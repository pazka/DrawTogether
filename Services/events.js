"use strict";
exports.__esModule = true;
exports.On = exports.send = exports.sub = void 0;
var allEvents = {};
function sub(event, observer) {
    if (Object.keys(allEvents).includes(event)) {
        allEvents[event].push(observer);
    }
    else {
        allEvents[event] = [observer];
    }
}
exports.sub = sub;
function send(event, data) {
    console.log("[" + event + "]=");
    console.info("" + data);
    console.log("###");
    if (Object.keys(allEvents).includes(event)) {
        allEvents[event].forEach(function (observer) { return observer(event, data); });
    }
}
exports.send = send;
var On = Object.freeze({
    NEW_ROOM: "NEW_ROOM",
    EDIT_ROOM: "EDIT_ROOM",
    NEW_IMG: "NEW_IMG",
    MOUSE_ACTION: "MOUSE_ACTION",
    TEXT_ACTION: "TEXT_ACTION"
});
exports.On = On;
//# sourceMappingURL=events.js.map