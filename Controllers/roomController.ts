import * as storage from "../Services/storage";
import {RoomDTO} from "../DTOs/RoomDTO";
import {send,On} from "../Services/events";
import {LayerDTO} from "../DTOs/LayerDTO";

let allRoomIds : string[] = []

storage.getRooms().then(res =>{
    allRoomIds = res ?? []
});

export async function getRoom(id : string) : Promise<RoomDTO>{
    
    if(!allRoomIds.includes(id)){
        return createNewRoom(id)
    }else{
        return storage.getRoom(id)
    }
}

export async function createNewRoom(existId : string = null) : Promise<RoomDTO>{
    const room = new RoomDTO() 
    room.id = existId ?? newUniqueId(8)
    room.layers = [new LayerDTO()]

    await storage.saveRoom(room)
    allRoomIds.push(room.id)
    await storage.saveRooms(allRoomIds)
    
    send(On.NEW_ROOM, room);
    return room
}

export async function saveRoom(room : RoomDTO): Promise<RoomDTO>{
    if(!allRoomIds.includes(room.id)){
        throw Error('No Room with this id')
    }
    
    room.lastUpdate = Date.now()
    await storage.saveRoom(room)
    
    return room;
}

export async function getAllRooms(){
    return allRoomIds
}

function newUniqueId(l : number) :string{
    const cs       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let newId = new Array(l).fill(0).map(x => cs[Math.floor(Math.random() *
            cs.length)]).join('');
    
    return allRoomIds.includes(newId) ? newUniqueId(l) : newId
}
