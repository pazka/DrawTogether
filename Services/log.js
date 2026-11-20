"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.log = exports.CONFIG_NAMES = exports.SLOW_MS = exports.SERVICE = void 0;
exports.createLogger = createLogger;
exports.configNamesSet = configNamesSet;
exports.errField = errField;
exports.requestId = requestId;
exports.routeOf = routeOf;
exports.urlParts = urlParts;
exports.requestLogger = requestLogger;
exports.errorRecorder = errorRecorder;
exports.migrationLog = migrationLog;
const crypto = require("crypto");
const perf = require("perf_hooks");
const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
exports.SERVICE = "drawtogether";
exports.SLOW_MS = 1000;
exports.CONFIG_NAMES = ["PORT", "UPLOADS_DIR", "PERSIST_DIR", "LOG_LEVEL", "APP_VERSION"];
function createLogger(level, out, version) {
    const name = LEVELS[level] ? level : "info";
    const min = LEVELS[name];
    const emit = (lvl) => (event, msg, fields = {}) => {
        if (LEVELS[lvl] < min)
            return;
        out.write(JSON.stringify(Object.assign({ ts: new Date().toISOString(), level: lvl, service: exports.SERVICE, version, event, msg }, fields)) + "\n");
    };
    return { level: name, debug: emit("debug"), info: emit("info"), warn: emit("warn"), error: emit("error") };
}
exports.log = createLogger(process.env.LOG_LEVEL, process.stdout, process.env.APP_VERSION || "dev");
function configNamesSet(env = process.env) {
    return exports.CONFIG_NAMES.filter(n => env[n] !== undefined && env[n] !== "");
}
function errField(e, hide = []) {
    const secrets = hide.filter(h => typeof h === "string" && h.length > 1).sort((a, b) => b.length - a.length);
    const word = (h) => new RegExp("(?<![A-Za-z0-9])" + h.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?![A-Za-z0-9])", "g");
    const clean = (s) => secrets.reduce((t, h) => t.replace(word(h), "<hidden>"), s);
    if (e instanceof Error) {
        const type = e.name || "Error";
        const message = clean(String(e.message));
        const frames = String(e.stack || "").split("\n").filter(l => /^\s+at /.test(l));
        return { err: { type, message, stack: [`${type}: ${message}`, ...frames].join("\n") } };
    }
    return { err: { type: typeof e, message: clean(String(e)) } };
}
function requestId(header) {
    const v = Array.isArray(header) ? header[0] : header;
    return typeof v === "string" && /^[A-Za-z0-9._:-]{1,64}$/.test(v) ? v : crypto.randomUUID();
}
function routeOf(url) {
    const p = String(url || "").split("?")[0];
    if (p === "/healthz")
        return "/healthz";
    if (p === "/")
        return "/";
    if (/^\/api\/room\/all\/?$/i.test(p))
        return "/api/room/all";
    if (/^\/api\/room\/[^/]+\/import\/?$/i.test(p))
        return "/api/room/:roomId/import";
    if (/^\/api\/room\/[^/]+\/[^/]+\/upload\/?$/i.test(p))
        return "/api/room/:roomId/:layerId/upload";
    if (/^\/api\/room\/[^/]+\/?$/i.test(p))
        return "/api/room/:roomid";
    if (/^\/api\//i.test(p))
        return "/api/*";
    if (/^\/uploads\//.test(p))
        return "/uploads/*";
    if (/^\/static\//.test(p))
        return "/static/*";
    if (/^\/[^/]+\/?$/.test(p))
        return p.includes(".") ? "/:file" : "/:roomId";
    if (/^\/[^/]+\/./.test(p))
        return "/:roomId/*";
    return "(other)";
}
const ROUTE_WORDS = ["api", "room", "all", "import", "upload", "uploads", "static", "healthz"];
function urlParts(url) {
    const s = String(url || "");
    const [p, q] = s.split("?");
    const parts = [s, p, q];
    for (const seg of p.split("/")) {
        if (ROUTE_WORDS.includes(seg))
            continue;
        parts.push(seg);
        try {
            parts.push(decodeURIComponent(seg));
        }
        catch (e) { }
    }
    return parts;
}
const failures = new WeakMap();
function requestLogger(logger = exports.log, now = () => perf.performance.now()) {
    return (req, res, next) => {
        const start = now();
        const reqId = requestId(req.headers["x-request-id"]);
        res.setHeader("X-Request-Id", reqId);
        const url = req.originalUrl || req.url;
        res.on("close", () => {
            const route = routeOf(url);
            const fields = { req_id: reqId, method: req.method, route, status: res.statusCode, dur_ms: Math.round(now() - start) };
            if (!res.writableFinished)
                fields.aborted = true;
            const failure = failures.get(res);
            if (route === "/healthz")
                logger.debug("healthz", "healthz", fields);
            else if (res.statusCode >= 500)
                logger.error("request_failed", "server error", failure === undefined ? fields : Object.assign(Object.assign({}, fields), errField(failure, urlParts(url))));
            else if (fields.dur_ms > exports.SLOW_MS)
                logger.warn("request_slow", "slow request", fields);
            else
                logger.debug("request", "request", fields);
        });
        next();
    };
}
function errorRecorder(err, req, res, next) {
    failures.set(res, err);
    next(err);
}
function migrationLog(logger = exports.log) {
    return (msg) => {
        if (/: skipped |: cannot list /.test(msg))
            logger.warn("persist_migration_skip", msg);
        else
            logger.info("persist_migration", msg);
    };
}
//# sourceMappingURL=log.js.map