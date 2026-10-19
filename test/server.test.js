// Upgrade safety net (see TESTING.md): black-box characterization tests of the server that ships today
// (the committed index.js, started like `npm start` minus tsc). They pin what it does NOW, quirks included,
// so a Node, Express, multer or Socket.IO bump that changes behaviour fails here.
// Node built-ins only:  node --test test/server.test.js
'use strict'

const {test, before, after} = require('node:test')
const assert = require('node:assert/strict')
const {spawn} = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')
const {PollClient} = require('./sio-poll')

const ROOT = path.join(__dirname, '..')
const BASE = 'http://127.0.0.1:9001' // env.json DEV.PORT
const UPLOADS = path.join(ROOT, 'front', 'build', 'uploads')
// 1x1 PNG
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')

let server, work, log = ''
const ids = () => `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

before(async () => {
    // node-persist (.node-persist/) and multer temp files ("uploads/") are relative to the cwd. Keep the cwd
    // on the same filesystem as front/build/uploads, as in the image (cwd /app): multer renames its temp
    // file there, and a cross-device rename fails with EXDEV (the known compose bug, see TESTING.md).
    work = fs.mkdtempSync(path.join(ROOT, '.test-work-'))
    server = spawn(process.execPath, [path.join(ROOT, 'index.js'), 'dev'], {cwd: work})
    server.stdout.on('data', d => { log += d })
    server.stderr.on('data', d => { log += d })
    const until = Date.now() + 15000
    while (!log.includes('Listening on 9001')) {
        if (Date.now() > until) throw new Error('server did not start:\n' + log)
        if (server.exitCode !== null) throw new Error('server exited:\n' + log)
        await new Promise(r => setTimeout(r, 50))
    }
})

after(() => {
    server.kill()
    fs.rmSync(work, {recursive: true, force: true})
})

const json = async (p, init) => (await fetch(BASE + p, init)).json()
const importRoom = (id, room) => fetch(`${BASE}/api/room/${id}/import`, {
    method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify(room),
})

function upload(roomId, layerId, name, bytes, type = 'image/png') {
    const form = new FormData()
    form.append('layerImg', new Blob([bytes], {type}), name)
    return fetch(`${BASE}/api/room/${roomId}/${layerId}/upload`, {method: 'POST', body: form})
}

test('GET / creates a room with an 8-char id and redirects to it', async () => {
    const r = await fetch(BASE + '/', {redirect: 'manual'})
    assert.equal(r.status, 302)
    const id = r.headers.get('location')
    assert.match(id, /^[A-Za-z0-9]{8}$/)
    assert.ok((await json('/api/room/all')).includes(id))
    const room = await json('/api/room/' + id)
    assert.equal(room.id, id)
    assert.deepEqual(room.layers, [{imgPath: '', texts: [], name: 'Layer', id: 1}])
    assert.deepEqual([room.version, room.cantDie], [0, false])
})

test('visiting /<name> creates that room (custom URL = new whiteboard)', async () => {
    const id = ids()
    await fetch(`${BASE}/${id}`)
    const room = await json('/api/room/' + id)
    assert.equal(room.id, id)
    assert.equal(room.layers.length, 1)
})

test('an unknown room id returns an empty default room (no id)', async () => {
    const room = await json('/api/room/never-visited-' + ids())
    assert.equal(room.id, undefined)
    assert.deepEqual([room.version, room.cantDie, room.layers], [0, false, []])
    assert.equal(typeof room.lastUpdate, 'number')
})

test('import replaces a room (no auth: the URL is the key)', async () => {
    const id = ids()
    await fetch(`${BASE}/${id}`)
    const room = {lastUpdate: 1, version: 3, cantDie: true, layers: [{id: 1, name: 'Map', imgPath: '', texts: []}]}
    const r = await importRoom(id, room)
    assert.equal(r.status, 200)
    assert.deepEqual(await r.json(), {...room, id})
    assert.deepEqual(await json('/api/room/' + id), {...room, id})
})

test('image upload: stored under front/build/uploads/<room>/, linked in the layer, served back', async () => {
    const id = ids()
    await fetch(`${BASE}/${id}`)
    const r = await upload(id, 1, 'map.png', PNG)
    assert.equal(r.status, 200)
    assert.ok(fs.existsSync(path.join(UPLOADS, id, 'map.png')))
    const room = await json('/api/room/' + id)
    assert.equal(room.layers[0].imgPath, `/uploads/${id}/map.png`)
    assert.equal(room.version, 1)
    const img = await fetch(`${BASE}/uploads/${id}/map.png`)
    assert.equal(img.status, 200)
    assert.deepEqual(Buffer.from(await img.arrayBuffer()), PNG)
})

test('upload with a non-image extension is refused and nothing is stored', async () => {
    const id = ids()
    await fetch(`${BASE}/${id}`)
    // Repeated: the refused file used to race into the uploads folder (stored and served from the site).
    for (let i = 0; i < 20; i++) {
        const r = await upload(id, 1, `page${i}.html`, Buffer.from('<script>alert(1)</script>'), 'text/html')
        assert.equal(r.status, 403)
    }
    await new Promise(r => setTimeout(r, 200))
    assert.deepEqual(fs.existsSync(path.join(UPLOADS, id)) ? fs.readdirSync(path.join(UPLOADS, id)) : [], [])
    assert.equal((await fetch(`${BASE}/uploads/${id}/page0.html`)).status, 404)
})

test('known gap: upload checks the extension only, not the content or the size', async () => {
    const id = ids()
    await fetch(`${BASE}/${id}`)
    const r = await upload(id, 1, 'fake.png', Buffer.alloc(2 * 1024 * 1024, 0x41))
    assert.equal(r.status, 200)
})

test('CORS: allowed origin gets the header, foreign origin is refused', async () => {
    const ok = await fetch(BASE + '/api/room/all', {headers: {origin: 'http://localhost:3000'}})
    assert.equal(ok.headers.get('access-control-allow-origin'), 'http://localhost:3000')
    const ko = await fetch(BASE + '/api/room/all', {headers: {origin: 'https://evil.example'}})
    assert.equal(ko.status, 500)
})

test('CORS preflight: OPTIONS on any path answers 204 for an allowed origin, 500 for a foreign one', async () => {
    for (const p of ['/', '/api/room/all', '/api/room/abc/1/upload', '/some/deep/path']) {
        const ok = await fetch(BASE + p, {method: 'OPTIONS', headers: {
            origin: 'http://localhost:3000', 'access-control-request-method': 'POST'}})
        assert.equal(ok.status, 204, p)
        assert.equal(ok.headers.get('access-control-allow-origin'), 'http://localhost:3000', p)
        assert.match(ok.headers.get('access-control-allow-methods'), /POST/, p)
        const ko = await fetch(BASE + p, {method: 'OPTIONS', headers: {
            origin: 'https://evil.example', 'access-control-request-method': 'POST'}})
        assert.equal(ko.status, 500, p)
    }
})

test('requests are logged in Apache combined format (morgan)', async () => {
    const marker = ids()
    await fetch(`${BASE}/api/room/all?m=${marker}`, {headers: {'user-agent': `ua-${marker}`}})
    await new Promise(r => setTimeout(r, 100))
    assert.match(log, new RegExp(`"GET /api/room/all\\?m=${marker} HTTP/1\\.1" 200 \\d+ "-" "ua-${marker}"`))
})

test('a top-level path with a dot (a file name) does not create a room', async () => {
    const id = ids()
    const r = await fetch(`${BASE}/${id}.png`)
    assert.equal(r.status, 404)
    await fetch(`${BASE}/${id}`)                                   // a plain name does (control)
    const all = await (await fetch(BASE + '/api/room/all')).json()
    assert.ok(all.includes(id))
    assert.ok(!all.includes(`${id}.png`))
})

test('socket: join, loadRoom, presence, mouse broadcast, saveRoom versioning, out-of-sync error', async () => {
    const id = ids()
    await fetch(`${BASE}/${id}`)
    const a = await new PollClient(BASE).connect()
    const b = await new PollClient(BASE).connect()
    try {
        await b.emit('join', id)
        const [roomB] = await b.waitFor('loadRoom')
        assert.equal(roomB.id, id)

        await a.emit('join', id)
        assert.deepEqual(await b.waitFor('join'), [id])           // the others hear about the newcomer
        const [roomA] = await a.waitFor('loadRoom')
        await b.waitFor('loadRoom')                                // loadRoom goes to the whole room
        assert.equal(roomA.version, 0)

        await a.emit('mouse', {x: 10, y: 20})
        assert.deepEqual(await b.waitFor('mouse'), [{id: a.id, x: 10, y: 20}])

        await a.emit('saveRoom', {...roomA, layers: [...roomA.layers, {id: 2, name: 'L2', imgPath: '', texts: []}]})
        const [saved] = await b.waitFor('loadRoom')
        assert.equal(saved.version, 1)
        assert.equal(saved.layers.length, 2)
        assert.equal((await json('/api/room/' + id)).version, 1)

        await a.emit('saveRoom', {...roomA, version: 50})
        const [err] = await a.waitFor('error')
        assert.equal(typeof err, 'string')
    } finally {
        await a.close()
        await b.close()
    }
})

test('malformed multipart uploads get an error answer and do not take the server down', async () => {
    const id = ids()
    await fetch(`${BASE}/${id}`)
    const bodies = [
        '--x\r\nContent-Disposition: form-data; name="layerImg"; filename="a.png"\r\n\r\ntruncated',
        '--x\r\n' + 'A'.repeat(100) + ':' + '\r\n\r\n--x--',
        '--x\r\nContent-Disposition: form-data; name="layerImg"; filename="a.png"\r\n' + 'X-Junk: ' + 'B'.repeat(70000) + '\r\n\r\nx\r\n--x--',
    ]
    for (const body of bodies) {
        const r = await fetch(`${BASE}/api/room/${id}/1/upload`, {
            method: 'POST', headers: {'content-type': 'multipart/form-data; boundary=x'}, body,
        })
        assert.ok(r.status >= 400, `status ${r.status}`)
        await r.arrayBuffer()
    }
    assert.equal(server.exitCode, null, 'server process still running')
    assert.equal((await fetch(`${BASE}/api/room/${id}`)).status, 200)
})
