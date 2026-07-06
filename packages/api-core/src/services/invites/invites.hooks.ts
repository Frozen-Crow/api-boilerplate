/**
 * Hooks for the invites service
 */

import { Forbidden } from '@feathersjs/errors'
import type { HookContext } from '../../declarations'
import { logger } from '../../logger'
import { InviteType } from './invites.schema'

/**
 * Before-hook guarding external patches to invites.
 *
 * Invite "patch" is the acceptance/decline channel and is deliberately not run
 * through team access control (the accepting user is typically not yet a member
 * of the target organization). That makes it easy to abuse, so for external
 * callers we:
 *   - restrict writable fields to the status transition only, and
 *   - for email invites, require the caller's email to match the invitee, and
 *   - reject already-consumed or expired invites.
 */
export const guardInvitePatch = async (context: HookContext) => {
  // Internal calls (provider undefined) are trusted.
  if (!context.params.provider) {
    return context
  }

  const user = (context.params as any).user
  const data = context.data || {}

  // Only allow the status transition to be set from the outside. `updatedAt` is
  // included because the patch resolver sets it server-side before this hook runs.
  const allowedFields = ['status', 'acceptedAt', 'declinedAt', 'updatedAt']
  Object.keys(data).forEach((key) => {
    if (!allowedFields.includes(key)) {
      delete (data as any)[key]
    }
  })

  const status = (data as any).status
  if (status && !['accepted', 'declined'].includes(status)) {
    throw new Forbidden('Invalid invite status transition')
  }

  // No id (multi-patch) is never allowed externally for invites.
  if (context.id === null || context.id === undefined) {
    throw new Forbidden('Invite id is required')
  }

  const invite = (await context.app.service('invites').get(context.id, {
    provider: undefined
  } as any)) as any

  if (!invite) {
    throw new Forbidden('Invite not found')
  }

  if (status === 'accepted') {
    if (invite.status === 'accepted') {
      throw new Forbidden('Invite has already been accepted')
    }

    // Expiry check.
    if (invite.expiresAt && new Date(invite.expiresAt).getTime() <= Date.now()) {
      throw new Forbidden('This invite has expired')
    }

    // For targeted email invites, only the invited email may accept.
    if (invite.email) {
      if (!user?.email || String(user.email).toLowerCase() !== String(invite.email).toLowerCase()) {
        throw new Forbidden('This invite was issued to a different email address')
      }
    } else if (!user?._id) {
      // Link invites still require an authenticated user to accept.
      throw new Forbidden('Authentication required to accept an invite')
    }
  }

  return context
}

/**
 * Hook to create verification token for email and link invites
 * This runs after an invite is created successfully
 */
export const createVerificationForInvite = async (context: HookContext) => {
  const { result, app } = context

  // Only process if invite was created successfully
  if (!result || context.method !== 'create') {
    return context
  }

  const invite = result

  // Create verification token for email and link invites
  try {
    // Get inviter information
    let inviterName: string | undefined
    try {
      const inviter = await app.service('users').get(invite.userId, {
        query: {
          $select: ['firstName', 'lastName', 'email']
        }
      })
      if (inviter.firstName || inviter.lastName) {
        inviterName = [inviter.firstName, inviter.lastName].filter(Boolean).join(' ')
      } else {
        inviterName = inviter.email
      }
    } catch (error) {
      logger.warn('Failed to get inviter information', {
        userId: String(invite.userId),
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }

    // Get organization information
    let organizationName: string | undefined
    try {
      const organization = await app.service('organizations').get(invite.organizationId, {
        query: {
          $select: ['name']
        }
      })
      organizationName = organization.name
    } catch (error) {
      logger.warn('Failed to get organization information', {
        organizationId: String(invite.organizationId),
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }

    // Get role names for display
    let roleNames: string[] = []
    try {
      if (invite.scopes && invite.scopes.length > 0) {
        const rolePromises = invite.scopes.map(async (scopeId: string) => {
          try {
            const role = await app.service('roles').get(scopeId, {
              query: {
                $select: ['name']
              }
            })
            return role.name
          } catch (error) {
            return null
          }
        })
        const roles = await Promise.all(rolePromises)
        roleNames = roles.filter((name): name is string => name !== null)
      }
    } catch (error) {
      logger.warn('Failed to get role names', {
        scopes: invite.scopes,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }

    // Determine email for verification
    // For email invites, use the invite email
    // For link invites, we might not have an email, so we'll use a placeholder
    // The verification will still be created and the link can be shared
    const verificationEmail = invite.email || `invite-${invite._id}@placeholder.local`

    // Calculate expiration time
    // Use invite expiration if provided, otherwise default to 7 days for invites
    let expiresIn: number
    if (invite.expiresAt) {
      const expiresAtDate = new Date(invite.expiresAt).getTime()
      const now = Date.now()
      expiresIn = Math.max(expiresAtDate - now, 0)
    } else {
      // Default to 7 days for invites
      expiresIn = 7 * 24 * 60 * 60 * 1000
    }
    // Determine the ID safely
    const rawId = invite._id || (invite as any).id
    const safeInviteId = rawId ? String(rawId) : undefined

    const metadataToSave = {
      inviteId: safeInviteId,
      organizationId: String(invite.organizationId),
      resourceType: invite.resourceType,
      resourceId: String(invite.resourceId),
      scopes: invite.scopes,
      inviteType: invite.inviteType,
      inviterName: inviterName,
      organizationName: organizationName,
      role: roleNames[0] || 'Member'
    }

    logger.info('Creating verification for invite', {
      inviteKeys: Object.keys(invite),
      inviteId: invite._id,
      inviteIdString: String(invite._id)
    })

    const verification = await app.service('verifications').create({
      type: 'invite',
      email: verificationEmail,
      expiresIn: expiresIn,
      metadata: metadataToSave
    })

    logger.info('Verification token created for invite', {
      inviteId: String(invite._id),
      inviteType: invite.inviteType,
      verificationId: String(verification._id),
      email: verificationEmail,
      expiresIn: expiresIn / (1000 * 60 * 60) + ' hours'
    })

    // Attach verification token to invite result for immediate use (especially for link invites)
    // This allows the client to construct the invite link without needing to query for the verification
    if (!context.result.metadata) {
      context.result.metadata = {}
    }
    context.result.metadata.verificationToken = verification.token

  } catch (error) {
    logger.error('Failed to create verification for invite', {
      inviteId: String(invite._id),
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    })
    // Don't throw - invite was created successfully, verification failure shouldn't break the flow
    // But we should log it for monitoring
  }

  return context
}

/**
 * Hook to handle invite acceptance
 * When an invite is accepted, add the user to the organization
 */
export const handleInviteAcceptance = async (context: HookContext) => {
  const { data, result, app, method } = context

  // Only process patch operations where status is being changed to 'accepted'
  if (method !== 'patch' || data?.status !== 'accepted') {
    return context
  }

  // NOTE: precedence matters here. `result || context.id ? ... : ...` would
  // parse as `(result || context.id) ? ... : ...` and always re-fetch. We want
  // to prefer the already-loaded result and only fetch when it is absent.
  const invite = result || (context.id != null ? await app.service('invites').get(context.id) : null)

  if (!invite) {
    logger.warn('Invite not found for acceptance handling', {
      inviteId: context.id
    })
    return context
  }

  // Check removed: this is an after hook, so status WILL be accepted. 
  // Idempotency is handled by the member check below.

  try {
    // Get the user who is accepting the invite
    // For email/link invites, get user from context (they should be authenticated)
    const user = (context.params as any).user

    logger.info('Handling invite acceptance hook', {
      inviteId: String(invite._id),
      hasUser: !!user,
      userId: user?._id,
      contextParamsUser: !!(context.params as any).user
    })

    if (!user?._id) {
      logger.warn('No user found in context for invite acceptance', {
        inviteId: String(invite._id),
        inviteType: invite.inviteType,
        contextParams: Object.keys(context.params || {})
      })
      return context
    }

    const userId = String(user._id)

    // Add user to organization if not already a member
    if (invite.resourceType === 'organization' && invite.resourceId && invite.scopes && invite.scopes.length > 0) {
      try {
        const organization = await app.service('organizations').get(invite.resourceId, {
          provider: null,
          authentication: null,
          user: null
        } as any)

        // Check if user is already a member
        const isMember = organization.members?.some(
          (member: any) => String(member.userId) === userId
        )

        if (!isMember) {
          // Add user to organization with the specified role (use first scope)
          const currentMembers = organization.members || []
          await app.service('organizations').patch(invite.resourceId, {
            members: [
              ...currentMembers,
              {
                userId: user._id, // Store as ObjectId, not string
                role: invite.scopes[0], // Use first scope as the role
                joinedAt: Date.now()
              },
            ],
          }, {
            provider: null,
            authentication: null,
            user: null
          } as any)

          logger.info('User added to organization via invite acceptance', {
            userId,
            organizationId: String(invite.resourceId),
            inviteId: String(invite._id),
            role: invite.scopes[0]
          })

          // Update the user's active organization if they don't have one set
          // OR even if they do, we set this one as active since they just accepted it?
          // For now, let's set it as active.
          await app.service('users').patch(userId, {
            activeOrganization: invite.resourceId,
            organizationId: invite.resourceId
          }, { provider: undefined })
        } else {
          logger.info('User already a member of organization', {
            userId,
            organizationId: String(invite.resourceId),
            inviteId: String(invite._id)
          })
        }
      } catch (orgError) {
        logger.error('Failed to add user to organization during invite acceptance', {
          userId,
          organizationId: String(invite.resourceId),
          inviteId: String(invite._id),
          error: orgError instanceof Error ? orgError.message : 'Unknown error'
        })
        // Don't throw - invite acceptance should still succeed even if org update fails
      }
    }

  } catch (error) {
    logger.error('Failed to handle invite acceptance', {
      inviteId: String(invite._id),
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    })
    // Don't throw - the invite status update should still succeed
  }

  return context
}

