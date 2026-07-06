import type { Params } from '@feathersjs/feathers'
import { MongoDBService } from '@feathersjs/mongodb'
import type { MongoDBAdapterParams, MongoDBAdapterOptions } from '@feathersjs/mongodb'

import type { Application } from '../../declarations'
import type { RolesData, RolesNewData, RolesPatch, RolesQuery } from './roles.schema'

export type { RolesData, RolesNewData, RolesPatch, RolesQuery }

export interface RolesParams extends MongoDBAdapterParams<RolesQuery> { }

export class Roles<ServiceParams extends Params = RolesParams> extends MongoDBService<
    RolesData,
    RolesNewData,
    ServiceParams,
    RolesPatch
> { }

export const getOptions = (app: Application): MongoDBAdapterOptions => {
    return {
        paginate: app.get('paginate'),
        Model: app.get('mongodbClient').then((db) => db.collection('roles'))
    }
}
