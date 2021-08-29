
let events = {}

export function sub(name,id,cb){
    if(!Object.keys(events).includes(name)){
        events[name] = {}
    }
    
    events[name][id] = cb
}

export function send(name,data){
    if(name !== On.snd_mouse){
        console.group(`[${name}]${new Date()}`)
        console.log(data)
        console.groupEnd()
    }
    
    if(Object.keys(events).includes(name)){
        Object.values(events[name]).forEach(cb => 
            cb(data)
        )
    }
}

const On = Object.freeze({
    snd_join : "snd_join",
    snd_mouse : "snd_mouse",
    snd_save : "snd_save",
    
    rcv_load : "rcv_load",
    rcv_mouse : "rcv_mouse",
    rcv_leave : "rcv_leave",
    
    ui_newName : "ui_newName",
})
export {On}