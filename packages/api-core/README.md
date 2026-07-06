# @frozencrow/api-core

A batteries-included [FeathersJS 5](https://feathersjs.com) + Koa + MongoDB core
for building multitenant APIs. It ships authentication, a repeatable
service + hook generation system, role-based access control (RBAC), and
per-organization data isolation, so you can focus on your own resources.

> Want a whole project instead of wiring it up yourself? Use the scaffolder:
> `npm create @frozencrow/api my-app` ([@frozencrow/create-api](https://www.npmjs.com/package/@frozencrow/create-api)).

## Contents

- [Features](#features)
- [Installation](#installation)
- [Quick start](#quick-start)
- [Configuration](#configuration-coreoptions)
- [Built-in services](#built-in-services)
- [Authentication](#authentication)
- [Authorization: RBAC & multitenancy](#authorization-rbac--multitenancy)
- [Adding your own services](#adding-your-own-services)
- [CLI](#cli)
- [`generateDefaultHooks` reference](#generatedefaulthooks--generatehooks-reference)
- [Organization membership management](#organization-membership-management)
- [Impersonation](#impersonation)
- [Invites & verifications](#invites--verifications)
- [Email & templates](#email--templates)
- [Human-readable serial IDs](#human-readable-serial-ids)
- [Realtime events](#realtime-events)
- [Security model & production checklist](#security-model--production-checklist)
- [Exports](#exports)

## Features

- **Auth** — local (email/password), JWT, Google OAuth (redirect + One Tap),
  static API keys, and anonymous, all pre-registered.
- **Services** — `users`, `organizations`, `roles`, `invites`, `verifications`,
  `serial-ids`, out of the box.
- **RBAC** — permissions of the form `<path>:<method>`, `<path>:*`, or `*`,
  resolved from a user's role within their active organization.
- **Multitenancy** — every request is automatically scoped to the caller's
  `activeOrganization`; cross-tenant reads/writes are rejected.
- **Repeatable services** — one `generateDefaultHooks({ schema })` call wires a
  new resource with auth, tenant scoping, validation, resolvers, and logging.
- **Email** — nodemailer + doT templates (welcome, invitation, password reset,
  magic link) with a layout system and consumer overrides.
- **Safe by default** — refuses to boot in production with a weak JWT secret,
  restricts CORS, hides secrets from API output, and scopes realtime events.

## Installation

```bash
npm install @frozencrow/api-core
```

Peer runtime: Node >= 20 and a reachable MongoDB.

## Quick start

The recommended setup uses the **Feathers config module** — configuration lives
in `config/*.json`, secrets in a git-ignored `config/local.json`, and production
overrides come from environment variables mapped in
`config/custom-environment-variables.json`. No `.env` files.

```ts
import { createConfiguredApp } from '@frozencrow/api-core'

const app = createConfiguredApp() // reads ./config via @feathersjs/configuration

// Register your own services on top of the core:
app.configure(myServices)

await app.listen(app.get('port'))
```

`config/default.json`:

```json
{
  "appName": "My API",
  "host": "localhost",
  "port": 3030,
  "public": "./public",
  "origins": ["http://localhost:5173"],
  "seed": true,
  "paginate": { "default": 10, "max": 50 },
  "mongodb": "mongodb://localhost:27017/my-api",
  "authentication": {
    "entity": "user", "service": "users", "secret": "CHANGE_ME_IN_PRODUCTION",
    "authStrategies": ["jwt", "local"],
    "jwtOptions": { "header": { "typ": "access" }, "audience": "https://example.com", "algorithm": "HS256", "expiresIn": "1d" },
    "local": { "usernameField": "email", "passwordField": "password" }
  }
}
```

The config schema (`configurationValidator`) allows extra keys, so you can add
your own configuration freely. Pass a custom validator to
`createConfiguredApp(validator)` if you want to type/validate those additions.

### Alternative: configure programmatically

If you'd rather not use config files, `createApp(options)` sets the same config
keys from a `CoreOptions` object:

```ts
import { createApp } from '@frozencrow/api-core'

const app = createApp({
  mongodb: process.env.MONGODB_URI!,
  authSecret: process.env.AUTH_SECRET!,
  origins: ['http://localhost:5173'],
  seed: true
})
```

Both paths end up with the same `app.get(...)` config; `configureCore(app)` (used
by both) reads from there. Neither calls `listen` for you.

## Configuration (`CoreOptions`)

These are the keys `createApp` accepts; they map 1:1 onto the config-module keys
above. Only `mongodb` and `authSecret` are required.

| Option | Type | Default | Notes |
| --- | --- | --- | --- |
| `mongodb` | `string` | — | MongoDB connection string (the db name is taken from the path) |
| `authSecret` | `string` | — | JWT signing secret; must be strong in production |
| `appName` | `string` | `'API'` | |
| `host` | `string` | `'localhost'` | |
| `port` | `number` | `3030` | |
| `public` | `string` | `'./public'` | static files dir; set falsy to disable |
| `apiHost` | `string` | — | absolute base URL of this API (OAuth callbacks) |
| `clientHost` | `string` | — | frontend base URL (used in email links) |
| `origins` | `string[]` | `[]` | CORS allow-list (REST + socket.io) |
| `paginate` | `{ default, max }` | `{ 10, 50 }` | |
| `jwtOptions` | `object` | `1d`, `HS256` | merged into Feathers `authentication.jwtOptions` |
| `apiKeys` | `string[]` | — | accepted by the `api-key` strategy |
| `oauth` | `object` | — | `{ google: { key, secret, scope? }, redirect? }` |
| `authentication` | `object` | — | deep overrides merged last into the resolved auth config |
| `mail` | `object` | — | `{ host, port, secure?, auth?, from?, fromName? }` |
| `seed` | `boolean \| { roles }` | off | `true` seeds Admin/Member; pass `{ roles }` to customize |
| `templatesDir` | `string` | bundled | directory of `.dot` templates to use instead of the built-ins |
| `defaultOrgName` | `(user) => string` | `"…'s Organization"` | names the org auto-created for a new user |
| `services` | `CoreServiceName[]` | all | subset of built-in services to register |

Anything you set is written onto Feathers config, so services read it via
`app.get('appName')`, `app.get('paginate')`, etc.

## Built-in services

| Path | Purpose | Notable methods |
| --- | --- | --- |
| `users` | Accounts; `restrictToUser` (a user only sees themselves externally). Roles are populated into objects on read. | `find`, `get`, `create`, `patch`, `remove`, `impersonate` |
| `organizations` | Tenants. Holds a `members[]` list of `{ userId, role, joinedAt }`, an `ownerId`, and `onboarded`. | standard + `invite`, `removeMember`, `updateMemberRole`, `getMembers` |
| `roles` | Named permission sets (`{ name, permissions[] }`). World-readable. | standard |
| `invites` | Organization invitations (email or link), backed by a verification token. | standard |
| `verifications` | Secret tokens for password reset / magic link / invite. External reads are blocked. | `create`, `patch` |
| `serial-ids` | Atomic per-org counters behind `generateShortId`. | standard + `next` |

A newly created user with no organization is automatically given one (as its
`Admin`) on first authentication — see `ensureUserHasOrganization`. Customize the
name via `defaultOrgName`.

## Authentication

The following strategies are registered: `jwt`, `local`, `google`,
`google-one-tap`, `api-key`, `anonymous`. By default `authStrategies` is
`['jwt', 'local']`; to allow additional login strategies, extend it:

```ts
createApp({
  mongodb, authSecret,
  apiKeys: ['service-key-123'],
  oauth: { google: { key: GOOGLE_CLIENT_ID, secret: GOOGLE_CLIENT_SECRET } },
  authentication: { authStrategies: ['jwt', 'local', 'api-key', 'google'] }
})
```

**Email + password login** (REST):

```http
POST /authentication
{ "strategy": "local", "email": "a@b.com", "password": "secret" }
```

Returns `{ accessToken, user }`. Send the token on later requests as
`Authorization: Bearer <accessToken>`. Passwords are always stripped from
responses.

**API key** — send `Authorization: <one-of-apiKeys>` and authenticate with the
`api-key` strategy. **Google One Tap** — `POST /authentication { strategy:
'google-one-tap', credential }`. **Anonymous** — used internally so services can
opt into public access (see `allowAnonymous`).

## Authorization: RBAC & multitenancy

**Roles** are documents `{ name, permissions }` where each permission is a
string: an exact `"<path>:<method>"` (e.g. `"widgets:create"`), a path wildcard
`"widgets:*"`, or the global `"*"`.

**Two layers of authority:**

1. **Global admin** — a user whose populated `role` array contains a role named
   `Admin` (case-insensitive). Global admins bypass tenant scoping. Detected via
   `isGlobalAdmin(user)`.
2. **Organization role** — within their `activeOrganization`, a user's
   permissions come from the role recorded in that org's `members[]` entry.

**`teamAccessControl`** (applied by `generateDefaultHooks`) enforces, per
request: the user is authenticated, is a member of the active organization,
holds `"<path>:<method>"` for the action, and — for reads/writes — the query is
constrained to `organizationId === activeOrganization`. On `create` it stamps the
resource with the active organization. This is what makes every service
multitenant without per-service code.

**Helpers** (`@frozencrow/api-core`), for use in custom methods:

```ts
import { isGlobalAdmin, assertOrgMembership, assertOrgPermission } from '@frozencrow/api-core'

await assertOrgMembership(app, user, organizationId)                  // throws if not a member
await assertOrgPermission(app, user, organizationId, 'widgets:patch') // throws if lacking permission
```

Seeded roles (`seed: true`): `Admin` (`['*']`) and `Member`
(`['users:get','users:patch','organizations:get','organizations:find']`).
Override with `seed: { roles: [...] }`.

## Adding your own services

A resource is three files. Below is the complete pattern for a multitenant
`widgets` service (also shipped in the scaffolder template).

**`widgets.schema.ts`** — TypeBox schemas + validators/resolvers, using the
core's shared AJV validators:

```ts
import { resolve } from '@feathersjs/schema'
import { Type, getValidator, querySyntax, ObjectIdSchema } from '@feathersjs/typebox'
import type { Static } from '@feathersjs/typebox'
import { dataValidator, queryValidator, type HookContext } from '@frozencrow/api-core'

export const widgetSchema = Type.Object({
  _id: ObjectIdSchema(),
  name: Type.String(),
  organizationId: ObjectIdSchema(),      // scopes the row to a tenant
  createdAt: Type.Number(),
  updatedAt: Type.Number()
}, { $id: 'Widget', additionalProperties: false })
export type Widget = Static<typeof widgetSchema>

// Client sends `name`; resolvers/teamAccessControl set the rest — but they must
// be permitted here, because resolveData runs *before* validateData.
export const widgetDataSchema = Type.Intersect([
  Type.Pick(widgetSchema, ['name']),
  Type.Object({
    organizationId: Type.Optional(ObjectIdSchema()),
    createdAt: Type.Optional(Type.Number()),
    updatedAt: Type.Optional(Type.Number())
  })
], { $id: 'WidgetData' })
export type WidgetData = Static<typeof widgetDataSchema>

export const widgetDataValidator = getValidator(widgetDataSchema, dataValidator)
export const widgetDataResolver = resolve<Widget, HookContext>({
  organizationId: async (v, _d, ctx) => v || (ctx.params as any).user?.activeOrganization,
  createdAt: async () => Date.now(),
  updatedAt: async () => Date.now()
})
// ...patch + query schemas/validators/resolvers follow the same shape.
```

**`widgets.class.ts`** — a MongoDB-backed service:

```ts
import { MongoDBService } from '@feathersjs/mongodb'
import type { MongoDBAdapterOptions } from '@feathersjs/mongodb'
import type { Application } from '@frozencrow/api-core'
import type { Widget, WidgetData, WidgetPatch, WidgetQuery } from './widgets.schema'

export class WidgetService extends MongoDBService<Widget, WidgetData, any, WidgetPatch> {}

export const getOptions = (app: Application): MongoDBAdapterOptions => ({
  paginate: app.get('paginate'),
  Model: (app.get('mongodbClient') as Promise<any>).then((db) => db.collection('widgets'))
})
```

**`widgets.ts`** — register and wire hooks in one `generateDefaultHooks` call:

```ts
import { generateDefaultHooks } from '@frozencrow/api-core'
import type { Application } from '@frozencrow/api-core'
import { WidgetService, getOptions } from './widgets.class'
import * as schema from './widgets.schema'

export const widgetPath = 'widgets'

// Full typing for app.use('widgets') / app.service('widgets'):
declare module '@frozencrow/api-core/lib/declarations' {
  interface ServiceTypes { widgets: WidgetService }
}

export const widgets = (app: Application) => {
  app.use(widgetPath, new WidgetService(getOptions(app)), {
    methods: ['find', 'get', 'create', 'patch', 'remove'],
    events: []
  })
  app.service(widgetPath).hooks(generateDefaultHooks({
    schema: {
      dataValidator: schema.widgetDataValidator,
      patchValidator: schema.widgetPatchValidator,
      queryValidator: schema.widgetQueryValidator,
      dataResolver: schema.widgetDataResolver,
      patchResolver: schema.widgetPatchResolver,
      queryResolver: schema.widgetQueryResolver,
      resultResolver: schema.widgetResolver,
      externalResolver: schema.widgetExternalResolver
    }
  }))
}
```

Then `app.configure(widgets)` after `createApp`. The service is now
JWT-protected, tenant-scoped, validated, and requires `widgets:<method>`
permission — no extra code.

## CLI

Installing `@frozencrow/api-core` also gives you the `frozencrow` command, so you
don't have to write the three service files by hand:

```bash
# Scaffold a multitenant service with typed fields, and register it in src/app.ts
npx frozencrow generate service invoices --fields "amount:number,paid?:boolean" --wire

# Other generators / helpers
npx frozencrow generate hook audit-log
npx frozencrow secret --write     # write a strong secret into config/local.json
npx frozencrow list services
```

| Command | Description |
| --- | --- |
| `generate service <name>` (alias `g s`) | Creates `<name>.schema.ts`, `<name>.class.ts`, and the registration file. |
| `generate hook <name>` (alias `g h`) | Creates a hook stub under `src/hooks`. |
| `secret` | Prints a strong secret; `--write` sets `authentication.secret` in `config/local.json`. |
| `list services` (alias `ls`) | Lists the services in the current project. |

**`generate service` options**

| Flag | Default | Notes |
| --- | --- | --- |
| `--fields "a:string,b:number"` | `name:string` | Types: `string`, `number`, `boolean`, `integer`; suffix `?` marks a field optional |
| `--access team\|user\|public` | `team` | `team` = multitenant, `user` = owner-scoped (`restrictToUser`), `public` = anonymous read/write |
| `--wire` | off | Also add the import + `app.configure(...)` to `src/app.ts` |
| `--dir <path>` | `src/services` | Output directory |
| `--force` | off | Overwrite existing files |

Projects created with `npm create @frozencrow/api` also expose
`npm run generate` and `npm run secret` shortcuts.

## `generateDefaultHooks` / `generateHooks` reference

`generateDefaultHooks(options)` is `generateHooks` with team-based access control
as the default mode. Both accept:

| Option | Default | Description |
| --- | --- | --- |
| `schema` | — | `{ dataValidator, patchValidator, queryValidator, dataResolver, patchResolver, queryResolver, resultResolver, externalResolver }` — any subset |
| `methods` | all 6 | service methods to wire |
| `requireAuth` | `true` | adds `authenticate('jwt', 'anonymous')` |
| `accessControl.mode` | `teamAccessControl` (default hooks) | `teamAccessControl`, `'restrictToUser'`, `'forbidden'`, `'ignore'`, or a custom `(context) => …` |
| `accessControl.methods` | all 6 | which methods access control applies to |
| `accessControl.restrictToUserFrom` / `restrictToUserAs` | `params.user._id` / `params.query.userId` | for `restrictToUser` mode |
| `allowAnonymous` | `false` | permit unauthenticated access (public read/create) |
| `discardVirtuals` | `['create','update','patch']` | strip virtual props before persistence |
| `logErrors` | `true` | wrap methods in error logging |
| `overrides` | — | replace a hook slot entirely, e.g. `{ before: { all: [...] } }` |
| `extensions` | — | append to a hook slot, e.g. `{ before: { create: [myHook] } }` |

Example — a public, non-tenant service:

```ts
generateDefaultHooks({
  schema,
  requireAuth: false,
  allowAnonymous: true,
  accessControl: { mode: 'ignore' }
})
```

## Organization membership management

The `organizations` service exposes custom methods (all require membership +
`organizations:patch`, or global admin):

```ts
await app.service('organizations').invite(
  { organizationId, roleId, email, inviteType: 'email' }, { user })
await app.service('organizations').updateMemberRole({ organizationId, userId, roleId }, { user })
await app.service('organizations').removeMember({ organizationId, userId }, { user })
await app.service('organizations').getMembers({ organizationId }, { user }) // members-only
```

## Impersonation

`users.impersonate` mints a JWT for another user/organization. It is restricted:
global admins can impersonate anyone into any org ("Login As"); everyone else may
only refresh their own session, and only into an organization they belong to.

```ts
const { accessToken } = await app.service('users').impersonate(
  { userId, organizationId }, { user: callingUser })
```

## Invites & verifications

**Invites** create a verification token and (for email invites) send an email.
Accepting is a `patch` to `status: 'accepted'`; the core verifies the caller (an
email invite requires a matching email, link invites require any authenticated
user, expired/consumed invites are rejected) and then adds the user to the
organization with the invited role.

**Verifications** power self-service flows. Request one with `create`
(`magic-link` or `password-reset` are allowed externally; `invite` is
server-only). Reset a password by patching with `{ token, password }` (no id).
Look tokens up server-side with `verificationsService.verifyToken(app, token, type)`.
External `find`/`get`/`remove` are blocked and tokens never appear in responses.

## Email & templates

Configure `mail`, then send:

```ts
import { sendTemplatedEmail, sendTextEmail } from '@frozencrow/api-core'

await sendTemplatedEmail(
  'user@example.com',
  'welcome',                                  // templates/welcome.{html,text}.dot
  { name: 'Ada' },
  app,
  { subject: 'Welcome!' }
)
await sendTextEmail('user@example.com', 'Hi', 'Plain body', app)
```

Bundled templates: `welcome`, `invitation`, `notification`, `password-reset`,
wrapped by `layout.{html,text}.dot`. Common data (`appName`, `clientUrl`,
`logoUrl`) is injected automatically. Override the whole directory with
`templatesDir`.

## Human-readable serial IDs

Generate per-organization, monotonic, human-readable IDs (backed by an atomic
counter):

```ts
import { generateShortId } from '@frozencrow/api-core'

const id = await generateShortId(app, organizationId, 'work-order', 'WO')
// => "WO-2607-0001"  (prefix-YYMM-sequence)
```

## Realtime events

Events are scoped per tenant, not broadcast to everyone. On login a connection
joins `authenticated`, `userId/<id>`, and `org/<activeOrganization>` channels;
each service event is published only to the organization it belongs to (falling
back to the affected user for user events). See `channels`.

## Security model & production checklist

- [ ] Set a strong **`AUTH_SECRET`** — the app refuses to boot in production
      (`NODE_ENV=production`) with a missing/placeholder/short (< 32 char) secret.
- [ ] Set **`origins`** to your real browser origins (CORS is restricted to them).
- [ ] Configure **`mail`** if you use password reset / magic link / invites.
- [ ] Keep the `Admin` role name intact — it is the global-admin signal.

Guarantees baked in: privileged user fields (`role`, `emailVerified`,
`oauthVerified`, Google identity) can't be self-assigned via the public API;
`impersonate` is admin-only; verification tokens are never exposed and their
service blocks external reads; realtime is tenant-scoped.

## Exports

App: `createConfiguredApp`, `createApp`, `configureCore`, `resolveConfiguration`,
`configurationValidator`, `CoreOptions`.
Services: `coreServices`, `services`, `ALL_CORE_SERVICES`, and namespaced
`usersService`, `organizationsService`, `rolesService`, `invitesService`,
`verificationsService`, `serialIdsService` (for schema composition). Hooks &
access: `generateHooks`, `generateDefaultHooks`, `teamAccessControl`,
`isGlobalAdmin`, `assertOrgMembership`, `assertOrgPermission`, `populateUserRoles`,
`preventRoleChange`, `filterOrganizationsByMembership`, `filterUsersByOrganization`,
`setupOrganization`, `ensureUserHasOrganization`. Strategies: `CustomJWTStrategy`,
`ApiKeyStrategy`, `AnonymousStrategy`, `GoogleStrategy`, `GoogleOneTapStrategy`.
Utilities: `generateShortId`, `sendTemplatedEmail`, mail helpers, `logger`,
`dataValidator`, `queryValidator`. Types: `Application`, `HookContext`.
A separate client entry is available at `@frozencrow/api-core/client`.

## License

MIT
