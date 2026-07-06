'use strict'

const path = require('node:path')
const fs = require('node:fs')
const { log, c, toKebab, toCamel, toPascal, writeFile } = require('../util')

const TS_TYPES = {
  string: 'Type.String()',
  number: 'Type.Number()',
  boolean: 'Type.Boolean()',
  integer: 'Type.Integer()'
}

// Parse `--fields "title:string,quantity:number,done?:boolean"` into descriptors.
function parseFields(spec) {
  if (!spec || spec === true) return [{ name: 'name', type: 'string', optional: false }]
  return String(spec)
    .split(',')
    .map((raw) => raw.trim())
    .filter(Boolean)
    .map((entry) => {
      const [rawName, rawType = 'string'] = entry.split(':')
      const optional = rawName.trim().endsWith('?')
      const name = toCamel(rawName.trim().replace(/\?$/, ''))
      const type = rawType.trim().toLowerCase()
      if (!TS_TYPES[type]) {
        throw new Error(`Unknown field type "${type}" for "${name}". Use: ${Object.keys(TS_TYPES).join(', ')}`)
      }
      return { name, type, optional }
    })
}

function schemaFile(names, fields, access) {
  const { Pascal, path: svcPath } = names
  const owner =
    access === 'team'
      ? { field: 'organizationId', line: 'organizationId: ObjectIdSchema(),' }
      : access === 'user'
        ? { field: 'userId', line: 'userId: ObjectIdSchema(),' }
        : null

  const fieldLines = fields
    .map((f) => `    ${f.name}: ${f.optional ? `Type.Optional(${TS_TYPES[f.type]})` : TS_TYPES[f.type]},`)
    .join('\n')

  const requiredFieldNames = fields.filter((f) => !f.optional).map((f) => `'${f.name}'`)
  const optionalFieldNames = fields.filter((f) => f.optional).map((f) => f.name)
  const allFieldNames = fields.map((f) => `'${f.name}'`)

  // Data schema: required fields + (owner + timestamps) as optional (set by resolvers).
  const dataExtra = [
    ...(owner ? [`      ${owner.field}: Type.Optional(ObjectIdSchema()),`] : []),
    ...optionalFieldNames.map((n) => {
      const f = fields.find((x) => x.name === n)
      return `      ${n}: Type.Optional(${TS_TYPES[f.type]}),`
    }),
    '      createdAt: Type.Optional(Type.Number()),',
    '      updatedAt: Type.Optional(Type.Number())'
  ].join('\n')

  const ownerResolver = owner
    ? access === 'team'
      ? `  ${owner.field}: async (value, _data, context) =>\n    value || (context.params as any).user?.activeOrganization,\n`
      : `  ${owner.field}: async (value, _data, context) =>\n    value || (context.params as any).user?._id,\n`
    : ''

  const queryPick = [
    "'_id'",
    ...allFieldNames,
    ...(owner ? [`'${owner.field}'`] : []),
    "'createdAt'"
  ].join(', ')

  return `import { resolve } from '@feathersjs/schema'
import { Type, getValidator, querySyntax, ObjectIdSchema } from '@feathersjs/typebox'
import type { Static } from '@feathersjs/typebox'
import { dataValidator, queryValidator } from '@frozencrow/api-core'
import type { HookContext } from '@frozencrow/api-core'

export const ${names.camel}Schema = Type.Object(
  {
    _id: ObjectIdSchema(),
${fieldLines}
${owner ? `    ${owner.line}\n` : ''}    createdAt: Type.Number(),
    updatedAt: Type.Number()
  },
  { $id: '${Pascal}', additionalProperties: false }
)
export type ${Pascal} = Static<typeof ${names.camel}Schema>
export const ${names.camel}Resolver = resolve<${Pascal}, HookContext>({})
export const ${names.camel}ExternalResolver = resolve<${Pascal}, HookContext>({})

// Client sends the fields below; owner + timestamps are set by resolvers, but
// must be permitted here (resolveData runs before validateData).
export const ${names.camel}DataSchema = Type.Intersect(
  [
    Type.Pick(${names.camel}Schema, [${requiredFieldNames.join(', ')}]),
    Type.Object({
${dataExtra}
    })
  ],
  { $id: '${Pascal}Data' }
)
export type ${Pascal}Data = Static<typeof ${names.camel}DataSchema>
export const ${names.camel}DataValidator = getValidator(${names.camel}DataSchema, dataValidator)
export const ${names.camel}DataResolver = resolve<${Pascal}, HookContext>({
${ownerResolver}  createdAt: async () => Date.now(),
  updatedAt: async () => Date.now()
})

export const ${names.camel}PatchSchema = Type.Partial(
  Type.Pick(${names.camel}Schema, [${[...allFieldNames, ...(owner ? [`'${owner.field}'`] : []), "'createdAt'", "'updatedAt'"].join(', ')}]),
  { $id: '${Pascal}Patch' }
)
export type ${Pascal}Patch = Static<typeof ${names.camel}PatchSchema>
export const ${names.camel}PatchValidator = getValidator(${names.camel}PatchSchema, dataValidator)
export const ${names.camel}PatchResolver = resolve<${Pascal}, HookContext>({
  updatedAt: async () => Date.now()
})

export const ${names.camel}QueryProperties = Type.Pick(${names.camel}Schema, [${queryPick}])
export const ${names.camel}QuerySchema = Type.Intersect(
  [querySyntax(${names.camel}QueryProperties), Type.Object({}, { additionalProperties: false })],
  { additionalProperties: false }
)
export type ${Pascal}Query = Static<typeof ${names.camel}QuerySchema>
export const ${names.camel}QueryValidator = getValidator(${names.camel}QuerySchema, queryValidator)
export const ${names.camel}QueryResolver = resolve<${Pascal}Query, HookContext>({})
`
}

function classFile(names) {
  const { Pascal, camel } = names
  return `import type { Params } from '@feathersjs/feathers'
import { MongoDBService } from '@feathersjs/mongodb'
import type { MongoDBAdapterParams, MongoDBAdapterOptions } from '@feathersjs/mongodb'
import type { Application } from '@frozencrow/api-core'

import type { ${Pascal}, ${Pascal}Data, ${Pascal}Patch, ${Pascal}Query } from './${names.file}.schema'

export interface ${Pascal}Params extends MongoDBAdapterParams<${Pascal}Query> {}

export class ${Pascal}Service<ServiceParams extends Params = ${Pascal}Params> extends MongoDBService<
  ${Pascal},
  ${Pascal}Data,
  ${Pascal}Params,
  ${Pascal}Patch
> {}

export const getOptions = (app: Application): MongoDBAdapterOptions => {
  return {
    paginate: app.get('paginate'),
    Model: (app.get('mongodbClient') as Promise<any>).then((db) => db.collection('${names.path}'))
  }
}
`
}

function registrationFile(names, access) {
  const { Pascal, camel, file, path: svcPath } = names

  const hookOptions =
    access === 'public'
      ? `{
      schema,
      requireAuth: false,
      allowAnonymous: true,
      accessControl: { mode: 'ignore' }
    }`
      : access === 'user'
        ? `{
      schema,
      accessControl: { mode: 'restrictToUser', restrictToUserAs: 'userId' }
    }`
        : '{ schema }'

  return `import { generateDefaultHooks } from '@frozencrow/api-core'
import type { Application } from '@frozencrow/api-core'

import { ${Pascal}Service, getOptions } from './${file}.class'
import {
  ${camel}DataValidator,
  ${camel}PatchValidator,
  ${camel}QueryValidator,
  ${camel}Resolver,
  ${camel}ExternalResolver,
  ${camel}DataResolver,
  ${camel}PatchResolver,
  ${camel}QueryResolver
} from './${file}.schema'

export const ${camel}Path = '${svcPath}'
export const ${camel}Methods = ['find', 'get', 'create', 'patch', 'remove'] as const

// Full typing for app.use('${svcPath}') / app.service('${svcPath}').
declare module '@frozencrow/api-core/lib/declarations' {
  interface ServiceTypes {
    '${svcPath}': ${Pascal}Service
  }
}

const schema = {
  dataValidator: ${camel}DataValidator,
  patchValidator: ${camel}PatchValidator,
  queryValidator: ${camel}QueryValidator,
  dataResolver: ${camel}DataResolver,
  patchResolver: ${camel}PatchResolver,
  queryResolver: ${camel}QueryResolver,
  resultResolver: ${camel}Resolver,
  externalResolver: ${camel}ExternalResolver
}

export const ${camel} = (app: Application) => {
  app.use(${camel}Path, new ${Pascal}Service(getOptions(app)), {
    methods: [...${camel}Methods],
    events: []
  })
  app.service(${camel}Path).hooks(generateDefaultHooks(${hookOptions}))
}
`
}

// Best-effort: add \`app.configure(<name>)\` to the app entry if we can find it.
function tryWire(targetDir, names) {
  const candidates = ['src/app.ts', 'src/index.ts']
  for (const rel of candidates) {
    const file = path.join(targetDir, rel)
    if (!fs.existsSync(file)) continue
    let src = fs.readFileSync(file, 'utf8')
    if (src.includes(`services/${names.dir}/${names.file}`)) return rel // already wired
    if (!/app\.configure\(/.test(src)) continue

    const importLine = `import { ${names.camel} } from './services/${names.dir}/${names.file}'`
    // Add import after the last existing import.
    const importMatch = src.match(/^import .*$/gm)
    if (importMatch) {
      const last = importMatch[importMatch.length - 1]
      src = src.replace(last, `${last}\n${importLine}`)
    } else {
      src = `${importLine}\n${src}`
    }
    // Append the configure call at the end of the file.
    src = `${src.replace(/\s*$/, '')}\n\napp.configure(${names.camel})\n`
    fs.writeFileSync(file, src)
    return rel
  }
  return null
}

module.exports = function generateService(args) {
  const rawName = args._[0]
  if (!rawName) {
    log.error('Usage: frozencrow generate service <name> [--fields "a:string,b:number"] [--access team|user|public] [--wire]')
    process.exit(1)
  }

  const access = String(args.flags.access || 'team').toLowerCase()
  if (!['team', 'user', 'public'].includes(access)) {
    log.error(`--access must be one of: team, user, public`)
    process.exit(1)
  }

  let fields
  try {
    fields = parseFields(args.flags.fields)
  } catch (e) {
    log.error(e.message)
    process.exit(1)
  }

  const kebab = toKebab(rawName)
  const names = {
    path: kebab, // service path, url segment, mongo collection
    dir: kebab, // folder under services/
    file: kebab, // file basename
    camel: toCamel(rawName),
    Pascal: toPascal(rawName)
  }

  const baseDir = String(args.flags.dir || 'src/services')
  const outDir = path.resolve(process.cwd(), baseDir, names.dir)
  const force = Boolean(args.flags.force)

  log.step(`Generating ${c.bold(names.path)} service (${access} access, ${fields.length} field${fields.length === 1 ? '' : 's'})`)

  writeFile(path.join(outDir, `${names.file}.schema.ts`), schemaFile(names, fields, access), { force })
  writeFile(path.join(outDir, `${names.file}.class.ts`), classFile(names), { force })
  writeFile(path.join(outDir, `${names.file}.ts`), registrationFile(names, access), { force })

  let wired = null
  if (args.flags.wire) {
    wired = tryWire(process.cwd(), names)
  }

  console.log()
  if (wired) {
    log.success(`Registered in ${c.bold(wired)} — run your dev server to see it.`)
  } else {
    log.success('Service generated. Register it in your app entry:')
    console.log(c.dim(`\n    import { ${names.camel} } from './services/${names.dir}/${names.file}'\n    app.configure(${names.camel})\n`))
  }
}
