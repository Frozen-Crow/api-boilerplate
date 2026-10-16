import assert from 'assert'
import fs from 'fs'
import path from 'path'
import { spawnSync } from 'child_process'

// Issue #12: organizations and roles (incl. the custom organizations methods)
// must be part of the typed client. Emits the package's declarations, then
// compiles a consumer against them — the same surface a published consumer
// gets. This also catches declaration emit dropping a service's augmentation.
describe('client types (issue #12)', function () {
  this.timeout(120000)

  const tsc = require.resolve('typescript/bin/tsc')
  const packageDir = path.join(__dirname, '..')
  // Kept under node_modules so the emitted .d.ts files resolve @feathersjs/* from the repo.
  const outDir = path.join(packageDir, 'node_modules', '.cache', 'client-types-test')
  const run = (args: string[]) => spawnSync(process.execPath, [tsc, ...args], { encoding: 'utf8' })

  after(() => fs.rmSync(outDir, { recursive: true, force: true }))

  it('exposes organizations and roles on the typed client', () => {
    fs.rmSync(outDir, { recursive: true, force: true })
    const emit = run([
      '-p', path.join(packageDir, 'tsconfig.json'),
      '--declaration', '--emitDeclarationOnly', '--outDir', outDir
    ])
    assert.strictEqual(emit.status, 0, `declaration emit failed:\n${emit.stdout}${emit.stderr}`)

    // The fixture imports the source client (so it's type-checked in place);
    // point it at the emitted declarations instead.
    const fixture = fs.readFileSync(path.join(__dirname, 'fixtures', 'client-types', 'consumer.ts'), 'utf8')
    const consumer = fixture.replace("'../../../src/client'", "'./client'")
    assert.notStrictEqual(consumer, fixture, 'fixture import path not found')
    fs.writeFileSync(path.join(outDir, 'consumer.ts'), consumer)

    const check = run([
      '--noEmit', '--strict', '--skipLibCheck', '--esModuleInterop',
      '--moduleResolution', 'node', '--target', 'es2020', '--module', 'commonjs',
      path.join(outDir, 'consumer.ts')
    ])
    assert.strictEqual(check.status, 0, `typed client failed to compile:\n${check.stdout}${check.stderr}`)
  })
})
