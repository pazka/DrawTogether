import logo from './logo.svg';
import './App.css';
import {useLocation} from "react-router";
import {MouseDisplay} from "./Components/MouseDisplay";
import {joinRoom} from "./services/socket";
import {Layers} from "./Components/Layer";


function App() {
    const location = useLocation()
    const roomId = location.pathname.split('/')[1]
    joinRoom(roomId)
    
    return <div>
        <MouseDisplay/>
        <Layers/>
    </div>;
}

export default App;
