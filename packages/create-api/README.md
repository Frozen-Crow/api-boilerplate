# @frozencrow/create-api

Scaffold a new API project powered by
[`@frozencrow/api-core`](https://www.npmjs.com/package/@frozencrow/api-core).

## Usage

```bash
npm create @frozencrow/api my-app
# or
npx @frozencrow/create-api my-app
```

It asks which services you want to create, then scaffolds them. You can also
pass them up front (and skip the prompt):

```bash
npm create @frozencrow/api my-app -- --services posts,comments,work-orders
```

Each name becomes a multitenant service (schema + class + registration, wired
into `src/services/index.ts`). Leave it blank for no services. For fields and
other access models, use the `frozencrow` CLI afterwards:
`npx frozencrow generate service <name> --fields "..."`.

The scaffolder also:

- sets the project's package name and database name,
- writes a strong secret to `config/local.json` (git-ignored — uses the Feathers
  config module, no `.env`).

Then:

```bash
cd my-app
npm install
npm run dev
```

## License

MIT
