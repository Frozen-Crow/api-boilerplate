'use strict'

const path = require('node:path')
const { log, c, toKebab, toCamel, writeFile } = require('../util')

function hookFile(camel) {
  return `import type { HookContext } from '@frozencrow/api-core'

/**
 * ${camel} hook.
 *
 * Use as a before/after/around hook, e.g. in a service's \`extensions\`:
 *   extensions: { before: { create: [${camel}()] } }
 */
export const ${camel} = () => {
  return async (context: HookContext) => {
    // context.params, context.data, context.result, context.method, context.id ...
    return context
  }
}
`
}

module.exports = function generateHook(args) {
  const rawName = args._[0]
  if (!rawName) {
    log.error('Usage: frozencrow generate hook <name> [--dir src/hooks]')
    process.exit(1)
  }

  const camel = toCamel(rawName)
  const file = toKebab(rawName)
  const baseDir = String(args.flags.dir || 'src/hooks')
  const outPath = path.resolve(process.cwd(), baseDir, `${file}.ts`)

  log.step(`Generating hook ${c.bold(camel)}`)
  writeFile(outPath, hookFile(camel), { force: Boolean(args.flags.force) })

  console.log()
  log.success('Hook generated. Import and attach it to a service:')
  console.log(c.dim(`\n    import { ${camel} } from '../../hooks/${file}'\n    // extensions: { before: { create: [${camel}()] } }\n`))
}
