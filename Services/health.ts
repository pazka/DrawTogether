import fs = require("fs");
import path = require("path");
import {uploadsDir} from "./paths";
import * as storage from "./storage";

// GET /healthz: proves the app can do its job, not just that the process is up: the uploads dir and the room
// store accept a write (a dotfile, ignored by express.static and node-persist), and the room list reads back.
// Never exposes paths or errors.
function canWrite(dir: string): boolean {
    const probe = path.join(dir, `.healthz-${process.pid}`);
    try {
        fs.mkdirSync(dir, {recursive: true});
        fs.writeFileSync(probe, "ok");
        fs.unlinkSync(probe);
        return true;
    } catch (e) {
        return false;
    }
}

function within<T>(p: Promise<T>, ms: number): Promise<T> {
    return Promise.race([p, new Promise<T>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms))]);
}

export async function health(): Promise<{ ok: boolean, body: any }> {
    const body: any = {status: "ok"};
    let ok = true;

    body.uploads = canWrite(path.join(uploadsDir, ".tmp")) ? "writable" : "not writable";
    if (body.uploads !== "writable") ok = false;

    try {
        body.store = canWrite(await within(storage.storeDir(), 3000)) ? "writable" : "not writable";
        if (body.store !== "writable") ok = false;
        const rooms: any = await within(storage.getRooms(), 3000);
        body.rooms = Array.isArray(rooms) ? rooms.length : 0;
    } catch (e) {
        ok = false;
        body.store = "unreadable";
    }

    if (!ok) body.status = "error";
    return {ok, body};
}
