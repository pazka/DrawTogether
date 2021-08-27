export class NameDTO{
    val = "Name"
    pos = [0,0]
    size = 1
    
    constructor(val : string, x : number,y : number) {
        this.val = val
        this.pos = [x,y]
    }
}