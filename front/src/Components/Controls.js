import {On, send} from "../services/events";
import {getRoomName, postData, sendImg} from "../services/rest";
import {useRef, useState} from "react";
import {useLayer, useRoom} from "../Controller/useRoom";
import {download, readFile} from "../services/file";

export default function LayerControls() {
    const inputRef = useRef()
    const loadRef = useRef()
    let room = useRoom("ok")
    const [activeLayerId, setActiveLayer] = useLayer()
    const [uploadStatus,setUploadStatus] = useState(false)

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

    function saveProject() {
        download(getRoomName()+'.json',JSON.stringify(room))
    }
    
    function loadProject (){
        if(uploadStatus){
            setUploadStatus(false)
            return;
        }
        
        if (!window.confirm("This will OVERWRITE the current project !"))
            return;
        
        setUploadStatus(true)
    }
    
    function handleProjectLoad(){
        if (!window.confirm("This will OVERWRITE the current project !"))
            return;
        
        let projectFile = loadRef.current.files[0];

        if(projectFile.name.split('.')[1] !== 'json'){
            alert("Bad format")
            return;
        }
        
        readFile(projectFile,(data)=>{
            setUploadStatus(false)
           let newRoom = JSON.parse(data)
            newRoom.version = Number(room.version) + 1
            newRoom.id = room.id
            postData(`/api/room/${room.id}/import`,newRoom).then(
                res => console.log(res)
            )
        })
    }
    
    function handleNewProject(){
        var name = window.prompt("Name of new project : ")
        window.location.replace(name)
    }

    let debug = 0
    function _debug(){
        debug = setInterval(()=>{
            send(On.snd_save,room)
            if(debug++ > 1000)
                clearInterval(debug)
        },1)
    }
    
    return <div className={"layer-controls"}>
        <button onClick={createNewName }> New Text</button>
        <form>
            <label htmlFor="layerImg">Background => </label>
            <input ref={inputRef} type="file" name={"layerImg"} onChange={handleFileChange}/>
        </form>
        <button onClick={()=>saveProject()}>Save project</button>
        
        <span>
            <button onClick={()=>{loadProject()}}>{uploadStatus ? "Close Upload" : "Import a project"}</button>
            {uploadStatus && <form>
                <input ref={loadRef} type="file" name={"projectFile"} onChange={handleProjectLoad}/>
            </form>}
        </span>
        <button onClick={()=>handleNewProject()}>New project</button>
    </div>
}