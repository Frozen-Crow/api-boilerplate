# @frozencrow/create-api

Scaffold a new API project powered by
[`@frozencrow/api-core`](https://www.npmjs.com/package/@frozencrow/api-core).

## Usage

```bash
npm create @frozencrow/api my-app
# or
npx @frozencrow/create-api my-app
```

This creates `my-app/` from the bundled template, then:

- sets the project's package name,
- generates a strong `AUTH_SECRET` and writes a ready-to-edit `.env`,
- points `MONGODB_URI` at a database named after your project.

Then:

```bash
cd my-app
npm install
npm run dev
```

The generated project depends on `@frozencrow/api-core` and includes an example
multitenant `widgets` service (`src/services/widgets/`) showing the pattern for
adding your own resources.

## License

MIT
