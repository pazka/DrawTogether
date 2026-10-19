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
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
const multer = require("multer");
const express = require("express");
const imageController_1 = require("../Controllers/imageController");
const events_1 = require("./events");
const router = express.Router();
const roomController = require('../Controllers/roomController');
const uploadTmpDir = path.join(__dirname, "../front/build/uploads/.tmp");
const upload = multer({
    dest: uploadTmpDir
});
const avatars = multer({
    dest: uploadTmpDir,
    fieldSize: 1024
});
router.get('/all', function (req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        res.send(yield roomController.getAllRooms());
    });
});
router.get('/:roomid', function (req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        res.send(yield roomController.getRoom(req.params.roomid));
    });
});
router.post("/:roomId/import", (req, res) => {
    let room = req.body;
    room.id = req.params.roomId;
    roomController.saveRoom(room)
        .then((r) => {
        res.status(200).send(r);
        (0, events_1.send)(events_1.On.EDIT_ROOM, room);
    })
        .catch((err) => res.status(403).send(err));
});
router.post("/:roomId/:layerId/upload", upload.single("layerImg"), (req, res) => {
    (0, imageController_1.writeImage)(req.file.originalname, req.params.roomId, req.params.layerId, req.file.path).then(r => {
        res
            .sendStatus(200);
    }).catch(err => {
        res
            .status(403)
            .send({ message: err });
    });
});
exports.default = router;
//# sourceMappingURL=api.js.map