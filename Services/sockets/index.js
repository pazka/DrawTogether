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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.init = init;
const roomController_1 = require("../../Controllers/roomController");
const events_1 = require("../events");
const env_1 = __importDefault(require("../env"));
const iolib = require('socket.io');
let io;
var allEvents;
(function (allEvents) {
    allEvents["join"] = "join";
    allEvents["leave"] = "leave";
    allEvents["mouse"] = "mouse";
    allEvents["loadRoom"] = "loadRoom";
    allEvents["saveRoom"] = "saveRoom";
    allEvents["error"] = "error";
})(allEvents || (allEvents = {}));
function init(httpServer) {
    return __awaiter(this, void 0, void 0, function* () {
        io = iolib(httpServer, {
            cors: {
                origin: env_1.default.allowedOrigin,
                methods: ["GET", "POST"]
            }
        });
        io.on('connection', (socket) => {
            console.log('Client connected');
            newSocketConnection(socket);
        });
    });
}
function newSocketConnection(socket) {
    let currentRoom = null;
    socket.onAny((eventName, ...args) => {
        if (eventName == "mouse")
            return;
        console.log(eventName, args);
    });
    socket.on('connect', () => {
        console.log(`${socket.conn.remoteAddress} connected`);
    });
    socket.on(allEvents.join, (roomId) => __awaiter(this, void 0, void 0, function* () {
        currentRoom = roomId;
        socket.join(currentRoom);
        console.log(`joined room-${currentRoom}`);
        socket.to(currentRoom).emit(allEvents.join, roomId);
        io.to(currentRoom).emit(allEvents.loadRoom, yield (0, roomController_1.getRoom)(currentRoom));
    }));
    socket.on(allEvents.mouse, (data) => {
        socket.to(currentRoom).emit(allEvents.mouse, Object.assign({ id: socket.id }, data));
    });
    socket.on(allEvents.saveRoom, (room) => __awaiter(this, void 0, void 0, function* () {
        try {
            (0, roomController_1.updateRoom)(room).then(res => {
                io.to(room.id).emit(allEvents.loadRoom, room);
            }).catch(err => {
                socket.emit(allEvents.error, JSON.stringify(err));
            });
        }
        catch (err) {
            socket.emit(allEvents.error, JSON.stringify(err));
        }
    }));
    socket.on('disconnect', () => {
        io.to(currentRoom).emit(allEvents.leave, { id: socket.id });
        console.log(`${socket.conn.remoteAddress} disconnected`);
    });
    (0, events_1.sub)(events_1.On.EDIT_ROOM, (room) => {
        io.to(room.id).emit(allEvents.loadRoom, room);
    });
    (0, events_1.sub)(events_1.On.ERROR, (error) => {
        io.broadcast.emit(allEvents.error, error);
    });
}
//# sourceMappingURL=index.js.map