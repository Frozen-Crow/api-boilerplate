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
 * Builds entity data from a GoogleProfile for database storage
 * @param profile - The GoogleProfile object
 * @param baseData - Base data from parent class
 * @returns Entity data object for database storage
 */
export function buildGoogleEntityData(profile: GoogleProfile, baseData: any) {
  return {
    ...baseData,
    // Basic profile info
    firstName: profile.given_name,
    lastName: profile.family_name,

    // Contact info
    email: profile.email,
    googleEmail: profile.email,
    emailVerified: profile.email_verified || false,

    // Profile details
    profilePicture: profile.picture,

    // Google-specific fields
    googleId: profile.sub,
    hostedDomain: profile.hd, // G Suite domain
    oauthVerified: profile.email_verified || false,
  }
}
