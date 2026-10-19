// The image runs the committed *.js, compiled from the *.ts. This pins that the toolchain works
// (`tsc -p tsconfig.json` compiles cleanly with the locked typescript + @types/node) and that the committed
// *.js is exactly what the *.ts compiles to today (CRLF included), so the two cannot drift apart.
// Node built-ins only (tsc is the locked devDependency):  node --test test/compile.test.js
'use strict'

const {test} = require('node:test')
const assert = require('node:assert/strict')
const {spawnSync} = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const ROOT = path.join(__dirname, '..')

function jsFiles(dir, base = dir) {
    return fs.readdirSync(dir, {withFileTypes: true}).flatMap(e => {
        const p = path.join(dir, e.name)
        if (e.isDirectory()) return jsFiles(p, base)
        return e.name.endsWith('.js') ? [path.relative(base, p)] : []
    })
}

test('tsc compiles the sources cleanly and the committed *.js is their exact output', () => {
    const out = fs.mkdtempSync(path.join(os.tmpdir(), 'dt-tsc-'))
    try {
        const tsc = path.join(ROOT, 'node_modules', 'typescript', 'bin', 'tsc')
        const r = spawnSync(process.execPath, [tsc, '-p', 'tsconfig.json', '--outDir', out],
            {cwd: ROOT, encoding: 'utf8'})
        assert.equal(r.status, 0, `tsc failed:\n${r.stdout}${r.stderr}`)

        const emitted = jsFiles(out).sort()
        assert.ok(emitted.includes('index.js') && emitted.length >= 11, `unexpected emit: ${emitted}`)
        for (const f of emitted) {
            const committed = path.join(ROOT, f)
            assert.ok(fs.existsSync(committed), `${f} is emitted but not committed`)
            assert.equal(fs.readFileSync(committed, 'utf8'), fs.readFileSync(path.join(out, f), 'utf8'),
                `${f} is stale: recompile (TESTING.md) and commit it`)
        }
    } finally {
        fs.rmSync(out, {recursive: true, force: true})
    }
})
