"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
const path = require("path");
const env = JSON.parse(fs.readFileSync(path.join(__dirname, "../env.json")));
console.log("Environment : " + ((process.argv[2].toLowerCase() == "dev") ? "DEV" : "PROD"));
const selected = env[(process.argv[2].toLowerCase() == "dev") ? "DEV" : "PROD"];
if (process.env.PORT) {
    const port = Number(process.env.PORT);
    if (!Number.isInteger(port) || port < 1 || port > 65535)
        throw new Error("PORT must be a TCP port number");
    selected.PORT = port;
}
exports.default = selected;
//# sourceMappingURL=env.js.map