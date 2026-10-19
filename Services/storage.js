"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRooms = getRooms;
exports.saveRooms = saveRooms;
exports.getRoom = getRoom;
exports.saveRoom = saveRoom;
exports.removeRoom = removeRoom;
const persist = require("node-persist");
const events_1 = require("./events");
let ready = false;
let isDequeuingJobs = false;
let jobQueue = [];
function recursivelyExecJobStack(nbFnToExec) {
    if (nbFnToExec == 0) {
        isDequeuingJobs = false;
        return;
    }
    jobQueue.splice(0, 1)[0]().then(() => recursivelyExecJobStack(nbFnToExec - 1));
}
const operationWorker = setInterval(() => {
    if (jobQueue.length > 0 && !isDequeuingJobs) {
        isDequeuingJobs = true;
        recursivelyExecJobStack(jobQueue.length);
    }
}, 1);
function safeOperation(cb) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!ready) {
            yield persist.init({});
            ready = true;
        }
        jobQueue.push(cb);
    });
}
function safeSet(id, data) {
    return __awaiter(this, void 0, void 0, function* () {
        return new Promise(resolve => {
            safeOperation(() => persist.setItem(id, data).then(resolve));
        });
    });
}
function safeGet(id) {
    return __awaiter(this, void 0, void 0, function* () {
        return new Promise(resolve => {
            safeOperation(() => persist.getItem(id).then(resolve));
        });
    });
}
function safeRemove(id) {
    return __awaiter(this, void 0, void 0, function* () {
        return new Promise(resolve => {
            safeOperation(() => persist.removeItem(id).then(resolve));
        });
    });
}
function getRooms() {
    return __awaiter(this, void 0, void 0, function* () {
        return yield safeGet('rooms');
    });
}
function saveRooms(roomIds) {
    return __awaiter(this, void 0, void 0, function* () {
        return yield safeSet('rooms', roomIds);
    });
}
function getRoom(id) {
    return __awaiter(this, void 0, void 0, function* () {
        return yield safeGet('room-' + id);
    });
}
function saveRoom(room) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            return yield safeSet('room-' + room.id, room);
        }
        catch (e) {
            (0, events_1.send)(events_1.On.ERROR, e);
        }
    });
}
function removeRoom(id) {
    return __awaiter(this, void 0, void 0, function* () {
        return yield safeRemove('room-' + id);
    });
}
//# sourceMappingURL=storage.js.map