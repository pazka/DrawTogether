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
const path = require("path");
const api_1 = __importDefault(require("./Services/api"));
const sockets = __importStar(require("./Services/sockets"));
const roomController = __importStar(require("./Controllers/roomController"));
const env_1 = __importDefault(require("./Services/env"));
const paths_1 = require("./Services/paths");
const health_1 = require("./Services/health");
const storage = __importStar(require("./Services/storage"));
const log_1 = require("./Services/log");
app.use((0, log_1.requestLogger)());
if (app.get('env') !== 'production')
    app.set('env', 'test');
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
app.get('/healthz', function (req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const h = yield (0, health_1.health)();
        res.status(h.ok ? 200 : 503).set('cache-control', 'no-store').json(h.body);
    });
});
app.get('/', function (req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        let room = yield roomController.createNewRoom();
        res.redirect(room.id);
        next();
    });
});
app.use('/uploads', express.static(paths_1.uploadsDir));
app.use('/', express.static(path.join(__dirname, 'front/build/')));
app.get('/:roomId', (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!req.params.roomId.includes('.'))
            yield roomController.fetchOrCreateRoom(req.params.roomId);
    }
    catch (e) {
        return next(e);
    }
    next();
}));
app.use('/:roomid', express.static(path.join(__dirname, 'front/build')));
app.use('/api/room', api_1.default);
app.use(log_1.errorRecorder);
Promise.all([
    sockets.init(httpServer)
]).then(() => {
    httpServer.listen(env_1.default.PORT, () => {
        startupLine().catch(() => undefined);
    });
});
function startupLine() {
    return __awaiter(this, void 0, void 0, function* () {
        let store = false;
        try {
            store = (0, health_1.canWrite)(yield (0, health_1.within)(storage.storeDir(), 3000));
        }
        catch (e) {
            store = false;
        }
        log_1.log.info('startup', 'Listening on ' + env_1.default.PORT, {
            port: env_1.default.PORT,
            mode: env_1.default.mode,
            uploads_dir_writable: (0, health_1.canWrite)(path.join(paths_1.uploadsDir, '.tmp')),
            store_dir_writable: store,
            log_level: log_1.log.level,
            config: (0, log_1.configNamesSet)(),
        });
    });
}
for (const signal of ['SIGTERM', 'SIGINT']) {
    process.on(signal, () => {
        log_1.log.info('shutdown', 'stopping', { signal, uptime_s: Math.round(process.uptime()) });
        httpServer.close();
        setTimeout(() => process.exit(0), 1000);
    });
}
//# sourceMappingURL=index.js.map