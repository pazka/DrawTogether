"use strict";
exports.__esModule = true;
exports.Calc = exports.Room = void 0;
var Room = (function () {
    function Room() {
        this.lastUpdate = Date.now();
        this.calcs = [];
    }
    return Room;
}());
exports.Room = Room;
var Calc = (function () {
    function Calc() {
        this.texts = [];
    }
    return Calc;
}());
exports.Calc = Calc;
//# sourceMappingURL=Room.js.map