let allEvents = {};

// Add an observer to observers.
export function sub(event,observer)
{
    if(Object.keys(allEvents).includes(event)){
        allEvents[event].push(observer);
    }else{
        allEvents[event] = [observer];
    }
}

// Loops over observers and calls the update method on each observer.
// The state object will call this method everytime it is updated.
export function send(event, data)
{
    console.log(`[${event}]=`)
    console.info(`${data}`)
    console.log(`###`)
    
    if(Object.keys(allEvents).includes(event)){
        allEvents[event].forEach(observer => observer(event, data));
    }
}

const On = Object.freeze({
    NEW_ROOM : "NEW_ROOM",
    EDIT_ROOM : "EDIT_ROOM",
    CALC_ACTION : "CALC_ACTION",
    MOUSE_ACTION : "MOUSE_ACTION",
    TEXT_ACTION : "TEXT_ACTION"
})


export {On};