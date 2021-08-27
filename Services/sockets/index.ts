﻿import {getRoom} from "../../Controllers/roomController";

enum allEvents {
    join = "join",
    joined = "joined",
    name = "name",
    leave = "leave",
    mouse = "mouse",
    text = "text",
    calc = "calc",
    img = "img"
}

export async function init(httpServer : any){
    const io = require('socket.io')(httpServer,{
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
        
        socket.to(currentRoom).emit(allEvents.joined,roomId)
        socket.join(currentRoom)
        console.log(`joined room-${currentRoom}`)
        socket.emit('loadRoom',await getRoom(currentRoom))
    });

    socket.on(allEvents.mouse, (data : any) => {
        socket.to(currentRoom).emit(allEvents.mouse, {id : socket.id,...data})
    });

    socket.on('disconnect', () => {
        socket.to(currentRoom).emit(allEvents.mouse, {id : socket.id})
        console.log(`${socket.conn.remoteAddress} disconnected`);
    });
}

