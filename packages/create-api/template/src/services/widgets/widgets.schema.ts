import { resolve } from '@feathersjs/schema'
import { Type, getValidator, querySyntax, ObjectIdSchema } from '@feathersjs/typebox'
import type { Static } from '@feathersjs/typebox'
import { dataValidator, queryValidator } from '@frozencrow/api-core'
import type { HookContext } from '@frozencrow/api-core'

// A minimal multitenant resource. `organizationId` scopes it to the caller's
// active organization — that is enforced automatically by teamAccessControl
// (wired in via generateDefaultHooks in widgets.ts).
export const widgetSchema = Type.Object(
  {
    _id: ObjectIdSchema(),
    name: Type.String(),
    organizationId: ObjectIdSchema(),
    createdAt: Type.Number(),
    updatedAt: Type.Number()
  },
  { $id: 'Widget', additionalProperties: false }
)
export type Widget = Static<typeof widgetSchema>
export const widgetResolver = resolve<Widget, HookContext>({})
export const widgetExternalResolver = resolve<Widget, HookContext>({})

// The client only supplies `name`; the rest are set by resolvers /
// teamAccessControl but must be permitted here so post-resolution validation
// passes (resolveData runs before validateData in generateDefaultHooks).
export const widgetDataSchema = Type.Intersect(
  [
    Type.Pick(widgetSchema, ['name']),
    Type.Object({
      organizationId: Type.Optional(ObjectIdSchema()),
      createdAt: Type.Optional(Type.Number()),
      updatedAt: Type.Optional(Type.Number())
    })
  ],
  { $id: 'WidgetData' }
)
export type WidgetData = Static<typeof widgetDataSchema>
export const widgetDataValidator = getValidator(widgetDataSchema, dataValidator)
export const widgetDataResolver = resolve<Widget, HookContext>({
  // teamAccessControl auto-assigns organizationId for non-admins; this fallback
  // ensures it is always set (e.g. for admins) from the active organization.
  organizationId: async (value, _data, context) =>
    value || (context.params as any).user?.activeOrganization,
  createdAt: async () => Date.now(),
  updatedAt: async () => Date.now()
})

export const widgetPatchSchema = Type.Partial(
  Type.Pick(widgetSchema, ['name', 'organizationId', 'createdAt', 'updatedAt']),
  { $id: 'WidgetPatch' }
)
export type WidgetPatch = Static<typeof widgetPatchSchema>
export const widgetPatchValidator = getValidator(widgetPatchSchema, dataValidator)
export const widgetPatchResolver = resolve<Widget, HookContext>({
  updatedAt: async () => Date.now()
})

export const widgetQueryProperties = Type.Pick(widgetSchema, ['_id', 'name', 'organizationId', 'createdAt'])
export const widgetQuerySchema = Type.Intersect(
  [querySyntax(widgetQueryProperties), Type.Object({}, { additionalProperties: false })],
  { additionalProperties: false }
)
export type WidgetQuery = Static<typeof widgetQuerySchema>
export const widgetQueryValidator = getValidator(widgetQuerySchema, queryValidator)
export const widgetQueryResolver = resolve<WidgetQuery, HookContext>({})
