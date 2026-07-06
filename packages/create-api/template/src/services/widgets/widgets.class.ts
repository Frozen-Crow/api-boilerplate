import type { Params } from '@feathersjs/feathers'
import { MongoDBService } from '@feathersjs/mongodb'
import type { MongoDBAdapterParams, MongoDBAdapterOptions } from '@feathersjs/mongodb'
import type { Application } from '@frozencrow/api-core'

import type { Widget, WidgetData, WidgetPatch, WidgetQuery } from './widgets.schema'

export interface WidgetParams extends MongoDBAdapterParams<WidgetQuery> {}

export class WidgetService<ServiceParams extends Params = WidgetParams> extends MongoDBService<
  Widget,
  WidgetData,
  WidgetParams,
  WidgetPatch
> {}

export const getOptions = (app: Application): MongoDBAdapterOptions => {
  return {
    paginate: app.get('paginate'),
    Model: (app.get('mongodbClient') as Promise<any>).then((db) => db.collection('widgets'))
  }
}
