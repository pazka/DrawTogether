# Deploying draw.hosh.it

Deployment on the hosh.it box (box standard: `docs/BOX-CONTRACT.md`). After the one-time cutover (§5),
releases deploy themselves through **hosh-deploy** (§1). Until then the box runs the **legacy compose**
(`/home/pazka/serious/DrawTogether/docker-compose.yml`, port 9001, bind mounts), and every image keeps
working with it unchanged (CI gate `container smoke (legacy)`). Nothing secret: no owner step is needed
except the deployer key.

## 1. How releases go live (hosh-deploy — after the cutover)

A **final** release tag `vX.Y.Z` (`release` workflow) builds, runs the container smoke in both box layouts,
the Node guardrail and Trivy, pushes `:vX.Y.Z` + `:latest`, then its **`deploy`** job connects to the box as
`deployer` with this repo's `HOSH_DEPLOY_KEY` (bound to drawtogether only) and runs
`hosh-deploy deploy drawtogether vX.Y.Z`. The box pulls the image, swaps the tag in `drawtogether.env`,
waits healthy, checks `/healthz` on `127.0.0.1:9135` and through Traefik, runs `POST_DEPLOY`
(`deploy/hosh-deploy.conf`) inside the container and **rolls back by itself** if any check fails.

- No `HOSH_DEPLOY_KEY` secret (before the cutover) ⇒ the deploy job prints a notice and deploys nothing.
- Prerelease tags (`v1.2.0-rc.1`) and branch-mode releases never deploy (and never move `:latest`).
- Redeploy / roll back: Actions → **deploy** → `vX.Y.Z`, `rollback` or `status`. On the box:
  `sudo hosh-deploy deploy|rollback|status drawtogether …` (log `/var/log/hosh-deploy.log`).
- Repo variable `HOSH_AUTODEPLOY=false` stops auto-deploy after releases.
- `build-scan-push` (push to `master`) still only pushes `:ci` + `:<sha>`.

## 2. Variables

`drawtogether.env` (mode 600, from `.env.example`, nothing secret):

| Variable | Default | Who | Meaning |
|---|---|---|---|
| `APP_IMAGE` | `ghcr.io/pazka/drawtogether:v1.2.0` | hosh-deploy | the only line a deploy changes |
| `APP_BIND` | `127.0.0.1:9135` | box | loopback publish (port registry) |

Fixed in `docker-compose.example.yml` (`environment:`), because they must match the port mapping and the volume:

| Variable | Compose value | Image default (= legacy compose) | Meaning |
|---|---|---|---|
| `PORT` | `8000` | `80` (env.json `PROD.PORT`) | listen port; must be a port number or the app refuses to start |
| `UPLOADS_DIR` | `/data/uploads` | `/app/front/build/uploads` | uploaded images, served at `/uploads/<room>/<file>` (URL unchanged); multer temp files in its `.tmp/` |
| `PERSIST_DIR` | `/data/persist` | `/app/.node-persist/storage` | node-persist room store (files directory itself) |

CORS origins, room TTL and cleanup interval stay in `env.json` (`PROD`), unchanged.

## 3. Capability checks (what "works" means — not just a 200)

`POST_DEPLOY` = `node /app/scripts/capability-smoke.js http://127.0.0.1:8000` (one JSON line per check), all in
the fixed room `hosh-deploy-smoke` (created once, overwritten each run, expires like any room):

- `GET /healthz` → 200 `{"status":"ok","uploads":"writable","store":"writable","rooms":<n>}` (503 + `"status":"error"` otherwise; `HEAD` too)
- `GET /api/room/all` → 200 JSON array of room ids (box today: ~312)
- `GET /hosh-deploy-smoke/` → 200 front (`<div id="root">`), room listed afterwards
- `POST /api/room/hosh-deploy-smoke/import` → 200, `GET /api/room/hosh-deploy-smoke` returns the imported text
- `POST /api/room/hosh-deploy-smoke/1/upload` (1×1 PNG) → 200, `GET /uploads/hosh-deploy-smoke/smoke.png` byte-identical, linked in layer 1
- Socket.IO (long-polling): connect, `join hosh-deploy-smoke` → `loadRoom` with the room

Box smoke (`svc_draw` in `scripts/smoke.sh`) should add, through `https://draw.hosh.it`: `GET /` → 302 to an
8-char room; an old room (e.g. the demo room) returns its layers; one existing upload served byte-exact; the
engine.io handshake `GET /socket.io/?EIO=4&transport=polling` → `"sid"`; HSTS header; `/.env` 404.

## 4. What runs

| Item | Value |
|---|---|
| Image | `ghcr.io/pazka/drawtogether:vX.Y.Z` (Node 26, `node:26.13.1-alpine@sha256`) |
| Upstream | container :8000 → `127.0.0.1:9135` |
| Edge | `/root/hosh-deploy/edge/traefik/dynamic/drawtogether.yml` (router `drawtogether@file`, resolver `le`, HSTS) |
| Volume | docker volume `drawtogether-data` → `/data` (`uploads/`, `persist/`; in the monthly restic golden backup) |
| Health | `GET /healthz` → `{"status":"ok", …}`; image `HEALTHCHECK` = compose healthcheck = `node /app/scripts/healthcheck.js` |
| Outbound | none (no external call; the front loads nothing from a CDN) |
| Daily cron | `reset_demo.sh` (pazka crontab, 05:00) re-imports `Demo-project.json` through the API — see §5 step 9 |

## 5. Cutover from legacy (once; on-box Claude in an owner-opened sudo window)

Box rules: `ACTIONS-LOG.md` intent BEFORE, result + revert AFTER; `/home/pazka/MIGRATION/scripts/smoke.sh`
BEFORE and AFTER. Legacy today: project `/home/pazka/serious/DrawTogether` (copy in
`/root/hosh-deploy/drawtogether/`), `ghcr.io/pazka/drawtogether:v1.1.1`, `127.0.0.1:9001:80`, uid 1000, bind
mounts `./front/build/uploads` (122 MB) and `./.node-persist` (54 417 md5 + 54 417 sha256 files in `storage/`).
Rehearsed end to end in CI by `scripts/cutover-smoke.sh` (job `cutover smoke (legacy -> hosh-deploy)`).

**Prerequisites:** a release ≥ **v1.2.0** built (the first with `/healthz` + env-driven dirs); the GHCR
package `drawtogether` **public** (owner, package settings — the box pulls anonymously), else the export
fallback (11-BOX-STANDARD §6) to load the image under its tag before step 7; port 9135 free (`ss -ltn`).

```sh
# 0 — baseline (ACTIONS-LOG intent): smoke BEFORE, room count, file counts
/home/pazka/MIGRATION/scripts/smoke.sh draw
curl -s http://127.0.0.1:9001/api/room/all | python3 -c 'import json,sys; print(len(json.load(sys.stdin)), "rooms")'
L=/home/pazka/serious/DrawTogether
sudo find "$L/front/build/uploads" "$L/.node-persist/storage" -type f | wc -l
sudo ls -A "$L/.node-persist"          # expect only: storage

# 1 — release checkout (provides docker-compose.example.yml, .env.example, deploy/*)
sudo mkdir -p /srv/drawtogether && sudo chmod 750 /srv/drawtogether && cd /srv/drawtogether
[ -d .git ] || { sudo git init -q && sudo git remote add origin https://github.com/pazka/DrawTogether; }
sudo git fetch -q --depth 1 origin tag v1.2.0 && sudo git checkout -q v1.2.0

# 2 — env file: .env.example unchanged (no value moves from the legacy side: the legacy compose has no
#     env_file/environment and the app reads none; its .env, if any, only fed compose interpolation)
[ -e drawtogether.env ] || sudo install -m 600 .env.example drawtogether.env

# 3 — pin the box config (validates the compose hardening). NO deploy from the box.
sudo hosh-deploy register drawtogether

# 4 — GitHub key (claude_agent: keygen; root: bind; gh: secret). If the agent is blocked, the owner runs these.
ssh-keygen -q -t ed25519 -N '' -C hosh-deploy:drawtogether -f /tmp/drawtogether-deploy
sudo /home/pazka/MIGRATION/scripts/setup-hosh-deploy.sh key drawtogether /tmp/drawtogether-deploy.pub
gh secret set HOSH_DEPLOY_KEY -R pazka/DrawTogether < /tmp/drawtogether-deploy && shred -u /tmp/drawtogether-deploy /tmp/drawtogether-deploy.pub

# 5 — downtime starts: stop legacy (freezes the data), backup both dirs
cd "$L" && sudo docker compose stop
sudo tar czf /mnt/data/attic/drawtogether-cutover-$(date +%F).tgz -C "$L" front/build/uploads .node-persist

# 6 — data move into the named volume (both dirs, md5 originals included), owned by 10001.
#     Read-only source mounts: the legacy dirs stay untouched (rollback). Same commands as CI's rehearsal.
DT_IMAGE=ghcr.io/pazka/drawtogether:v1.2.0; DT_LEGACY="$L"
sudo docker volume create --label com.docker.compose.project=drawtogether \
  --label com.docker.compose.volume=drawtogether-data drawtogether-data
sudo docker run --rm --network none --user 0:0 --entrypoint sh \
  -v drawtogether-data:/data \
  -v "$DT_LEGACY/front/build/uploads:/from/uploads:ro" \
  -v "$DT_LEGACY/.node-persist/storage:/from/persist:ro" \
  "$DT_IMAGE" -c 'set -e; mkdir -p /data/uploads /data/persist
    cp -a /from/uploads/. /data/uploads/ && cp -a /from/persist/. /data/persist/
    chown -R 10001:10001 /data
    echo "files: $(find /from/uploads /from/persist -type f | wc -l) -> $(find /data/uploads /data/persist -type f | wc -l)"'
#     the two counts must be equal (= step 0's count)
```
**7 — legacy router out (coordinator):** remove the `draw.hosh.it` router + its service from
`/root/hosh-deploy/edge/traefik/dynamic/routes.yml` (backup `routes.yml.bak-drawtogether` first) **before** the
first deploy: two routers with the same `Host` rule (or a duplicate router name) would make hosh-deploy's HTTPS
check hit the stopped legacy upstream and roll back. Check `curl -s 127.0.0.1:8899/api/http/routers | grep -i draw` is empty.
```sh
# 8 — first deploy = CI (writes the Traefik route, POST_DEPLOY, auto-rollback). Expect in the container log:
#     "node-persist migration (md5 -> sha256 names) in /data/persist: 0 copied, <n> already migrated, 0 skipped"
gh workflow run deploy -R pazka/DrawTogether -f version=v1.2.0
sudo hosh-deploy status drawtogether
sudo docker logs drawtogether 2>&1 | grep 'node-persist migration'
curl -s http://127.0.0.1:9135/api/room/all | python3 -c 'import json,sys; print(len(json.load(sys.stdin)), "rooms")'   # = step 0
```
**9 — daily demo reset:** `reset_demo.sh` (pazka crontab, 05:00) posts `Demo-project.json` to
`http://127.0.0.1:9001/api/room/<demo room>/import`. After the cutover it must call the **same path on port
9135**: `http://127.0.0.1:9135/api/room/<demo room>/import` (`POST`, `content-type: application/json`,
body = the file). Edit the port in the script (backup it first); run it once by hand and check
`GET http://127.0.0.1:9135/api/room/<demo room>` returns the demo layers. (The import only overwrites the room;
the demo room must already be in the room list, which it is after the data move.)

**10 — after:** add the §3 checks to `svc_draw` in `scripts/smoke.sh` (target `127.0.0.1:9135` for the loopback
check instead of 9001), smoke AFTER, port registry 9001 → free / 9135 → live, commit the new route + routes.yml
change in `/root/hosh-deploy`, ACTIONS-LOG result. Keep the legacy dirs and compose as they are (rollback).

**Rollback** (data copy left untouched; rooms changed after the cutover exist only in the volume):
```sh
cd /srv/drawtogether && sudo docker compose --env-file drawtogether.env down        # volume kept
sudo rm -f /root/hosh-deploy/edge/traefik/dynamic/drawtogether.yml
sudo cp /root/hosh-deploy/edge/traefik/dynamic/routes.yml.bak-drawtogether /root/hosh-deploy/edge/traefik/dynamic/routes.yml
cd /home/pazka/serious/DrawTogether && sudo docker compose up -d                    # legacy, untouched dirs
# reset_demo.sh back to port 9001. To keep rooms edited after the cutover, copy the volume back first:
#   sudo docker run --rm --network none --user 0:0 --entrypoint sh -v drawtogether-data:/data:ro \
#     -v "$L/front/build/uploads:/to/uploads" -v "$L/.node-persist/storage:/to/persist" "$DT_IMAGE" \
#     -c 'cp -a /data/uploads/. /to/uploads/ && cp -a /data/persist/. /to/persist/ && chown -R 1000:1000 /to'
```
Full revert of the registration: `sudo rm /etc/hosh-deploy/apps/drawtogether.conf` +
`sudo .../setup-hosh-deploy.sh unkey drawtogether` + `gh secret delete HOSH_DEPLOY_KEY -R pazka/DrawTogether`.

**Later, separate step (not part of the cutover):** drop the 54 417 md5-named node-persist 3 originals
(32-hex names) from the volume once the cutover is settled (the 2-minute expiry sweep reads every file, so they
double its I/O; MIGRATIONS.md). Backup first, then e.g.
`sudo docker run --rm --network none --user 10001:10001 --entrypoint sh -v drawtogether-data:/data "$DT_IMAGE" -c 'find /data/persist -maxdepth 1 -type f -regex ".*/[0-9a-f]\{32\}" -delete'`.
After that, a rollback to an image older than v1.1.1 (node-persist 3) would see no rooms.

## 6. Decisions / known limits
- Backward compatible on purpose: with no env, the image behaves exactly as before (port 80,
  `front/build/uploads`, `.node-persist/storage` under `/app`), so a release can still be pulled by the legacy
  compose until the cutover. New: `/healthz` (a room can no longer be named `healthz`) and an image
  `HEALTHCHECK` (the legacy container now shows a health status too).
- Logs stay morgan "combined" + plain lines (pinned by the tests), not JSON; `/healthz` is not logged.
  Client IPs in the access log are the docker gateway (the app trusts no `X-Forwarded-For`).
- Rooms have no access control (the URL is the key); `GET /api/room/all` lists every id; uploads check the
  extension only (TESTING.md "Known gaps").
- `mem_limit 512m`: body-parser accepts imports up to 100 MB.
