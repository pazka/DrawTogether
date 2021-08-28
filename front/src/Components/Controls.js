import {On, send} from "../services/events";
import {sendImg} from "../services/rest";
import {useRef} from "react";
import {useLayer, useRoom} from "../Controller/useRoom";

export default function LayerControls(){
    const inputRef = useRef()
    let room = useRoom("ok")
    const [activeLayerId,setActiveLayer] = useLayer()

    function handleFileChange(e){
        let layerImg = inputRef.current.files[0];
        sendImg(layerImg,room.id,activeLayerId).then(res =>{
            send(On.snd_save, room)
        })
    }
    
    return <div className={"layer-controls"}>
        <button onClick={()=>send(On.ui_newName,null)}> New Text </button>
        <form>
            <label htmlFor="layerImg">Set Img</label>
            <input ref={inputRef} type="file" name={"layerImg"}  onChange={handleFileChange}/>
        </form>
    </div>
}