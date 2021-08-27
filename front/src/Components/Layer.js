import useRoom from "../Controller/useRoom";
import {On, send} from "../services/events";
import {useState,useEffect} from "react";
import Layers from "./Layers";
import {Names} from "./Names";


export default function Layer(props) {
    const [edit, setEdit] = useState(false)
    let room = useRoom('layer'+props.i)
    let layer = room.layers[props.i]

    function handleRemove(){
        let newRoom = {...room}

        newRoom.layers.splice(props.i, 1)

        send(On.snd_save, newRoom)
    }

    function handleEditLayer(newName) {
        let newRoom = {...room}
        newRoom.layers[props.i].name = newName

        send(On.snd_save, newRoom)
    }

    return <div className={'layerItem'} onClick={props.onClick}>
        {!edit ? <p onDoubleClick={x => setEdit(!edit)}>{layer.name}</p> :
            <input onBlur={x => setEdit(!edit)}
                   defaultValue={layer.name}
                   onChange={e => handleEditLayer(e.target.value)}/>}

        <button onClick={handleRemove}>Remove</button>
        {props.active && <Names i={props.i}/>}
    </div>
}
