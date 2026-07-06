// Copies the package READMEs into the site so the docs page renders them as the
// single source of truth. Runs automatically before `dev` and `build`.
import { mkdirSync, copyFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(here, '..', '..')
const outDir = join(here, '..', 'src', 'content')

mkdirSync(outDir, { recursive: true })

const docs = [
  ['packages/api-core/README.md', 'api-core.md'],
  ['packages/create-api/README.md', 'create-api.md']
]

for (const [src, dest] of docs) {
  const from = join(repoRoot, src)
  if (!existsSync(from)) {
    console.warn(`[sync-docs] missing ${src}, skipping`)
    continue
  }
  copyFileSync(from, join(outDir, dest))
  console.log(`[sync-docs] ${src} -> src/content/${dest}`)
}
