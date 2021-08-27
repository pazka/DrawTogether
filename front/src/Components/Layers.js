import useRoom from "../Controller/useRoom";
import {On, send} from "../services/events";
import {LayerDTO} from "../DTOs/LayerDTO";
import Layer from "./Layer";
import {useState} from "react";

export default function Layers() {
    let room = useRoom("ok")
    const [activeLayer,setActiveLayer] = useState(0)

    function handleAddLayer() {
        let newRoom = {...room}
        newRoom.layers.push(new LayerDTO(Math.max.apply(Math, newRoom.layers.map(function (l) {
            return l.id;
        })) + 1));

        send(On.snd_save, newRoom)
    }

    return <div className={'layerContainer'}>
        <div>
            {"active " + activeLayer}
            {room.layers.map((l, i) => <div key={i}>
                <Layer i={i} active={activeLayer === i} 
                       onClick={e=> {
                           setActiveLayer(i)
                       }}/>
            </div>)}
        </div>
        <div>
            <button onClick={handleAddLayer}>+ Add Layer</button>
        </div>
    </div>
}
