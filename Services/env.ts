import fs = require('fs')
import path = require("path");

// @ts-ignore
const env : any = JSON.parse(fs.readFileSync(path.join(__dirname, "../env.json")) )

const mode = (process.argv[2].toLowerCase() == "dev") ? "DEV" : "PROD"
const selected = env[mode]
// DEV or PROD (the startup line says which)
selected.mode = mode

// PORT (env) overrides env.json's port: the hosh-deploy compose listens on 8000, the legacy compose keeps 80
if (process.env.PORT) {
    const port = Number(process.env.PORT)
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("PORT must be a TCP port number")
    selected.PORT = port
}

export default selected