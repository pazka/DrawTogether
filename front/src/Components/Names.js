import {io} from "socket.io-client";
import {useState, useEffect} from "react";
import * as events from "../services/events";
import {On, send, sub} from "../services/events";
import {useRoom} from "../Controller/useRoom";
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
        if(newName) {
            setNewName(false)
        }
    })
    
    sub(On.ui_newName,"names",()=>{
        setNewName(true)
        setEditIndex(-1)
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

    let offSet = []
    
    function dragStart(e,i){
        offSet = [
            room.layers[props.i].texts[i].pos[0] - e.clientX , 
            room.layers[props.i].texts[i].pos[1] - e.clientY 
        ]
    }
    
    function dragEnd(e,i){
        let newRoom = {...room}
        newRoom.layers[props.i].texts[i].pos = [
            e.clientX + offSet[0], 
            e.clientY + offSet[1]
        ]

        send(On.snd_save, newRoom)
    }
    
    function getNewName(){
        return newName ? <span style={{
            display : "block",
            position: "fixed",
            left : tmpPos[0],
            top : tmpPos[1]
        }}> New Text</span> : null
    }
    
    function getNameEdit(){
        return <span className={"edit-name"}></span>
    }

    return (
        <div className={"name-container"}>
            {getNewName()}
            {names.map((name, i) => (
                <span className={"name-item"}
                      key={i} style = {{
                    display : "block",
                    position: "fixed",
                    left : name.pos[0],
                    top : name.pos[1]
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
                    {getNameEdit()}
                </span>
            ))}
        </div>
    )
}