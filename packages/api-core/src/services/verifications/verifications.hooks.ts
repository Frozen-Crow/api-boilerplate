/**
 * Hooks for the verifications service
 */

import { randomBytes } from 'crypto'
import { BadRequest } from '@feathersjs/errors'
import type { HookContext } from '../../declarations'
import { logger } from '../../logger'
import { sendTemplatedEmail } from '../../utils/email-templates'
import { buildVerificationLink } from './verifications.utils'

/**
 * Restrict what external (REST/socket) callers may create.
 *
 * The verifications service is intentionally reachable anonymously so it can
 * power self-service "forgot password" and "magic link" flows. Everything else
 * (invite verifications) is created server-side with `provider: undefined`.
 *
 * For external callers we therefore:
 *   - only permit the two self-service types, and
 *   - drop any client-supplied `metadata` (which is rendered into outbound
 *     emails and could otherwise be used for phishing).
 */
export const restrictExternalVerificationCreate = async (context: HookContext) => {
  // Internal calls (no provider) are trusted.
  if (!context.params.provider) {
    return context
  }

  const allowedTypes = ['magic-link', 'password-reset']
  const type = context.data?.type

  if (!allowedTypes.includes(type)) {
    throw new BadRequest('Unsupported verification type')
  }

  // Never let external callers control server-managed / trust-sensitive fields.
  delete context.data.metadata
  delete context.data.token
  delete context.data.used
  delete context.data.usedAt

  return context
}

/**
 * Generate a secure random token
 */
const generateToken = (): string => {
  return randomBytes(32).toString('hex')
}

/**
 * Format expiration date for email display
 */
const formatExpirationDate = (expiresAt: number): string => {
  return new Date(expiresAt).toLocaleString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short'
  })
}

/**
 * Hook to generate token and set expiration before creating verification
 */
export const generateVerificationToken = async (context: HookContext) => {
  const { data } = context

  // Generate secure token
  data.token = generateToken()

  // Set expiration (default 1 hour, or use provided expiresIn)
  const expiresIn = data.expiresIn || 60 * 60 * 1000 // 1 hour in milliseconds
  const now = Date.now()
  data.expiresAt = now + expiresIn

  // Set defaults
  data.used = false
  data.createdAt = now
  data.updatedAt = now

  logger.info('Verification token generated', {
    type: data.type,
    email: data.email,
    tokenPrefix: data.token.substring(0, 8) + '...',
    expiresIn,
    expiresAt: data.expiresAt,
    expiresAtType: typeof data.expiresAt,
    expiresAtDate: new Date(data.expiresAt).toISOString(),
    createdAt: data.createdAt,
    createdAtDate: new Date(data.createdAt).toISOString(),
    expiresInHours: expiresIn / (1000 * 60 * 60)
  })

  return context
}

/**
 * Hook to send email after verification is created
 */
export const sendVerificationEmail = async (context: HookContext) => {
  const { result, app, data } = context

  // Don't send email if verification already exists (patch operation)
  if (!result || context.method !== 'create') {
    return context
  }

  try {
    const verification = result
    const verificationLink = buildVerificationLink(app, verification.type, verification.token)
    const expiresAt = formatExpirationDate(verification.expiresAt)

    // Send email based on verification type
    switch (verification.type) {
      case 'magic-link': {
        const appName = app.get('appName') || 'App'
        await sendTemplatedEmail(
          verification.email,
          'notification',
          {
            title: `Sign in to ${appName}`,
            content: `<p>Click the button below to sign in to your ${appName} account:</p><p style="font-size: 14px; color: #6b7280;">This link will expire on ${expiresAt}.</p>`,
            actionLink: verificationLink,
            actionText: 'Sign In'
          },
          app,
          {
            subject: `Sign in to ${appName}`
          }
        )
        break
      }

      case 'password-reset': {
        await sendTemplatedEmail(
          verification.email,
          'password-reset',
          {
            resetLink: verificationLink,
            expiresAt: expiresAt
          },
          app
        )
        break
      }

      case 'invite': {
        const metadata = verification.metadata || {}
        const inviteType = metadata.inviteType

        // Skip email sending for link invites (they don't have a specific email recipient)
        // Link invites are shared via the invite code/link directly
        if (inviteType === 'link') {
          logger.info('Skipping email send for link invite', {
            verificationId: String(verification._id),
            inviteId: metadata.inviteId,
            inviteCode: metadata.inviteCode
          })
          break
        }

        // For email invites, send the invitation email
        const inviterName = metadata.inviterName
        const organizationName = metadata.organizationName
        const role = metadata.role

        await sendTemplatedEmail(
          verification.email,
          'invitation',
          {
            inviterName,
            organizationName,
            role,
            invitationLink: verificationLink,
            expiresAt: expiresAt
          },
          app
        )
        break
      }

      default:
        logger.warn(`Unknown verification type: ${verification.type}`)
    }

    logger.info(`Verification email sent for ${verification.type} to ${verification.email}`)
  } catch (error) {
    logger.error('Failed to send verification email', {
      error: error instanceof Error ? error.message : 'Unknown error',
      verificationId: result._id,
      type: result.type,
      email: result.email
    })
    // Don't throw - verification was created successfully, email failure shouldn't break the flow
  }

  return context
}

/**
 * Hook to mark verification as used
 */
export const markVerificationAsUsed = async (context: HookContext) => {
  const { result, app } = context

  if (!result || result.used) {
    return context
  }

  // Update verification to mark as used
  await app.service('verifications').patch(result._id, {
    used: true,
    usedAt: Date.now(),
    updatedAt: Date.now()
  })

  return context
}

/**
 * Hook to handle password reset via patch operation
 * When patching with password field and token, it resets the user's password
 * This is an around hook that intercepts the patch call
 */
export const handlePasswordReset = async (context: HookContext, next?: () => Promise<any>) => {
  const { data, app, params, id } = context

  // Check if this is a password reset operation (has password, token, and no ID)
  if (!data?.password || !data?.token || id !== null) {
    // Not a password reset, proceed with normal patch
    if (next) {
      return next()
    }
    return context
  }

  // This is a password reset operation - handle it here and skip normal patch
  let { token, password } = data

  // Trim token to handle any whitespace issues from URL extraction
  token = token?.trim()

  if (!token) {
    throw new Error('Invalid or expired reset token')
  }

  logger.info('Password reset request received', {
    tokenPrefix: token.substring(0, 8) + '...',
    tokenLength: token.length,
    hasPassword: !!password
  })

  // Find the verification - explicitly exclude used tokens and ensure exact token match
  // Use exact match query - MongoDB will do case-sensitive string comparison
  logger.info('Querying for token', {
    tokenPrefix: token.substring(0, 8) + '...',
    tokenLength: token.length,
    queryParams: {
      token: token.substring(0, 8) + '...',
      type: 'password-reset',
      used: false
    }
  })

  // Build query explicitly - don't pass params through as it's unsafe
  // Only query for what we need: exact token match, password-reset type, and unused
  const { data: verifications } = await app.service('verifications').find({
    query: {
      token: token, // Exact match
      type: 'password-reset',
      used: false,
    }
  })

  logger.info('Password reset token lookup result', {
    tokenPrefix: token.substring(0, 8) + '...',
    fullTokenLength: token.length,
    foundCount: verifications?.length || 0,
    verifications: verifications?.map(v => ({
      _id: String(v._id),
      email: v.email,
      used: v.used,
      tokenMatch: v.token === token,
      tokenLength: v.token?.length,
      tokenPrefix: v.token?.substring(0, 8) + '...',
      tokenFirstChars: v.token?.substring(0, 20),
      tokenLastChars: v.token?.substring(v.token.length - 20),
      expiresAt: v.expiresAt,
      expiresAtType: typeof v.expiresAt,
      createdAt: v.createdAt
    }))
  })

  if (!verifications || verifications.length === 0) {
    logger.warn('Password reset token not found or already used', {
      tokenPrefix: token?.substring(0, 8) + '...'
    })
    throw new Error('Invalid or expired reset token')
  }

  // Find the exact token match (in case query returned multiple results)
  // Also double-check it's not used (defensive check)
  const verification = verifications.find(v => v.token === token && !v.used)

  if (!verification) {
    logger.warn('Password reset token not found in results or already used', {
      tokenPrefix: token?.substring(0, 8) + '...',
      foundCount: verifications.length,
      allUsed: verifications.every(v => v.used),
      tokenMatches: verifications.filter(v => v.token === token).length
    })
    throw new Error('Invalid or expired reset token')
  }

  // Check expiration - convert to number in case MongoDB returns it as a Date object
  const expiresAtRaw = verification.expiresAt
  const expiresAtType = typeof expiresAtRaw
  const expiresAt = expiresAtType === 'number'
    ? expiresAtRaw
    : new Date(expiresAtRaw).getTime()
  const now = Date.now()
  const timeRemaining = expiresAt - now
  const isExpired = expiresAt <= now

  logger.info('Password reset token expiration check', {
    verificationId: String(verification._id),
    email: verification.email,
    expiresAtRaw,
    expiresAtType,
    expiresAt,
    now,
    isExpired,
    timeRemaining,
    timeRemainingHours: timeRemaining / (1000 * 60 * 60),
    expiresAtDate: new Date(expiresAt).toISOString(),
    nowDate: new Date(now).toISOString(),
    used: verification.used,
    createdAt: verification.createdAt
  })

  if (isExpired) {
    logger.warn('Password reset token expired - marking as used', {
      verificationId: String(verification._id),
      email: verification.email,
      expiresAt,
      now,
      timeRemaining,
      timeRemainingHours: timeRemaining / (1000 * 60 * 60)
    })
    // Mark as used
    const verificationId = String(verification._id)
    await app.service('verifications').patch(verificationId, {
      used: true,
      usedAt: Date.now(),
    })
    throw new Error('This password reset link has expired. Please request a new one.')
  }

  logger.info('Password reset token is valid, proceeding with password reset', {
    verificationId: String(verification._id),
    email: verification.email,
    timeRemaining,
    timeRemainingHours: timeRemaining / (1000 * 60 * 60)
  })

  // Find user by email
  const { data: users } = await app.service('users').find({
    query: {
      email: verification.email,
    },
  })

  if (!users || users.length === 0) {
    throw new Error('User not found')
  }

  const user = users[0]

  // Update user password (this is done server-side, so no auth needed)
  const userId = String(user._id)
  await app.service('users').patch(userId, {
    password: password,
  })

  // Mark verification as used
  const verificationId = String(verification._id)
  await app.service('verifications').patch(verificationId, {
    used: true,
    usedAt: Date.now(),
    updatedAt: Date.now(),
  })

  logger.info('Password reset completed successfully', {
    verificationId,
    userId: String(user._id),
    email: verification.email
  })

  // Replace the result with success message
  // We've handled everything, so don't call next() - this prevents the normal patch
  context.result = {
    success: true,
    message: 'Password reset successful'
  }

  return context
}

