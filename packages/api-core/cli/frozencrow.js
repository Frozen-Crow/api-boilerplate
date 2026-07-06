#!/usr/bin/env node
'use strict'

/**
 * frozencrow — developer CLI shipped with @frozencrow/api-core.
 *
 *   npx frozencrow generate service widgets --fields "name:string,qty:number"
 *   npx frozencrow generate hook audit-log
 *   npx frozencrow secret --write
 *   npx frozencrow list services
 */

const { parseArgs, c, log } = require('./util')

const pkg = require('../package.json')

const generateService = require('./commands/generate-service')
const generateHook = require('./commands/generate-hook')
const secret = require('./commands/secret')
const list = require('./commands/list')

const HELP = `
${c.bold('frozencrow')} ${c.dim('· CLI for @frozencrow/api-core')}

${c.bold('Usage')}
  frozencrow <command> [options]

${c.bold('Commands')}
  ${c.cyan('generate service')} <name>   Scaffold a service (schema + class + registration)
  ${c.cyan('generate hook')} <name>      Scaffold a Feathers hook
  ${c.cyan('secret')}                    Generate a strong AUTH_SECRET
  ${c.cyan('list')} [services]           List the services in this project

${c.bold('generate service options')}
  --fields "a:string,b:number"   Fields (types: string, number, boolean, integer; suffix ? = optional)
  --access team|user|public      Access model (default: team / multitenant)
  --dir <path>                   Output dir (default: src/services)
  --wire                         Also register it in src/app.ts
  --force                        Overwrite existing files

${c.bold('secret options')}
  --write                        Write/update authentication.secret in config/local.json
  --file <path>                  Config file to update (default: config/local.json)

${c.bold('Examples')}
  frozencrow g service invoices --fields "amount:number,paid?:boolean"
  frozencrow g service audit-events --access public
  frozencrow secret --write
`

const aliases = { g: 'generate', ls: 'list' }

function main() {
  const argv = process.argv.slice(2)

  if (argv.length === 0 || argv[0] === 'help' || argv.includes('-h') || argv.includes('--help')) {
    console.log(HELP)
    return
  }
  if (argv[0] === '--version' || argv[0] === '-v') {
    console.log(pkg.version)
    return
  }

  let [cmd, ...rest] = argv
  cmd = aliases[cmd] || cmd

  if (cmd === 'generate') {
    let [sub, ...subrest] = rest
    const subAliases = { s: 'service', h: 'hook' }
    sub = subAliases[sub] || sub
    const args = parseArgs(subrest)
    if (sub === 'service') return generateService(args)
    if (sub === 'hook') return generateHook(args)
    log.error(`Unknown generator "${sub || ''}". Try: service, hook`)
    process.exit(1)
  }

  const args = parseArgs(rest)
  if (cmd === 'secret') return secret(args)
  if (cmd === 'list') return list(args)

  log.error(`Unknown command "${cmd}". Run "frozencrow help".`)
  process.exit(1)
}

main()
