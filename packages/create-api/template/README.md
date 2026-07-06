# My API

An API built on [`@frozencrow/api-core`](https://www.npmjs.com/package/@frozencrow/api-core) —
authentication, RBAC, and multitenant (organization) access control out of the box.

## Getting started

```bash
npm install
npm run dev
```

Requires a MongoDB instance (see `docker-compose.yml` for a local stack with
MongoDB + smtp4dev).

## Configuration

Configuration uses the Feathers config module (no `.env` files):

- `config/default.json` — app settings (name, port, origins, mongodb, auth, …).
- `config/local.json` — machine-local overrides, **git-ignored**. Your project
  was scaffolded with a strong `authentication.secret` here.
- `config/test.json` — used when `NODE_ENV=test`.
- `config/custom-environment-variables.json` — maps env vars (`AUTH_SECRET`,
  `MONGODB_URI`, `PORT`, …) onto config for production.

Generate a fresh secret any time with `npm run secret -- --write` (updates
`config/local.json`), or set `AUTH_SECRET` in the environment for production.

## Where things live

- `src/app.ts` — builds the app with `createConfiguredApp()` from
  `@frozencrow/api-core` and registers your own services.
- `src/services/widgets/` — an example multitenant service. Copy this folder as
  the pattern for new resources: a `.schema.ts`, a `.class.ts`, and a registration
  file that calls `generateDefaultHooks({ schema })` — or run
  `npx frozencrow g service <name>`.

## Generate services with the CLI

The `frozencrow` CLI ships with `@frozencrow/api-core`, so you can scaffold that
pattern instead of writing it by hand:

```bash
npx frozencrow generate service invoices --fields "amount:number,paid?:boolean" --wire
# shortcuts:  npm run generate -- service invoices ...   npm run secret
```

See the [@frozencrow/api-core CLI docs](https://www.npmjs.com/package/@frozencrow/api-core#cli)
for all commands and options.

## What you get from the core

`users`, `organizations`, `roles`, `invites`, and `verifications` services with
local + Google + API-key auth, JWT, role-based permissions (`<path>:<method>`),
and per-organization data isolation. See the `@frozencrow/api-core` README for
the full configuration surface and security model.

## Testing

```bash
npm test    # needs a MongoDB on localhost:27017
```

## Production

- Set a strong `AUTH_SECRET` (the app refuses to boot in production without one).
- Set `ORIGINS` to your allowed browser origins.
- `npm run compile && npm start`, or build the Docker image.
