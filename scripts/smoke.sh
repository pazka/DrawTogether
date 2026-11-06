#!/usr/bin/env bash
# Container smoke test (upgrade safety net, see TESTING.md).
#
#   docker build -t drawtogether:smoke . && bash scripts/smoke.sh drawtogether:smoke [deployed|hardened|legacy|template]
#
# deployed (default): exactly like docker-compose.yml today (no extra flags; uploads + persist volumes).
# hardened: non-root (node, uid 1000), read-only rootfs, cap_drop ALL, no-new-privileges, same volumes.
# legacy: exactly like the box's legacy compose for draw.hosh.it (/home/pazka/serious/DrawTogether, until
#   the hosh-deploy cutover): uid 1000, sysctl ip_unprivileged_port_start=0, no-new-privileges, cap_drop ALL,
#   restart unless-stopped, host BIND MOUNTS ./front/build/uploads and ./.node-persist owned by 1000,
#   127.0.0.1:<port>:80. The data must land in those host dirs, at today's paths.
# template: exactly like docker-compose.example.yml (hosh-deploy): uid 10001, read-only rootfs, tmpfs /tmp,
#   cap_drop ALL, no-new-privileges, pids 128, mem 512m, ONE fresh named volume at /data
#   (UPLOADS_DIR=/data/uploads, PERSIST_DIR=/data/persist), PORT=8000, image HEALTHCHECK must turn healthy.
# Every mode: the in-container capability smoke (scripts/capability-smoke.js: REST, import round-trip,
# upload, Socket.IO join) and a restart: rooms, uploads and the room list survive `docker restart`.
# Both modes require a working upload: multer's temp dir lives on the uploads volume (PR #5), so the
# rename stays on one filesystem (before: EXDEV with the compose volume, EROFS when read-only).
set -euo pipefail

IMAGE="${1:-drawtogether:smoke}"
MODE="${2:-deployed}"
NAME="drawtogether-smoke-$$"
PORT="${SMOKE_PORT:-18001}"
BASE="http://127.0.0.1:${PORT}"
TMP="$(mktemp -d)"
cd "$TMP" # fixtures are referenced by relative name (portable curl -F)

dk() { MSYS_NO_PATHCONV=1 docker "$@"; }  # Git Bash on Windows rewrites /paths in args
cleanup() {
  cd /
  if [ "${SMOKE_OK:-0}" != 1 ]; then echo "---- container log ----"; dk logs "$NAME" 2>&1 | tail -n 40 || true; fi
  dk rm -f "$NAME" >/dev/null 2>&1 || true
  dk volume rm -f "$NAME-uploads" "$NAME-persist" "$NAME-data" >/dev/null 2>&1 || true
  # legacy bind dirs hold files owned by uid 1000: remove them from a container (the runner may not be root)
  if [ -d "$TMP/box" ]; then dk run --rm -v "$TMP/box:/b" --entrypoint sh "$IMAGE" -c 'rm -rf /b/* /b/.[!.]*' >/dev/null 2>&1 || true; fi
  rm -rf "$TMP" 2>/dev/null || true
}
trap cleanup EXIT
fail() { echo "SMOKE FAIL ($MODE): $*" >&2; exit 1; }
step() { echo "== $*"; }
code() { # code <expected> <curl args...>   body saved to body.out
  local want="$1"; shift
  local got
  got="$(curl -sS -o body.out -w '%{http_code}' "$@")"
  [ "$got" = "$want" ] || { head -c 300 body.out >&2; echo >&2; fail "expected $want got $got for: $*"; }
}

CPORT=80   # port inside the container
flags=()
vols=(-v "$NAME-uploads:/app/front/build/uploads" -v "$NAME-persist:/app/.node-persist")
case "$MODE" in
  deployed) ;;
  hardened)
    # Volumes must be writable by uid 1000 (a fresh named volume is root-owned).
    dk run --rm -v "$NAME-uploads:/u" -v "$NAME-persist:/p" --entrypoint sh "$IMAGE" -c 'chown 1000:1000 /u /p'
    flags+=(--user 1000:1000 --read-only --tmpfs /tmp --cap-drop ALL --security-opt no-new-privileges:true)
    ;;
  legacy)
    # The box's legacy compose, verbatim (image tag aside):
    #   user: "1000:1000"; sysctls: [net.ipv4.ip_unprivileged_port_start=0]
    #   security_opt: ["no-new-privileges:true"]; cap_drop: [ALL]; restart: unless-stopped
    #   ports: ["127.0.0.1:9001:80"]
    #   volumes: ./front/build/uploads:/app/front/build/uploads, ./.node-persist:/app/.node-persist
    mkdir -p box/front/build/uploads box/.node-persist
    dk run --rm -v "$TMP/box:/b" --entrypoint sh "$IMAGE" -c 'chown -R 1000:1000 /b/front/build/uploads /b/.node-persist'
    flags+=(--user 1000:1000 --sysctl net.ipv4.ip_unprivileged_port_start=0 \
      --security-opt no-new-privileges:true --cap-drop ALL --restart unless-stopped)
    vols=(-v "$TMP/box/front/build/uploads:/app/front/build/uploads" -v "$TMP/box/.node-persist:/app/.node-persist")
    ;;
  template)
    # docker-compose.example.yml as docker run flags (scripts/cutover-smoke.sh runs the compose file itself).
    # No chown: a fresh volume must be writable by 10001 out of the box (the image's /data is 10001-owned).
    CPORT=8000
    flags+=(--user 10001:10001 --read-only --tmpfs /tmp:size=16m,mode=1777 --cap-drop ALL \
      --security-opt no-new-privileges:true --pids-limit 128 --memory 512m \
      -e PORT=8000 -e UPLOADS_DIR=/data/uploads -e PERSIST_DIR=/data/persist)
    vols=(-v "$NAME-data:/data")
    ;;
  *) fail "unknown mode $MODE" ;;
esac

wait_up() { # until the API answers (after start or restart)
  for _ in $(seq 1 60); do
    [ "$(dk inspect --format '{{.State.Running}}' "$NAME")" = true ] || fail "container exited"
    [ "$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/room/all")" = 200 ] && return 0
    sleep 1
  done
  fail "API did not come up"
}

step "start $IMAGE ($MODE)"
dk run -d --name "$NAME" "${flags[@]}" "${vols[@]}" -p "127.0.0.1:${PORT}:${CPORT}" "$IMAGE" >/dev/null
wait_up
dk logs "$NAME" 2>&1 | grep -q "Listening on ${CPORT}" || fail "no 'Listening on ${CPORT}' line"

step "healthz + image HEALTHCHECK"
code 200 "$BASE/healthz"
grep -q '"status":"ok"' body.out && grep -q '"uploads":"writable"' body.out && grep -q '"store":"writable"' body.out \
  || fail "healthz: $(cat body.out)"
code 200 -I "$BASE/healthz"   # HEAD like GET
for _ in $(seq 1 40); do
  h="$(dk inspect --format '{{.State.Health.Status}}' "$NAME")"
  [ "$h" = healthy ] && break; [ "$h" = unhealthy ] && fail "container unhealthy"; sleep 1
done
[ "$h" = healthy ] || fail "container not healthy ($h)"
code 200 "$BASE/api/room/all"
grep -q '"healthz"' body.out && fail "/healthz created a room"

step "new room + REST"
ROOM="$(curl -sS -o /dev/null -w '%{redirect_url}' "$BASE/" | sed 's#.*/##')"
[[ "$ROOM" =~ ^[A-Za-z0-9]{8}$ ]] || fail "GET / did not redirect to a new room ($ROOM)"
code 200 "$BASE/api/room/$ROOM"
grep -q "\"id\":\"$ROOM\"" body.out || fail "room not persisted"
code 200 "$BASE/api/room/all"
grep -q "$ROOM" body.out || fail "room not listed"

step "front"
dk exec "$NAME" test -f /app/front/build/index.html || fail "image has no front build"
code 200 -L "$BASE/$ROOM"   # serve-static answers 301 /room -> /room/
grep -qi '<div id="root">' body.out || fail "front index not served"

step "Socket.IO handshake"
code 200 "$BASE/socket.io/?EIO=4&transport=polling"
grep -q '"sid"' body.out || fail "no engine.io sid"

printf '%s' 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==' \
  | base64 -d >pixel.png
step "image upload to the uploads volume, served back"
code 200 -F "layerImg=@pixel.png;type=image/png" "$BASE/api/room/$ROOM/1/upload"
code 200 "$BASE/uploads/$ROOM/pixel.png"
cmp -s body.out pixel.png || fail "served image differs"
code 200 "$BASE/api/room/$ROOM"
grep -q "/uploads/$ROOM/pixel.png" body.out || fail "image not linked in the layer"

step "capability smoke inside the container (as hosh-deploy POST_DEPLOY runs it)"
dk exec "$NAME" node /app/scripts/capability-smoke.js "http://127.0.0.1:${CPORT}" || fail "capability smoke"

if [ "$MODE" = legacy ]; then
  step "legacy: data landed in the host bind mounts at today's paths"
  cmp -s box/front/build/uploads/"$ROOM"/pixel.png pixel.png || fail "upload not in ./front/build/uploads/<room>/"
  ls box/.node-persist/storage | grep -Eq '^[0-9a-f]{64}$' || fail "no node-persist file in ./.node-persist/storage/"
fi
if [ "$MODE" = template ]; then
  step "template: all state in the /data volume, nothing written elsewhere"
  dk exec "$NAME" sh -c "cmp /data/uploads/$ROOM/pixel.png /data/uploads/hosh-deploy-smoke/smoke.png >/dev/null 2>&1; test -f /data/uploads/$ROOM/pixel.png" \
    || fail "upload not in /data/uploads/<room>/"
  dk exec "$NAME" sh -c 'ls /data/persist | grep -Eq "^[0-9a-f]{64}$"' || fail "no node-persist file in /data/persist/"
  dk exec "$NAME" sh -c '[ -z "$(ls -A /app/.node-persist)" ] && [ -z "$(ls -A /app/front/build/uploads)" ]' || fail "data written to the image paths"
  [ "$(dk inspect --format '{{.Config.User}}' "$NAME")" = 10001:10001 ] || fail "not uid 10001"
fi

step "restart: rooms, list and uploads survive"
sleep 3   # node-persist writes through a 1 s queue
for p in all "$ROOM" hosh-deploy-smoke; do code 200 "$BASE/api/room/$p"; cp body.out "before-$p.json"; done
dk restart -t 10 "$NAME" >/dev/null
wait_up
for p in all "$ROOM" hosh-deploy-smoke; do
  code 200 "$BASE/api/room/$p"
  cmp -s body.out "before-$p.json" || { echo "before: $(cat "before-$p.json")"; echo "after: $(cat body.out)"; fail "$p changed across a restart"; }
done
code 200 "$BASE/uploads/$ROOM/pixel.png"
cmp -s body.out pixel.png || fail "uploaded image lost across a restart"
dk exec "$NAME" node /app/scripts/capability-smoke.js "http://127.0.0.1:${CPORT}" || fail "capability smoke after restart"

step "no crash in logs"
if dk logs "$NAME" 2>&1 | grep -E 'Error: E[A-Z]+|UnhandledPromiseRejection|Uncaught'; then fail "errors in container log"; fi

SMOKE_OK=1
echo "SMOKE OK ($IMAGE, $MODE)"
