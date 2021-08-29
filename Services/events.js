"use strict";
exports.__esModule = true;
exports.On = exports.send = exports.sub = void 0;
var events = {};
function sub(name, cb) {
    if (!Object.keys(events).includes(name)) {
        events[name] = [];
    }
    events[name].push(cb);
}
exports.sub = sub;
function send(name, data) {
    if (name !== On.MOUSE_ACTION) {
        console.group("[" + name + "]");
        console.log(data);
        console.groupEnd();
    }
    if (!Object.keys(events).includes(name)) {
        events[name] = [];
    }
    if (Object.keys(events).includes(name)) {
        events[name].forEach(function (cb) { return cb(data); });
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