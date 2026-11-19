import {getRoom, updateRoom} from "../../Controllers/roomController";
import {RoomDTO} from "../../DTOs/RoomDTO";
import {On, send, sub} from "../events";
import env from "../env";
import {log} from "../log";

const iolib = require('socket.io')
let io: any

enum allEvents {
    join = "join",
    leave = "leave",
    mouse = "mouse",
    loadRoom = "loadRoom",
    saveRoom = "saveRoom",
    error = "error"
}

export async function init(httpServer: any) {
    io = iolib(httpServer, {
        cors: {
            origin: env.allowedOrigin,
            methods: ["GET", "POST"]
        }
    });

    io.on('connection', (socket: any) => {
        // never an IP, a room id or a payload: counts only, at debug
        log.debug('socket_connect', 'client connected', {clients: io.engine.clientsCount})
        newSocketConnection(socket)
    });
}


function newSocketConnection(socket: any) {
    let currentRoom: string = null

    socket.on(allEvents.join, async (roomId: string) => {
        currentRoom = roomId

        socket.join(currentRoom)

        socket.to(currentRoom).emit(allEvents.join, roomId)
        io.to(currentRoom).emit(allEvents.loadRoom, await getRoom(currentRoom))
    });

    socket.on(allEvents.mouse, (data: any) => {
        socket.to(currentRoom).emit(allEvents.mouse, {id: socket.id, ...data})
    });

    socket.on(allEvents.saveRoom, async (room: RoomDTO) => {
        try {
            updateRoom(room).then(res =>{
                io.to(room.id).emit(allEvents.loadRoom, room)
            }).catch(err =>{
                socket.emit(allEvents.error, JSON.stringify(err))
            })
        }catch(err){
            socket.emit(allEvents.error, JSON.stringify(err))
        }
    })

    socket.on('disconnect', () => {
        io.to(currentRoom).emit(allEvents.leave, {id: socket.id})
        log.debug('socket_disconnect', 'client disconnected', {clients: io.engine.clientsCount})
    });
    
    sub(On.EDIT_ROOM, (room : RoomDTO)=>{
        io.to(room.id).emit(allEvents.loadRoom, room)
    });

    sub(On.ERROR, (error : any)=>{
        io.broadcast.emit(allEvents.error, error)
    });
}

