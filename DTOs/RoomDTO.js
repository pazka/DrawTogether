"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RoomDTO = void 0;
const LayerDTO_1 = require("./LayerDTO");
class RoomDTO {
    constructor() {
        this.lastUpdate = Date.now();
        this.version = 0;
        this.cantDie = false;
        this.layers = [];
    }
    addLayer() {
        this.layers.push(new LayerDTO_1.LayerDTO(Math.max(...this.layers.map(l => l.id)) + 1));
    }
}
exports.RoomDTO = RoomDTO;
//# sourceMappingURL=RoomDTO.js.map