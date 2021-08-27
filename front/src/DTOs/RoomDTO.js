"use strict";
exports.__esModule = true;
exports.RoomDTO = void 0;
var LayerDTO_1 = require("./LayerDTO");
var RoomDTO = (function () {
    function RoomDTO() {
        this.lastUpdate = Date.now();
        this.layers = [];
    }
    RoomDTO.prototype.addLayer = function () {
        this.layers.push(new LayerDTO_1.LayerDTO(Math.max.apply(Math, this.layers.map(function (l) { return l.id; })) + 1));
    };
    return RoomDTO;
}());
exports.RoomDTO = RoomDTO;
//# sourceMappingURL=RoomDTO.js.map