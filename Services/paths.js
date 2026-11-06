"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.persistDir = exports.uploadsDir = void 0;
const path = require("path");
exports.uploadsDir = process.env.UPLOADS_DIR
    ? path.resolve(process.env.UPLOADS_DIR)
    : path.join(__dirname, "../front/build/uploads");
exports.persistDir = process.env.PERSIST_DIR ? path.resolve(process.env.PERSIST_DIR) : null;
//# sourceMappingURL=paths.js.map