import {NameDTO} from "./NameDTO";

export class LayerDTO {
    imgPath : string = ""
    texts : NameDTO[] = []
    name : string = "Layer"
    id : number
    
    constructor(id : number = 1) {
        this.id = id
    }
}