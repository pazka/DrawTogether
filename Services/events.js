"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.On = void 0;
exports.sub = sub;
exports.send = send;
let events = {};
function sub(name, cb) {
    if (!Object.keys(events).includes(name)) {
        events[name] = [];
    }
    events[name].push(cb);
}
function send(name, data) {
    if (name !== On.MOUSE_ACTION) {
        console.group(`[${name}]`);
        console.log(data);
        console.groupEnd();
    }
    if (!Object.keys(events).includes(name)) {
        events[name] = [];
    }
    if (Object.keys(events).includes(name)) {
        events[name].forEach((cb) => cb(data));
    }
}
const On = Object.freeze({
    NEW_ROOM: "NEW_ROOM",
    EDIT_ROOM: "EDIT_ROOM",
    ERROR: "ERROR",
    NEW_IMG: "NEW_IMG",
    MOUSE_ACTION: "MOUSE_ACTION",
    TEXT_ACTION: "TEXT_ACTION"
});
exports.On = On;
//# sourceMappingURL=events.js.map