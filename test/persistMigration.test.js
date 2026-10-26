// node-persist 3 -> 4 data migration (MIGRATIONS.md): 3.x named each key's file md5(key), 4.x names it
// sha256(key). Loads the committed Services/persistMigration.js and the locked node-persist (4.x), on a temp
// dir filled in the 3.x on-disk layout (synthetic rooms only). Node built-ins only:
//   node --test test/persistMigration.test.js
'use strict'

const {test, beforeEach, afterEach} = require('node:test')
const assert = require('node:assert/strict')
const crypto = require('node:crypto')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const persist = require('node-persist')
const {migrateMd5ToSha256} = require('../Services/persistMigration')

const md5 = k => crypto.createHash('md5').update(k).digest('hex')
const sha256 = k => crypto.createHash('sha256').update(k).digest('hex')

// What node-persist 3.1.3 setItem(key, value) writes with the app's options (init({}): ttl false):
// file <dir>/md5(key), content JSON.stringify({key, value, ttl}).
function writeV3(dir, key, value) {
    fs.writeFileSync(path.join(dir, md5(key)), JSON.stringify({key, value, ttl: false}), 'utf8')
}

const ROOMS = {
    'rooms': ['abcdEFGH', 'déjà-vu'],
    'room-abcdEFGH': {
        id: 'abcdEFGH', version: 7, lastUpdate: 1761400000000, cantDie: false,
        layers: [{id: 1, name: 'Calque 1', image: '/uploads/abcdEFGH/pixel.png',
            lines: [{color: '#ff0000', width: 3, points: [[1, 2], [3.5, 4.25], [10, 20]]}]}],
    },
    'room-déjà-vu': {id: 'déjà-vu', version: 1, lastUpdate: 1761300000000, cantDie: true, layers: [{id: 1, lines: []}]},
}

let dir, logs
const log = m => logs.push(m)

async function readWithV4(key) {
    // a fresh 4.x instance with the app's defaults, only the dir differs; no background interval
    const storage = persist.create({dir, expiredInterval: false})
    await storage.init()
    return storage.getItem(key)
}

beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dt-persist-'))
    logs = []
    for (const [k, v] of Object.entries(ROOMS)) writeV3(dir, k, v)
})
afterEach(() => fs.rmSync(dir, {recursive: true, force: true}))

test('without migration node-persist 4 does not see 3.x data (why the migration exists)', async () => {
    assert.match(require('node-persist/package.json').version, /^4\./)
    assert.equal(await readWithV4('room-abcdEFGH'), undefined)
})

test('every 3.x key is readable identically by node-persist 4 after migration; originals kept', async () => {
    const before = Object.fromEntries(Object.keys(ROOMS).map(k => [k, fs.readFileSync(path.join(dir, md5(k)))]))
    assert.deepEqual(migrateMd5ToSha256(dir, log), {copied: 3, alreadyMigrated: 0, skipped: 0})
    for (const [k, v] of Object.entries(ROOMS)) {
        assert.deepEqual(await readWithV4(k), v, k)
        assert.deepEqual(fs.readFileSync(path.join(dir, sha256(k))), before[k], `${k}: exact bytes`)
        assert.deepEqual(fs.readFileSync(path.join(dir, md5(k))), before[k], `${k}: md5 original untouched`)
    }
    assert.deepEqual(fs.readdirSync(dir).filter(n => n.startsWith('.')), [], 'no temp file left')
    assert.match(logs.at(-1), /3 copied, 0 already migrated, 0 skipped/)
})

test('idempotent: a second run copies nothing and never overwrites what 4.x wrote since', async () => {
    migrateMd5ToSha256(dir, log)
    const storage = persist.create({dir, expiredInterval: false, writeQueue: false})
    await storage.init()
    const drawnAfterUpgrade = {...ROOMS['room-abcdEFGH'], version: 8}
    await storage.setItem('room-abcdEFGH', drawnAfterUpgrade)

    assert.deepEqual(migrateMd5ToSha256(dir, log), {copied: 0, alreadyMigrated: 3, skipped: 0})
    assert.deepEqual(await readWithV4('room-abcdEFGH'), drawnAfterUpgrade)
    // and 3.x (rollback) still finds the pre-upgrade room in the md5 file
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir, md5('room-abcdEFGH')), 'utf8')).value,
        ROOMS['room-abcdEFGH'])
})

test('corrupt, foreign, symlinked and non-file entries are skipped and logged, the rest migrates', async () => {
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'dt-outside-'))
    try {
        fs.writeFileSync(path.join(dir, md5('corrupt')), '{"key":"corrupt","val')        // truncated JSON
        fs.writeFileSync(path.join(dir, md5('nokey')), JSON.stringify({value: 1}))       // no key
        fs.writeFileSync(path.join(dir, md5('foreign')), JSON.stringify({key: 'other', value: 1})) // name != md5(key)
        fs.mkdirSync(path.join(dir, md5('a-dir')))
        writeV3(outside, 'room-evil', {id: 'evil'})
        fs.symlinkSync(path.join(outside, md5('room-evil')), path.join(dir, md5('room-evil')))
        fs.writeFileSync(path.join(dir, 'README'), 'not a storage file')                  // not md5-named: ignored
        fs.writeFileSync(path.join(dir, '.hidden'), 'x')                                   // dotfile: ignored

        const r = migrateMd5ToSha256(dir, log)
        assert.deepEqual(r, {copied: 3, alreadyMigrated: 0, skipped: 5})
        assert.equal(logs.filter(l => l.includes('skipped ')).length, 5)
        assert.ok(!fs.existsSync(path.join(dir, sha256('room-evil'))), 'symlink not followed')
        assert.ok(!fs.existsSync(path.join(dir, sha256('other'))))
        assert.deepEqual(fs.readdirSync(outside), [md5('room-evil')], 'nothing written outside dir')
        for (const [k, v] of Object.entries(ROOMS)) assert.deepEqual(await readWithV4(k), v, k)
    } finally {
        fs.rmSync(outside, {recursive: true, force: true})
    }
})

test('the 4.x expiry sweep (app default every 2 min) still runs and keeps every room after migration', async () => {
    migrateMd5ToSha256(dir, log)
    const storage = persist.create({dir, expiredInterval: false})
    await storage.init()
    await storage.removeExpiredItems()
    for (const [k, v] of Object.entries(ROOMS)) assert.deepEqual(await storage.getItem(k), v, k)
})

test('missing storage dir (fresh install): nothing to do, no throw', () => {
    assert.deepEqual(migrateMd5ToSha256(path.join(dir, 'nope'), log), {copied: 0, alreadyMigrated: 0, skipped: 0})
})
