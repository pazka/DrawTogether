import {RoomDTO} from "../DTOs/RoomDTO";

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
    return await safeSet('rooms', roomIds)
}

export async function getRoom(id: string) {
    return await safeGet('room-' + id)
}

export async function saveRoom(room: RoomDTO) {
    return await safeSet('room-' + room.id, room)
}
