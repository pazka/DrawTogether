import {useState} from "react";
import {On, send, sub} from "../services/events";
import {useGlobalMouseMove} from "../Controller/DOMEvents";
import {Accessibility} from '@material-ui/icons'


export default function MouseDisplay() {
    const [mice, setMice] = useState({})
    const [name, setName] = useState("Anon")
    const [tmpPos, setTmpPos] = useState([0, 0])
    let position

    useGlobalMouseMove((e) => {
        let position = {x: e.clientX, y: e.clientY}
        send(On.snd_mouse, {name: name, ...position})
        setTmpPos([e.clientX, e.clientY])
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
                position: "fixed",
                left: tmpPos[0] + 20,
                top: tmpPos[1] + 20
            }}><p>test</p></span>
        } else return null
    }

    function getUserMice(m, i) {
        return <span className={'mice'} key={"mouse" + i} style={{
            position: "fixed",
            left: m.x,
            top: m.y
        }}>
            <span style={{display : 'flex'}}>
                <p>{m.name}</p>
            </span>
            </span>
    }

    return (<div>
            <div className={"mouse-container"}>
                <p>{Object.values(mice).length} users in this room</p>
                <span>
                <span> you = </span>
                <input defaultValue={"Anon"} type="text" onChange={handleNameChange}/>
            </span>

                {getMyMouse()}
            </div>
        {Object.values(mice).map((m, i) => getUserMice(m, i))}
    </div>
    )
}