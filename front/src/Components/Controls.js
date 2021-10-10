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
    const [uploadStatus, setUploadStatus] = useState(false)
    const [backgroundUploadStatus, setBackgroundUploadStatus] = useState(false)

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

    function createNewName() {
        send(On.ui_newName, null)
    }

    function saveProject() {
        download(getRoomName() + '.json', JSON.stringify(room))
    }

    function loadProject() {
        if (uploadStatus) {
            setUploadStatus(false)
            return;
        }

        if (!window.confirm("This will OVERWRITE the current project !"))
            return;

        setUploadStatus(true)
    }

    function handleProjectLoad() {
        if (!window.confirm("This will OVERWRITE the current project !"))
            return;

        let projectFile = loadRef.current.files[0];

        if (projectFile.name.split('.')[1] !== 'json') {
            alert("Bad format")
            return;
        }

        readFile(projectFile, (data) => {
            setUploadStatus(false)
            let newRoom = JSON.parse(data)
            newRoom.version = Number(room.version) + 1
            newRoom.id = room.id
            postData(`/api/room/${room.id}/import`, newRoom).then(
                res => console.log(res)
            )
        })
    }

    function handleNewProject() {
        var name = window.prompt("Name of new project : ")
        window.location.replace('/'+name)
    }

    let debug = 0
    let debugInterval

    function _debug() {
        if (debugInterval) {
            debug = 1000
            return;
        }

        debugInterval = setInterval(() => {
            let position = {x: 1000 + 200 * Math.sin(Date.now() / 2000), y: 1000 + 200 * Math.cos(Date.now() / 2000)}
            send(On.snd_mouse, {name: 'DEBUG', ...position})
            if (debug++ > 1000) {
                clearInterval(debugInterval)
                debug = 0
            }
        }, 50)
    }

    return <div className={"layer-controls"}>
        <span>
                {process.env.NODE_ENV !== 'production' && <button onClick={_debug}> Debug</button>}
            <button onClick={createNewName}> New Text</button>
        </span>
        <span>
            <button onClick={() => {
                setBackgroundUploadStatus(!backgroundUploadStatus)
            }}>{backgroundUploadStatus ? "Close background upload" : "Change Background"}</button>
            {backgroundUploadStatus && <form>
                <label htmlFor="layerImg"> New background : </label>
                <input ref={inputRef} type="file" name={"layerImg"} onChange={handleFileChange}/>
            </form>}
        </span>
        <span>
            <button onClick={() => saveProject()}>Save project</button>
            
            <button onClick={() => {
                setUploadStatus(!uploadStatus)
            }}>{uploadStatus ? "Close Upload" : "Import a project"}</button>
            {uploadStatus && <form>
                <input ref={loadRef} type="file" name={"projectFile"} onChange={handleProjectLoad}/>
            </form>}
        </span>

        <span>
            <button onClick={() => handleNewProject()}>New project</button>
        </span>

    </div>
}