// For more information about this file see https://dove.feathersjs.com/guides/cli/service.class.html#database-services
import type { Params } from '@feathersjs/feathers'
import { MongoDBService } from '@feathersjs/mongodb'
import type { MongoDBAdapterParams, MongoDBAdapterOptions } from '@feathersjs/mongodb'

import type { Application } from '../../declarations'
import type {
  Verifications,
  VerificationsData,
  VerificationsPatch,
  VerificationsQuery
} from './verifications.schema'

export type { Verifications, VerificationsData, VerificationsPatch, VerificationsQuery }

export interface VerificationsParams extends MongoDBAdapterParams<VerificationsQuery> {}

// By default calls the standard MongoDB adapter service methods but can be customized with your own functionality.
export class VerificationsService<ServiceParams extends Params = VerificationsParams> extends MongoDBService<
  Verifications,
  VerificationsData,
  VerificationsParams,
  VerificationsPatch
> {}

export const getOptions = (app: Application): MongoDBAdapterOptions => {
  return {
    paginate: app.get('paginate'),
    Model: app.get('mongodbClient').then(db => db.collection('verifications'))
  }
}
