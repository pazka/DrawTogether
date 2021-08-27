import {io} from "socket.io-client";
import {useState, useEffect} from "react";
import * as events from "../services/events";
import {On, send, sub} from "../services/events";
import {useGlobalMouseMove} from "../Controller/DOMEvents";


export default function MouseDisplay() {
    const [mice, setMice] = useState({})
    const [name, setName] = useState("Anon")
    const [tmpPos, setTmpPos] = useState([0,0])
    let position
    
    useGlobalMouseMove((e)=>{
        let position = {x: e.clientX, y: e.clientY}
        send(On.snd_mouse, {name: name, ...position})
        setTmpPos([e.clientX,e.clientY])
    })

    sub(On.rcv_mouse, 'md', (data) => {
        let newMice = {...mice}
        if (data.name)
            newMice[data.id] = data
        setMice(newMice)
    })

    sub(On.rcv_leave, 'msd', (data) => {
        let newMice = {...mice}
        delete newMice[data.id]
        setMice(newMice)
    })


    const handleNameChange = event => {
        let newName = event.target.value
        setName(newName)
        send(On.snd_mouse, {name: newName, ...position})
    }

    return (
        <div>
            {(process.env.NODE_ENV !== 'production') && <span style={{
                backgroundColor: "red",
                position: "absolute",
                left: tmpPos[0] +5 + "px",
                top: tmpPos[1] +5 + "px"
            }}><p>test</p></span>}
            <p>{Object.values(mice).length} mice</p>
            <input defaultValue={"Anon"} type="text" onChange={handleNameChange}/>
            {Object.values(mice).map((m, i) =>
                <span key={"mouse" + i} style={{
                    position: "absolute",
                    left: m.x + "px",
                    top: m.y + "px"
                }}>
                <p>{m.name}</p>
            </span>)}
        </div>
    )
}