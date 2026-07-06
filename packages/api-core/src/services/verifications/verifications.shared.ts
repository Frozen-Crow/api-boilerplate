// For more information about this file see https://dove.feathersjs.com/guides/cli/service.shared.html
import type { Params } from '@feathersjs/feathers'
import type { ClientApplication } from '../../client'
import type {
  Verifications,
  VerificationsData,
  VerificationsPatch,
  VerificationsQuery,
  VerificationsService
} from './verifications.class'

export type { Verifications, VerificationsData, VerificationsPatch, VerificationsQuery }

export type VerificationsClientService = Pick<
  VerificationsService<Params<VerificationsQuery>>,
  (typeof verificationsMethods)[number]
>

export const verificationsPath = 'verifications'

export const verificationsMethods: Array<keyof VerificationsService> = [
  'find',
  'get',
  'create',
  'patch',
  'remove'
]

export const verificationsClient = (client: ClientApplication) => {
  const connection = client.get('connection')

  client.use(verificationsPath, connection.service(verificationsPath), {
    methods: verificationsMethods
  })
}

// Add this service to the client service type index
declare module '../../client' {
  interface ServiceTypes {
    [verificationsPath]: VerificationsClientService
  }
}
