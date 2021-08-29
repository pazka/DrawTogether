import {On, send} from "../services/events";
import {sendImg} from "../services/rest";
import {useRef} from "react";
import {useLayer, useRoom} from "../Controller/useRoom";

export default function LayerControls() {
    const inputRef = useRef()
    let room = useRoom("ok")
    const [activeLayerId, setActiveLayer] = useLayer()

    function handleFileChange(e) {
        let layerImg = inputRef.current.files[0];
        sendImg(layerImg, room.id, activeLayerId).then(res => {
            if (res.status !== 200) {
                res.json().then(body => {
                    alert(body.message)
                })
            }
        }).catch(err => {
            alert(err)
        })
    }
    
    function createNewName(){
        send(On.ui_newName, null)
    }

    return <div className={"layer-controls"}>
        <button onClick={createNewName }> New Text</button>
        <form>
            <label htmlFor="layerImg">Background => </label>
            <input ref={inputRef} type="file" name={"layerImg"} onChange={handleFileChange}/>
        </form>
    </div>
}