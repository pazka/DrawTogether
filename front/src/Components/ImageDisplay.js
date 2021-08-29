import {getBaseUrl} from "../services/rest";
import {useRoom,useLayer} from "../Controller/useRoom";

export default function ImageDisplay(props){
    let room = useRoom('layer'+props.i)
    let [activeLayerId,setActiveLaterId] = useLayer()
    
    const layerIndex = room.layers.findIndex(l => Number(l.id) === Number(activeLayerId))
    const imgPath = room.layers[layerIndex]?.imgPath 
    
    return <div className={"layer-img"}>
        <img src={`${getBaseUrl()}${imgPath}`} alt={"currentLayerPath"}/>
    </div>
}