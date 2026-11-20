
import express = require('express')
const app = express()
import http = require('http')
const httpServer = http.createServer(app);

import cors = require('cors')
import bodyParser = require('body-parser')
import path = require('path')

import routes from './Services/api'
import * as sockets from './Services/sockets'
import router from "./Services/api";
import * as roomController from './Controllers/roomController'
import {getRoom} from "./Controllers/roomController";
import env from "./Services/env"
import {uploadsDir} from "./Services/paths"
import {health, canWrite, within} from "./Services/health"
import * as storage from "./Services/storage"
import {log, requestLogger, errorRecorder, configNamesSet} from "./Services/log"

// Logging standard (Services/log): X-Request-Id on every answer; only 5xx and slow answers are logged at info.
app.use(requestLogger())
// Express prints every error (stack, body-parser excerpts of the body) to stderr unless its env is "test";
// errorRecorder puts it in the JSON request line instead. Answers are unchanged: finalhandler only treats
// "production" differently, and that one is left as it is.
if (app.get('env') !== 'production') app.set('env', 'test')

app.use(cors({
    origin: function(origin, callback){
        // allow requests with no origin 
        // (like mobile apps or curl requests)
        if(!origin) return callback(null, true);
        if(env.allowedOrigin.indexOf(origin) === -1){
            var msg = 'The CORS policy for this site does not ' +
                'allow access from the specified Origin.';
            return callback(new Error(msg), false);
        }
        return callback(null, true);
    }
}));
app.options('/{*splat}', cors())
app.use(bodyParser.json({limit:'100mb'}));
app.use(bodyParser.urlencoded({ extended: true }));

// Before the room routes, or /healthz would create a room named "healthz"
app.get('/healthz', async function (req, res) {
    const h = await health()
    res.status(h.ok ? 200 : 503).set('cache-control', 'no-store').json(h.body)
})


// @ts-ignore

app.get('/', async function (req, res,next) {
    let room = await roomController.createNewRoom()
    res.redirect(room.id)
    next()
})
// Uploaded images (UPLOADS_DIR, default front/build/uploads: then this serves exactly what the line below did)
app.use('/uploads', express.static(uploadsDir));
app.use('/', express.static(path.join(__dirname, 'front/build/')));

app.get('/:roomId', (req, res,next)=>{
    if(!req.params.roomId.includes('.'))
        roomController.fetchOrCreateRoom(req.params.roomId)
    
    next()
})
app.use('/:roomid', express.static(path.join(__dirname, 'front/build')))

app.use('/api/room',routes)
app.use(errorRecorder)
//websocket

Promise.all([
    sockets.init(httpServer)
]).then(()=>{
    httpServer.listen(env.PORT, () => {
        startupLine().catch((): void => undefined)
    });
})

async function startupLine(): Promise<void> {
    let store = false
    try {
        store = canWrite(await within(storage.storeDir(), 3000))
    } catch (e) {
        store = false
    }
    log.info('startup', 'Listening on ' + env.PORT, {
        port: env.PORT,
        mode: env.mode,
        uploads_dir_writable: canWrite(path.join(uploadsDir, '.tmp')),
        store_dir_writable: store,
        log_level: log.level,
        config: configNamesSet(),
    })
}

// docker stop (SIGTERM; node is PID 1 in the image): one line, a moment for the room store's write queue, exit
for (const signal of ['SIGTERM', 'SIGINT']) {
    process.on(signal, () => {
        log.info('shutdown', 'stopping', {signal, uptime_s: Math.round(process.uptime())})
        httpServer.close()
        setTimeout(() => process.exit(0), 1000)
    })
}

