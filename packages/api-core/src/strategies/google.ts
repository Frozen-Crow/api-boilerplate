import querystring from 'qs'
import { oauth, OAuthStrategy } from '@feathersjs/authentication-oauth'
import { OAuth2Client, TokenPayload } from 'google-auth-library'
import { NotAuthenticated, Conflict } from '@feathersjs/errors'
import { Params } from '@feathersjs/feathers'
import { AuthenticationRequest } from '@feathersjs/authentication'
import type { Application } from '../declarations'
import { GoogleProfile, buildGoogleProfile, buildGoogleEntityData, extractBearerToken } from './google-utils'

export class GoogleStrategy extends OAuthStrategy {
  async getEntityData(profile: GoogleProfile, existing: any, params: any) {
    const baseData = await super.getEntityData(profile, existing, { ...params, provider: null })
    // The base OAuthStrategy stamps an id keyed by the strategy *name*
    // (`${this.name}Id`). For the One Tap strategy that is `google-one-tapId`,
    // a stray key the strict users validator rejects (400 additionalProperty).
    // buildGoogleEntityData writes the canonical `googleId` itself, so drop the
    // base's provider-named key.
    if (this.name) {
      delete (baseData as any)[`${this.name}Id`]
    }
    return buildGoogleEntityData(profile, baseData, existing)
  }

  async getEntityQuery(profile: GoogleProfile, params: any) {
    return {
      googleId: profile.sub
    }
  }

  async findEntity(profile: GoogleProfile, params: any) {
    if (typeof profile.sub === "undefined") { return null }
    const query = await this.getEntityQuery(profile, params)
    const result = await this.entityService.find({
      ...params,
      provider: null,
      query
    })
    const [entity = null] = result.data ? result.data : result
    return entity
  }

  async getProfile(data: AuthenticationRequest, _params: Params): Promise<any> {
    if (data.code) {
      const oauthConfig = (this.authentication?.configuration as any)?.oauth || {}
      const googleConfig = oauthConfig?.google || {}
      const app = this.authentication?.app
      const host = app?.get('apiHost') || 'http://localhost'
      const redirectUri = `${host}/oauth/google/callback`

      const client = new OAuth2Client(
        googleConfig.key,
        googleConfig.secret,
        redirectUri
      )

      try {
        const { tokens } = await client.getToken(data.code)
        data.accessToken = tokens.access_token
      } catch (error: any) {
        throw new NotAuthenticated(`Failed to exchange code for token: ${error.message}`)
      }
    }

    if (data.profile) {
      return data.profile
    }
    if (data.accessToken) {
      try {
        // get profile from google
        const profile = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: {
            Authorization: `Bearer ${data.accessToken}`
          }
        })
          .then(res => res.json())
          .catch(err => {
            throw new NotAuthenticated(`Failed to get profile: ${err.message}`)
          })

        if (!profile || profile.error || !profile.sub) {
          throw new NotAuthenticated('Could not retrieve profile with provided access token')
        }

        return profile
      } catch (error: any) {
        throw new NotAuthenticated(`Failed to get profile: ${error.message}`)
      }
    }
    throw new NotAuthenticated('No profile or access token provided')
  }

  async getRedirect(authResult: any, params: any) {
    const oauthConfig = (this.authentication?.configuration as any)?.oauth || {}
    const redirectConfig = oauthConfig?.redirect || {}
    const success = redirectConfig?.success || 'http://localhost:5174/auth/success'
    const error = redirectConfig?.error || 'http://localhost:5174/auth/error'
    const queryRedirect = (params && params.redirect) || ''
    let redirect: string, qs = '', query: any = false
    if (authResult instanceof Error) {
      redirect = error
      // Propagate a typed error code (e.g. `google-account-exists`) so a
      // redirect-flow client can branch on it, not just the message.
      const errorCode = (authResult as any).data?.code
      query = errorCode ? { error: authResult.message, code: errorCode } : { error: authResult.message }
    } else if (authResult.accessToken) {
      redirect = success
    } else {
      redirect = error
    }
    const redirectUrl = redirect
    const separator = redirect.endsWith('?') ? '' : '?'
    if (!query) {
      if (authResult.user.oauthVerified && authResult.accessToken) {
        query = { accessToken: authResult.accessToken }
      } else if (!authResult.accessToken) {
        query = { error: authResult.message || 'Google Auth Failed' }
      }
    }
    if (queryRedirect.length) {
      query.redirect = queryRedirect
    }
    if (Object.keys(query).length) {
      qs = separator + querystring.stringify(query)
    }
    return redirectUrl + qs
  }

  /**
   * Resolve the *currently authenticated* user for the "link a provider to the
   * account I'm logged in as" flow.
   *
   * The base `OAuthStrategy.getCurrentEntity` reads `params.authentication`, which
   * is unreliable in the One Tap / token flows: it is frequently absent (null),
   * and if it *were* present naming this OAuth strategy the base would re-enter
   * this strategy (recursion) instead of resolving a logged-in user. So we:
   *   1. defer to the base resolution when `params.authentication` names a
   *      non-OAuth (token) strategy — this honours a consumer's configured
   *      `linkStrategy`, e.g. the standard redirect link flow;
   *   2. otherwise resolve the current user from the raw `Authorization: Bearer`
   *      header, verified via the `jwt` strategy — this is what makes One Tap
   *      "link while logged in" work, where `params.authentication` is absent.
   * Only a genuine auth failure (`NotAuthenticated`) counts as "no current user";
   * unexpected errors propagate rather than silently creating a duplicate.
   */
  async getCurrentEntity(params: any) {
    const auth = this.authentication
    if (!auth) {
      return null
    }
    const { entity } = this.configuration
    const current = params?.authentication
    const isOAuthStrategy =
      current?.strategy === this.name || current?.strategy === 'google' || current?.strategy === 'google-one-tap'

    // 1) Standard param-based resolution (honours a configured linkStrategy),
    //    unless it would recurse back into an OAuth strategy.
    if (current?.strategy && !isOAuthStrategy) {
      try {
        const base = await super.getCurrentEntity(params)
        if (base) {
          return base
        }
      } catch (err) {
        if (!(err instanceof NotAuthenticated)) {
          throw err
        }
      }
    }

    // 2) One Tap / token flows: params.authentication is absent — resolve the
    //    current user from the Authorization header.
    const accessToken = extractBearerToken(params?.headers)
    if (!accessToken) {
      return null
    }
    try {
      const authResult = await auth.authenticate(
        { strategy: 'jwt', accessToken },
        { ...params, provider: undefined },
        'jwt'
      )
      return (authResult && authResult[entity]) || null
    } catch (err) {
      if (err instanceof NotAuthenticated) {
        return null
      }
      throw err
    }
  }

  /**
   * Shared account-resolution pipeline for both the redirect and One Tap flows:
   *   1. match by `googleId` (returning Google user),
   *   2. else the currently-logged-in user (link a provider to my account),
   *   3. else, if an account already exists for this verified email, refuse to
   *      silently create a duplicate / trip a unique-index E11000 — surface a
   *      typed 409 so the client can drive a link/confirm flow,
   *   4. else create a fresh account.
   */
  protected async resolveGoogleEntity(profile: GoogleProfile, params: any) {
    const existingEntity = (await this.findEntity(profile, params)) || (await this.getCurrentEntity(params))

    // Update/link: buildGoogleEntityData (update-aware) preserves the account's
    // primary email and only upgrades verified status, so linking cannot hijack
    // or clobber the login identity — no separate email-collision check needed.
    if (existingEntity) {
      return this.updateEntity(existingEntity, profile, { ...params, user: existingEntity, provider: null })
    }

    await this.assertNoEmailCollision(profile, params)

    return this.createEntity(profile, { ...params, provider: null })
  }

  /**
   * When no account matches by `googleId` and there is no logged-in user to link
   * to, block creating a second account for an email that already exists. Only
   * enforced for Google-verified emails (an unverified Google email is not proof
   * of ownership and must not be able to probe which emails have accounts).
   */
  protected async assertNoEmailCollision(profile: GoogleProfile, params: any) {
    if (!profile.email || !profile.email_verified) {
      return
    }
    const result: any = await this.entityService.find({
      ...params,
      provider: null,
      query: { email: profile.email, $limit: 1 }
    })
    const [existing = null] = result.data ? result.data : result
    if (existing) {
      throw new Conflict('An account already exists for this email address.', {
        code: 'google-account-exists',
        email: profile.email
      })
    }
  }

  async authenticate(authentication: any, params: any) {
    const { entity } = this.configuration
    const profile = (await this.getProfile(authentication, params)) as GoogleProfile
    const authEntity = await this.resolveGoogleEntity(profile, params)
    return {
      authentication: { strategy: this.name || 'google' },
      [entity]: authEntity
    }
  }
}

export class GoogleOneTapStrategy extends GoogleStrategy {
  /**
   * Cryptographically verify a One Tap `credential` (a Google ID token) against
   * this app's client id and return the resulting profile. Isolated so it can be
   * overridden in tests without hitting Google.
   */
  protected async verifyCredential(credential: string): Promise<GoogleProfile> {
    const oauthConfig = (this.authentication?.configuration as any)?.oauth || {}
    const googleConfig = oauthConfig?.google || {}
    const client = new OAuth2Client(googleConfig.key || '')
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: googleConfig.key || ''
    })
    const payload = ticket.getPayload()
    if (!payload) {
      throw new NotAuthenticated('Invalid Google token')
    }
    return buildGoogleProfile(payload)
  }

  async authenticate(authentication: any, params: any) {
    const { entity } = this.configuration
    const profile = await this.verifyCredential(authentication.credential)
    const authEntity = await this.resolveGoogleEntity(profile, params)
    return {
      authentication: { strategy: this.name || 'google-one-tap' },
      [entity]: authEntity
    }
  }
}
