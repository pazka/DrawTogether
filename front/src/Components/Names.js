import {io} from "socket.io-client";
import {useState, useEffect} from "react";
import * as events from "../services/events";
import {On, send, sub} from "../services/events";
import useRoom from "../Controller/useRoom";
import {NameDTO} from "../DTOs/NameDTO";
import {LayerDTO} from "../DTOs/LayerDTO";
import {useGlobalMouseClick} from "../Controller/DOMEvents";
import {useGlobalKeypress, useGlobalMouseMove} from "../Controller/DOMEvents";


export function Names(props) {
    let room = useRoom('names')
    const [editIndex, setEditIndex] = useState(-1)
    const [newName, setNewName] = useState(false)
    const [tmpPos, setTmpPos] = useState([0,0])
    const names = room.layers[props.i].texts

    useGlobalMouseClick(handleMouseClick)
    useGlobalMouseMove(handleMouseMove)
    useGlobalKeypress((e)=> {
        if(e.code === "KeyN" && editIndex === -1) {
            setNewName(!newName)
            setEditIndex(-1)
        }
    })

    function handleMouseClick(e) {
        if(!newName) return;
        
        let pos = [e.clientX, e.clientY]
        let newRoom = {...room}
        newRoom.layers[props.i].texts.push(new NameDTO("New Text", pos[0], pos[1]))

        send(On.snd_save, newRoom)
        setNewName(false)
    }
    
    function handleMouseMove(e){
        setTmpPos([e.clientX, e.clientY])
    }

    const handleNameChange = (name,i) => {
        let newRoom = {...room}
        newRoom.layers[props.i].texts[i].val = name

        send(On.snd_save, newRoom)
    }

    function dragStart(e,i){

    }
    
    function dragEnd(e,i){
        let newRoom = {...room}
        newRoom.layers[props.i].texts[i].pos = [e.clientX, e.clientY]

        send(On.snd_save, newRoom)
    }

    return (
        <div>
            {newName && <span style={{
                display : "block",
                position: "absolute",
                left : tmpPos[0]+"px",
                top : tmpPos[1]+"px"
            }}> New Text</span>}
            {names.map((name, i) => (
                <span key={i} style = {{
                    display : "block",
                    position: "absolute",
                    left : name.pos[0]+"px",
                    top : name.pos[1]+"px"
                }}>
                {(editIndex === i) ? <input onBlur={x => setEditIndex(-1)}
                                           defaultValue={name.val}
                                           onChange={e => handleNameChange(e.target.value,i)}/>
                    : <p 
                        onDoubleClick={x => setEditIndex(i)}
                        draggable={"true"}
                        onDragStart={(e)=>{dragStart(e,i)}}
                        onDragEnd={(e)=>{dragEnd(e,i)}}
                    >{name.val}</p> 
                }
                <span className={"editName"}>
                    
                </span>
                </span>
            ))}
        </div>
    )
}