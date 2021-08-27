import logo from './logo.svg';
import './App.css';
import {useLocation} from "react-router";
import {MouseDisplay} from "./Components/MouseDisplay";
import {Layers} from "./Components/Layer";
import {On,send} from "./services/events";
import SocketIOService from "./services/socket"

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
