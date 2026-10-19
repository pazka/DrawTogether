# Testing

Safety net for upgrades (Node base image, Express / multer / Socket.IO / node-persist, Actions): it pins what
the server does today so a Dependabot PR is judged on its CI run.

## What ships

The image runs the **committed `*.js`** (`npm run start-prod` → `node index.js prod`; no `tsc` in the image).
The `*.ts` files are the sources those were compiled from. `front/` (CRA 4) is **not built by master's
Dockerfile** (owner PR #5 adds a front build stage).

## Run it

```bash
# server tests: black-box, spawns `node index.js dev` on :9001; Node built-ins only
docker run --rm -v "$PWD":/src:ro node:20-alpine sh -c \
  'mkdir /a && cd /src && tar --exclude=./node_modules -cf - . | tar -xf - -C /a && cd /a \
   && npm ci && node --test --test-reporter=spec test/'

# container smoke
docker build -t drawtogether:smoke .
bash scripts/smoke.sh drawtogether:smoke deployed   # like docker-compose.yml today (gate)
bash scripts/smoke.sh drawtogether:smoke hardened   # non-root, read-only rootfs (PR #5 target)
```

(Windows Git Bash: prefix `docker run` with `MSYS_NO_PATHCONV=1`, mount `"$(cygpath -w "$PWD")"`.)

## CI (`.github/workflows/ci.yml`)

PRs, `master`, `agent/**`: `server tests (node 20|26)`; `container smoke (deployed)` (gate);
`container smoke (hardened)` (non-blocking until PR #5 is merged).

## What is covered

`test/server.test.js` (9 tests; `test/sio-poll.js` is a tiny Socket.IO long-polling client on `fetch`, so no
socket.io-client dependency): `GET /` creates a room and redirects; `/<name>` creates that room; unknown room
→ default room; import replaces a room; image upload stored under `front/build/uploads/<room>/`, linked in
the layer, served back; non-image extension refused; CORS allow/deny; two Socket.IO clients: join,
`loadRoom`, presence, mouse broadcast, `saveRoom` versioning, out-of-sync error.

`scripts/smoke.sh`: the built image — new room, REST, front (when the image has one), engine.io
handshake, image upload to the uploads volume and served back, no crash in the logs.

## Owner PR #5 — what it is expected to fix (validated locally 2026-10-19, PR head ccbcb12, not merged)

| check | master | PR #5 |
|---|---|---|
| upload with the compose uploads volume (`deployed`) | **403 `EXDEV`** — multer writes to `/app/uploads` on the rootfs, then `rename()` to the volume fails (pinned in the smoke) | upload works |
| non-root + read-only rootfs (`hardened`) | **does not boot** (`EROFS mkdir /app/uploads`) | passes |
| front served at `/<room>` | no front in the image | served |

After merging PR #5: in `scripts/smoke.sh` drop the pinned-EXDEV branch (or run with
`SMOKE_UPLOAD_FIXED=1`) and remove `continue-on-error` from the hardened smoke. Its CI run will fail on the
pinned 403 until then — that is the expected flip signal. **Before deploying PR #5**: it builds
`front/build/uploads` and `.node-persist` owned by uid 1000; if the box runs it as `node`, the bind-mounted
host dirs `./uploads` and `./persist` must be writable by uid 1000.

## Upgrades checked (2026-10-19)

- **Node 20 → 26** (Dependabot #4): server tests 9/9 on 26.12, deployed smoke OK on `node:26-alpine` → **go**
  (same upload EXDEV as on 20; unrelated to the bump). PR #5's front stage uses `node:16-alpine` (EOL); a
  newer Node needs `--openssl-legacy-provider` for react-scripts 4.

## Known gaps (pinned, not changed)

- `tsc` cannot compile today: the lockfile resolves `@types/node` 26 (transitively), which TypeScript 4.9
  cannot parse. Editing a `.ts` file means fixing that first (pin `@types/node` to the runtime's major, as a
  devDependency) and recompiling; the committed `.js` is what runs.
- Upload: only the extension is checked (no content sniffing, no size limit); `.svg` is allowed and served
  from the same origin (stored XSS risk); the `roomId` path segment is not sanitised before building the
  target folder.
- `GET /api/room/all` lists every room id, and a room URL is its only access key.
- `Services/sockets/index.ts` subscribes `EDIT_ROOM`/`ERROR` once per connection and never unsubscribes:
  listeners leak and each edit is emitted once per connection ever made.
- Dockerfile uses `npm install` (not `npm ci`); image runs as root; no HEALTHCHECK.
