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
const express = require("express");
const app = express();
const http = require("http");
const httpServer = http.createServer(app);
const cors = require("cors");
const bodyParser = require("body-parser");
const morgan = require("morgan");
const path = require("path");
const api_1 = __importDefault(require("./Services/api"));
const sockets = __importStar(require("./Services/sockets"));
const roomController = __importStar(require("./Controllers/roomController"));
const env_1 = __importDefault(require("./Services/env"));
app.use(cors({
    origin: function (origin, callback) {
        if (!origin)
            return callback(null, true);
        if (env_1.default.allowedOrigin.indexOf(origin) === -1) {
            var msg = 'The CORS policy for this site does not ' +
                'allow access from the specified Origin.';
            return callback(new Error(msg), false);
        }
        return callback(null, true);
    }
}));
app.options('/{*splat}', cors());
app.use(bodyParser.json({ limit: '100mb' }));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(morgan('combined'));
app.get('/', function (req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        let room = yield roomController.createNewRoom();
        res.redirect(room.id);
        next();
    });
});
app.use('/', express.static(path.join(__dirname, 'front/build/')));
app.get('/:roomId', (req, res, next) => {
    if (!req.params.roomId.includes('.'))
        roomController.fetchOrCreateRoom(req.params.roomId);
    next();
});
app.use('/:roomid', express.static(path.join(__dirname, 'front/build')));
app.use('/api/room', api_1.default);
Promise.all([
    sockets.init(httpServer)
]).then(() => {
    httpServer.listen(env_1.default.PORT, () => {
        console.log('Listening on ' + env_1.default.PORT);
    });
});
//# sourceMappingURL=index.js.map