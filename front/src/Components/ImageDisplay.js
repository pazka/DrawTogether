import {getBaseUrl} from "../services/rest";
import {useRoom,useLayer} from "../Controller/useRoom";

export default function ImageDisplay(props){
    let room = useRoom('layer'+props.i)
    let [activeLayerId,setActiveLaterId] = useLayer()
    
    return <div className={"layer-img"}>
        <img src={`${getBaseUrl()}/uploads/${room.id}/${activeLayerId}.png`} alt={"ok"}/>
    </div>
}