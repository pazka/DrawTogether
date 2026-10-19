import * as path from "path";

const multer = require("multer");

import * as express from 'express'
import * as fs from "fs";
import {isFormatValid, validFormats, writeImage} from "../Controllers/imageController";
import {RoomDTO} from "../DTOs/RoomDTO";
import {On, send} from "./events";

const router = express.Router()
const roomController = require('../Controllers/roomController')


// Multer temp files must live on the same filesystem as the final upload folder
// (imageController renames them into ../front/build/uploads/<roomId>, which is a bind
// mount in production: a rename across mounts fails with EXDEV). It also keeps multer's
// startup mkdir inside a writable volume when the container runs as non-root.
const uploadTmpDir = path.join(__dirname, "../front/build/uploads/.tmp");

const upload = multer({
    dest: uploadTmpDir
    // you might also want to set some limits: https://github.com/expressjs/multer#limits
});

const avatars = multer({
    dest: uploadTmpDir,
    fieldSize : 1024
    // you might also want to set some limits: https://github.com/expressjs/multer#limits
});

router.get('/all', async function (req, res) {
    res.send(await roomController.getAllRooms())
})

router.get('/:roomid', async function (req, res) {
    res.send(await roomController.getRoom(req.params.roomid))
})

router.post("/:roomId/import",(req: any, res: any) => {
    let room : RoomDTO= req.body
    room.id = req.params.roomId
    
    roomController.saveRoom(room)
        .then((r :any) => {
            res.status(200).send(r)
            send(On.EDIT_ROOM,room)
        })
        .catch((err :any) =>res.status(403).send(err))
})

router.post("/:roomId/:layerId/upload", upload.single("layerImg" /* name attribute of <file> element in your form */),
    (req: any, res: any) => {        
        writeImage(req.file.originalname,req.params.roomId,req.params.layerId,req.file.path).then(r =>{
            res
                .sendStatus(200)
        }).catch(err =>{
            res
                .status(403)
                .send({message: err});
        })
    }
)

export default router