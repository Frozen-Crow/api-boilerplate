#!/usr/bin/env node
// Bump every published package to the same version in lockstep, and update the
// internal dependency ranges that point at them (so the scaffold template keeps
// pinning a satisfiable range — important because for 0.x, `^0.1.0` does NOT
// satisfy `0.2.0`).
//
//   npm run bump patch|minor|major     # relative bump from the current version
//   npm run bump 1.4.0                  # explicit version
//   npm run bump minor --dry           # preview without writing
import { readFileSync, writeFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

// --- what to keep in lockstep ---------------------------------------------
// Published packages that get their `version` bumped:
const PACKAGES = ['packages/api-core', 'packages/create-api']
// package.json files whose dependency ranges on the packages above are updated
// (in addition to the packages themselves):
const DEPENDENTS = ['packages/create-api/template']
// Internal package names to rewrite ranges for, as `^<newVersion>`:
const INTERNAL = ['@frozencrow/api-core', '@frozencrow/create-api']
const DEP_FIELDS = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']

const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'))
const writeJson = (p, obj) => writeFileSync(p, JSON.stringify(obj, null, 4) + '\n')

function parseSemver(v) {
  const m = /^(\d+)\.(\d+)\.(\d+)(?:-[0-9A-Za-z.-]+)?$/.exec(v)
  if (!m) throw new Error(`Invalid version: "${v}"`)
  return { major: +m[1], minor: +m[2], patch: +m[3] }
}
function applyBump(v, type) {
  const s = parseSemver(v)
  if (type === 'major') return `${s.major + 1}.0.0`
  if (type === 'minor') return `${s.major}.${s.minor + 1}.0`
  if (type === 'patch') return `${s.major}.${s.minor}.${s.patch + 1}`
  return null
}

const args = process.argv.slice(2)
const dry = args.includes('--dry') || args.includes('--dry-run')
const spec = args.find((a) => !a.startsWith('--'))

if (!spec) {
  console.error('Usage: npm run bump <major|minor|patch|x.y.z> [--dry]')
  process.exit(1)
}

const current = readJson(join(root, PACKAGES[0], 'package.json')).version
const next = ['major', 'minor', 'patch'].includes(spec) ? applyBump(current, spec) : (parseSemver(spec), spec)

console.log(`${dry ? '[dry-run] ' : ''}Bumping ${current} -> ${next}\n`)

const edits = [] // { path, pkg }

for (const rel of PACKAGES) {
  const p = join(root, rel, 'package.json')
  const pkg = readJson(p)
  pkg.version = next
  edits.push({ p, pkg })
  console.log(`  ${pkg.name}  version -> ${next}`)
}

for (const rel of [...PACKAGES, ...DEPENDENTS]) {
  const p = join(root, rel, 'package.json')
  const pkg = edits.find((e) => e.p === p)?.pkg ?? readJson(p)
  let touched = false
  for (const field of DEP_FIELDS) {
    const deps = pkg[field]
    if (!deps) continue
    for (const name of INTERNAL) {
      if (deps[name] && deps[name] !== `^${next}`) {
        console.log(`  ${pkg.name}  ${field}.${name}: ${deps[name]} -> ^${next}`)
        deps[name] = `^${next}`
        touched = true
      }
    }
  }
  if (touched && !edits.find((e) => e.p === p)) edits.push({ p, pkg })
}

if (dry) {
  console.log('\n[dry-run] no files written.')
  process.exit(0)
}

for (const { p, pkg } of edits) writeJson(p, pkg)

try {
  execSync('npm install --package-lock-only', { cwd: root, stdio: 'ignore' })
  console.log('\n  package-lock.json refreshed')
} catch {
  console.log('\n  (run `npm install` to refresh the lockfile)')
}

console.log(`\nDone. To release:
  git commit -am "v${next}" && git tag v${next}
  npm publish --workspace @frozencrow/api-core --workspace @frozencrow/create-api`)
