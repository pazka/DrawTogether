import {useEffect} from "react";

export const useWindowEvent = (event, callback) => {
    useEffect(() => {
        window.addEventListener(event, callback);
        return () => window.removeEventListener(event, callback);
    }, [event, callback]);
};

export const useGlobalMouseClick = (callback) => {
    return useWindowEvent("click", callback);
};

export const useGlobalMouseDblClick = (callback) => {
    return useWindowEvent("dblclick", callback);
};

export const useGlobalMouseMove = (callback) => {
    return useWindowEvent("mousemove", callback);
};

export const useGlobalKeypress = (callback) => {
    return useWindowEvent("keypress", callback);
};