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

### Versioning & releasing

**`release`** bumps every published package in lockstep, commits the bump, and
tags it `vX.Y.Z` — so the git tag never drifts from the published version:

```bash
npm run release -- patch       # or minor | major | an explicit x.y.z
npm run release -- minor --dry # preview without writing/committing/tagging
```

Then push and publish:

```bash
git push && git push origin vX.Y.Z
npm run build
npm publish --workspace @frozencrow/api-core
npm publish --workspace @frozencrow/create-api
```

`release` bumps both packages to the same version, rewrites the template's
`@frozencrow/api-core` range to `^<new>` (needed because for `0.x`, `^0.1.0` does
not satisfy `0.2.0`), refreshes the lockfile, then commits **only those files**
(leaving unrelated working-tree changes alone) and creates the tag. It aborts if
the tag already exists.

Use **`npm run bump -- patch`** if you want to change versions *without*
committing/tagging (e.g. as part of a larger commit). Always keep the `--`
separator so npm forwards flags like `--dry` to the script. Configure which
packages participate at the top of [`scripts/bump.mjs`](scripts/bump.mjs).

Both packages are public and MIT-licensed; `@frozencrow/api-core` runs its build
on `prepublishOnly`.

## Repository layout

```
packages/
  api-core/                  @frozencrow/api-core (library)
    src/                     services, hooks, strategies, utils, createApp, options
  create-api/                @frozencrow/create-api (scaffolder)
    bin/create-api.js        the CLI
    template/                reference app + scaffold source
```
