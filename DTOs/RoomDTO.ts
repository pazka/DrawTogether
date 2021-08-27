import {LayerDTO} from "./LayerDTO";

export class RoomDTO {
    id : string
    lastUpdate : number = Date.now()
    layers : LayerDTO[] = []
    
    constructor(){
    }
    
    addLayer(){
        this.layers.push(new LayerDTO(Math.max(...this.layers.map(l => l.id)) + 1))
    }
}