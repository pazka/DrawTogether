import {useLayer,useRoom} from "../Controller/useRoom";
import {On, send} from "../services/events";
import {LayerDTO} from "../DTOs/LayerDTO";
import Layer from "./Layer";

export default function Layers() {
    let room = useRoom("ok")
    const [activeLayerId,setActiveLayer] = useLayer()

    const layerIndex = room.layers.findIndex(l => Number(l.id) === Number(activeLayerId))
    if(layerIndex === -1 && room.layers.length > 0){
        setActiveLayer(room.layers[0].id)
    }
    
    function handleAddLayer() {
        let newRoom = {...room}
        newRoom.layers.push(new LayerDTO(Math.max.apply(Math, newRoom.layers.map(function (l) {
            return l.id;
        })) + 1));

        send(On.snd_save, newRoom)
    }

    return <div className={'layer-container'}>
        <div>
            {room.layers.map((l, i) => <div key={i}>
                <Layer i={i} 
                       active={activeLayerId === l.id} 
                       onClick={e=> {
                           setActiveLayer(l.id)
                       }}
                />
            </div>)}
        </div>
        <div>
            <button onClick={handleAddLayer}>+ Add Layer</button>
        </div>
    </div>
}
