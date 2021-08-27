import {io} from "socket.io-client";
import * as events from "./events";

let currentRoom 
const socket = io("http://localhost:9001");
//const socket = io();
console.log("I'm a new instance !")

socket.on("connect", () => {
    console.log("connect : " + socket.connected);
});

socket.on("disconnect", (reason) => {
    console.log("disconnect : " + reason);
});


export function joinRoom(roomId){
    currentRoom = roomId
    socket.emit("join", roomId)
}

export function mouseMoved(data){
    socket.emit("mouse", data)
}
socket.on("mouse",(data)=>{
    events.send(events.On.mouse,data)
})