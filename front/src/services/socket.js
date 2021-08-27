import {io} from "socket.io-client";
import * as events from "./events";

let currentRoom
const url = window.location.href.match(/(https*:\/\/)(\w*)([:/]\d*)/)
const protocol = url[1]
const domain = url[2]
const port = url[3]
const dynamicUrl = protocol+domain+port

let ioUrl = (process.env.NODE_ENV !== 'production') ? "http://localhost:9001" : dynamicUrl

const socket = io(ioUrl);


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