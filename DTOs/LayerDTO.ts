export class LayerDTO {
    imgPath : string = ""
    texts : string[] = []
    name : string = "Layer"
    id : number
    
    constructor(id : number = 1) {
        this.id = id
    }
}