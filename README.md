# Frozencrow API

A batteries-included [FeathersJS 5](https://feathersjs.com) + Koa + MongoDB core
for building APIs with authentication, role-based access control, a repeatable
service/hook system, and multitenant (organization) data isolation — published
as reusable npm packages plus a scaffolder.

## Packages

This is an npm-workspaces monorepo containing two published packages:

| Package | Description |
| --- | --- |
| [`packages/api-core`](packages/api-core) → **[@frozencrow/api-core](https://www.npmjs.com/package/@frozencrow/api-core)** | The library. `createApp(options)` + composable services, hooks, and access-control utilities. |
| [`packages/create-api`](packages/create-api) → **[@frozencrow/create-api](https://www.npmjs.com/package/@frozencrow/create-api)** | The scaffolder. `npm create @frozencrow/api my-app` generates a ready-to-run project that depends on the core. |

The scaffolder's `template/` also doubles as the reference/example consumer app
and is exercised by the test suite.

## Use it

Scaffold a new project:

```bash
npm create @frozencrow/api my-app
cd my-app && npm install && npm run dev
```

Or add the core to an existing Feathers-friendly app:

```bash
npm install @frozencrow/api-core
```

```ts
import { createApp } from '@frozencrow/api-core'
const app = createApp({ mongodb: process.env.MONGODB_URI!, authSecret: process.env.AUTH_SECRET!, seed: true })
await app.listen(app.get('port'))
```

See [packages/api-core/README.md](packages/api-core/README.md) for the full
configuration surface and security model.

## Develop this repo

```bash
npm install          # installs all workspaces and links them together
npm run build        # builds @frozencrow/api-core (emits lib/ + email templates)
npm test             # runs the example app's integration tests (needs MongoDB)
```

`npm test` expects a MongoDB on `localhost:27017`. A quick one:

```bash
docker run -d --name dev-mongo -p 27017:27017 mongo:7
```

### Versioning

Bump every published package in lockstep (and keep the template's dependency
range in sync) with one command:

```bash
npm run bump -- patch          # or minor | major | an explicit x.y.z
npm run bump -- minor --dry    # preview without writing
```

Always keep the `--` separator so npm forwards the arguments (e.g. `--dry`) to
the script instead of consuming them. Or call it directly:
`node scripts/bump.mjs patch`.

This updates `@frozencrow/api-core` and `@frozencrow/create-api` to the same
version, rewrites the template's `@frozencrow/api-core` range to `^<new>`
(needed because for `0.x`, `^0.1.0` does not satisfy `0.2.0`), and refreshes the
lockfile. Configure which packages participate at the top of
[`scripts/bump.mjs`](scripts/bump.mjs).

### Publishing

Both packages are public and MIT-licensed. From a clean build:

```bash
npm run bump -- patch       # bump versions first
npm run build
npm publish --workspace @frozencrow/api-core
npm publish --workspace @frozencrow/create-api
```

(`@frozencrow/api-core` runs its build on `prepublishOnly`.)

## Repository layout

```
packages/
  api-core/                  @frozencrow/api-core (library)
    src/                     services, hooks, strategies, utils, createApp, options
  create-api/                @frozencrow/create-api (scaffolder)
    bin/create-api.js        the CLI
    template/                reference app + scaffold source
```
