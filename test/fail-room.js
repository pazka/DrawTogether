// Preload (node -r) for test/server.test.js: makes the creation of one room fail. While the file FAIL_ROOM_FILE
// exists, saving the room whose id it holds rejects (before the room is listed), with the id in the error message.
// Remove the file to lift the failure. Node built-ins only.
'use strict'

const fs = require('node:fs')
const path = require('node:path')
const storage = require(path.join(__dirname, '..', 'Services', 'storage.js'))

const file = process.env.FAIL_ROOM_FILE
const saveRoom = storage.saveRoom
storage.saveRoom = async (room) => {
    let failing = null
    try { failing = fs.readFileSync(file, 'utf8').trim() } catch (e) { /* no file: no failure */ }
    if (room && room.id === failing) throw new Error(`cannot save room-${room.id}`)
    return saveRoom(room)
}
