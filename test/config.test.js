// hosh-deploy mode (docker-compose.example.yml): PORT, UPLOADS_DIR and PERSIST_DIR come from the env, and
// GET /healthz proves the app works. The defaults (no env) are pinned by server.test.js and scripts/smoke.sh.
// Node built-ins only:  node --test test/config.test.js
'use strict'

const {test, before, after} = require('node:test')
const assert = require('node:assert/strict')
const {spawn} = require('node:child_process')
const crypto = require('node:crypto')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const ROOT = path.join(__dirname, '..')
const PORT = 9135
const BASE = `http://127.0.0.1:${PORT}`
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')

let server, data, cwd, log = ''

before(async () => {
    data = fs.mkdtempSync(path.join(os.tmpdir(), 'dt-data-'))
    cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'dt-cwd-'))
    server = spawn(process.execPath, [path.join(ROOT, 'index.js'), 'prod'], {
        cwd,
        env: {...process.env, PORT: String(PORT), UPLOADS_DIR: path.join(data, 'uploads'), PERSIST_DIR: path.join(data, 'persist')},
    })
    server.stdout.on('data', d => { log += d })
    server.stderr.on('data', d => { log += d })
    const until = Date.now() + 15000
    while (!log.includes(`Listening on ${PORT}`)) {
        if (Date.now() > until) throw new Error('server did not start:\n' + log)
        if (server.exitCode !== null) throw new Error('server exited:\n' + log)
        await new Promise(r => setTimeout(r, 50))
    }
})

after(() => {
    server.kill()
    fs.rmSync(data, {recursive: true, force: true})
    fs.rmSync(cwd, {recursive: true, force: true})
})

test('GET/HEAD /healthz: 200 ok, uploads + store writable, room count; no room "healthz", not logged', async () => {
    const r = await fetch(BASE + '/healthz')
    assert.equal(r.status, 200)
    assert.equal(r.headers.get('cache-control'), 'no-store')
    const body = await r.json()
    assert.deepEqual(Object.keys(body).sort(), ['rooms', 'status', 'store', 'uploads'])
    assert.deepEqual([body.status, body.uploads, body.store], ['ok', 'writable', 'writable'])
    assert.equal(typeof body.rooms, 'number')
    assert.equal((await fetch(BASE + '/healthz', {method: 'HEAD'})).status, 200)
    assert.ok(!(await (await fetch(BASE + '/api/room/all')).json()).includes('healthz'))
    assert.ok(!log.includes('GET /healthz'))
    // the probe files are gone (dotfiles, never served or read as rooms)
    assert.deepEqual(fs.readdirSync(path.join(data, 'uploads', '.tmp')), [])
})

test('PERSIST_DIR holds the node-persist files, UPLOADS_DIR the images (served under /uploads/), nothing in the cwd', async () => {
    const id = 'cfg' + Date.now().toString(36)
    await fetch(`${BASE}/${id}`)
    const form = new FormData()
    form.append('layerImg', new Blob([PNG], {type: 'image/png'}), 'p.png')
    assert.equal((await fetch(`${BASE}/api/room/${id}/1/upload`, {method: 'POST', body: form})).status, 200)

    assert.deepEqual(fs.readFileSync(path.join(data, 'uploads', id, 'p.png')), PNG)
    const served = await fetch(`${BASE}/uploads/${id}/p.png`)
    assert.equal(served.status, 200)
    assert.deepEqual(Buffer.from(await served.arrayBuffer()), PNG)
    assert.equal((await (await fetch(`${BASE}/api/room/${id}`)).json()).layers[0].imgPath, `/uploads/${id}/p.png`)

    await new Promise(r => setTimeout(r, 1500)) // node-persist write queue
    const name = crypto.createHash('sha256').update('room-' + id).digest('hex')
    assert.equal(JSON.parse(fs.readFileSync(path.join(data, 'persist', name), 'utf8')).value.id, id)
    assert.deepEqual(fs.readdirSync(cwd), [])
    assert.ok(!fs.existsSync(path.join(ROOT, 'front', 'build', 'uploads', id)))
})

test('a PORT that is not a port number stops the server at start', async () => {
    const r = spawn(process.execPath, [path.join(ROOT, 'index.js'), 'prod'], {cwd, env: {...process.env, PORT: 'eighty'}})
    let out = ''
    r.stderr.on('data', d => { out += d })
    const code = await new Promise(res => r.on('exit', res))
    assert.notEqual(code, 0)
    assert.match(out, /PORT must be a TCP port number/)
})
