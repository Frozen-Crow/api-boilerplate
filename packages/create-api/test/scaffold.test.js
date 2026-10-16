'use strict'

// Scaffolder tests (node:test — keeps create-api dependency-free). Each test runs
// the real bin/create-api.js into a temp directory and inspects the output.

const { test } = require('node:test')
const assert = require('node:assert')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { execFileSync, spawnSync } = require('node:child_process')

const BIN = path.join(__dirname, '..', 'bin', 'create-api.js')

function scaffold(t, name) {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'create-api-test-'))
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }))
  execFileSync(process.execPath, [BIN, name, '--services', ''], { cwd, stdio: 'pipe' })
  return path.join(cwd, name)
}

const read = (dir, file) => fs.readFileSync(path.join(dir, file), 'utf8')
const readJson = (dir, file) => JSON.parse(read(dir, file))

// Every file in the generated project.
function projectFiles(dir) {
  const out = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...projectFiles(full))
    else out.push(full)
  }
  return out
}

// Load the generated config through node-config in a fresh process.
function loadConfig(projectDir, env) {
  const configModule = require.resolve('config')
  return spawnSync(
    process.execPath,
    ['-e', `const c=require(${JSON.stringify(configModule)}); process.stdout.write(JSON.stringify(c.get('port')))`],
    { encoding: 'utf8', env: { ...process.env, NODE_CONFIG_DIR: path.join(projectDir, 'config'), ...env } }
  )
}

test('personalizes every template "my-api" reference (#11)', (t) => {
  const dir = scaffold(t, 'cool-app')

  for (const file of projectFiles(dir)) {
    const text = fs.readFileSync(file, 'utf8')
    assert.doesNotMatch(text, /my-api|My API/, `template name left in ${path.relative(dir, file)}`)
  }

  const compose = read(dir, 'docker-compose.yml')
  assert.match(compose, /^name: cool-app$/m, 'compose project is named after the package')
  assert.match(compose, /MONGODB_URI=mongodb:\/\/mongodb:27017\/cool-app$/m)

  assert.strictEqual(readJson(dir, 'config/default.json').mongodb, 'mongodb://localhost:27017/cool-app')
  const testCfg = readJson(dir, 'config/test.json')
  assert.strictEqual(testCfg.mongodb, 'mongodb://localhost:27017/cool-app-test')
  assert.strictEqual(testCfg.appName, 'cool-app (test)')

  assert.match(read(dir, 'README.md'), /^# cool-app$/m)
  assert.match(read(dir, 'public/index.html'), /<title>cool-app<\/title>/)
})

test('sanitizes package names that are invalid database / compose names (#11)', (t) => {
  const dir = scaffold(t, 'my.app')

  assert.strictEqual(readJson(dir, 'config/default.json').mongodb, 'mongodb://localhost:27017/my-app')
  assert.strictEqual(readJson(dir, 'config/test.json').mongodb, 'mongodb://localhost:27017/my-app-test')
  assert.match(read(dir, 'docker-compose.yml'), /^name: my-app$/m)
  // Display names keep the real package name.
  assert.strictEqual(readJson(dir, 'config/default.json').appName, 'my.app')
})

test('maps the PORT env var to a number (#9)', (t) => {
  const dir = scaffold(t, 'port-app')
  const result = loadConfig(dir, { PORT: '4321', NODE_ENV: 'development', SUPPRESS_NO_CONFIG_WARNING: '1' })
  assert.strictEqual(result.status, 0, result.stderr)
  assert.strictEqual(result.stdout, '4321', 'port is the number 4321, not the string "4321"')
})

test('Dockerfile runs the production stage with NODE_ENV=production (#10)', (t) => {
  const dir = scaffold(t, 'docker-app')
  const stages = read(dir, 'Dockerfile').split(/^FROM /m)
  const production = stages[stages.length - 1]
  assert.match(production, /^ENV NODE_ENV=production$/m)

  // config/production.json exists, so node-config loads cleanly with no
  // "did not match any deployment config file" warning.
  const result = loadConfig(dir, { NODE_ENV: 'production' })
  assert.strictEqual(result.status, 0, result.stderr)
  assert.doesNotMatch(result.stderr, /did not match any deployment config/)
})
