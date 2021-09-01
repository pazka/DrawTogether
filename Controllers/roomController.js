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
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
exports.__esModule = true;
exports.getAllRooms = exports.addImgPathInRoom = exports.updateRoom = exports.saveRoom = exports.createNewRoom = exports.fetchOrCreateRoom = exports.getRoom = void 0;
var storage = require("../Services/storage");
var RoomDTO_1 = require("../DTOs/RoomDTO");
var events_1 = require("../Services/events");
var LayerDTO_1 = require("../DTOs/LayerDTO");
var env_1 = require("../Services/env");
var node_persist_1 = require("node-persist");
var storage_1 = require("../Services/storage");
var allRoomIds = [];
storage.getRooms().then(function (res) {
    var _a;
    allRoomIds = (_a = res) !== null && _a !== void 0 ? _a : [];
});
var roomCleanUpTimeout = setInterval(removeUnusedRooms, env_1["default"].RoomCleanUpInterval * 1000);
function removeUnusedRooms() {
    return __awaiter(this, void 0, void 0, function () {
        var newRoomIds, index, room;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log("# Cleaning up room");
                    newRoomIds = __spreadArray([], allRoomIds, true);
                    index = allRoomIds.length - 1;
                    _a.label = 1;
                case 1:
                    if (!(index >= 0)) return [3, 5];
                    return [4, getRoom(allRoomIds[index])];
                case 2:
                    room = _a.sent();
                    if (!(Date.now() - room.lastUpdate > env_1["default"].RoomTTL * 1000)) return [3, 4];
                    return [4, (0, node_persist_1.removeItem)(room.id)];
                case 3:
                    _a.sent();
                    newRoomIds.splice(index, 1);
                    console.log("# Cleaned " + room.id + ", last update : " + new Date(room.lastUpdate));
                    _a.label = 4;
                case 4:
                    index--;
                    return [3, 1];
                case 5:
                    allRoomIds = newRoomIds;
                    return [4, (0, storage_1.saveRooms)(newRoomIds)];
                case 6:
                    _a.sent();
                    console.log("# Room checked ");
                    return [2];
            }
        });
    });
}
function getRoom(id) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!!allRoomIds.includes(id)) return [3, 1];
                    return [2, new RoomDTO_1.RoomDTO()];
                case 1: return [4, storage.getRoom(id)];
                case 2: return [2, _a.sent()];
            }
        });
    });
}
exports.getRoom = getRoom;
function fetchOrCreateRoom(id) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!!allRoomIds.includes(id)) return [3, 1];
                    return [2, createNewRoom(id)];
                case 1: return [4, storage.getRoom(id)];
                case 2: return [2, _a.sent()];
            }
        });
    });
}
exports.fetchOrCreateRoom = fetchOrCreateRoom;
function createNewRoom(existId) {
    if (existId === void 0) { existId = null; }
    return __awaiter(this, void 0, void 0, function () {
        var room;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    room = new RoomDTO_1.RoomDTO();
                    room.id = existId !== null && existId !== void 0 ? existId : newUniqueId(8);
                    room.layers = [new LayerDTO_1.LayerDTO()];
                    return [4, storage.saveRoom(room)];
                case 1:
                    _a.sent();
                    allRoomIds.push(room.id);
                    return [4, storage.saveRooms(allRoomIds)];
                case 2:
                    _a.sent();
                    (0, events_1.send)(events_1.On.NEW_ROOM, room);
                    return [2, room];
            }
        });
    });
}
exports.createNewRoom = createNewRoom;
function saveRoom(room) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4, storage.saveRoom(room)];
                case 1:
                    _a.sent();
                    return [2, room];
            }
        });
    });
}
exports.saveRoom = saveRoom;
function updateRoom(room) {
    return __awaiter(this, void 0, void 0, function () {
        var lastRoom;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!allRoomIds.includes(room.id)) {
                        throw Error('No Room with this id');
                    }
                    return [4, storage.getRoom(room.id)];
                case 1:
                    lastRoom = _a.sent();
                    if (Math.abs(Number(room.version) - Number(lastRoom.version)) > 10) {
                        throw Error("You fell out of sync with the server : you(" + room.version + " < new(" + lastRoom.version);
                    }
                    room.lastUpdate = Date.now();
                    room.version = Number(room.version) + 1;
                    return [4, storage.saveRoom(room)];
                case 2:
                    _a.sent();
                    return [2, room];
            }
        });
    });
}
exports.updateRoom = updateRoom;
function addImgPathInRoom(roomId, layerId, path) {
    return __awaiter(this, void 0, void 0, function () {
        var room, layerIndex;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!allRoomIds.includes(roomId)) {
                        throw Error('No Room with this id');
                    }
                    return [4, storage.getRoom(roomId)];
                case 1:
                    room = _a.sent();
                    room.lastUpdate = Date.now();
                    layerIndex = room.layers.findIndex(function (l) { return Number(l.id) === Number(layerId); });
                    room.layers[layerIndex].imgPath = path;
                    return [2, updateRoom(room).then(function (res) {
                            (0, events_1.send)(events_1.On.EDIT_ROOM, room);
                        })];
            }
        });
    });
}
exports.addImgPathInRoom = addImgPathInRoom;
function getAllRooms() {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2, allRoomIds];
        });
    });
}
exports.getAllRooms = getAllRooms;
function newUniqueId(l) {
    var cs = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var newId = new Array(l).fill(0).map(function (x) { return cs[Math.floor(Math.random() *
        cs.length)]; }).join('');
    return allRoomIds.includes(newId) ? newUniqueId(l) : newId;
}
//# sourceMappingURL=roomController.js.map