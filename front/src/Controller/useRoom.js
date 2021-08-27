import {On, sub} from "../services/events";
import {useState, useEffect} from "react";
import {RoomDTO} from "../DTOs/RoomDTO";
import {createGlobalState} from 'react-hooks-global-state';

const {useGlobalState} = createGlobalState({room: new RoomDTO()});


export default function useRoom(token) {
    const [room, setRoom] = useGlobalState('room')

    useEffect(() => {
        sub(On.rcv_load, token, (_room) => {
            setRoom(_room)
        })
    }, [room]);

    return room
}
