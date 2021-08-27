
export class Room {
    id : string
    lastUpdate : number = Date.now()
    layers : Layer[] = [new Layer()]
    
    constructor(){
    }
    
    addLayer(){
        this.layers.push(new Layer(Math.max(...this.layers.map(l => l.id)) + 1))
    }
}

export class Layer{
    imgPath : string = ""
    texts : string[] = []
    name : string = "Layer"
    id : number
    
    constructor(id : number = 1) {
        this.id = id
    }
}