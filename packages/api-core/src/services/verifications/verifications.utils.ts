/**
 * Utility functions for verifications service
 */

import type { Application } from '../../declarations'
import type { Verifications } from './verifications.schema'
import { logger } from '../../logger'

/**
 * Verify a token and return the verification record if valid
 */
export const verifyToken = async (
  app: Application,
  token: string,
  type?: Verifications['type']
): Promise<Verifications | null> => {
  try {
    // Trim token to handle any whitespace issues
    const trimmedToken = token?.trim()
    if (!trimmedToken) {
      logger.warn('Empty token provided to verifyToken')
      return null
    }
    
    const query: any = { token: trimmedToken, used: false }
    if (type) {
      query.type = type
    }
    
    const { data } = await app.service('verifications').find({ query })
    
    logger.info('Token verification lookup', {
      tokenPrefix: token.substring(0, 8) + '...',
      type,
      foundCount: data?.length || 0
    })
    
    if (!data || data.length === 0) {
      logger.warn('Token verification not found', {
        tokenPrefix: token.substring(0, 8) + '...',
        type
      })
      return null
    }
    
    const verification = data[0]
    
    // Check expiration - convert to number in case MongoDB returns it as a Date object
    const expiresAtRaw = verification.expiresAt
    const expiresAtType = typeof expiresAtRaw
    const expiresAt = expiresAtType === 'number' 
      ? expiresAtRaw 
      : new Date(expiresAtRaw).getTime()
    const now = Date.now()
    const timeRemaining = expiresAt - now
    const isExpired = expiresAt <= now
    
    logger.info('Token expiration check in verifyToken', {
      verificationId: String(verification._id),
      type: verification.type,
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
      used: verification.used
    })
    
    if (isExpired) {
      logger.info('Verification token expired', { 
        tokenPrefix: token.substring(0, 8) + '...',
        type: verification.type,
        verificationId: String(verification._id)
      })
      // Optionally mark as used or delete expired verification
      const verificationId = String(verification._id)
      await app.service('verifications').patch(verificationId, {
        used: true,
        usedAt: Date.now()
      })
      return null
    }
    
    return verification
  } catch (error) {
    logger.error('Error verifying token', {
      error: error instanceof Error ? error.message : 'Unknown error',
      token: token.substring(0, 8) + '...' // Log partial token for debugging
    })
    return null
  }
}

/**
 * Build verification link URL
 */
export const buildVerificationLink = (app: Application, type: Verifications['type'], token: string): string => {
  // Use clientHost from config, fallback to default
  const baseUrl = app.get('clientHost') || 'http://localhost:5173'
  const pathMap: Record<Verifications['type'], string> = {
    'magic-link': '/auth/magic-link',
    'password-reset': '/auth/reset-password',
    'invite': '/invite'
  }
  const path = pathMap[type] || '/verify'
  // URL encode the token to handle any special characters safely
  const encodedToken = encodeURIComponent(token)
  return `${baseUrl}${path}?token=${encodedToken}`
}

/**
 * Create a verification and return it (useful for programmatic access)
 */
export const createVerification = async (
  app: Application,
  data: {
    type: Verifications['type']
    email: string
    userId?: string
    expiresIn?: number
    metadata?: Record<string, any>
  }
): Promise<Verifications> => {
  return await app.service('verifications').create(data)
}

