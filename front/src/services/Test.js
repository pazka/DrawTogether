import {io} from "socket.io-client";
import {useEffect} from "react";

const socket = io("http://localhost:9001");
//const socket = io();
console.log("I'm a new instance !")

socket.io.on("reconnect_attempt", () => {
    console.log("reconnect_attempt : " + socket.connected);
});

socket.io.on("reconnect", () => {
    console.log("reconnect : " +socket.connected); 
});

socket.on("connect", () => {
    console.log("connect : " + socket.connected); 
});

socket.on("disconnect", (reason) => {
    console.log("disconnect : " + reason); 
});

socket.on("hello", (data) => {
    console.log("data : " + data)
})


socket.emit("event", "test",'ok')

export function Test() {
    const emit = ()=>{
        socket.emit("event", {x : 12,y : 98})
        socket.emit("mouse", {x : 12,y : 98})
    }
    
    return (
        <div>
            <p>Hey</p>
            <button onClick={()=>{emit()}}>emit</button>
        </div>
    )
}