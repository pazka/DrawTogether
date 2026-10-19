"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRoom = getRoom;
exports.fetchOrCreateRoom = fetchOrCreateRoom;
exports.createNewRoom = createNewRoom;
exports.saveRoom = saveRoom;
exports.updateRoom = updateRoom;
exports.addImgPathInRoom = addImgPathInRoom;
exports.getAllRooms = getAllRooms;
const storage = __importStar(require("../Services/storage"));
const RoomDTO_1 = require("../DTOs/RoomDTO");
const events_1 = require("../Services/events");
const LayerDTO_1 = require("../DTOs/LayerDTO");
const env_1 = __importDefault(require("../Services/env"));
const node_persist_1 = require("node-persist");
const storage_1 = require("../Services/storage");
let allRoomIds = [];
storage.getRooms().then(res => {
    var _a;
    allRoomIds = (_a = res) !== null && _a !== void 0 ? _a : [];
});
const roomCleanUpTimeout = setInterval(removeUnusedRooms, env_1.default.RoomCleanUpInterval * 1000);
function removeUnusedRooms() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log("# Cleaning up room");
        let newRoomIds = [...allRoomIds];
        for (let index = allRoomIds.length - 1; index >= 0; index--) {
            let room = yield getRoom(allRoomIds[index]);
            console.log(`# Checking room ${room.id}`);
            if (room.cantDie) {
                console.log(`The room : ${room.id} can't die !`);
            }
            if (!room.cantDie && (Date.now() - room.lastUpdate > env_1.default.RoomTTL * 1000)) {
                yield (0, node_persist_1.removeItem)(room.id);
                newRoomIds.splice(index, 1);
                console.log(`# Cleaned ${room.id}, last update : ${new Date(room.lastUpdate)}`);
            }
        }
        allRoomIds = newRoomIds;
        yield (0, storage_1.saveRooms)(newRoomIds);
        console.log("# Room checked ");
    });
}
function getRoom(id) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!allRoomIds.includes(id)) {
            return new RoomDTO_1.RoomDTO();
        }
        else {
            return yield storage.getRoom(id);
        }
    });
}
function fetchOrCreateRoom(id) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!allRoomIds.includes(id)) {
            return createNewRoom(id);
        }
        else {
            return yield storage.getRoom(id);
        }
    });
}
function createNewRoom() {
    return __awaiter(this, arguments, void 0, function* (existId = null) {
        const room = new RoomDTO_1.RoomDTO();
        room.id = existId !== null && existId !== void 0 ? existId : newUniqueId(8);
        room.layers = [new LayerDTO_1.LayerDTO()];
        yield storage.saveRoom(room);
        allRoomIds.push(room.id);
        yield storage.saveRooms(allRoomIds);
        (0, events_1.send)(events_1.On.NEW_ROOM, room);
        return room;
    });
}
function saveRoom(room) {
    return __awaiter(this, void 0, void 0, function* () {
        yield storage.saveRoom(room);
        return room;
    });
}
function updateRoom(room) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!allRoomIds.includes(room.id)) {
            throw Error('No Room with this id');
        }
        let lastRoom = yield storage.getRoom(room.id);
        if (Math.abs(Number(room.version) - Number(lastRoom.version)) > 10) {
            throw Error(`You fell out of sync with the server : you(${room.version} < new(${lastRoom.version}`);
        }
        room.lastUpdate = Date.now();
        room.version = Number(room.version) + 1;
        yield storage.saveRoom(room);
        return room;
    });
}
function addImgPathInRoom(roomId, layerId, path) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!allRoomIds.includes(roomId)) {
            throw Error('No Room with this id');
        }
        let room = yield storage.getRoom(roomId);
        room.lastUpdate = Date.now();
        const layerIndex = room.layers.findIndex(l => Number(l.id) === Number(layerId));
        room.layers[layerIndex].imgPath = path;
        return updateRoom(room).then(res => {
            (0, events_1.send)(events_1.On.EDIT_ROOM, room);
        });
    });
}
function getAllRooms() {
    return __awaiter(this, void 0, void 0, function* () {
        return allRoomIds;
    });
}
function newUniqueId(l) {
    const cs = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let newId = new Array(l).fill(0).map(x => cs[Math.floor(Math.random() *
        cs.length)]).join('');
    return allRoomIds.includes(newId) ? newUniqueId(l) : newId;
}
//# sourceMappingURL=roomController.js.map