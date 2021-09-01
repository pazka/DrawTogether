import {useState} from "react";
import {On, send, sub} from "../services/events";
import {useGlobalMouseMove} from "../Controller/DOMEvents";
import {Accessibility} from '@material-ui/icons'
import {getRoomName} from "../services/rest";


export default function MouseDisplay() {
    const [mice, setMice] = useState({})
    const [name, setName] = useState("Anon")
    const [tmpPos, setTmpPos] = useState([0, 0])
    let position

    useGlobalMouseMove((e) => {
        let position = {x: window.scrollX + e.clientX, y: window.scrollY + e.clientY}
        send(On.snd_mouse, {name: name, ...position})
        setTmpPos([position.x, position.y])
    })

    sub(On.rcv_mouse, 'md', (data) => {
        let newMice = {...mice}
        if (data.name)
            newMice[data.id] = data
        setMice(newMice)
    })

    sub(On.rcv_leave, 'msd', (data) => {
        let newMice = {...mice}
        delete newMice[data.id]
        setMice(newMice)
    })


    const handleNameChange = event => {
        let newName = event.target.value
        setName(newName)
        send(On.snd_mouse, {name: newName, ...position})
    }

    function getMyMouse() {
        if ((process.env.NODE_ENV !== 'production')) {
            return <span style={{
                backgroundColor: "red",
                position: "absolute",
                left: tmpPos[0] + 20,
                top: tmpPos[1] + 20
            }}><p>test</p></span>
        } else return null
    }

    function getUserMice(m, i) {
        return <span className={'mice'} key={"mouse" + i} style={{
            position: "absolute",
            left: m.x,
            top: m.y
        }}>
            <span style={{display: 'flex'}}>
                <p>{m.name}</p>
            </span>
        </span>
    }

    return (<div className={"mouse-container"}>
                <div className={"info"}>
                    <p>Room name : <b>{getRoomName()}</b></p>
                    <p>{Object.values(mice).length + 1} users in this room.</p>
                    <p>
                        <span> You are </span>
                        <input defaultValue={"Anon"} type="text" onChange={handleNameChange}/>
                    </p>
                </div>

            {Object.values(mice).map((m, i) => getUserMice(m, i))}
            {getMyMouse()}
        </div>
    )
}