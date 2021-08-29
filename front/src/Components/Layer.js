import {useRoom} from "../Controller/useRoom";
import {On, send} from "../services/events";
import {useState} from "react";
import {Delete} from "@material-ui/icons";


export default function Layer(props) {
    const [edit, setEdit] = useState(false)
    let room = useRoom('layer'+props.i)
    let layer = room.layers[props.i]

    function handleRemove(){
        if (!window.confirm("Confirm delete :")) return;
        
        let newRoom = {...room}

        newRoom.layers.splice(props.i, 1)

        send(On.snd_save, newRoom)
    }

    function handleEditLayer(newName) {
        let newRoom = {...room}
        newRoom.layers[props.i].name = newName

        send(On.snd_save, newRoom)
    }
    
    function getLayerName(){
        return !edit ? <p onDoubleClick={x => setEdit(!edit)}>{layer.name}</p> :
            <input onBlur={x => setEdit(!edit)}
                   defaultValue={layer.name}
                   onChange={e => handleEditLayer(e.target.value)}/>
    }
    
    
    return <div>
        <div className={`layer-item ${props.active && 'layer-item-selected'}`}
             onClick={props.onClick}>
            {getLayerName()}

            <button onClick={handleRemove}><Delete/></button>
        </div>
    </div>
}
