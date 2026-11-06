"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
exports.health = health;
const fs = require("fs");
const path = require("path");
const paths_1 = require("./paths");
const storage = __importStar(require("./storage"));
function canWrite(dir) {
    const probe = path.join(dir, `.healthz-${process.pid}`);
    try {
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(probe, "ok");
        fs.unlinkSync(probe);
        return true;
    }
    catch (e) {
        return false;
    }
}
function within(p, ms) {
    return Promise.race([p, new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), ms))]);
}
function health() {
    return __awaiter(this, void 0, void 0, function* () {
        const body = { status: "ok" };
        let ok = true;
        body.uploads = canWrite(path.join(paths_1.uploadsDir, ".tmp")) ? "writable" : "not writable";
        if (body.uploads !== "writable")
            ok = false;
        try {
            body.store = canWrite(yield within(storage.storeDir(), 3000)) ? "writable" : "not writable";
            if (body.store !== "writable")
                ok = false;
            const rooms = yield within(storage.getRooms(), 3000);
            body.rooms = Array.isArray(rooms) ? rooms.length : 0;
        }
        catch (e) {
            ok = false;
            body.store = "unreadable";
        }
        if (!ok)
            body.status = "error";
        return { ok, body };
    });
}
//# sourceMappingURL=health.js.map