import useRoom from "../Controller/useRoom";
import {On, send} from "../services/events";
import {LayerDTO} from "../DTOs/LayerDTO";
import {useState,useEffect} from "react";

const layerContainer = {
    display: "block",
    minWidth: "50px",
    minHeight: "50px",
    position: "sticky",
    top: "0",
    right: "0",

    '& *': {
        border: 'solid red 1px'
    }
}

const layerItem = {
    display: "block",
    width: "50px",
    height: "50px"
}

export function Layers() {
    let room = useRoom("ok")

    function handleAddLayer() {
        let newRoom = {...room}
        newRoom.layers.push(new LayerDTO(Math.max.apply(Math, newRoom.layers.map(function (l) {
            return l.id;
        })) + 1));

        send(On.snd_save, newRoom)
    }

    return <div style={layerContainer}>
        <div>
            {room.layers.map((l, i) => <Layer i={i} key={i}/>)}
        </div>
        <div>
            <button onClick={handleAddLayer}>+ Add Layer</button>
        </div>
        <pre>{JSON.stringify(room, "   ", 4)}</pre>
    </div>
}

export function Layer(props) {
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
    
    return <div style={layerItem}>
        {!edit ? <p onDoubleClick={x => setEdit(!edit)}>{layer.name}</p> :
            <input onBlur={x => setEdit(!edit)} 
                defaultValue={layer.name}
                   onChange={e => handleEditLayer(e.target.value)}/>}

        <button onClick={handleRemove}>Remove</button>
    </div>
}