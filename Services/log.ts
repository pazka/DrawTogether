import crypto = require("crypto");
import perf = require("perf_hooks");

// Logging standard (pazka/hosh-management AGENTS.md section 11): stdout only, one JSON object per line with
// ts, level, service, version, event (stable snake_case name, the thing to count), msg, then the line's own
// fields. Never a raw path, query string, body, socket payload, room id, cookie, user agent or IP.

const LEVELS: { [level: string]: number } = {debug: 10, info: 20, warn: 30, error: 40}

export const SERVICE = "drawtogether"
// a request slower than this is logged at warn
export const SLOW_MS = 1000
// the variables the server reads: the startup line lists the ones that are set, never their values
export const CONFIG_NAMES = ["PORT", "UPLOADS_DIR", "PERSIST_DIR", "LOG_LEVEL", "APP_VERSION"]

export type LogFn = (event: string, msg: string, fields?: any) => void

export interface Logger {
    level: string
    debug: LogFn
    info: LogFn
    warn: LogFn
    error: LogFn
}

// level: debug | info | warn | error (anything else: info)
export function createLogger(level: string, out: { write: (s: string) => any }, version: string): Logger {
    const name = LEVELS[level] ? level : "info"
    const min = LEVELS[name]
    const emit = (lvl: string): LogFn => (event: string, msg: string, fields: any = {}) => {
        if (LEVELS[lvl] < min) return
        out.write(JSON.stringify({
            ts: new Date().toISOString(), level: lvl, service: SERVICE, version, event, msg, ...fields,
        }) + "\n")
    }
    return {level: name, debug: emit("debug"), info: emit("info"), warn: emit("warn"), error: emit("error")}
}

export const log: Logger = createLogger(process.env.LOG_LEVEL, process.stdout, process.env.APP_VERSION || "dev")

export function configNamesSet(env: any = process.env): string[] {
    return CONFIG_NAMES.filter(n => env[n] !== undefined && env[n] !== "")
}

// The `err` field of an error line: type, message, stack. Every string of `hide` (the raw URL, its path
// segments...) found in the message as a whole word is replaced by "<hidden>"; the stack keeps only its
// "at ..." frames, under the cleaned message, so request data never reaches the log through an error.
export function errField(e: any, hide: string[] = []): { err: { type: string, message: string, stack?: string } } {
    const secrets = hide.filter(h => typeof h === "string" && h.length > 1).sort((a, b) => b.length - a.length)
    const word = (h: string) => new RegExp("(?<![A-Za-z0-9])" + h.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?![A-Za-z0-9])", "g")
    const clean = (s: string) => secrets.reduce((t, h) => t.replace(word(h), "<hidden>"), s)
    if (e instanceof Error) {
        const type = e.name || "Error"
        const message = clean(String(e.message))
        const frames = String(e.stack || "").split("\n").filter(l => /^\s+at /.test(l))
        return {err: {type, message, stack: [`${type}: ${message}`, ...frames].join("\n")}}
    }
    return {err: {type: typeof e, message: clean(String(e))}}
}

// The edge's X-Request-Id when it is a plain token of at most 64 characters, else a new one.
export function requestId(header: any): string {
    const v = Array.isArray(header) ? header[0] : header
    return typeof v === "string" && /^[A-Za-z0-9._:-]{1,64}$/.test(v) ? v : crypto.randomUUID()
}

// The route template of a request path: never the raw path (a room name is the room's only key) or its query.
export function routeOf(url: string): string {
    const p = String(url || "").split("?")[0]
    if (p === "/healthz") return "/healthz"
    if (p === "/") return "/"
    if (/^\/api\/room\/all\/?$/i.test(p)) return "/api/room/all"
    if (/^\/api\/room\/[^/]+\/import\/?$/i.test(p)) return "/api/room/:roomId/import"
    if (/^\/api\/room\/[^/]+\/[^/]+\/upload\/?$/i.test(p)) return "/api/room/:roomId/:layerId/upload"
    if (/^\/api\/room\/[^/]+\/?$/i.test(p)) return "/api/room/:roomid"
    if (/^\/api\//i.test(p)) return "/api/*"
    if (/^\/uploads\//.test(p)) return "/uploads/*"
    if (/^\/static\//.test(p)) return "/static/*"
    if (/^\/[^/]+\/?$/.test(p)) return p.includes(".") ? "/:file" : "/:roomId"
    if (/^\/[^/]+\/./.test(p)) return "/:roomId/*"
    return "(other)"
}

// The fixed words of the routes (routeOf): not request data, and hiding them would garble messages ("allow").
const ROUTE_WORDS = ["api", "room", "all", "import", "upload", "uploads", "static", "healthz"]

// Everything of a URL that must not reach the log: the URL, its path, query, and each path segment (raw and decoded).
export function urlParts(url: string): string[] {
    const s = String(url || "")
    const [p, q] = s.split("?")
    const parts = [s, p, q]
    for (const seg of p.split("/")) {
        if (ROUTE_WORDS.includes(seg)) continue
        parts.push(seg)
        try { parts.push(decodeURIComponent(seg)) } catch (e) { /* not decodable: the raw one is hidden */ }
    }
    return parts
}

const failures = new WeakMap<object, any>()

// First middleware: X-Request-Id on every answer, then one line when the answer is done, only if it matters:
// a 5xx (error, with `err`), a slow answer (warn); anything else at debug; /healthz never above debug.
export function requestLogger(logger: Logger = log, now: () => number = () => perf.performance.now()) {
    return (req: any, res: any, next: Function) => {
        const start = now()
        const reqId = requestId(req.headers["x-request-id"])
        res.setHeader("X-Request-Id", reqId)
        const url = req.originalUrl || req.url
        // "close" also fires when an answer is cut short, which "finish" never sees
        res.on("close", () => {
            const route = routeOf(url)
            const fields: any = {req_id: reqId, method: req.method, route, status: res.statusCode, dur_ms: Math.round(now() - start)}
            if (!res.writableFinished) fields.aborted = true
            const failure = failures.get(res)
            if (route === "/healthz") logger.debug("healthz", "healthz", fields)
            else if (res.statusCode >= 500) logger.error("request_failed", "server error",
                failure === undefined ? fields : {...fields, ...errField(failure, urlParts(url))})
            else if (fields.dur_ms > SLOW_MS) logger.warn("request_slow", "slow request", fields)
            else logger.debug("request", "request", fields)
        })
        next()
    }
}

// Last middleware: remembers the error for the request line, then lets Express answer exactly as before.
export function errorRecorder(err: any, req: any, res: any, next: Function) {
    failures.set(res, err)
    next(err)
}

// The node-persist migration's text lines (Services/persistMigration): its summary at info, a skipped file at warn.
export function migrationLog(logger: Logger = log): (msg: string) => void {
    return (msg: string) => {
        if (/: skipped |: cannot list /.test(msg)) logger.warn("persist_migration_skip", msg)
        else logger.info("persist_migration", msg)
    }
}
