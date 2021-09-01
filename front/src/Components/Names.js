import {io} from "socket.io-client";
import {useState, useEffect} from "react";
import * as events from "../services/events";
import {On, send, sub} from "../services/events";
import {useLayer, useRoom} from "../Controller/useRoom";
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
    const [activeLayerId, setActiveLayer] = useLayer()
    const layerIndex = room.layers.findIndex(l => Number(l.id) === Number(activeLayerId))
    const names = room.layers[layerIndex]?.texts ?? []

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

        let pos = [window.scrollX + e.clientX, window.scrollY + e.clientY]
        let newRoom = {...room}
        newRoom.layers[layerIndex].texts.push(new NameDTO("New Text", pos[0], pos[1]))

        send(On.snd_save, newRoom)
        setNewName(false)
    }

    function handleMouseMove(e) {
        let position = [window.scrollX + e.clientX, window.scrollY + e.clientY]
        setTmpPos(position)
    }

    const handleNameChange = (name, i) => {
        let newRoom = {...room}
        newRoom.layers[layerIndex].texts[i].val = name

        send(On.snd_save, newRoom)
    }

    let offSet = [0, 0]

    function dragStart(e, i) {
        let position = [window.scrollX + e.clientX, window.scrollY + e.clientY]
        offSet = [
            room.layers[layerIndex].texts[i].pos[0] - position[0],
            room.layers[layerIndex].texts[i].pos[1] - position[1]
        ]
    }

    function dragEnd(e, i) {
        let newRoom = {...room}
        let position = [window.scrollX + e.clientX, window.scrollY + e.clientY]
        
        newRoom.layers[layerIndex].texts[i].pos = [
            position[0] + offSet[0],
            position[1] + offSet[1]
        ]

        send(On.snd_save, newRoom)
    }

    function editTextProp(e, i, val) {
        let newRoom = {...room}

        newRoom.layers[layerIndex].texts[i][e] = val

        send(On.snd_save, newRoom)
    }

    function getNewName() {
        return newName && <span className={"name-item"}
                                style={{
                                    left: tmpPos[0] + 5,
                                    top: tmpPos[1] + 5
                                }}> New Text</span>
    }

    function editColor(e, i, close) {
        let newRoom = {...room}
        newRoom.layers[layerIndex].texts[i].color = `rgba(${e.rgb.r},${e.rgb.g},${e.rgb.b},${e.rgb.a})`

        if (close) {
            send(On.snd_save, newRoom)
            setColorOpen(!colorOpen)
        }
    }

    function deleteText(i) {
        let newRoom = {...room}
        newRoom.layers[layerIndex].texts.splice(i, 1)

        send(On.snd_save, newRoom)
    }

    function getNameEdit(i) {
        const text = room.layers[layerIndex].texts[i]
        return <span className={"edit-name-container"}>
            <span className={"edit-name-item"}>
            <button onClick={x => editTextProp('size', i, Number(text.size ?? 1) + 0.2)}>+</button>
            <button onClick={x => editTextProp('size', i, Number(text.size ?? 1) - 0.2)}>-</button>
            <button onClick={x => editTextProp('width', i, Number(text.width ?? 1) + 0.2)}>⭠⭢</button>
            <button onClick={x => editTextProp('width', i, Number(text.width ?? 1) - 0.2)}>⭢⭠</button>
            <button onClick={x => editTextProp('rot', i, Number(text.rot ?? 0) - 5)}>↶</button>
            <button onClick={x => editTextProp('rot', i, Number(text.rot ?? 0) + 5)}>↷</button>
            <button onClick={x => editTextProp('bold', i, !text.bold)} style={{
                fontWeight: 'bold'
            }}>b</button>
            <button onClick={x => editTextProp('underline', i, !text.underline)} style={{
                textDecoration: 'underline'
            }}>u</button>
            <button onClick={() => setColorOpen(!colorOpen)} style={{backgroundColor: text.color}}>color</button>
                {colorOpen && <SketchPicker
                    color={text.color}
                    onChangeComplete={(e) => editColor(e, i, true)}
                />}
                <button onClick={() => deleteText(i)} style={{marginLeft: '15px'}}> Delete</button>
        </span>
        </span>
    }

    return (
        <div className={"name-container"}>
            {getNewName()}
            {names.map((name, i) => (
                <span className={"name-item"}
                      key={i} style={{
                    left: name.pos[0],
                    top: name.pos[1]
                }}>
                {(editIndex === i) ? <input onBlur={x => setEditIndex(-1)}
                                            defaultValue={name.val}
                                            onChange={e => handleNameChange(e.target.value, i)}/>
                    : <p
                        onDoubleClick={x => setEditIndex(i)}
                        style={{
                            color: name.color,
                            fontSize: (name.size ?? 1) + 'rem',
                            width: (name.width ?? 1) * name.size * 5 + 'rem',
                            transform: "rotate(" + (name.rot ?? 0) + "deg)",
                            fontWeight: name.bold ? 'bold' : 'normal',
                            textDecoration: name.underline ? 'underline' : 'none',
                        }}

                        draggable={true}
                        onDragStart={(e) => {
                            dragStart(e, i)
                        }}
                        onDragEnd={(e) => {
                            dragEnd(e, i)
                        }}>{name.val}</p>
                }
                    {getNameEdit(i)}
                </span>
            ))}
        </div>
    )
}