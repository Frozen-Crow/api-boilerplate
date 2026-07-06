'use strict'

const fs = require('node:fs')
const path = require('node:path')

// ---------- terminal styling (zero-dep ANSI) ----------
const useColor = process.stdout.isTTY && !process.env.NO_COLOR
const wrap = (code) => (s) => (useColor ? `[${code}m${s}[0m` : String(s))
const c = {
  bold: wrap('1'),
  dim: wrap('2'),
  green: wrap('32'),
  cyan: wrap('36'),
  yellow: wrap('33'),
  red: wrap('31'),
  magenta: wrap('35')
}

const log = {
  info: (msg) => console.log(msg),
  step: (msg) => console.log(`${c.cyan('›')} ${msg}`),
  created: (rel) => console.log(`  ${c.green('create')} ${rel}`),
  skipped: (rel) => console.log(`  ${c.yellow('skip')}   ${rel} ${c.dim('(exists, use --force)')}`),
  success: (msg) => console.log(`${c.green('✓')} ${msg}`),
  warn: (msg) => console.warn(`${c.yellow('!')} ${msg}`),
  error: (msg) => console.error(`${c.red('✗')} ${msg}`)
}

// ---------- argument parsing ----------
// Returns { _: [positionals], flags: { key: value|true } }.
function parseArgs(argv) {
  const out = { _: [], flags: {} }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg.startsWith('--')) {
      const body = arg.slice(2)
      const eq = body.indexOf('=')
      if (eq !== -1) {
        out.flags[body.slice(0, eq)] = body.slice(eq + 1)
      } else if (i + 1 < argv.length && !argv[i + 1].startsWith('--')) {
        out.flags[body] = argv[++i]
      } else {
        out.flags[body] = true
      }
    } else {
      out._.push(arg)
    }
  }
  return out
}

// ---------- casing ----------
function words(input) {
  return String(input)
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((w) => w.toLowerCase())
}
const toKebab = (input) => words(input).join('-')
const toCamel = (input) =>
  words(input)
    .map((w, i) => (i === 0 ? w : w[0].toUpperCase() + w.slice(1)))
    .join('')
const toPascal = (input) => {
  const camel = toCamel(input)
  return camel ? camel[0].toUpperCase() + camel.slice(1) : camel
}

// ---------- filesystem ----------
function writeFile(absPath, content, { force = false } = {}) {
  const rel = path.relative(process.cwd(), absPath)
  if (fs.existsSync(absPath) && !force) {
    log.skipped(rel)
    return false
  }
  fs.mkdirSync(path.dirname(absPath), { recursive: true })
  fs.writeFileSync(absPath, content)
  log.created(rel)
  return true
}

module.exports = { c, log, parseArgs, words, toKebab, toCamel, toPascal, writeFile }
