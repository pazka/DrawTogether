import {On, sub} from "../services/events";
import {useState,useEffect} from "react";
import {Room} from "../DTOs/Room";

export default function useRoom(){
    const [room,setRoom] = useState(new Room())
    
    useEffect(() => {
        sub(On.rcv_load,'roomCont',(_room)=>{
            setRoom(_room)
        })
    });
    
    return room
}
