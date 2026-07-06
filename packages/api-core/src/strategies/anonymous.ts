import { AuthenticationBaseStrategy } from '@feathersjs/authentication'
import type { Application } from '../declarations'

export class AnonymousStrategy extends AuthenticationBaseStrategy {
  async authenticate() {
    return {
      roles: ['anonymous']
    }
  }
}
