"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.On = void 0;
exports.sub = sub;
exports.unsub = unsub;
exports.send = send;
let events = {};
function sub(name, cb) {
    if (!Object.keys(events).includes(name)) {
        events[name] = [];
    }
    events[name].push(cb);
}
function unsub(name, cb) {
    if (Object.keys(events).includes(name)) {
        events[name] = events[name].filter((f) => f !== cb);
    }
}
function send(name, data) {
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