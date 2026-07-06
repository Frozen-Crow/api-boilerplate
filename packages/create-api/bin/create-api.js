#!/usr/bin/env node
'use strict'

/**
 * Scaffolder for @frozencrow/api-core based projects.
 *
 *   npm create @frozencrow/api my-app
 *   npx @frozencrow/create-api my-app
 *
 * Copies the bundled template, renames the project, generates a strong
 * AUTH_SECRET, and writes a ready-to-edit .env. Zero runtime dependencies.
 */

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const readline = require('readline')

const TEMPLATE_DIR = path.join(__dirname, '..', 'template')

// Files that must be renamed on copy (npm strips/renames some dotfiles in
// published packages, so we ship them dot-less).
const RENAME_ON_COPY = { gitignore: '.gitignore' }

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
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath)
    } else {
      fs.copyFileSync(srcPath, destPath)
    }
  }
}

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((resolve) => rl.question(question, (answer) => {
    rl.close()
    resolve(answer.trim())
  }))
}

async function main() {
  let projectName = process.argv[2]

  if (!projectName) {
    projectName = await ask('Project name: ')
  }
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
  const localConfig = { authentication: { secret } }
  fs.writeFileSync(
    path.join(targetDir, 'config', 'local.json'),
    JSON.stringify(localConfig, null, 4) + '\n'
  )

  console.log(`
Done! Next steps:

  cd ${projectName}
  npm install
  npm run dev

A strong secret was written to config/local.json (git-ignored). Configure the
rest in config/default.json, then add your own services under src/services
(see src/services/widgets for the pattern, or run \`npx frozencrow g service\`).
`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
