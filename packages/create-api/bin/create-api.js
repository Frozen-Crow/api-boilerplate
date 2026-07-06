#!/usr/bin/env node
'use strict'

/**
 * Scaffolder for @frozencrow/api-core based projects.
 *
 *   npm create @frozencrow/api my-app
 *   npx @frozencrow/create-api my-app --services posts,comments
 *
 * Copies the bundled template, renames the project, generates a strong secret
 * into config/local.json, and scaffolds the services you name (replacing the
 * bundled `widgets` example). Zero runtime dependencies.
 */

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const readline = require('readline')

const { generateServiceFiles, writeServicesBarrel, isValidServiceName } = require('../lib/generate-service')

const TEMPLATE_DIR = path.join(__dirname, '..', 'template')

// Files that must be renamed on copy (npm strips/renames some dotfiles in
// published packages, so we ship them dot-less).
const RENAME_ON_COPY = { gitignore: '.gitignore' }

function parseArgs(argv) {
  const out = { _: [], flags: {} }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg.startsWith('--')) {
      const body = arg.slice(2)
      const eq = body.indexOf('=')
      if (eq !== -1) out.flags[body.slice(0, eq)] = body.slice(eq + 1)
      else if (i + 1 < argv.length && !argv[i + 1].startsWith('--')) out.flags[body] = argv[++i]
      else out.flags[body] = true
    } else {
      out._.push(arg)
    }
  }
  return out
}

function isValidPackageName(name) {
  return /^(?:@[a-z0-9-*~][a-z0-9-*._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/.test(name)
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true })
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'lib') continue
    const srcPath = path.join(src, entry.name)
    const destName = RENAME_ON_COPY[entry.name] || entry.name
    const destPath = path.join(dest, destName)
    if (entry.isDirectory()) copyDir(srcPath, destPath)
    else fs.copyFileSync(srcPath, destPath)
  }
}

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((resolve) => rl.question(question, (answer) => {
    rl.close()
    resolve(answer.trim())
  }))
}

// Parse a comma-separated services spec into validated, de-duped names.
function parseServices(spec) {
  if (typeof spec !== 'string') return []
  const seen = new Set()
  const valid = []
  for (const raw of spec.split(',').map((s) => s.trim()).filter(Boolean)) {
    if (!isValidServiceName(raw)) {
      console.warn(`  skipping invalid service name "${raw}" (use letters, numbers, hyphens)`)
      continue
    }
    const key = raw.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    valid.push(raw)
  }
  return valid
}

// Replace the bundled `widgets` example with the user's services and rewrite the
// services barrel. Always removes the widgets example.
function applyServices(targetDir, serviceNames) {
  const servicesDir = path.join(targetDir, 'src', 'services')

  fs.rmSync(path.join(servicesDir, 'widgets'), { recursive: true, force: true })
  fs.rmSync(path.join(targetDir, 'test', 'widgets.test.ts'), { force: true })

  const tokens = serviceNames.map((name) => {
    const n = generateServiceFiles(servicesDir, name)
    console.log(`  ${'create'} src/services/${n.dir}/`)
    return n
  })
  writeServicesBarrel(servicesDir, tokens)
  return tokens
}

async function main() {
  const { _, flags } = parseArgs(process.argv.slice(2))

  let projectName = _[0]
  if (!projectName) projectName = await ask('Project name: ')
  if (!projectName) {
    console.error('Error: a project name is required.')
    process.exit(1)
  }

  const targetDir = path.resolve(process.cwd(), projectName)
  const pkgName = path.basename(projectName)

  if (!isValidPackageName(pkgName)) {
    console.error(`Error: "${pkgName}" is not a valid npm package name.`)
    process.exit(1)
  }
  if (fs.existsSync(targetDir) && fs.readdirSync(targetDir).length > 0) {
    console.error(`Error: directory "${projectName}" already exists and is not empty.`)
    process.exit(1)
  }

  // Decide which services to scaffold: --services flag, else prompt (if
  // interactive), else none.
  let servicesSpec = flags.services
  if (servicesSpec === undefined) {
    servicesSpec = process.stdin.isTTY
      ? await ask('Services to create? Comma-separated names (e.g. posts,comments), or blank for none: ')
      : ''
  }
  const serviceNames = parseServices(servicesSpec)

  console.log(`\nCreating a new API in ${targetDir} ...`)
  copyDir(TEMPLATE_DIR, targetDir)

  // 1. Set the package name.
  const pkgPath = path.join(targetDir, 'package.json')
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
  pkg.name = pkgName
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 4) + '\n')

  // 2. Personalize config/default.json (app name + database name).
  const defaultConfigPath = path.join(targetDir, 'config', 'default.json')
  if (fs.existsSync(defaultConfigPath)) {
    const cfg = JSON.parse(fs.readFileSync(defaultConfigPath, 'utf8'))
    cfg.appName = pkgName
    cfg.mongodb = `mongodb://localhost:27017/${pkgName}`
    fs.writeFileSync(defaultConfigPath, JSON.stringify(cfg, null, 4) + '\n')
  }

  // 3. Generate a strong secret into config/local.json (git-ignored). The config
  // module (config/*.json) loads local.json last, so this overrides the default
  // placeholder secret without committing it. In production, set AUTH_SECRET —
  // it is mapped in config/custom-environment-variables.json.
  const secret = crypto.randomBytes(48).toString('base64url')
  fs.writeFileSync(
    path.join(targetDir, 'config', 'local.json'),
    JSON.stringify({ authentication: { secret } }, null, 4) + '\n'
  )

  // 4. Scaffold the requested services (replaces the bundled widgets example).
  applyServices(targetDir, serviceNames)

  const servicesLine = serviceNames.length
    ? `Scaffolded ${serviceNames.length} service${serviceNames.length === 1 ? '' : 's'}: ${serviceNames.join(', ')}.`
    : 'No custom services yet — add one with `npx frozencrow generate service <name>`.'

  console.log(`
Done! Next steps:

  cd ${projectName}
  npm install
  npm run dev

${servicesLine}
A strong secret was written to config/local.json (git-ignored); configure the
rest in config/default.json.
`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
