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
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
exports.__esModule = true;
var multer = require("multer");
var express = require("express");
var imageController_1 = require("../Controllers/imageController");
var events_1 = require("./events");
var router = express.Router();
var roomController = require('../Controllers/roomController');
var upload = multer({
    dest: "uploads"
});
var avatars = multer({
    dest: "avatars",
    fieldSize: 1024
});
router.get('/all', function (req, res) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    _b = (_a = res).send;
                    return [4, roomController.getAllRooms()];
                case 1:
                    _b.apply(_a, [_c.sent()]);
                    return [2];
            }
        });
    });
});
router.get('/:roomid', function (req, res) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    _b = (_a = res).send;
                    return [4, roomController.getRoom(req.params.roomid)];
                case 1:
                    _b.apply(_a, [_c.sent()]);
                    return [2];
            }
        });
    });
});
router.post("/:roomId/import", function (req, res) {
    var room = req.body;
    room.id = req.params.roomId;
    roomController.saveRoom(room)
        .then(function (r) {
        res.status(200).send(r);
        (0, events_1.send)(events_1.On.EDIT_ROOM, room);
    })["catch"](function (err) { return res.status(403).send(err); });
});
router.post("/:roomId/:layerId/upload", upload.single("layerImg"), function (req, res) {
    (0, imageController_1.writeImage)(req.file.originalname, req.params.roomId, req.params.layerId, req.file.path).then(function (r) {
        res
            .sendStatus(200);
    })["catch"](function (err) {
        res
            .status(403)
            .send({ message: err });
    });
});
exports["default"] = router;
//# sourceMappingURL=api.js.map