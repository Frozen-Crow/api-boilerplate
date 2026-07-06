'use strict'

const fs = require('node:fs')
const path = require('node:path')
const { log, c } = require('../util')

// List services discovered under src/services (each subfolder with a <name>.ts).
module.exports = function list(args) {
  const what = args._[0] || 'services'
  if (what !== 'services') {
    log.error(`Unknown list target "${what}". Try: services`)
    process.exit(1)
  }

  const dir = path.resolve(process.cwd(), String(args.flags.dir || 'src/services'))
  if (!fs.existsSync(dir)) {
    log.warn(`No services directory at ${path.relative(process.cwd(), dir)}`)
    return
  }

  const entries = fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .filter((name) => fs.existsSync(path.join(dir, name, `${name}.ts`)))
    .sort()

  if (entries.length === 0) {
    log.info(c.dim('No services found.'))
    return
  }

  console.log(c.bold(`\nServices (${entries.length})`))
  for (const name of entries) {
    console.log(`  ${c.cyan('•')} ${name}`)
  }
  console.log()
}
