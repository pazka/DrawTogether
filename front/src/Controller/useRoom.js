import {On, sub} from "../services/events";
import {useEffect} from "react";
import {RoomDTO} from "../DTOs/RoomDTO";
import {createGlobalState} from 'react-hooks-global-state';

const {useGlobalState} = createGlobalState({room: new RoomDTO(),activeLayer : 0});


export function useRoom(token) {
    const [room, setRoom] = useGlobalState('room')

    useEffect(() => {
        sub(On.rcv_load, token, (_room) => {
            setRoom(_room)
        })
    });

    return room
}

export function useLayer(){
    return useGlobalState('activeLayer')
}