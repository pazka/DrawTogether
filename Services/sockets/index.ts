import {getRoom, saveRoom} from "../../Controllers/roomController";
import {RoomDTO} from "../../DTOs/RoomDTO";
const iolib = require('socket.io')
let io : any

enum allEvents {
    join = "join",
    mouse = "mouse",
    loadRoom = "loadRoom",
    saveRoom = "saveRoom"
}

export async function init(httpServer : any){
    io = iolib(httpServer,{
        cors: {
        origin: ["http://localhost:3000","http://cptnchtn/"],
        methods: ["GET", "POST"]
    }});

    io.on('connection', (socket : any) => {
        console.log('Client connected');
        newSocketConnection(socket)
    });
}


function newSocketConnection(socket : any){
    let currentRoom : string= null
    
    socket.onAny((eventName : string, ...args : any) => {
        if(eventName == "mouse")
            return;
        
        console.log(eventName,args)
    });
    
    socket.on('connect', () => {
        console.log(`${socket.conn.remoteAddress} connected`);
    });

    socket.on(allEvents.join, async (roomId : string) => {
        currentRoom = roomId
        
        socket.join(currentRoom)
        console.log(`joined room-${currentRoom}`)

        socket.to(currentRoom).emit(allEvents.join,roomId)
        io.to(currentRoom).emit(allEvents.loadRoom,await getRoom(currentRoom))
    });

    socket.on(allEvents.mouse, (data : any) => {
        socket.to(currentRoom).emit(allEvents.mouse, {id : socket.id,...data})
    });
    
    socket.on(allEvents.saveRoom, async (room :RoomDTO) =>{
        io.to(currentRoom).emit(allEvents.loadRoom,await saveRoom(room))
    })

    socket.on('disconnect', () => {
        socket.to(currentRoom).emit(allEvents.mouse, {id : socket.id})
        console.log(`${socket.conn.remoteAddress} disconnected`);
    });
}

