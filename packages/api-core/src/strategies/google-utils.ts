import { TokenPayload } from 'google-auth-library'

export interface GoogleProfile {
  // Basic profile info
  sub: string
  name: string
  given_name: string
  family_name: string
  middle_name?: string
  nickname?: string

  // Contact info
  email: string
  email_verified: boolean

  // Profile details
  picture?: string
  locale?: string
  gender?: string
  birthdate?: string
  phone_number?: string
  phone_number_verified?: boolean

  // Address info
  address?: {
    formatted?: string
    street_address?: string
    locality?: string
    region?: string
    postal_code?: string
    country?: string
  }

  // Additional fields
  hd?: string // Hosted domain (for G Suite users)
  azp?: string // Authorized party
  aud?: string // Audience
  iss?: string // Issuer
  iat?: number // Issued at
  exp?: number // Expires at

  // Custom fields
  oauthVerified?: boolean
}

/**
 * Builds a GoogleProfile from a Google OAuth payload
 * @param payload - The Google OAuth token payload
 * @returns GoogleProfile object with all available fields
 */
export function buildGoogleProfile(payload: TokenPayload): GoogleProfile {
  const extendedPayload = payload as any

  return {
    // Basic profile info
    sub: payload.sub || '',
    name: payload.name || '',
    given_name: payload.given_name || '',
    family_name: payload.family_name || '',
    middle_name: extendedPayload.middle_name,
    nickname: extendedPayload.nickname,

    // Contact info
    email: payload.email || '',
    email_verified: payload.email_verified || false,

    // Profile details
    picture: payload.picture,
    locale: payload.locale,
    gender: extendedPayload.gender,
    birthdate: extendedPayload.birthdate,
    phone_number: extendedPayload.phone_number,
    phone_number_verified: extendedPayload.phone_number_verified,

    // Address info (if available)
    address: extendedPayload.address ? {
      formatted: extendedPayload.address.formatted,
      street_address: extendedPayload.address.street_address,
      locality: extendedPayload.address.locality,
      region: extendedPayload.address.region,
      postal_code: extendedPayload.address.postal_code,
      country: extendedPayload.address.country
    } : undefined,

    // Additional fields
    hd: payload.hd,
    azp: payload.azp,
    aud: payload.aud,
    iss: payload.iss,
    iat: payload.iat,
    exp: payload.exp
  }
}

/**
 * Extract a bearer access token from a set of request headers.
 *
 * Used to resolve the *currently authenticated* user in the OAuth flows
 * directly from the original request's `Authorization: Bearer <jwt>` header,
 * which is more reliable than depending on `params.authentication` (which can be
 * absent or repurposed to the OAuth request body by the time a strategy runs).
 *
 * @param headers - The request headers (case-insensitive `authorization`)
 * @returns The bearer token, or `null` when absent/malformed
 */
export function extractBearerToken(headers: any): string | null {
  if (!headers) {
    return null
  }
  const raw = headers.authorization ?? headers.Authorization
  if (typeof raw !== 'string') {
    return null
  }
  const match = raw.match(/^\s*Bearer\s+(.+?)\s*$/i)
  return match ? match[1] : null
}

/**
 * Builds entity data from a GoogleProfile for database storage.
 *
 * The `existing` argument makes this update-aware. On a first-time **create**
 * (`existing` null) the account's identity is seeded from the Google profile.
 * On an **update** — a returning login matched by googleId, or linking Google to
 * the account you're logged in as — we deliberately do NOT overwrite the
 * account's primary `email` (that is its local-login identity, and blindly
 * overwriting it lets a Google identity hijack or clobber another account's
 * login) and never *downgrade* its verified status — verification only ever
 * moves up. Non-authoritative fields (name, picture, googleEmail, googleId,
 * hostedDomain) are always refreshed from the profile.
 *
 * @param profile - The GoogleProfile object
 * @param baseData - Base data from the parent strategy (contains `googleId`)
 * @param existing - The existing entity when updating/linking, else null
 * @returns Entity data object for database storage
 */
export function buildGoogleEntityData(profile: GoogleProfile, baseData: any, existing: any = null) {
  const data: any = {
    ...baseData,
    // Non-authoritative fields — always synced from the Google profile.
    firstName: profile.given_name,
    lastName: profile.family_name,
    googleEmail: profile.email,
    profilePicture: profile.picture,
    googleId: profile.sub,
    hostedDomain: profile.hd // G Suite domain
  }

  if (existing) {
    // Returning login / linking: keep the account's primary email, only ever
    // upgrade verified status (never true -> false).
    if (profile.email_verified) {
      data.emailVerified = true
      data.oauthVerified = true
    }
  } else {
    // First-time account creation: seed identity from the Google profile.
    data.email = profile.email
    data.emailVerified = profile.email_verified || false
    data.oauthVerified = profile.email_verified || false
  }

  return data
}
