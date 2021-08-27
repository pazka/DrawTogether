"use strict";
exports.__esModule = true;
exports.Layer = exports.Room = void 0;
var Room = (function () {
    function Room() {
        this.lastUpdate = Date.now();
        this.layers = [];
    }
    return Room;
}());
exports.Room = Room;
var Layer = (function () {
    function Layer() {
        this.texts = [];
        this.name = "Layer";
    }
    return Layer;
}());
exports.Layer = Layer;
//# sourceMappingURL=Room.js.map