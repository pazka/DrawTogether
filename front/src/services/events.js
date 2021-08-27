
let events = {}

export function sub(name,id,cb){
    events[name] = {
        id : cb
    }
}

export function send(name,data){
    console.group(`[${name}]=`)
    console.log(data)
    console.groupEnd()
    
    if(Object.keys(events).includes(name)){
        Object.values(events[name]).map(cb =>{
            cb(data)
        })
    }
}

const On = Object.freeze({
    mouse : "mouse",
    calc : "calc"
})
export {On}