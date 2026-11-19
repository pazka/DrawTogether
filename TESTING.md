# Testing

Safety net for upgrades (Node base image, Express / multer / Socket.IO / node-persist, Actions): it pins what
the server does today so a Dependabot PR is judged on its CI run.

## What ships

The image runs the **committed `*.js`** (`node index.js prod`, what `npm run start-prod` runs; no `tsc` in the image).
The `*.ts` files are the sources those were compiled from. `front/` (CRA 4) is built in a Dockerfile stage
and served from `/app/front/build`.


## Run it

```bash
# server tests: black-box, spawns `node index.js dev` on :9001; Node built-ins only
docker run --rm -v "$PWD":/src:ro node:26-alpine sh -c \
  'mkdir /a && cd /src && tar --exclude=./node_modules -cf - . | tar -xf - -C /a && cd /a \
   && npm ci --ignore-scripts && node --test --test-reporter=spec test/server.test.js test/imageController.test.js test/compile.test.js \
   test/persistMigration.test.js test/config.test.js test/log.test.js'

# recompile after editing a .ts (CRLF output, set in tsconfig): compile in a container, copy the JS out
docker run --rm -v "$PWD":/src:ro -v "$PWD/.tsc-out":/out node:26-alpine sh -c \
  'mkdir /a && cd /src && tar --exclude=./node_modules --exclude=./front -cf - . | tar -xf - -C /a && cd /a \
   && npm ci --ignore-scripts && npx tsc -p tsconfig.json \
   && find index.js* Controllers DTOs Services -name "*.js*" | tar -cf - -T - | tar -xf - -C /out'
# then copy .tsc-out/ over the repo (keeps the paths); test/compile.test.js fails on any stale .js

# container smoke
docker build -t drawtogether:smoke .
bash scripts/smoke.sh drawtogether:smoke deployed   # like docker-compose.yml
bash scripts/smoke.sh drawtogether:smoke hardened   # non-root, read-only rootfs
bash scripts/smoke.sh drawtogether:smoke legacy     # exactly the box's legacy compose (uid 1000, bind mounts)
bash scripts/smoke.sh drawtogether:smoke template   # docker-compose.example.yml (hosh-deploy: 10001, /data, :8000)
bash scripts/cutover-smoke.sh drawtogether:smoke    # legacy -> hosh-deploy cutover rehearsal (DEPLOY.md §5)

# node-persist 3 -> 4 upgrade smoke: build the last node-persist 3 master (ae2d4d4) as the old image
git worktree add /tmp/dt-np3 ae2d4d4 && docker build -t drawtogether:np3 /tmp/dt-np3
bash scripts/upgrade-smoke.sh drawtogether:np3 drawtogether:smoke deployed
bash scripts/upgrade-smoke.sh drawtogether:np3 drawtogether:smoke hardened
```

(Windows Git Bash: prefix `docker run` with `MSYS_NO_PATHCONV=1`, mount `"$(cygpath -w "$PWD")"`.)

## CI (`.github/workflows/ci.yml`)

PRs, `master`, `agent/**`, all gates: `server tests (node 26)`, `container smoke (deployed)`,
`container smoke (hardened)`, `container smoke (legacy)`, `container smoke (template)`,
`cutover smoke (legacy -> hosh-deploy)`, `upgrade smoke (node-persist 3 -> 4)`, `visual regression`.

Node guardrail (`scripts/check-node-version.sh <image>`, pazka/hosh-management#5): the built image's Node must
be an LTS line (22/24/26) at or above its patched minimum (CVE-2026-111497). Runs in `container smoke` after
the build, and in `release.yml` / `build-scan-push.yml` before any push; `container smoke (deployed)` also checks it
refuses `node:24.21.0-alpine` (test of the test). The base image is pinned `node:26.13.1-alpine@sha256:…`
(Dependabot `docker` bumps it).

## What is covered

`test/server.test.js` (14 tests; `test/sio-poll.js` is a tiny Socket.IO long-polling client on `fetch`, so no
socket.io-client dependency): `GET /` creates a room and redirects; `/<name>` creates that room; unknown room
→ default room; import replaces a room; image upload stored under `front/build/uploads/<room>/`, linked in
the layer, served back; non-image extension refused; CORS allow/deny; CORS preflight (`OPTIONS`) on any path;
`/<name>.<ext>` creates no room; the startup line (mode DEV, port 9001) and no access log (no path, query, IP); two Socket.IO clients: join, `loadRoom`,
presence, mouse broadcast, `saveRoom` versioning, out-of-sync error.

`test/log.test.js` (17 tests): the logging standard (hosh-management AGENTS.md §11), see "Logs" below.

`test/compile.test.js` (2 tests): `tsc -p tsconfig.json` compiles cleanly and every committed `*.js` is
byte-for-byte its output (CRLF); the `fs-extra` `copySync` call `build.js` uses.

`scripts/smoke.sh`: the built image — new room, REST, front served, engine.io handshake, image upload to the
uploads volume and served back, the in-container capability smoke, a `docker restart` after which the room
list, rooms and uploads are byte-identical, no crash in the logs; in every mode. Mode `legacy` is the box's
legacy compose for draw.hosh.it verbatim (uid 1000, `sysctls: net.ipv4.ip_unprivileged_port_start=0`,
no-new-privileges, cap_drop ALL, host bind mounts `./front/build/uploads` and `./.node-persist` owned by 1000,
port 80) and also checks the files land in those host dirs: every release must keep working with it until the
hosh-deploy cutover.

Mode `template` is `docker-compose.example.yml` as `docker run` flags (uid 10001, read-only rootfs, tmpfs
/tmp, pids 128, mem 512m, `PORT=8000`, `UPLOADS_DIR=/data/uploads`, `PERSIST_DIR=/data/persist`, one fresh named
volume at `/data` with no chown): `/healthz`, the image `HEALTHCHECK` turns healthy, all state is in `/data`
and nothing is written to the image paths. Every mode also checks `/healthz` creates no room.

`scripts/cutover-smoke.sh <image>`: rooms made under the legacy compose (plus an md5-named node-persist 3
original, like the box keeps), the DEPLOY.md §5 data move verbatim, `docker-compose.example.yml` + `.env.example`
through the box's register hardening check (`.github/scripts/register-check.py`, a copy of hosh-deploy's),
`docker compose up`, healthy, `/healthz` on BIND, `POST_DEPLOY` from `deploy/hosh-deploy.conf` as argv, the
same rooms/list/image byte for byte, a restart, then the rollback to the legacy compose on its untouched dirs.

`test/config.test.js` (3 tests): `PORT`, `UPLOADS_DIR`, `PERSIST_DIR` from the env (`/healthz` 200 with
uploads/store writable and a room count, `HEAD` too, no room "healthz", not logged; images land in UPLOADS_DIR
and are served under `/uploads/`, room files in PERSIST_DIR, nothing in the cwd; a bad `PORT` stops the start).

`scripts/capability-smoke.js` (Node built-ins + `test/sio-poll.js`, runs inside the container; hosh-deploy
`POST_DEPLOY`): `/healthz`, room list, the
front for a room, an import read back, an image upload stored and served back, a Socket.IO client joining the
room and receiving it. Everything happens in one fixed room `hosh-deploy-smoke` (overwritten on each run,
expires like any room), so it is safe to run against production after each deploy.

`test/persistMigration.test.js` (6 tests): the node-persist 3 -> 4 data migration (`Services/persistMigration`)
on a temp dir in the 3.x layout (`md5(key)` files, synthetic rooms) read back with the locked node-persist 4:
4.x alone sees nothing; after migration every key reads identically (exact bytes, md5 originals untouched);
idempotent and never overwrites what 4.x wrote since; truncated JSON, no key, name != md5(key), directory and
symlink (pointing outside) are skipped and logged, nothing written outside the dir; the 4.x expiry sweep keeps
every room; a missing dir is a no-op.

`scripts/upgrade-smoke.sh <old> <new> [deployed|hardened]`: on the same two volumes, the last node-persist 3
image creates rooms through the API (new room, custom URL, import with layers + texts, uploaded layer image);
the new image must log the migration and serve the same `/api/room/all` and rooms byte for byte, plus the
image; a room drawn after the upgrade survives a restart (second start: `0 copied`); the old image again
(rollback) still serves the pre-upgrade rooms. Checked to fail with node-persist 4 and no migration (empty
room list).

`test/imageController.test.js` (2 tests) loads the committed controller with a fake `fs` (slow `unlink`):
a refused extension is deleted and never moved or linked; an accepted image is moved and linked.

## Logs (hosh-management AGENTS.md §11)

`Services/log.ts` (+ committed `.js`): stdout only, one JSON object per line: `ts` (UTC ISO, ms), `level`, `service`
(`drawtogether`), `version` (`APP_VERSION`, set by `release.yml` through the Dockerfile `ARG VERSION`; `dev` otherwise),
`event`, `msg`, then the line's fields. `LOG_LEVEL` (debug|info|warn|error, default and anything else: info).

| event | level | when / fields |
|---|---|---|
| `startup` | info | listening: `port`, `mode`, `uploads_dir_writable`, `store_dir_writable`, `log_level`, `config` (names of the variables set, never values); msg `Listening on <port>` (the smokes wait for it) |
| `shutdown` | info | SIGTERM / SIGINT: `signal`, `uptime_s`; exits 0 after 1 s (node-persist's write queue) |
| `request_failed` | error | an answer >= 500: `req_id`, `method`, `route`, `status`, `dur_ms`, `err` {type, message, stack} when Express had an error |
| `request_slow` | warn | an answer slower than 1 s (same fields) |
| `request` / `healthz` | debug | any other answer; `/healthz` never above debug |
| `persist_migration` / `_skip` | info / warn | the node-persist 3 -> 4 migration lines (text unchanged, the smokes grep it) |
| `room_cleanup_start` / `_done` | info | the cleanup job: `rooms`; then `dur_ms`, `checked`, `removed`, `kept_forever`, `rooms` |
| `socket_connect` / `socket_disconnect` | debug | `clients` (a count) |

- `route` is a template from `routeOf` (`/api/room/:roomId/import`, `/:roomId`, `/uploads/*`...), never the raw
  path or query: a room id is the room's only key, so it never reaches the log (nor in `err`: request values are
  replaced by `<hidden>`, the stack keeps only its frames). No IP, user agent, cookie, body or socket payload.
- Every answer carries `X-Request-Id`: the incoming one if it is a plain token (`[A-Za-z0-9._:-]`, at most 64), else a
  new UUID. Socket.IO requests do not go through Express (no header, no line).
- Express no longer prints errors on stderr (its env is set to `test` unless `NODE_ENV=production`, which only
  silences that print: the error answers are unchanged); the error goes into the `request_failed` line.
- The image starts `node index.js prod` directly (npm printed banner lines on stdout and stood between docker's
  SIGTERM and node). `scripts/smoke.sh` checks, in every mode, that every stdout line is a standard JSON line and
  that the startup, shutdown (the restart) and migration lines are there.

`test/log.test.js` pins: the line format and level filter; `errField`, `requestId`, `routeOf`, `urlParts`; on a real
Express app with a fake clock, 5xx at error with `err`, exactly 1 s not slow / 1001 ms at warn, 4xx and `/healthz`
(even a 503) silent at info and at debug when asked; then two real servers (`index.js`, info and debug): the startup
line, a CORS refusal (500) as one error line with an unchanged answer and an empty stderr, `X-Request-Id`
echo/replace, nothing at info for ordinary requests / `/healthz` / a bad JSON body / a socket client, at debug only
route templates and socket counts (no room id, path, query, payload, IP), SIGTERM -> one shutdown line and exit 0,
and the room cleanup job's two lines with counts and no room id. Each line of that code was mutated once
(level filter, 64-char limit, header, route template, healthz level, `>= 500`, slow threshold, `err`, hiding,
stack, Express env, error recorder, signal handler, socket payload / IP, event payload print, cleanup counts,
migration lines, mode): a test fails for each.

## Visual use cases (visual regression, hosh-management AGENTS.md §3)

`visual/run.sh IMAGE` (CI job `visual regression`): the built image runs as `docker-compose.example.yml` does
(uid 10001, read-only rootfs, tmpfs /tmp, cap_drop ALL, no-new-privileges, `PORT=8000`, all state in a fresh
`/data` volume). `visual/shoot.mjs` runs with the image's own node (no package): it first **seeds** the room
`visualboard` through the server's API (`GET /visualboard`, `POST /api/room/visualboard/import` with two layers
"Plan" (3 styled texts) and "Notes" (1 text), and `POST /api/room/visualboard/1/upload` of a 1200x800 "floor plan"
PNG built with zlib), reads it back, then two headless Chromes of the runner (mouse for 1400 / 1024, touch for 390)
open `http://draw.test:9875`. Every other host resolves to nothing. A URL with "localhost" would make the front talk
to `http://localhost:9001` (`front/src/services/env`). Every case below is shot at **1400, 1024 and 390 px** by a
new visitor (new browser context) and compared with `visual/baseline/<id>-<width>.png` (tolerance: channel 24,
0.1 % of the pixels). Any `alert()`/`confirm()` (Socket.IO "error", refused upload) or page exception fails the
shot. Copied from pazka/MyMurderParty `visual/`.

| id | page / state | steps |
|---|---|---|
| E1-new-room | `/visualempty`: a new room (one empty "Layer"), info box "1 users in this room.", controls bar, "+ Add Layer" | none |
| B1-board | `/visualboard`: background image, the 3 texts of "Plan" (bold red, rotated + underlined blue, wide), layer "Plan" selected | none |
| B2-board-second-layer | layer "Notes" selected: its text only, no background | click "Notes" |
| B3-text-hover-toolbar | the edit toolbar of "Kitchen" (+ - width rotate b u color Delete) and its dashed frame. **1400 and 1024 only**: a phone has no hover | mouse over "Kitchen" |
| B4-text-editing | "Garden" turned into an input (nothing saved) | double-click "Garden" |
| B5-forms-open | "Change Background" and "Import a project" opened: two file inputs, buttons renamed "Close background upload" / "Close Upload" | click both |
| U1-two-users | a second visitor named "Visual Bob" moves their mouse to (700, 160): "2 users in this room." and Bob's pointer label | second browser context, type the name, move |
| D1-presentation | `/visualboard?displayOnly=true`: no info box, no controls, no delete buttons, no background (`App.js` hides `ImageDisplay` in that mode) | none |
| N1-new-text-mode | `/visualnewtext`: after "New Text" the "New Text" label follows the pointer (300, 420), no text is created | click "New Text", move |

What the pictures show today, pinned on purpose (not bugs fixed by the harness):
- The page has no mobile layout: at 390 px the phone browser zooms out to the content width (about 1200 px), and
  the controls bar overlaps the info box.
- The runner's fonts have no glyph for the width buttons `⭠⭢` / `⭢⭠` of the text toolbar: B3 shows them as boxes
  (same on every run; a local Chrome with other fonts draws arrows).
- The info box shows the room name cut at the first non-word character (`getRoomName()` matches `\w*`):
  `/visual-empty` shows "visual". The harness uses room names without a hyphen.

Not covered, and why:
- Dragging a text, the colour picker, renaming / adding / deleting a layer, choosing a real file in the forms:
  each one saves to the room, so a later shot would see it. They need a room of their own per shot (next step).
- "Save project" (a download), "New project" (a `prompt()`), the `?debug` console mode: nothing to see.
- `GET /` (a new random room id, redirected): the id is random. E1 covers the same page.

New or changed baselines (a wanted visual change, said in the PR): CI prints every failing shot in the log
(`VISUAL-PNG` lines); `node visual/from-log.mjs <job log> visual/baseline --chrome` writes them back with their
sha256 checked. Look at every picture before committing it. Baselines are only meaningful for the runner's Chrome
(`visual/baseline/chrome.txt`); a local run with another Chrome differs by its fonts.
Local run: `docker build -t drawtogether:smoke . && CHROME=/path/to/chrome bash visual/run.sh`
(`ONLY=B3 bash visual/run.sh` shoots only the cases whose id starts with B3).

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

## Dependency upgrades (branch `agent/deps-upgrades`)

- **tsc fixed**: TypeScript 7.0.2 (Dependabot #12) and `@types/node` ^26 pinned as a devDependency (TS 4.9
  could not parse `@types/node` 26). TS 7 forces `esModuleInterop`/`strict` and has no ES5 target:
  `tsconfig.json` sets `target es2015`, `strict false`, `types [node]`, `newLine crlf`; called namespace
  imports of CommonJS packages became `import x = require(...)` (same emitted `require`). The committed JS
  was recompiled: same logic, ES2015 syntax (native classes/arrows/generators instead of ES5 helpers).
- **Express 5.3** (Dependabot #15): the bare `'*'` route is invalid in path-to-regexp 8 (the server exited on
  start); `app.options('*')` became `app.options('/{*splat}')`. No other removed API is used.
- **morgan 1.12.1, socket.io 4.8.4** (Dependabot #11), **fs-extra 11.4.1** (Dependabot #14, `build.js` only).
- **node-persist 4 not taken** (Dependabot #13) at first: v4 names files by `sha256(key)` instead of
  `md5(key)`, with no migration, so `getItem` would no longer find any room written by v3 (verified): every
  existing room would vanish on deploy. Done on 2026-10-26 with a migration, below.

## node-persist 4.0.4 with a data migration (2026-10-26, owner-approved)

- `node-persist` ^4.0.4 (supersedes Dependabot #13); new transitive deps `p-limit` 3.1.0 + `yocto-queue`
  0.1.0 (node-persist's own). Read from its source, the only change the app sees is the file name; same
  JSON content, same `init({})` defaults (dir `.node-persist/storage`, `ttl` false, 2-min expiry sweep, 1 s
  write queue); reads/writes now go through `p-limit` (`maxFileDescriptors` Infinity = unlimited, as before);
  dotfiles are still ignored by its directory scan.
- `Services/persistMigration.ts` (+ committed `.js`), called once by `Services/storage` right after
  `persist.init` and before the first read (init is now a single shared promise): copies each `md5(key)` file
  to `sha256(key)` when that file does not exist yet, through a dot-prefixed temp file + rename; md5
  originals kept (rollback). One log line per start: `N copied, M already migrated, K skipped`.
- Cost: the 2-minute expiry sweep (`removeExpiredItems`, it reads every file) now also reads the kept md5
  copies. Deleting them is a later, separate change once the upgrade is settled (MIGRATIONS.md).
- Box steps, rollback: `MIGRATIONS.md`.

## Known gaps (pinned, not changed)

- Upload: only the extension is checked (no content sniffing, no size limit); `.svg` is allowed and served
  from the same origin (stored XSS risk); the `roomId` path segment is not sanitised before building the
  target folder.
- `GET /api/room/all` lists every room id, and a room URL is its only access key.
- `Services/sockets/index.ts` subscribes `EDIT_ROOM`/`ERROR` once per connection and never unsubscribes:
  listeners leak and each edit is emitted once per connection ever made.
- Image runs as root by default (the composes set the user); HEALTHCHECK = `GET /healthz` since v1.2.0.
