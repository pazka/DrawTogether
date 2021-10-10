import * as storage from "../Services/storage";
import {RoomDTO} from "../DTOs/RoomDTO";
import {send, On} from "../Services/events";
import {LayerDTO} from "../DTOs/LayerDTO";

import env from "../Services/env"
import {removeItem} from "node-persist";
import {saveRooms} from "../Services/storage";

let allRoomIds: string[] = []

storage.getRooms().then(res => {
    allRoomIds = res as any ?? []
});

const roomCleanUpTimeout = setInterval(removeUnusedRooms, env.RoomCleanUpInterval * 1000)

async function removeUnusedRooms() {
    console.log("# Cleaning up room")
    let newRoomIds = [...allRoomIds]
    for (let index = allRoomIds.length -1; index >= 0 ; index--){
        let room: RoomDTO = await getRoom(allRoomIds[index])
        console.log(`# Checking room ${room.id}`)
        
        if(room.cantDie){
            console.log(`The room : ${room.id} can't die !`)
        }
    
        if (!room.cantDie && (Date.now() - room.lastUpdate > env.RoomTTL * 1000)) {
            await removeItem(room.id)

            newRoomIds.splice(index,1)
            console.log(`# Cleaned ${room.id}, last update : ${new Date(room.lastUpdate)}`)
        }
    }
    
    allRoomIds = newRoomIds
    await saveRooms(newRoomIds)
    console.log("# Room checked ")
}


export async function getRoom(id: string): Promise<RoomDTO> {

    if (!allRoomIds.includes(id)) {
        return new RoomDTO()
    } else {
        return await storage.getRoom(id) as any
    }
}

export async function fetchOrCreateRoom(id: string): Promise<RoomDTO> {

    if (!allRoomIds.includes(id)) {
        return createNewRoom(id)
    } else {
        return await storage.getRoom(id) as any
    }
}

export async function createNewRoom(existId: string = null): Promise<RoomDTO> {
    const room = new RoomDTO()
    room.id = existId ?? newUniqueId(8)
    room.layers = [new LayerDTO()]

    await storage.saveRoom(room)
    allRoomIds.push(room.id)
    await storage.saveRooms(allRoomIds)

    send(On.NEW_ROOM, room);
    return room
}

export async function saveRoom(room: RoomDTO): Promise<RoomDTO> {
    await storage.saveRoom(room)

    return room;
}

export async function updateRoom(room: RoomDTO): Promise<RoomDTO> {
    if (!allRoomIds.includes(room.id)) {
        throw Error('No Room with this id')
    }

    let lastRoom : RoomDTO = await storage.getRoom(room.id) as any
    if(Math.abs(Number(room.version) - Number(lastRoom.version)) > 10){
        throw Error(`You fell out of sync with the server : you(${room.version} < new(${lastRoom.version}`)
    }
    
    room.lastUpdate = Date.now()
    room.version = Number(room.version) + 1
    await storage.saveRoom(room)

    return room;
}

export async function addImgPathInRoom(roomId: string, layerId: number, path: string) {
    if (!allRoomIds.includes(roomId)) {
        throw Error('No Room with this id')
    }

    let room: RoomDTO = await storage.getRoom(roomId) as any
    room.lastUpdate = Date.now()
    const layerIndex = room.layers.findIndex(l => Number(l.id) === Number(layerId))
    room.layers[layerIndex].imgPath = path

    return updateRoom(room).then(res =>{
        send(On.EDIT_ROOM, room);
    })
}

export async function getAllRooms() {
    return allRoomIds
}

function newUniqueId(l: number): string {
    const cs = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let newId = new Array(l).fill(0).map(x => cs[Math.floor(Math.random() *
        cs.length)]).join('');

    return allRoomIds.includes(newId) ? newUniqueId(l) : newId
}
