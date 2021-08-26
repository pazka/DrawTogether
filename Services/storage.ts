import {Room} from "../DTOs/Room";

import * as persist from 'node-persist'

let ready = false

async function safeGet(id: string) {
    if (!ready) {
        return persist.init( /* options ... */).then(async (x) => {
            return await persist.getItem(id)
        })
    } else {
        return await persist.getItem(id)
    }

}

async function safeSet(id: string, data: any) {
    if (!ready) {
        return persist.init( /* options ... */).then(async (x) => {
            return await persist.setItem(id, data)
        })
    } else {
        return persist.setItem(id, data)
    }
}

export async function getRooms() {
    return await safeGet('rooms')
}

export async function saveRooms(roomIds: string[]) {
    return await persist.setItem('rooms', roomIds)
}

export async function getRoom(id: string) {
    return await safeGet('room-' + id)
}

export async function saveRoom(room: Room) {
    return await safeSet('room-' + room.id, room)
}

/*
    storage.getItem(req.params.id).then(data => {
        return res.send(data);
    }, err => {
        return res.send(err);
    })
    
    
    storage.setItem(req.params.id, req.body).then(data => {
        return res.send(data);
    }, err => {
        return res.send(err);
    })
*/