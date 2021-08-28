
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

const PORT = 9001

app.use(cors());
app.use(bodyParser.json());
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
    roomController.fetchOrCreateRoom(req.params.roomId)
    next()
})
app.use('/:roomid', express.static(path.join(__dirname, 'front/build')))

app.use('/api/room',routes)
//websocket

Promise.all([
    sockets.init(httpServer)
]).then(()=>{
    httpServer.listen(PORT, () => {
        console.log('Listening on ' + PORT)
    });
})

