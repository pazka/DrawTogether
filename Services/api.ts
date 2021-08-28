import * as path from "path";

const multer = require("multer");

import * as express from 'express'
import * as fs from "fs";
import {isFormatValid, validFormats} from "../Controllers/imageController";

const router = express.Router()
const roomController = require('../Controllers/roomController')


const upload = multer({
    dest: "uploads"
    // you might also want to set some limits: https://github.com/expressjs/multer#limits
});

router.get('/all', async function (req, res) {
    res.send(await roomController.getAllRooms())
})

router.get('/:roomid', async function (req, res) {
    res.send(await roomController.getRoom(req.params.roomid))
})

router.get("/:roomId/img/:layerid",async function (req, res) {
    const targetPath = path.join(__dirname, `../front/build/uploads/${req.params.roomId}/${req.params.layerid}.png`);
    res.sendFile(targetPath)
})

router.post("/:roomId/:layerId/upload", upload.single("layerImg" /* name attribute of <file> element in your form */),
    (req: any, res: any) => {
        const tempPath = req.file.path;
        const fileExt = path.extname(req.file.originalname)
        const targetFolder = path.join(__dirname, `../front/build/uploads/${req.params.roomId}`);
        const targetPath = path.join(targetFolder, `${req.params.layerId}${fileExt}`);
        
        if (!fs.existsSync(targetFolder)){
            fs.mkdirSync(targetFolder, { recursive: true });
        }
        
        if (!isFormatValid(fileExt)) {
            fs.unlink(tempPath, err => {
                if (err) {
                    res
                        .status(403)
                        .send(err.message);
                }

                res
                    .status(403)
                    .send(`Only ${validFormats.join(', ')} files are allowed!`);
            })
            return
        }

        fs.rename(tempPath, targetPath, err => {
            if (err) {
                res
                    .status(403)
                    .send(err.message);
            }

            res
                .status(200)
                .send("File uploaded!");
        });
    }
)

export default router