
import express = require('express')
const app = express()
import http = require('http')
const httpServer = http.createServer(app);

import cors = require('cors')
import bodyParser = require('body-parser')
import morgan = require('morgan')
import path = require('path')

import routes from './Services/api'
import * as sockets from './Services/sockets'
import router from "./Services/api";
import * as roomController from './Controllers/roomController'
import {getRoom} from "./Controllers/roomController";
import env from "./Services/env"
import {uploadsDir} from "./Services/paths"
import {health} from "./Services/health"

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
// the container healthcheck polls /healthz every 30 s: keep it out of the access log
app.use(morgan('combined', {skip: (req: any) => req.path === '/healthz'}));

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
//websocket

Promise.all([
    sockets.init(httpServer)
]).then(()=>{
    httpServer.listen(env.PORT, () => {
        console.log('Listening on ' + env.PORT)
    });
})

