import { generateDefaultHooks } from '@frozencrow/api-core'
import type { Application } from '@frozencrow/api-core'

import { WidgetService, getOptions } from './widgets.class'
import {
  widgetDataValidator,
  widgetPatchValidator,
  widgetQueryValidator,
  widgetResolver,
  widgetExternalResolver,
  widgetDataResolver,
  widgetPatchResolver,
  widgetQueryResolver
} from './widgets.schema'

export const widgetPath = 'widgets'
export const widgetMethods = ['find', 'get', 'create', 'patch', 'remove'] as const

// Register the service's types with the core so `app.use('widgets', ...)` and
// `app.service('widgets')` are fully typed. This is how you extend the core's
// service map from a consumer app. (Type-only declaration — erased at build.)
declare module '@frozencrow/api-core/lib/declarations' {
  interface ServiceTypes {
    widgets: WidgetService
  }
}

// Registering a custom service is the same three steps for every resource:
//  1. app.use(path, new Service(...))
//  2. generateDefaultHooks({ schema, ... }) — brings JWT auth, multitenant
//     teamAccessControl (permission `widgets:<method>`), validation, resolvers,
//     virtual-prop discarding, and error logging.
//  3. app.service(path).hooks(...)
export const widgets = (app: Application) => {
  app.use(widgetPath, new WidgetService(getOptions(app)), {
    methods: [...widgetMethods],
    events: []
  })

  app.service(widgetPath).hooks(
    generateDefaultHooks({
      schema: {
        dataValidator: widgetDataValidator,
        patchValidator: widgetPatchValidator,
        queryValidator: widgetQueryValidator,
        dataResolver: widgetDataResolver,
        patchResolver: widgetPatchResolver,
        queryResolver: widgetQueryResolver,
        externalResolver: widgetExternalResolver,
        resultResolver: widgetResolver
      }
    })
  )
}
