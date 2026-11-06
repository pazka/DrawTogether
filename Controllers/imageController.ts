import fs = require("fs");
import path = require("path");
import {addImgPathInRoom} from "./roomController";
import {uploadsDir} from "../Services/paths";


export const validFormats = [
    ".png", ".jpg", ".jpeg", ".svg"
]

export function isFormatValid(format: string) {
    if (!format)
        return false

    return validFormats.includes(format.toLowerCase())
}

export function writeImage(originalName: string, roomId: string, layerId: string, tempPath: string) {
    return new Promise((resolve,reject)=>{
        const targetFolder = path.join(uploadsDir, `${roomId}`);

        if (!fs.existsSync(targetFolder)) {
            fs.mkdirSync(targetFolder, {recursive: true});
        }

        //check format
        const fileExt = path.extname(originalName)

        if (!isFormatValid(fileExt)) {
            fs.unlink(tempPath, (err: any) => {
                if (err)
                    return reject(err)

                return reject(`Only ${validFormats.join(', ')} files are allowed!`);
            })
            // Without this return the rename below raced the unlink and could store the refused file.
            return
        }

        //move tmp file to public folder
        const targetPath = path.join(targetFolder, `${originalName}`);

        fs.rename(tempPath, targetPath, (err: any) => {
            if (err)
                return reject(err)

            addImgPathInRoom(roomId, Number(layerId),`/uploads/${roomId}/${originalName}`).then(resolve).catch(reject)
        });
    })
}