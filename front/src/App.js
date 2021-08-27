import logo from './logo.svg';
import './App.css';
import {useLocation} from "react-router";
import MouseDisplay from "./Components/MouseDisplay";
import Layers from "./Components/Layers";
import {On,send} from "./services/events";
import SocketIOService from "./services/socket"
import {Names} from "./Components/Names";

SocketIOService()

function App() {
    const location = useLocation()
    const roomId = location.pathname.split('/')[1]
    send(On.snd_join,roomId)
    
    return <div>
        <MouseDisplay/>
        <Layers/>
    </div>;
}

export default App;
