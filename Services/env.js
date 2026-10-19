"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
const path = require("path");
const env = JSON.parse(fs.readFileSync(path.join(__dirname, "../env.json")));
console.log("Environment : " + ((process.argv[2].toLowerCase() == "dev") ? "DEV" : "PROD"));
exports.default = env[(process.argv[2].toLowerCase() == "dev") ? "DEV" : "PROD"];
//# sourceMappingURL=env.js.map