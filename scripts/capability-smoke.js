// Capability smoke, run INSIDE the container (CI, and hosh-deploy POST_DEPLOY after every deploy):
//
//   node /app/scripts/capability-smoke.js [base URL, default http://127.0.0.1:$PORT or :80]
//
// Proves the whiteboard works, not just that something answers: the room list, the front for a room,
// a write round-trip (import, read back), an image upload stored and served back, and a Socket.IO client
// that joins the room and receives it. Everything happens in ONE fixed room (`hosh-deploy-smoke`, created
// once, overwritten on every run, expires like any room), so repeated runs never pile up data.
// Node built-ins only (+ test/sio-poll.js, the repo's fetch-based Socket.IO polling client).
// One JSON line per check; exit 1 if any check failed.
'use strict'

const {PollClient} = require('../test/sio-poll')

const base = (process.argv[2] || `http://127.0.0.1:${process.env.PORT || 80}`).replace(/\/$/, '')
const ROOM = 'hosh-deploy-smoke'
// 1x1 PNG
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')
const nonce = `smoke-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
let failed = 0

async function check(name, fn) {
    try {
        const detail = await fn()
        console.log(JSON.stringify({check: name, ok: true, ...(detail ? {detail} : {})}))
    } catch (err) {
        failed += 1
        console.log(JSON.stringify({check: name, ok: false, detail: (err && err.message) || String(err)}))
    }
}

function expect(cond, message) {
    if (!cond) throw new Error(message)
}

async function get(path, init) {
    const res = await fetch(base + path, {redirect: 'manual', ...init})
    const body = Buffer.from(await res.arrayBuffer())
    return {res, body, text: body.toString('utf8')}
}

async function getJson(path) {
    const {res, text} = await get(path)
    expect(res.status === 200, `GET ${path} -> ${res.status}`)
    return JSON.parse(text)
}

async function main() {
    await check('room list', async () => {
        const all = await getJson('/api/room/all')
        expect(Array.isArray(all), 'not a JSON array')
        return `${all.length} rooms`
    })

    await check('front for a room (creates it once)', async () => {
        const {res, text} = await get(`/${ROOM}/`)
        expect(res.status === 200 && /<div id="root">/i.test(text), `GET /${ROOM}/ -> ${res.status}`)
        const all = await getJson('/api/room/all')
        expect(all.includes(ROOM), 'room not listed after visiting it')
    })

    await check('write round-trip (import, read back)', async () => {
        const room = {
            lastUpdate: Date.now(), version: 0, cantDie: false,
            layers: [{id: 1, name: 'smoke', imgPath: '', texts: [{val: nonce, pos: [1, 2], size: 1, rot: 0}]}],
        }
        const {res} = await get(`/api/room/${ROOM}/import`, {
            method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify(room),
        })
        expect(res.status === 200, `import -> ${res.status}`)
        const back = await getJson(`/api/room/${ROOM}`)
        expect(back.id === ROOM && JSON.stringify(back).includes(nonce), 'imported room not read back')
    })

    await check('image upload stored and served back', async () => {
        const form = new FormData()
        form.append('layerImg', new Blob([PNG], {type: 'image/png'}), 'smoke.png')
        const up = await get(`/api/room/${ROOM}/1/upload`, {method: 'POST', body: form})
        expect(up.res.status === 200, `upload -> ${up.res.status} ${up.text.slice(0, 200)}`)
        const img = await get(`/uploads/${ROOM}/smoke.png`)
        expect(img.res.status === 200 && img.body.equals(PNG), `GET /uploads/${ROOM}/smoke.png -> ${img.res.status}`)
        const back = await getJson(`/api/room/${ROOM}`)
        expect(back.layers[0].imgPath === `/uploads/${ROOM}/smoke.png`, 'image not linked in the layer')
    })

    await check('socket.io: join the room, receive it', async () => {
        const c = await new PollClient(base).connect()
        try {
            await c.emit('join', ROOM)
            const [room] = await c.waitFor('loadRoom')
            expect(room && room.id === ROOM && JSON.stringify(room).includes(nonce), 'loadRoom without the room')
        } finally {
            await c.close()
        }
    })

    if (failed) {
        console.log(JSON.stringify({smoke: 'FAIL', failed}))
        process.exit(1)
    }
    console.log(JSON.stringify({smoke: 'OK', base}))
}

main().catch(err => {
    console.log(JSON.stringify({smoke: 'FAIL', detail: (err && err.message) || String(err)}))
    process.exit(1)
})
