
import * as express from 'express'
const app = express()
import * as http from 'http'
const httpServer = http.createServer(app);

import * as cors from 'cors'
import * as bodyParser from 'body-parser'
import * as morgan from 'morgan'
import * as path from 'path'

import routes from './Services/api'
import * as sockets from './Services/sockets'
import router from "./Services/api";
import * as roomController from './Controllers/roomController'
import {getRoom} from "./Controllers/roomController";
import env from "./Services/env"

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
app.options('*', cors())
app.use(bodyParser.json({limit:'100mb'}));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(morgan('combined'));


// @ts-ignore

app.get('/', async function (req, res,next) {
    let room = await roomController.createNewRoom()
    res.redirect(room.id)
    next()
})
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

