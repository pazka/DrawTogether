// Deterministic check of the upload extension refusal in the committed Controllers/imageController.js
// (what the image runs). fs is replaced so unlink is slow: before the fix the rename that follows the
// refusal still ran and could store the refused file (it raced the unlink; the black-box test in
// server.test.js only caught it under some timings). Node built-ins only.
'use strict'

const {test} = require('node:test')
const assert = require('node:assert/strict')
const Module = require('node:module')
const path = require('node:path')

const CONTROLLER = path.join(__dirname, '..', 'Controllers', 'imageController.js')

function loadWithFakes() {
    const calls = {rename: [], unlink: [], linked: []}
    const fakeFs = {
        existsSync: () => true,
        mkdirSync: () => {},
        unlink: (p, cb) => { calls.unlink.push(p); setTimeout(() => cb(null), 50) },
        rename: (a, b, cb) => { calls.rename.push([a, b]); setImmediate(() => cb(null)) },
    }
    const fakeRooms = {addImgPathInRoom: async (...args) => { calls.linked.push(args) }}
    const load = Module._load
    Module._load = function (request, parent, ...rest) {
        if (parent && parent.filename === CONTROLLER) {
            if (request === 'fs') return fakeFs
            if (request === './roomController') return fakeRooms
        }
        return load.call(this, request, parent, ...rest)
    }
    try {
        delete require.cache[CONTROLLER]
        return {controller: require(CONTROLLER), calls}
    } finally {
        Module._load = load
    }
}

test('a refused extension is deleted, never moved into the uploads folder', async () => {
    const {controller, calls} = loadWithFakes()
    await assert.rejects(controller.writeImage('page.html', 'room1', '1', '/tmp/upload-tmp'),
        /Only \.png, \.jpg, \.jpeg, \.svg files are allowed!/)
    await new Promise(r => setTimeout(r, 100))
    assert.deepEqual(calls.unlink, ['/tmp/upload-tmp'])
    assert.deepEqual(calls.rename, [])
    assert.deepEqual(calls.linked, [])
})

test('an accepted image is moved and linked to the layer', async () => {
    const {controller, calls} = loadWithFakes()
    await controller.writeImage('Map.PNG', 'room1', '2', '/tmp/upload-tmp')
    assert.deepEqual(calls.unlink, [])
    assert.equal(calls.rename.length, 1)
    assert.equal(calls.rename[0][0], '/tmp/upload-tmp')
    assert.match(calls.rename[0][1], /front[\\/]build[\\/]uploads[\\/]room1[\\/]Map\.PNG$/)
    assert.deepEqual(calls.linked, [['room1', 2, '/uploads/room1/Map.PNG']])
})
