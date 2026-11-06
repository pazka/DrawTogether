// Container healthcheck (Dockerfile HEALTHCHECK, compose healthcheck): GET /healthz on the app's own port
// must answer 200 {"status":"ok"} (uploads + room store writable, room list readable). Node built-ins only.
'use strict'
const port = process.env.PORT || 80
fetch(`http://127.0.0.1:${port}/healthz`, {signal: AbortSignal.timeout(4000)})
    .then(async r => process.exit(r.status === 200 && (await r.json()).status === 'ok' ? 0 : 1))
    .catch(() => process.exit(1))
