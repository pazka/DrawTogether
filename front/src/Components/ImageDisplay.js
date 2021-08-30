import {getBaseUrl} from "../services/rest";
import {useRoom, useLayer} from "../Controller/useRoom";

export default function ImageDisplay(props) {
    let room = useRoom('layer' + props.i)
    let [activeLayerId, setActiveLaterId] = useLayer()

    const layerIndex = room.layers.findIndex(l => Number(l.id) === Number(activeLayerId))
    const imgPath = room.layers[layerIndex]?.imgPath

    return <div className={"layer-img"}>
        {
            imgPath && <img src={`${getBaseUrl()}${imgPath}`} alt={"Background image of layer"+room.layers[layerIndex]?.name}/>
        }</div>
}