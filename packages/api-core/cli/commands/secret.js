'use strict'

const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const { log, c } = require('../util')

// Generate a strong secret. With --write, set authentication.secret in the
// project's config/local.json (git-ignored) — the config-module way, no .env.
module.exports = function secret(args) {
  const value = crypto.randomBytes(48).toString('base64url')

  if (!args.flags.write) {
    console.log(value)
    return
  }

  const file = path.resolve(process.cwd(), String(args.flags.file || 'config/local.json'))

  let config = {}
  if (fs.existsSync(file)) {
    try {
      config = JSON.parse(fs.readFileSync(file, 'utf8'))
    } catch {
      log.error(`Could not parse ${path.relative(process.cwd(), file)} as JSON`)
      process.exit(1)
    }
  }

  config.authentication = { ...(config.authentication || {}), secret: value }
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, JSON.stringify(config, null, 4) + '\n')

  log.success(`Wrote a new authentication.secret to ${c.bold(path.relative(process.cwd(), file) || file)}`)
}
