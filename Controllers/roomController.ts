import * as storage from "../Services/storage";
import {Room} from "../DTOs/Room";
import {send,On} from "../Services/events";

let allRoomIds : string[] = []

storage.getRooms().then(res =>{
    allRoomIds = res ?? []
});

export async function getRoom(id : string) : Promise<Room>{
    
    if(!allRoomIds.includes(id)){
        return createNewRoom(id)
    }else{
        return storage.getRoom(id)
    }
}

export async function createNewRoom(existId : string = null) : Promise<Room>{
    const room = new Room() 
    room.id = existId ?? newUniqueId(8)

    allRoomIds.push(room.id)
    await storage.saveRoom(room)
    await storage.saveRooms(allRoomIds)
    
    send(On.NEW_ROOM, room);
    return room
}

export async function updateRoom(room : Room){
    if(!allRoomIds.includes(room.id)){
        throw Error('No Room with this id')
    }
    
    room.lastUpdate = Date.now()
    await storage.saveRoom(room)
    
    send(On.EDIT_ROOM, room);
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
