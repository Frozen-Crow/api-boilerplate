import querystring from 'qs'
import { oauth, OAuthStrategy } from '@feathersjs/authentication-oauth'
import { OAuth2Client, TokenPayload } from 'google-auth-library'
import { NotAuthenticated } from '@feathersjs/errors'
import { Params } from '@feathersjs/feathers'
import { AuthenticationRequest } from '@feathersjs/authentication'
import type { Application } from '../declarations'
import { GoogleProfile, buildGoogleProfile, buildGoogleEntityData } from './google-utils'

export class GoogleStrategy extends OAuthStrategy {
  async getEntityData(profile: GoogleProfile, existing: any, params: any) {
    const baseData = await super.getEntityData(profile, existing, { ...params, provider: null })
    return buildGoogleEntityData(profile, baseData)
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
      query = { error: authResult.message }
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

  async authenticate(authentication: any, params: any) {
    const entity = super.configuration.entity
    const profile = await this.getProfile(authentication, params) as GoogleProfile
    const existingEntity = await this.findEntity(profile, params)
      || await super.getCurrentEntity(params)
    if (existingEntity) {
      profile.oauthVerified = typeof existingEntity.oauthVerified !== "undefined" ? existingEntity.oauthVerified : false
    } else {
      profile.oauthVerified = true
    }
    const authEntity = !existingEntity ? await super.createEntity(profile, { ...params, provider: null })
      : await super.updateEntity(existingEntity, profile, { ...params, provider: null })
    return {
      authentication: { strategy: this.name || 'google' },
      [entity]: authEntity
    }
  }
}

export class GoogleOneTapStrategy extends GoogleStrategy {
  async authenticate(authentication: any, params: any) {
    const entity = super.configuration.entity
    const oauthConfig = (this.authentication?.configuration as any)?.oauth || {}
    const googleConfig = oauthConfig?.google || {}
    const client = new OAuth2Client(googleConfig.key || '')
    const ticket = await client.verifyIdToken({
      idToken: authentication.credential,
      audience: googleConfig.key || '',
    })
    const payload = ticket.getPayload()
    if (!payload) {
      throw new NotAuthenticated('Invalid Google token')
    }
    const profile = buildGoogleProfile(payload)
    const existingEntity = await this.findEntity(profile, params)
      || await super.getCurrentEntity(params)
    if (existingEntity) {
      profile.oauthVerified = typeof existingEntity.oauthVerified !== "undefined" ? existingEntity.oauthVerified : false
    } else {
      profile.oauthVerified = true
    }
    const authEntity = !existingEntity ? await super.createEntity(profile, { ...params, provider: null })
      : await super.updateEntity(existingEntity, profile, { ...params, user: existingEntity, provider: null })
    return {
      authentication: { strategy: this.name || 'google-one-tap' },
      [entity]: authEntity
    }
  }
}
