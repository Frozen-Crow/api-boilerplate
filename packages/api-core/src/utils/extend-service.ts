import { Type, getValidator, querySyntax } from '@feathersjs/typebox'
import { resolve } from '@feathersjs/schema'
import { dataValidator, queryValidator } from '../validators'
import { isGlobalAdmin } from './access'
import type { Application } from '../declarations'

/**
 * Consumer-supplied extension for a core service. Passed via the `extend`
 * option to `createApp` / `createConfiguredApp` / `configureCore`.
 *
 * ```ts
 * createConfiguredApp({
 *   extend: {
 *     users: {
 *       properties: { phone: Type.Optional(Type.String()) },   // stored + returned
 *       queryProperties: { phone: Type.String() },             // filterable
 *       resolvers: { result: { displayName: async (_v, u) => `${u.firstName} ${u.lastName}` } },
 *       hooks: { after: { create: [syncToCrm] } }
 *     }
 *   }
 * })
 * ```
 */
export interface ServiceExtension {
  /**
   * Extra TypeBox properties merged into the service's create + patch schemas
   * (so they are stored/returned).
   *
   * SECURITY: these are **server-owned by default** — an external client (the
   * account owner included) cannot set them on create/patch/update unless the
   * property is also listed in `clientWritable`. This prevents app state hung off
   * a core service (entitlements, quotas, consent, …) from being self-writable.
   * Internal (server-side) calls and global admins are unaffected.
   */
  properties?: Record<string, any>
  /**
   * Names of `properties` that external clients ARE allowed to write (e.g. a
   * user-editable `phone`). Anything not listed here is server-owned and stripped
   * from external, non-admin writes. Omit for the safe default (all server-owned).
   *
   * Notes:
   * - The guard covers `create`/`patch`/`update`. Core services expose `patch`
   *   (partial), not `update` (full replace). If you re-register a service with
   *   `update` in its methods, prefer `patch` for editing server-owned-bearing
   *   records — a full replace would drop stripped fields rather than preserve
   *   them.
   * - It guards writes only, not `queryProperties` (filterability).
   * - A custom data/patch resolver must use its `value` argument (already
   *   stripped); reaching into the raw `context.data.<field>` would re-introduce
   *   the client value.
   */
  clientWritable?: string[]
  /** Extra properties merged into the query schema so the field is filterable. */
  queryProperties?: Record<string, any>
  /** Extra resolvers, applied in the correct slot alongside the core resolvers. */
  resolvers?: {
    data?: Record<string, any>
    patch?: Record<string, any>
    result?: Record<string, any>
    query?: Record<string, any>
  }
  /** Extra Feathers hooks, merged (appended) onto the service's hooks. */
  hooks?: Record<string, Record<string, any[]>>
}

/** Map of service path -> extension. */
export type CoreExtend = Record<string, ServiceExtension>

/** The base schema + validators + resolvers a core service passes to the helper. */
export interface ServiceSchemaBase {
  dataSchema: any
  patchSchema: any
  queryProperties: any
  dataValidator: any
  patchValidator: any
  queryValidator: any
  dataResolver?: any
  patchResolver?: any
  queryResolver?: any
  resultResolver?: any
  externalResolver?: any
}

const getExtension = (app: Application, serviceName: string): ServiceExtension | undefined =>
  (app.get('coreOptions') as any)?.extend?.[serviceName]

/**
 * Build the `schema` object for `generateDefaultHooks`, applying any consumer
 * extension for this service. With no extension it returns the base validators
 * and resolvers unchanged (fast path). With an extension it rebuilds the
 * affected validators from base.properties + the extra properties — ANONYMOUSLY
 * (no `$id`, to avoid colliding with the already-registered base schemas) and
 * always with `additionalProperties: false` so truly-unknown fields are still
 * rejected. Extra resolvers are layered as additional resolvers in the right slot.
 */
export const resolveServiceSchema = (app: Application, serviceName: string, base: ServiceSchemaBase) => {
  const ext = getExtension(app, serviceName)

  const schema: any = {
    dataValidator: base.dataValidator,
    patchValidator: base.patchValidator,
    queryValidator: base.queryValidator,
    dataResolver: base.dataResolver,
    patchResolver: base.patchResolver,
    queryResolver: base.queryResolver,
    resultResolver: base.resultResolver,
    externalResolver: base.externalResolver
  }

  if (!ext) {
    return schema
  }

  if (ext.properties && Object.keys(ext.properties).length > 0) {
    schema.dataValidator = getValidator(
      Type.Object({ ...(base.dataSchema.properties || {}), ...ext.properties }, { additionalProperties: false }),
      dataValidator
    )
    // Patch: every field optional (base patch props already are; make the
    // extras optional too regardless of how the consumer declared them).
    schema.patchValidator = getValidator(
      Type.Partial(
        Type.Object({ ...(base.patchSchema.properties || {}), ...ext.properties }, { additionalProperties: false })
      ),
      dataValidator
    )
  }

  if (ext.queryProperties && Object.keys(ext.queryProperties).length > 0) {
    schema.queryValidator = getValidator(
      Type.Intersect(
        [
          querySyntax(Type.Object({ ...(base.queryProperties.properties || {}), ...ext.queryProperties })),
          Type.Object({}, { additionalProperties: false })
        ],
        { additionalProperties: false }
      ),
      queryValidator
    )
  }

  // Opt-in writability (issue #2). Extended properties are server-owned by
  // default: any that the consumer has NOT listed in `clientWritable` are
  // stripped from EXTERNAL, non-admin create/patch/update data BEFORE validation,
  // so an account owner can't self-write app state attached via `extend`.
  // Runs before any consumer data/patch resolver, so server-side resolvers can
  // still compute those fields.
  const serverOwnedKeys = Object.keys(ext.properties || {}).filter(
    (key) => !(ext.clientWritable || []).includes(key)
  )

  const extraData: any[] = []
  const extraPatch: any[] = []

  if (serverOwnedKeys.length > 0) {
    const stripServerOwned = resolve<any, any>(
      Object.fromEntries(
        serverOwnedKeys.map((key) => [
          key,
          async (value: any, _data: any, context: any) => {
            if (context?.params?.provider && !isGlobalAdmin(context.params.user)) {
              return undefined
            }
            return value
          }
        ])
      )
    )
    extraData.push(stripServerOwned)
    extraPatch.push(stripServerOwned)
  }

  if (ext.resolvers?.data) extraData.push(resolve(ext.resolvers.data as any))
  if (ext.resolvers?.patch) extraPatch.push(resolve(ext.resolvers.patch as any))

  if (extraData.length > 0) schema.extraDataResolvers = extraData
  if (extraPatch.length > 0) schema.extraPatchResolvers = extraPatch
  if (ext.resolvers?.result) schema.extraResultResolvers = [resolve(ext.resolvers.result as any)]
  if (ext.resolvers?.query) schema.extraQueryResolvers = [resolve(ext.resolvers.query as any)]

  return schema
}

/**
 * Merge the consumer's extension hooks (appending arrays) onto a service's
 * base `extensions` map for `generateDefaultHooks`.
 */
export const withExtensionHooks = (
  app: Application,
  serviceName: string,
  baseExtensions: Record<string, Record<string, any[]>> = {}
) => {
  const ext = getExtension(app, serviceName)
  if (!ext?.hooks) {
    return baseExtensions
  }

  const merged: Record<string, Record<string, any[]>> = {}
  for (const source of [baseExtensions, ext.hooks]) {
    for (const type of Object.keys(source)) {
      merged[type] = merged[type] || {}
      for (const method of Object.keys(source[type])) {
        merged[type][method] = [...(merged[type][method] || []), ...source[type][method]]
      }
    }
  }
  return merged
}
