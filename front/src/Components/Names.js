import {io} from "socket.io-client";
import {useState, useEffect} from "react";
import * as events from "../services/events";
import {On, send, sub} from "../services/events";
import {useRoom} from "../Controller/useRoom";
import {NameDTO} from "../DTOs/NameDTO";
import {LayerDTO} from "../DTOs/LayerDTO";
import {useGlobalMouseClick} from "../Controller/DOMEvents";
import {useGlobalKeypress, useGlobalMouseMove} from "../Controller/DOMEvents";
import {SketchPicker} from "react-color";


export function Names(props) {
    let room = useRoom('names')
    const [editIndex, setEditIndex] = useState(-1)
    const [newName, setNewName] = useState(false)
    const [tmpPos, setTmpPos] = useState([0, 0])
    const [colorOpen, setColorOpen] = useState(false)
    const names = room.layers[props.i].texts

    useGlobalMouseClick(handleMouseClick)
    useGlobalMouseMove(handleMouseMove)
    useGlobalKeypress((e) => {
        if (newName) {
            setNewName(false)
        }
    })

    sub(On.ui_newName, "names", () => {
        setNewName(true)
        setEditIndex(-1)
    })

    function handleMouseClick(e) {
        if (!newName) return;

        let pos = [e.clientX, e.clientY]
        let newRoom = {...room}
        newRoom.layers[props.i].texts.push(new NameDTO("New Text", pos[0], pos[1]))

        send(On.snd_save, newRoom)
        setNewName(false)
    }

    function handleMouseMove(e) {
        setTmpPos([e.clientX, e.clientY])
    }

    const handleNameChange = (name, i) => {
        let newRoom = {...room}
        newRoom.layers[props.i].texts[i].val = name

        send(On.snd_save, newRoom)
    }

    let offSet = []

    function dragStart(e, i) {
        offSet = [
            room.layers[props.i].texts[i].pos[0] - e.clientX,
            room.layers[props.i].texts[i].pos[1] - e.clientY
        ]
    }

    function dragEnd(e, i) {
        let newRoom = {...room}
        newRoom.layers[props.i].texts[i].pos = [
            e.clientX + offSet[0],
            e.clientY + offSet[1]
        ]

        send(On.snd_save, newRoom)
    }
    function editTextProp(e,i,val) {
        let newRoom = {...room}
        
        newRoom.layers[props.i].texts[i][e] = val

        send(On.snd_save, newRoom)
    }

    function getNewName() {
        return newName ? <span style={{
            display: "block",
            position: "fixed",
            left: tmpPos[0],
            top: tmpPos[1]
        }}> New Text</span> : null
    }
    
    function editColor(e,i,close) {
        let newRoom = {...room}
        newRoom.layers[props.i].texts[i].color = `rgba(${e.rgb.r},${e.rgb.g},${e.rgb.b},${e.rgb.a})`

        if(close) {
            send(On.snd_save, newRoom)
            setColorOpen(!colorOpen)
        }
    }
    
    function getNameEdit(i) {
        const text = room.layers[props.i].texts[i]
        return <span className={"edit-name"}>
            <button onClick={x=>editTextProp('size',i,Number(text.size)+0.2)}>+</button>
            <button onClick={x=>editTextProp('size',i,Number(text.size)-0.2)}>-</button>
            <button onClick={x=>editTextProp('bold',i,!text.bold)} style={{
                fontWeight: 'bold'
            }}>b</button>
            <button onClick={x=>editTextProp('underline',i,!text.underline)} style={{
                textDecoration: 'underline'
            }}>u</button>
            <button onClick={() => setColorOpen(!colorOpen)} style={{backgroundColor: text.color}}>color</button>
            {colorOpen && <SketchPicker
            color={text.color}
            onChangeComplete={(e)=>editColor(e,i,true)}
            />} 
        </span>
    }

    return (
        <div className={"name-container"}>
            {getNewName()}
            {names.map((name, i) => (
                <span className={"name-item"}
                      key={i} style={{
                    display: "block",
                    position: "fixed",
                    left: name.pos[0],
                    top: name.pos[1]
                }}>
                {(editIndex === i) ? <input onBlur={x => setEditIndex(-1)}
                                            defaultValue={name.val}
                                            onChange={e => handleNameChange(e.target.value, i)}/>
                    : <p
                        onDoubleClick={x => setEditIndex(i)}
                        draggable={"true"}
                        onDragStart={(e) => {
                            dragStart(e, i)
                        }}
                        onDragEnd={(e) => {
                            dragEnd(e, i)
                        }}
                        style={{
                            color: name.color,
                            fontSize : name.size+'rem',
                            fontWeight : name.bold ? 'bold' : 'normal',
                            textDecoration : name.underline ? 'underline':  'none',
                        }}
                    >{name.val}</p>
                }
                    {getNameEdit(i)}
                </span>
            ))}
        </div>
    )
}