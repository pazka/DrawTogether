"use strict";
exports.__esModule = true;
var fs = require("fs");
var path = require("path");
var env = JSON.parse(fs.readFileSync(path.join(__dirname, "../env.json")));
console.log("Environment : " + ((process.argv[2].toLowerCase() == "dev") ? "DEV" : "PROD"));
exports["default"] = env[(process.argv[2].toLowerCase() == "dev") ? "DEV" : "PROD"];
//# sourceMappingURL=env.js.map