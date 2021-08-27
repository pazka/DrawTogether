import {io} from "socket.io-client";
import * as events from "./events";
import {On} from "./events";

let socket;
let currentRoom


export default function SocketIOService(){
    const url = window.location.href.match(/(https*:\/\/)(\w*)([:/]\d*)/)
    const protocol = url[1]
    const domain = url[2]
    const port = url[3]
    const dynamicUrl = protocol+domain+port

    let ioUrl = (process.env.NODE_ENV !== 'production') ? "http://localhost:9001" : dynamicUrl

    socket = io(ioUrl);

    console.log("I'm a new instance !")

    socket.on("connect", () => {
        console.log("connect : " + socket.connected);
    });

    socket.on("disconnect", (reason) => {
        console.log("disconnect : " + reason);
    });

    socket.on("join",(data)=>{
        console.log('Somebody joined')
    })
    socket.on("leave",(data)=>events.send(On.rcv_leave,data))

    socket.on("loadRoom",data => events.send(On.rcv_load,data))

    socket.on("mouse",(data)=>events.send(On.rcv_mouse,data))

    events.sub(On.snd_join,'sock',x => joinRoom(x))
    events.sub(On.snd_mouse,'sock',x => socket.emit("mouse",x))
    events.sub(On.snd_save,'sock',x => socket.emit("saveRoom",x))

    function joinRoom(roomId){
        currentRoom = roomId
        socket.emit("join", roomId)
    }
}