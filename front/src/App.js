import './App.css';
import {useLocation} from "react-router";
import MouseDisplay from "./Components/MouseDisplay";
import Layers from "./Components/Layers";
import {On,send} from "./services/events";
import SocketIOService from "./services/socket"
import ImageDisplay from "./Components/ImageDisplay";
import LayerControls from "./Components/Controls";
import {Names} from "./Components/Names";

SocketIOService()

function App() {
    const location = useLocation()
    const roomId = location.pathname.split('/')[1]
    send(On.snd_join,roomId)
    
    return <div>
        <MouseDisplay/>
        <Names/>
        <Layers/>
        <LayerControls/>
        <ImageDisplay/>
    </div>;
}

export default App;
