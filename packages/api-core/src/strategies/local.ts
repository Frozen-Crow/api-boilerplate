import { AuthenticationBaseStrategy, JWTStrategy } from '@feathersjs/authentication'
import { NotAuthenticated } from '@feathersjs/errors'
import type { Application } from '../declarations'

export class CustomJWTStrategy extends JWTStrategy {
  async getEntity(id: string, params: any) { 
    const entityService = this.entityService 
    const { entity } = this.configuration 
  
    if (entityService === null) { 
      throw new NotAuthenticated('Could not find entity service') 
    } 
  
    // Add timeout to prevent hanging
    const getEntityPromise = (async () => {
      const query = await this.getEntityQuery(params) 
      const getParams = Object.assign({}, { ...params, provider: null }, { query }) 
      return entityService.get(id, getParams)
    })()
    
    // Set a 5-second timeout for entity retrieval
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('JWT entity retrieval timed out')), 5000)
    )
    
    return Promise.race([getEntityPromise, timeoutPromise])
  } 
}

export class ApiKeyStrategy extends AuthenticationBaseStrategy {
  app: Application

  constructor(app: Application) {
    super()
    this.app = app
  }

  async authenticate(authentication: any) {
    const { token } = authentication
    const config = this.app.get('authentication') as any
    const apiKeyConfig = config['api-key']

    if (!apiKeyConfig?.allowedKeys?.includes(token)) {
      throw new NotAuthenticated('Incorrect API Key')
    }

    return {
      "api-key": true
    }
  }
}
