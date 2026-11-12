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
   && npm ci && node --test --test-reporter=spec test/server.test.js test/imageController.test.js test/compile.test.js \
   test/persistMigration.test.js test/config.test.js'

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
`cutover smoke (legacy -> hosh-deploy)`, `upgrade smoke (node-persist 3 -> 4)`.

Node guardrail (`scripts/check-node-version.sh <image>`, pazka/hosh-management#5): the built image's Node must
be an LTS line (22/24/26) at or above its patched minimum (CVE-2026-111497). Runs in `container smoke` after
the build, and in `release.yml` / `build-scan-push.yml` before any push; `container smoke (deployed)` also checks it
refuses `node:24.21.0-alpine` (test of the test). The base image is pinned `node:26.13.1-alpine@sha256:…`
(Dependabot `docker` bumps it).

## What is covered

`test/server.test.js` (12 tests; `test/sio-poll.js` is a tiny Socket.IO long-polling client on `fetch`, so no
socket.io-client dependency): `GET /` creates a room and redirects; `/<name>` creates that room; unknown room
→ default room; import replaces a room; image upload stored under `front/build/uploads/<room>/`, linked in
the layer, served back; non-image extension refused; CORS allow/deny; CORS preflight (`OPTIONS`) on any path;
`/<name>.<ext>` creates no room; morgan combined access log; two Socket.IO clients: join, `loadRoom`,
presence, mouse broadcast, `saveRoom` versioning, out-of-sync error.

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
