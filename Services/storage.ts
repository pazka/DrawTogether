import {RoomDTO} from "../DTOs/RoomDTO";

import persist = require('node-persist')
import {On, send} from "./events";
import {migrateMd5ToSha256} from "./persistMigration";

let ready = false
let initializing: Promise<void> = null

let isDequeuingJobs = false
let jobQueue: Function[] = []

function recursivelyExecJobStack(nbFnToExec : number){
    if(nbFnToExec == 0) {
        isDequeuingJobs = false
        return;
    }
    
    jobQueue.splice(0, 1)[0]().then(()=>recursivelyExecJobStack(nbFnToExec-1))
}

const operationWorker = setInterval(() => {
    if (jobQueue.length > 0 && !isDequeuingJobs) {
        isDequeuingJobs = true
        recursivelyExecJobStack(jobQueue.length)
    }
}, 1)

function init(): Promise<void> {
    if (!initializing) {
        initializing = (async () => {
            const options = await persist.init( {})
            // node-persist 4 names files sha256(key) instead of md5(key): copy the 3.x files before
            // the first read, or every existing room would vanish (MIGRATIONS.md)
            migrateMd5ToSha256(options.dir)
            ready = true
        })()
        initializing.catch(() => { initializing = null })
    }
    return initializing
}

async function safeOperation(cb: Function) {
    if (!ready) {
        await init()
    }
    
    jobQueue.push(cb)
}

async function safeSet(id: string, data: any) {
    return new Promise (resolve=>{
        safeOperation(() => persist.setItem(id, data).then(resolve))
    })
}

async function safeGet(id: string) {
    return new Promise (resolve=>{
      safeOperation(() => persist.getItem(id).then(resolve))  
    })
}


async function safeRemove(id: string) {
    return new Promise (resolve=>{
      safeOperation(() => persist.removeItem(id).then(resolve))  
    })
}


export async function getRooms() {
    return await safeGet('rooms')
}

export async function saveRooms(roomIds: string[]) {
    return await safeSet('rooms', roomIds)
}

export async function getRoom(id: string) {
    return await safeGet('room-' + id)
}

export async function saveRoom(room: RoomDTO) {
    try {
        return await safeSet('room-' + room.id, room)
    } catch (e) {
        send(On.ERROR, e)
    }
}

export async function removeRoom(id: string) {
    return await safeRemove('room-' + id)
}
