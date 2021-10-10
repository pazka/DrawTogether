"use strict";
exports.__esModule = true;
exports.writeImage = exports.isFormatValid = exports.validFormats = void 0;
var fs = require("fs");
var path = require("path");
var roomController_1 = require("./roomController");
exports.validFormats = [
    ".png", ".jpg", ".jpeg", ".svg"
];
function isFormatValid(format) {
    if (!format)
        return false;
    return exports.validFormats.includes(format.toLowerCase());
}
exports.isFormatValid = isFormatValid;
function writeImage(originalName, roomId, layerId, tempPath) {
    return new Promise(function (resolve, reject) {
        var targetFolder = path.join(__dirname, "../front/build/uploads/" + roomId);
        if (!fs.existsSync(targetFolder)) {
            fs.mkdirSync(targetFolder, { recursive: true });
        }
        var fileExt = path.extname(originalName);
        if (!isFormatValid(fileExt)) {
            fs.unlink(tempPath, function (err) {
                if (err)
                    return reject(err);
                return reject("Only " + exports.validFormats.join(', ') + " files are allowed!");
            });
        }
        var targetPath = path.join(targetFolder, "" + originalName);
        fs.rename(tempPath, targetPath, function (err) {
            if (err)
                return reject(err);
            (0, roomController_1.addImgPathInRoom)(roomId, Number(layerId), "/uploads/" + roomId + "/" + originalName).then(resolve)["catch"](reject);
        });
    });
}
exports.writeImage = writeImage;
//# sourceMappingURL=imageController.js.map