// Logging standard (pazka/hosh-management AGENTS.md section 11), on the committed Services/log.js and index.js:
// stdout only, one JSON object per line (ts, level, service, version, event, msg); a startup and a shutdown line;
// requests logged only when they fail (5xx, with err) or are slow (warn), /healthz at debug; X-Request-Id echoed
// or replaced; never an IP, a raw path, a query string, a body, a room id or a socket payload.
// Node built-ins plus the app's own express:  node --test test/log.test.js
'use strict'

const {test, before, after} = require('node:test')
const assert = require('node:assert/strict')
const {spawn} = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const express = require('express')
const {PollClient} = require('./sio-poll')
const L = require('../Services/log')

const ROOT = path.join(__dirname, '..')
const TS = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const mark = () => `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
const sleep = ms => new Promise(r => setTimeout(r, ms))

function memLogger(level) {
    const lines = []
    const logger = L.createLogger(level, {write: s => lines.push(s)}, 'v1.2.3')
    return {logger, lines, parsed: () => lines.map(l => JSON.parse(l))}
}

// ---- unit: Services/log.js -----------------------------------------------------------------------------------

test('createLogger: one JSON object per line with ts, level, service, version, event, msg, then the fields', () => {
    const {logger, lines, parsed} = memLogger('info')
    logger.info('startup', 'hello', {port: 1})
    assert.equal(lines.length, 1)
    assert.ok(lines[0].endsWith('\n') && !lines[0].slice(0, -1).includes('\n'))
    const o = parsed()[0]
    assert.deepEqual(Object.keys(o), ['ts', 'level', 'service', 'version', 'event', 'msg', 'port'])
    assert.match(o.ts, TS)
    assert.ok(Math.abs(Date.parse(o.ts) - Date.now()) < 5000)
    assert.deepEqual([o.level, o.service, o.version, o.event, o.msg, o.port], ['info', 'drawtogether', 'v1.2.3', 'startup', 'hello', 1])
})

test('createLogger: LOG_LEVEL filters (default and unknown = info)', () => {
    const levels = l => {
        const {logger, parsed} = memLogger(l)
        for (const x of ['debug', 'info', 'warn', 'error']) logger[x]('e', x)
        return parsed().map(o => o.level)
    }
    assert.deepEqual(levels('debug'), ['debug', 'info', 'warn', 'error'])
    assert.deepEqual(levels('info'), ['info', 'warn', 'error'])
    assert.deepEqual(levels(undefined), ['info', 'warn', 'error'])
    assert.deepEqual(levels('loud'), ['info', 'warn', 'error'])
    assert.deepEqual(levels('warn'), ['warn', 'error'])
    assert.deepEqual(levels('error'), ['error'])
    assert.equal(L.createLogger('nope', {write() {}}, 'x').level, 'info')
})

test('configNamesSet lists the names that are set, never a value', () => {
    assert.deepEqual(L.configNamesSet({PORT: '8000', UPLOADS_DIR: '/data/u', PERSIST_DIR: '', LOG_LEVEL: 'debug', OTHER: 'x'}),
        ['PORT', 'UPLOADS_DIR', 'LOG_LEVEL'])
    assert.deepEqual(L.configNamesSet({}), [])
})

test('errField: type, message, stack frames; request data in the message is hidden as whole words', () => {
    const e = new TypeError("Failed to decode param 'secretRoom' (allow list)")
    const {err} = L.errField(e, ['secretRoom', 'all'])
    assert.equal(err.type, 'TypeError')
    assert.equal(err.message, "Failed to decode param '<hidden>' (allow list)")
    const lines = err.stack.split('\n')
    assert.equal(lines[0], "TypeError: Failed to decode param '<hidden>' (allow list)")
    assert.ok(lines.length > 1 && lines.slice(1).every(l => /^\s+at /.test(l)), err.stack)
    assert.ok(!err.stack.includes('secretRoom'))
    // a stack whose first line differs from the message (multi-line message) keeps only the frames
    const m = new Error('line one\nsecretRoom line two')
    assert.ok(!L.errField(m, ['secretRoom']).err.stack.includes('secretRoom'))
    assert.deepEqual(L.errField('boom secretRoom', ['secretRoom']), {err: {type: 'string', message: 'boom <hidden>'}})
    assert.equal(L.errField(new Error('x.y?z'), ['x.y?z']).err.message, '<hidden>') // regex characters are literal
})

test('urlParts: the URL, path, query and the request segments, not the fixed route words', () => {
    const parts = L.urlParts('/api/room/r%C3%A9union/import?q=1')
    for (const p of ['/api/room/r%C3%A9union/import?q=1', '/api/room/r%C3%A9union/import', 'q=1', 'r%C3%A9union', 'réunion'])
        assert.ok(parts.includes(p), p)
    for (const w of ['api', 'room', 'import']) assert.ok(!parts.includes(w), w)
})

test('requestId: a plain token of at most 64 characters is kept, anything else is replaced', () => {
    assert.equal(L.requestId('abc-123_x.y:z'), 'abc-123_x.y:z')
    assert.equal(L.requestId('a'.repeat(64)), 'a'.repeat(64))
    assert.equal(L.requestId(['first', 'second']), 'first')
    for (const bad of [undefined, '', 'a'.repeat(65), 'has space', 'x"}{', 'é', 'a\nb', ['a b']])
        assert.match(L.requestId(bad), UUID, String(bad))
})

test('routeOf: route templates, never the raw path or the query', () => {
    const cases = {
        '/healthz': '/healthz', '/': '/', '/?x=1': '/',
        '/api/room/all': '/api/room/all', '/api/room/all?m=1': '/api/room/all',
        '/api/room/Secret1/import': '/api/room/:roomId/import',
        '/api/room/Secret1/2/upload': '/api/room/:roomId/:layerId/upload',
        '/api/room/Secret1': '/api/room/:roomid', '/api/room/Secret1/': '/api/room/:roomid',
        '/api/other/Secret1': '/api/*',
        '/uploads/Secret1/a.png': '/uploads/*', '/static/js/main.js': '/static/*',
        '/Secret1': '/:roomId', '/Secret1/': '/:roomId', '/Secret1.png': '/:file',
        '/Secret1/static/js/main.js': '/:roomId/*',
        '//': '(other)', '': '(other)',
    }
    for (const [url, route] of Object.entries(cases)) {
        assert.equal(L.routeOf(url), route, url)
        assert.ok(!L.routeOf(url).includes('Secret1'))
    }
})

test('migrationLog: the summary at info (persist_migration), a skipped file at warn', () => {
    const {logger, parsed} = memLogger('info')
    const ml = L.migrationLog(logger)
    ml('node-persist migration (md5 -> sha256 names) in /d: 1 copied, 0 already migrated, 0 skipped')
    ml('node-persist migration: skipped 0123 (no key)')
    ml('node-persist migration: cannot list /d (EACCES)')
    assert.deepEqual(parsed().map(o => [o.level, o.event]),
        [['info', 'persist_migration'], ['warn', 'persist_migration_skip'], ['warn', 'persist_migration_skip']])
    assert.match(parsed()[0].msg, /1 copied, 0 already migrated, 0 skipped/)
})

// ---- requestLogger + errorRecorder on a real express app with a fake clock ----------------------------------

async function withApp(level, fn) {
    const {logger, parsed} = memLogger(level)
    let clock = 0
    const app = express()
    app.set('env', 'test') // as index.js: Express prints no error to stderr
    app.use(L.requestLogger(logger, () => clock))
    app.get('/healthz', (req, res) => res.status(Number(req.query.s || 200)).end())
    app.get('/api/room/:roomid', (req, res) => {
        if (req.query.slow) clock += Number(req.query.slow)
        if (req.query.fail) throw new Error(`room ${req.params.roomid} broke`)
        if (req.query.s) return res.status(Number(req.query.s)).end()
        res.json({ok: true})
    })
    app.use(L.errorRecorder)
    const server = await new Promise(r => { const s = app.listen(0, '127.0.0.1', () => r(s)) })
    try {
        await fn(`http://127.0.0.1:${server.address().port}`, parsed)
    } finally {
        server.close()
    }
}

test('requests: 5xx at error with err, slow (> 1 s) at warn, others and /healthz only at debug', async () => {
    await withApp('info', async (base, parsed) => {
        assert.equal((await fetch(`${base}/api/room/Secret1?q=Q1`)).status, 200)
        assert.equal((await fetch(`${base}/api/room/Secret1?s=404`)).status, 404)
        assert.equal((await fetch(`${base}/api/room/Secret1?slow=1000`)).status, 200)   // exactly 1 s: not slow
        assert.equal((await fetch(`${base}/healthz?s=503`)).status, 503)               // never above debug
        assert.equal((await fetch(`${base}/healthz`)).status, 200)
        await sleep(50)
        assert.deepEqual(parsed(), [])

        const failed = await fetch(`${base}/api/room/Secret1?fail=1&q=Q2`, {headers: {'x-request-id': 'edge-42'}})
        assert.equal(failed.status, 500)
        assert.equal(failed.headers.get('x-request-id'), 'edge-42')
        assert.equal((await fetch(`${base}/api/room/Secret1?s=502`)).status, 502)
        assert.equal((await fetch(`${base}/api/room/Secret1?slow=1001&q=Q3`)).status, 200)
        await sleep(50)
        const lines = parsed()
        assert.equal(lines.length, 3, JSON.stringify(lines))
        const [e1, e2, w] = lines
        assert.deepEqual([e1.level, e1.event, e1.req_id, e1.method, e1.route, e1.status], ['error', 'request_failed', 'edge-42', 'GET', '/api/room/:roomid', 500])
        assert.equal(typeof e1.dur_ms, 'number')
        assert.deepEqual([e1.err.type, e1.err.message], ['Error', 'room <hidden> broke'])
        assert.match(e1.err.stack, /^Error: room <hidden> broke\n\s+at /)
        assert.deepEqual([e2.level, e2.event, e2.status, e2.err], ['error', 'request_failed', 502, undefined])
        assert.match(e2.req_id, UUID)
        assert.deepEqual([w.level, w.event, w.route, w.status, w.dur_ms, w.err], ['warn', 'request_slow', '/api/room/:roomid', 200, 1001, undefined])
        const all = JSON.stringify(lines)
        for (const s of ['Secret1', 'Q2', 'Q3', 'fail=1', '127.0.0.1']) assert.ok(!all.includes(s), s)
    })
    await withApp('debug', async (base, parsed) => {
        await fetch(`${base}/healthz?s=503`)
        await fetch(`${base}/api/room/Secret1`)
        await sleep(50)
        assert.deepEqual(parsed().map(o => [o.level, o.event, o.route, o.status]),
            [['debug', 'healthz', '/healthz', 503], ['debug', 'request', '/api/room/:roomid', 200]])
    })
})

// ---- the real server (committed index.js), black box ------------------------------------------------------

function startServer(port, extraEnv = {}) {
    const data = fs.mkdtempSync(path.join(os.tmpdir(), 'dt-log-'))
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'dt-logcwd-'))
    const env = {...process.env, PORT: String(port), UPLOADS_DIR: path.join(data, 'uploads'),
        PERSIST_DIR: path.join(data, 'persist'), ...extraEnv}
    if (!('LOG_LEVEL' in extraEnv)) delete env.LOG_LEVEL
    const s = {out: '', err: '', base: `http://127.0.0.1:${port}`, data, cwd}
    s.proc = spawn(process.execPath, [path.join(ROOT, 'index.js'), 'prod'], {cwd, env})
    s.proc.stdout.on('data', d => { s.out += d })
    s.proc.stderr.on('data', d => { s.err += d })
    s.lines = () => s.out.split('\n').filter(Boolean).map(l => JSON.parse(l))
    s.ready = (async () => {
        const until = Date.now() + 15000
        while (!s.out.includes('"event":"startup"')) {
            if (Date.now() > until || s.proc.exitCode !== null) throw new Error('server did not start:\n' + s.out + s.err)
            await sleep(50)
        }
    })()
    s.stop = () => {
        if (s.proc.exitCode === null) s.proc.kill('SIGKILL')
        fs.rmSync(data, {recursive: true, force: true})
        fs.rmSync(cwd, {recursive: true, force: true})
    }
    return s
}

let info, debug
before(async () => {
    info = startServer(9137, {APP_VERSION: 'v9.8.7'})
    debug = startServer(9138, {LOG_LEVEL: 'debug'})
    await Promise.all([info.ready, debug.ready])
})
after(() => { info.stop(); debug.stop() })

test('server: the startup line (version, port, data dirs writable, config names without values)', () => {
    const starts = info.lines().filter(o => o.event === 'startup')
    assert.equal(starts.length, 1)
    const s = starts[0]
    assert.match(s.ts, TS)
    assert.deepEqual([s.level, s.service, s.version, s.msg, s.port, s.mode, s.log_level],
        ['info', 'drawtogether', 'v9.8.7', 'Listening on 9137', 9137, 'PROD', 'info'])
    assert.deepEqual([s.uploads_dir_writable, s.store_dir_writable], [true, true])
    assert.deepEqual(s.config, ['PORT', 'UPLOADS_DIR', 'PERSIST_DIR', 'APP_VERSION'])
    assert.ok(!JSON.stringify(s).includes(info.data), 'no path value in the startup line')
    const d = debug.lines().find(o => o.event === 'startup')
    assert.deepEqual([d.version, d.log_level, d.config], ['dev', 'debug', ['PORT', 'UPLOADS_DIR', 'PERSIST_DIR', 'LOG_LEVEL']])
    assert.ok(info.lines().some(o => o.event === 'persist_migration' && o.level === 'info'))
})

test('server: the startup line says store_dir_writable:false when PERSIST_DIR cannot be created', async () => {
    const data = fs.mkdtempSync(path.join(os.tmpdir(), 'dt-log-ro-'))
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'dt-logcwd-ro-'))
    try {
        fs.writeFileSync(path.join(data, 'afile'), '')
        const env = {...process.env, PORT: '9139', UPLOADS_DIR: path.join(data, 'uploads'),
            PERSIST_DIR: path.join(data, 'afile', 'persist')}
        delete env.LOG_LEVEL
        const proc = spawn(process.execPath, [path.join(ROOT, 'index.js'), 'prod'], {cwd, env})
        let out = ''
        proc.stdout.on('data', d => { out += d })
        proc.stderr.on('data', () => {})
        const until = Date.now() + 15000
        while (!out.includes('"event":"startup"') && proc.exitCode === null && Date.now() < until) await sleep(50)
        await sleep(200)
        if (proc.exitCode === null) proc.kill('SIGKILL')
        const starts = out.split('\n').filter(l => l.startsWith('{')).map(l => JSON.parse(l)).filter(o => o.event === 'startup')
        assert.equal(starts.length, 1, 'one startup line before the (pre-existing) store crash:\n' + out)
        assert.deepEqual([starts[0].uploads_dir_writable, starts[0].store_dir_writable], [true, false])
    } finally {
        fs.rmSync(data, {recursive: true, force: true})
        fs.rmSync(cwd, {recursive: true, force: true})
    }
})

test('server: a 5xx (CORS refusal) is one error line with err; the answer is unchanged; nothing on stderr', async () => {
    const m = mark()
    const r = await fetch(`${info.base}/api/room/all?q=${m}`, {headers: {origin: 'https://evil.example', 'x-request-id': `req-${m}`, 'user-agent': `ua-${m}`}})
    assert.equal(r.status, 500)
    assert.equal(r.headers.get('x-request-id'), `req-${m}`)
    assert.match(await r.text(), /The CORS policy for this site does not allow access from the specified Origin\./)
    await sleep(100)
    const errs = info.lines().filter(o => o.req_id === `req-${m}`)
    assert.equal(errs.length, 1)
    const e = errs[0]
    assert.match(e.ts, TS)
    assert.deepEqual([e.level, e.service, e.version, e.event, e.method, e.route, e.status],
        ['error', 'drawtogether', 'v9.8.7', 'request_failed', 'GET', '/api/room/all', 500])
    assert.equal(typeof e.dur_ms, 'number')
    assert.equal(e.err.type, 'Error')
    assert.equal(e.err.message, 'The CORS policy for this site does not allow access from the specified Origin.')
    assert.match(e.err.stack, /^Error: The CORS policy[^\n]*\n\s+at /)
    const line = JSON.stringify(e)
    for (const s of [`q=${m}`, `ua-${m}`, 'evil.example']) assert.ok(!line.includes(s), s)
    assert.equal(info.err, '', 'stderr stays empty (Express no longer prints errors there)')
})

test('server: X-Request-Id is echoed when it is a plain token, replaced otherwise, on every answer', async () => {
    const ok = await fetch(`${info.base}/api/room/all`, {headers: {'x-request-id': 'abc.DEF-123'}})
    assert.equal(ok.headers.get('x-request-id'), 'abc.DEF-123')
    for (const bad of ['a'.repeat(65), 'two words', '"quoted"']) {
        const r = await fetch(`${info.base}/api/room/all`, {headers: {'x-request-id': bad}})
        assert.match(r.headers.get('x-request-id'), UUID, bad)
    }
    assert.match((await fetch(`${info.base}/`, {redirect: 'manual'})).headers.get('x-request-id'), UUID)
    assert.match((await fetch(`${info.base}/healthz`)).headers.get('x-request-id'), UUID)
})

test('server: ordinary requests, /healthz, a bad body and sockets log nothing at info; never an IP, path, query or payload', async () => {
    const m = mark()
    const before = info.out.length
    await fetch(`${info.base}/${m}`)
    await fetch(`${info.base}/api/room/${m}?q=Q${m}`, {headers: {'user-agent': `ua-${m}`}})
    await fetch(`${info.base}/healthz?h=${m}`)
    const bad = await fetch(`${info.base}/api/room/${m}/import`, {method: 'POST', headers: {'content-type': 'application/json'}, body: `{"x":"B${m}`})
    assert.equal(bad.status, 400)
    const c = await new PollClient(info.base).connect()
    await c.emit('join', m)
    await c.waitFor('loadRoom')
    await c.close()
    await sleep(200)
    assert.equal(info.out.slice(before), '')
    assert.equal(info.err, '')
    assert.ok(!info.out.includes(m))
})

test('server (LOG_LEVEL=debug): /healthz and requests at debug by route; sockets only as counts, no payload, room or IP', async () => {
    const m = mark()
    const before = debug.out.length
    assert.equal((await fetch(`${debug.base}/healthz?h=${m}`)).status, 200)
    await fetch(`${debug.base}/${m}`)
    const room = {lastUpdate: 1, version: 0, cantDie: false, layers: [{id: 1, name: `L${m}`, imgPath: '', texts: [{text: `T${m}`}]}]}
    assert.equal((await fetch(`${debug.base}/api/room/${m}/import`, {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify(room)})).status, 200)
    const a = await new PollClient(debug.base).connect()
    const b = await new PollClient(debug.base).connect()
    try {
        await a.emit('join', m)
        const [loaded] = await a.waitFor('loadRoom')
        await b.emit('join', m)
        await a.emit('mouse', {x: 1, y: 2, name: `N${m}`})
        await b.waitFor('mouse')
        await a.emit('saveRoom', {...loaded, layers: [...loaded.layers, {id: 2, name: `S${m}`, imgPath: '', texts: []}]})
        await b.waitFor('loadRoom')
    } finally {
        await a.close()
        await b.close()
    }
    await sleep(300)
    const lines = debug.out.slice(before).split('\n').filter(Boolean).map(l => JSON.parse(l))
    const hz = lines.filter(o => o.route === '/healthz')
    assert.equal(hz.length, 1)
    assert.deepEqual([hz[0].level, hz[0].event, hz[0].status, hz[0].method], ['debug', 'healthz', 200, 'GET'])
    assert.ok(lines.some(o => o.level === 'debug' && o.event === 'request' && o.route === '/:roomId'))
    assert.ok(lines.some(o => o.level === 'debug' && o.event === 'request' && o.route === '/api/room/:roomId/import' && o.method === 'POST'))
    const conns = lines.filter(o => o.event === 'socket_connect')
    const discs = lines.filter(o => o.event === 'socket_disconnect')
    assert.equal(conns.length, 2)
    assert.equal(discs.length, 2)
    for (const o of [...conns, ...discs]) {
        assert.equal(o.level, 'debug')
        assert.deepEqual(Object.keys(o).sort(), ['clients', 'event', 'level', 'msg', 'service', 'ts', 'version'])
        assert.equal(typeof o.clients, 'number')
    }
    assert.deepEqual(lines.filter(o => !['healthz', 'request', 'socket_connect', 'socket_disconnect'].includes(o.event)), [])
    const text = debug.out.slice(before)
    assert.ok(!text.includes(m), 'no room id, path, query or payload')
    assert.ok(!/127\.0\.0\.1|::ffff|::1/.test(text), 'no IP')
    assert.equal(debug.err, '')
})

test('server: every stdout line is a standard JSON line; SIGTERM writes one shutdown line and exits 0', async () => {
    info.proc.kill('SIGTERM')
    const code = await new Promise(r => info.proc.exitCode !== null ? r(info.proc.exitCode) : info.proc.on('exit', r))
    assert.equal(code, 0)
    const lines = info.out.split('\n').filter(Boolean)
    for (const l of lines) {
        const o = JSON.parse(l)
        assert.deepEqual(Object.keys(o).slice(0, 6), ['ts', 'level', 'service', 'version', 'event', 'msg'], l)
        assert.match(o.ts, TS)
        assert.ok(['debug', 'info', 'warn', 'error'].includes(o.level))
        assert.match(o.event, /^[a-z]+(_[a-z]+)*$/)
    }
    const downs = lines.map(l => JSON.parse(l)).filter(o => o.event === 'shutdown')
    assert.equal(downs.length, 1)
    assert.deepEqual([downs[0].level, downs[0].signal, downs[0].version], ['info', 'SIGTERM', 'v9.8.7'])
    assert.equal(info.err, '')
})

// ---- the room cleanup job (Controllers/roomController.removeUnusedRooms) ------------------------------------

test('room cleanup: one start line and one done line with dur_ms and counts, never a room id', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dt-clean-'))
    const code = `
        const rc = require(${JSON.stringify(path.join(ROOT, 'Controllers', 'roomController.js'))})
        ;(async () => {
            await new Promise(r => setTimeout(r, 300))
            const old = await rc.createNewRoom('OldRoomSecret')
            const keep = await rc.createNewRoom('KeepRoomSecret')
            await rc.createNewRoom('FreshRoomSecret')
            await rc.saveRoom({...old, lastUpdate: 0})
            await rc.saveRoom({...keep, lastUpdate: 0, cantDie: true})
            await rc.removeUnusedRooms()
            console.error('ROOMS ' + JSON.stringify(await rc.getAllRooms()))
            process.exit(0)
        })()`
    try {
        const p = spawn(process.execPath, ['-e', code, 'x', 'dev'], {cwd: dir, env: {...process.env, PERSIST_DIR: path.join(dir, 'p'), LOG_LEVEL: ''}})
        let out = '', err = ''
        p.stdout.on('data', d => { out += d })
        p.stderr.on('data', d => { err += d })
        assert.equal(await new Promise(r => p.on('exit', r)), 0, err)
        assert.match(err, /ROOMS \["KeepRoomSecret","FreshRoomSecret"\]/)
        const lines = out.split('\n').filter(Boolean).map(l => JSON.parse(l)).filter(o => o.event.startsWith('room_cleanup'))
        assert.deepEqual(lines.map(o => [o.level, o.event]), [['info', 'room_cleanup_start'], ['info', 'room_cleanup_done']])
        assert.equal(lines[0].rooms, 3)
        const done = lines[1]
        assert.deepEqual([done.checked, done.removed, done.kept_forever, done.rooms], [3, 1, 1, 2])
        assert.equal(typeof done.dur_ms, 'number')
        assert.ok(done.dur_ms >= 0)
        assert.ok(!/RoomSecret/.test(out), 'no room id in the log')
    } finally {
        fs.rmSync(dir, {recursive: true, force: true})
    }
})
