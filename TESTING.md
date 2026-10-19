# Testing

Safety net for upgrades (Node base image, Express / multer / Socket.IO / node-persist, Actions): it pins what
the server does today so a Dependabot PR is judged on its CI run.

## What ships

The image runs the **committed `*.js`** (`npm run start-prod` → `node index.js prod`; no `tsc` in the image).
The `*.ts` files are the sources those were compiled from. `front/` (CRA 4) is built in a Dockerfile stage
and served from `/app/front/build`.


## Run it

```bash
# server tests: black-box, spawns `node index.js dev` on :9001; Node built-ins only
docker run --rm -v "$PWD":/src:ro node:26-alpine sh -c \
  'mkdir /a && cd /src && tar --exclude=./node_modules -cf - . | tar -xf - -C /a && cd /a \
   && npm ci && node --test --test-reporter=spec test/server.test.js test/imageController.test.js'

# container smoke
docker build -t drawtogether:smoke .
bash scripts/smoke.sh drawtogether:smoke deployed   # like docker-compose.yml
bash scripts/smoke.sh drawtogether:smoke hardened   # non-root, read-only rootfs
```

(Windows Git Bash: prefix `docker run` with `MSYS_NO_PATHCONV=1`, mount `"$(cygpath -w "$PWD")"`.)

## CI (`.github/workflows/ci.yml`)

PRs, `master`, `agent/**`, all gates: `server tests (node 20|26)`, `container smoke (deployed)`,
`container smoke (hardened)`.

## What is covered

`test/server.test.js` (9 tests; `test/sio-poll.js` is a tiny Socket.IO long-polling client on `fetch`, so no
socket.io-client dependency): `GET /` creates a room and redirects; `/<name>` creates that room; unknown room
→ default room; import replaces a room; image upload stored under `front/build/uploads/<room>/`, linked in
the layer, served back; non-image extension refused; CORS allow/deny; two Socket.IO clients: join,
`loadRoom`, presence, mouse broadcast, `saveRoom` versioning, out-of-sync error.

`scripts/smoke.sh`: the built image — new room, REST, front served, engine.io handshake, image upload to the
uploads volume and served back, no crash in the logs; in both modes.

`test/imageController.test.js` (2 tests) loads the committed controller with a fake `fs` (slow `unlink`):
a refused extension is deleted and never moved or linked; an accepted image is moved and linked.

## Changes and upgrades (2026-10-19)

- **Owner PR #5 merged** (validated first): multer's temp dir is on the uploads mount, so uploads work with
  the compose volume (they failed with `EXDEV` before) and the image runs non-root with a read-only rootfs;
  the front is built in the image (master's image had no front). The smoke's pinned EXDEV expectation was
  flipped and the hardened mode became a gate.
- **Upload fix (security)**: a refused extension (e.g. `.html`) was unlinked but the `rename` after it still
  ran (missing `return`), so the file could land in `uploads/` and be served from the site's origin. CI
  caught it as a flaky test once PR #5 made the rename fast; fixed in `.ts` and the committed `.js`, with a
  deterministic test.
- **Node 26** runtime (supersedes Dependabot #4), `npm ci` from the lockfile, no global npm upgrade.
  The front build stage stays on `node:16-alpine`: react-scripts 4 (webpack 4) needs it or
  `--openssl-legacy-provider`; it is build-only and not shipped.
- If the box ever runs the image as `node` (uid 1000), the bind-mounted `./uploads` and `./persist` must be
  writable by uid 1000 (the image itself runs as root by default, like before).

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
