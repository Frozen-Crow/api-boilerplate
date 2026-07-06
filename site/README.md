# Frozencrow API — marketing & docs site

A Vite + React + TypeScript site for the `@frozencrow/api-core` and
`@frozencrow/create-api` packages: a marketing landing page plus a documentation
section that renders the package READMEs (single source of truth).

## Develop

```bash
cd site
npm install
npm run dev      # http://localhost:5178
```

`predev`/`prebuild` run `scripts/sync-docs.mjs`, which copies the package
READMEs into `src/content/` so the docs page always reflects the latest docs.
Edit the READMEs under `packages/*/README.md` — not the copies.

## Build

```bash
npm run build    # outputs static files to dist/
npm run preview  # preview the production build
```

`dist/` is a fully static bundle — deploy it to any static host (Vercel,
Netlify, GitHub Pages, Cloudflare Pages, S3/CloudFront). The app uses hash-based
routing, so it needs no server-side rewrite rules.

## Structure

```
src/
  pages/Landing.tsx    marketing landing (hero, features, showcase, packages, security, CTA)
  pages/Docs.tsx        docs — renders synced READMEs with a generated sidebar
  components/           Layout (nav + footer), CodeBlock, CopyButton
  content/              generated from packages/*/README.md (git-ignored)
```

> The GitHub URL in `src/components/Layout.tsx` is a placeholder —
> update it to your repository.
