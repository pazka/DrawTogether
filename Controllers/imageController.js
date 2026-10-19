"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validFormats = void 0;
exports.isFormatValid = isFormatValid;
exports.writeImage = writeImage;
const fs = require("fs");
const path = require("path");
const roomController_1 = require("./roomController");
exports.validFormats = [
    ".png", ".jpg", ".jpeg", ".svg"
];
function isFormatValid(format) {
    if (!format)
        return false;
    return exports.validFormats.includes(format.toLowerCase());
}
function writeImage(originalName, roomId, layerId, tempPath) {
    return new Promise((resolve, reject) => {
        const targetFolder = path.join(__dirname, `../front/build/uploads/${roomId}`);
        if (!fs.existsSync(targetFolder)) {
            fs.mkdirSync(targetFolder, { recursive: true });
        }
        const fileExt = path.extname(originalName);
        if (!isFormatValid(fileExt)) {
            fs.unlink(tempPath, (err) => {
                if (err)
                    return reject(err);
                return reject(`Only ${exports.validFormats.join(', ')} files are allowed!`);
            });
            return;
        }
        const targetPath = path.join(targetFolder, `${originalName}`);
        fs.rename(tempPath, targetPath, (err) => {
            if (err)
                return reject(err);
            (0, roomController_1.addImgPathInRoom)(roomId, Number(layerId), `/uploads/${roomId}/${originalName}`).then(resolve).catch(reject);
        });
    });
}
//# sourceMappingURL=imageController.js.map