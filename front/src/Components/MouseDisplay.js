import {io} from "socket.io-client";
import {useState,useEffect} from "react";
import * as events from "../services/events";
import {On, send, sub} from "../services/events";


export function MouseDisplay() {
    const [mice,setMice] = useState({})
    const [name,setName] = useState("Anon")
    let  position = {}
    
    useEffect(()=>{
        function handleMouseClick(e) {
            position = {x : e.x,y : e.y}
            send(On.snd_mouse,{name : name,...position})
        }
        
        window.addEventListener("mousemove", handleMouseClick);
        
        return ()=>{
            window.removeEventListener("mousemove",handleMouseClick)
        }
    })

    sub(On.rcv_mouse,'md',(data)=>{
        let newMice = {...mice}
        if(data.name)
            newMice[data.id] = data
        setMice(newMice)
    })
    
    
    const handleNameChange = event =>{
        let newName = event.target.value
        setName(newName)
        send(On.snd_mouse,{name : newName,...position})
    }

    return (
        <div>
            <p>{Object.values(mice).length} mice</p>
            <input defaultValue={"Anon"} type="text" onChange={handleNameChange}/>
            {Object.values(mice).map((m,i)=>
            <span key={"mouse"+i} style={{
                position : "absolute", 
                left : m.x+"px", 
                top : m.y+"px"}}>
                <p>{m.name}</p>
            </span>)}
        </div>
    )
}