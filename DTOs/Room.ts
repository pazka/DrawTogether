
export class Room {
    id : string
    lastUpdate : number = Date.now()
    calcs : Calc[] = []
}

export class Calc{
    imgPath : string
    texts : string[] = []
}