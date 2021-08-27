"use strict";
exports.__esModule = true;
exports.Layer = exports.Room = void 0;
var Room = (function () {
    function Room() {
        this.lastUpdate = Date.now();
        this.layers = [];
    }
    Room.prototype.addLayer = function () {
        this.layers.push(new Layer(Math.max.apply(Math, this.layers.map(function (l) { return l.id; })) + 1));
    };
    return Room;
}());
exports.Room = Room;
var Layer = (function () {
    function Layer(id) {
        if (id === void 0) { id = 1; }
        this.imgPath = "";
        this.texts = [];
        this.name = "Layer";
        this.id = id;
    }
    return Layer;
}());
exports.Layer = Layer;
//# sourceMappingURL=Room.js.map