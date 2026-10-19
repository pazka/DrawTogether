import fs = require('fs')
import path = require("path");

// @ts-ignore
const env : any = JSON.parse(fs.readFileSync(path.join(__dirname, "../env.json")) )

console.log("Environment : " + ((process.argv[2].toLowerCase() == "dev") ? "DEV" : "PROD"))

export default env[(process.argv[2].toLowerCase() == "dev") ? "DEV" : "PROD"]