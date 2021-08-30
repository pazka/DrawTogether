import * as fs from 'fs'
import * as path from "path";

// @ts-ignore
const env : any = JSON.parse(fs.readFileSync(path.join(__dirname, "../env.json")) )

export default (envName : string)=>env[envName ?? "PROD"]