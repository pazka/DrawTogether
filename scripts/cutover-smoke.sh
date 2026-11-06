#!/usr/bin/env bash
# Rehearsal of the box cutover legacy compose → hosh-deploy (DEPLOY.md §5), on one image:
#
#   bash scripts/cutover-smoke.sh <image>
#
# 1. legacy: the box's legacy compose (uid 1000, sysctl, bind mounts ./front/build/uploads + ./.node-persist,
#    port 80) gets rooms (new room, custom URL, import with texts, uploaded image) + an md5-named node-persist
#    original like the box keeps after the node-persist 4 migration; then it is stopped.
# 2. the DEPLOY.md data move, verbatim: copy both dirs into the named volume drawtogether-data, chown 10001.
# 3. hosh-deploy: docker-compose.example.yml + .env.example as the box gets them, the register hardening
#    check, `docker compose up`, healthy, loopback /healthz on BIND, POST_DEPLOY from deploy/hosh-deploy.conf
#    run as argv inside the container; every room, the list and the image identical to legacy; restart.
# 4. rollback: compose down (volume kept), legacy again on its untouched dirs serves the same rooms.
set -euo pipefail

IMAGE="${1:?image}"
REPO="$(cd "$(dirname "$0")/.." && pwd)"
TMP="$(mktemp -d)"
LEGACY="$TMP/legacy"            # stands for /home/pazka/serious/DrawTogether
SRV="$TMP/srv"                  # stands for /srv/drawtogether
LNAME="drawtogether-legacy-$$"
LBASE="http://127.0.0.1:${LEGACY_PORT:-19001}"
conf() { sed -n "s/^$1=//p" "$REPO/deploy/hosh-deploy.conf"; }
BIND="$(conf BIND)"; SERVICE="$(conf SERVICE)"
NBASE="http://$BIND"
cd "$TMP"

COMPOSE=(docker compose --project-directory "$SRV" --env-file "$SRV/drawtogether.env" -f "$SRV/docker-compose.yml")
cleanup() {
  cd /
  if [ "${SMOKE_OK:-0}" != 1 ]; then
    echo "---- legacy log ----"; docker logs "$LNAME" 2>&1 | tail -n 30 || true
    echo "---- compose log ----"; "${COMPOSE[@]}" logs --tail 30 2>&1 || true
  fi
  docker rm -f "$LNAME" >/dev/null 2>&1 || true
  "${COMPOSE[@]}" down -v >/dev/null 2>&1 || true
  docker volume rm -f drawtogether-data >/dev/null 2>&1 || true
  [ -d "$LEGACY" ] && docker run --rm -v "$LEGACY:/b" --entrypoint sh "$IMAGE" -c 'rm -rf /b/* /b/.[!.]*' >/dev/null 2>&1 || true
  rm -rf "$TMP" 2>/dev/null || true
}
trap cleanup EXIT
fail() { echo "CUTOVER SMOKE FAIL: $*" >&2; exit 1; }
step() { echo "== $*"; }
code() { local want="$1"; shift; local got; got="$(curl -sS -o body.out -w '%{http_code}' "$@")"
  [ "$got" = "$want" ] || { head -c 300 body.out >&2; echo >&2; fail "expected $want got $got for: $*"; }; }
up() { for _ in $(seq 1 60); do [ "$(curl -s -o /dev/null -w '%{http_code}' "$1/api/room/all")" = 200 ] && return 0; sleep 1; done; fail "$1 did not come up"; }
snapshot() { code 200 "$2/api/room/all"; cp body.out "$1-all.json"
  for r in "${ROOMS[@]}"; do code 200 "$2/api/room/$r"; cp body.out "$1-$r.json"; done
  code 200 "$2/uploads/$ROOM_A/pixel.png"; cp body.out "$1-pixel.png"; }
same() { for f in all "${ROOMS[@]}"; do cmp -s "$1-$f.json" "$2-$f.json" || { echo "$1: $(cat "$1-$f.json")"; echo "$2: $(cat "$2-$f.json")"; fail "$f differs ($1 vs $2)"; }; done
  cmp -s "$1-pixel.png" "$2-pixel.png" || fail "image differs ($1 vs $2)"; }
legacy_start() {
  docker rm -f "$LNAME" >/dev/null 2>&1 || true
  docker run -d --name "$LNAME" --user 1000:1000 --sysctl net.ipv4.ip_unprivileged_port_start=0 \
    --security-opt no-new-privileges:true --cap-drop ALL --restart unless-stopped \
    -v "$LEGACY/front/build/uploads:/app/front/build/uploads" -v "$LEGACY/.node-persist:/app/.node-persist" \
    -p "127.0.0.1:${LBASE##*:}:80" "$IMAGE" >/dev/null
  up "$LBASE"
}
printf '%s' 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==' | base64 -d >pixel.png

step "1. legacy compose: rooms, import, upload"
mkdir -p "$LEGACY/front/build/uploads" "$LEGACY/.node-persist"
docker run --rm -v "$LEGACY:/b" --entrypoint sh "$IMAGE" -c 'chown -R 1000:1000 /b/front/build/uploads /b/.node-persist'
legacy_start
ROOM_A="$(curl -sS -o /dev/null -w '%{redirect_url}' "$LBASE/" | sed 's#.*/##')"
[[ "$ROOM_A" =~ ^[A-Za-z0-9]{8}$ ]] || fail "GET / did not redirect to a new room"
ROOMS=("$ROOM_A" cutover-custom cutover-import)
code 200 "$LBASE/cutover-custom/"
code 200 "$LBASE/cutover-import/"
code 200 -H 'content-type: application/json' --data-binary @- "$LBASE/api/room/cutover-import/import" <<JSON
{"lastUpdate":$(date +%s)000,"version":5,"cantDie":true,"layers":[{"id":1,"name":"Carte","imgPath":"","texts":[{"val":"Élodie","pos":[12,34]}]}]}
JSON
code 200 -F "layerImg=@pixel.png;type=image/png" "$LBASE/api/room/$ROOM_A/1/upload"
sleep 3; snapshot legacy "$LBASE"
grep -q 'Élodie' legacy-cutover-import.json || fail "import not stored"
docker stop -t 10 "$LNAME" >/dev/null
# the box keeps the node-persist 3 md5 originals next to the sha256 files: add one (md5("rooms") = copy)
docker run --rm -v "$LEGACY/.node-persist:/p" --entrypoint sh "$IMAGE" -c \
  'cd /p/storage && cp -p "$(printf rooms | sha256sum | cut -c1-64)" "$(printf rooms | md5sum | cut -c1-32)"'
LCOUNT="$(docker run --rm -v "$LEGACY:/b:ro" --entrypoint sh "$IMAGE" -c 'find /b/front/build/uploads /b/.node-persist/storage -type f | wc -l')"

step "2. data move into the named volume (DEPLOY.md §5 step 4, verbatim)"
DT_IMAGE="$IMAGE"; DT_LEGACY="$LEGACY"
# ---8<--- DEPLOY.md
# labels = what `docker compose` would set, so compose adopts the volume without a warning
docker volume create --label com.docker.compose.project=drawtogether \
  --label com.docker.compose.volume=drawtogether-data drawtogether-data
docker run --rm --network none --user 0:0 --entrypoint sh \
  -v drawtogether-data:/data \
  -v "$DT_LEGACY/front/build/uploads:/from/uploads:ro" \
  -v "$DT_LEGACY/.node-persist/storage:/from/persist:ro" \
  "$DT_IMAGE" -c 'set -e; mkdir -p /data/uploads /data/persist
    cp -a /from/uploads/. /data/uploads/ && cp -a /from/persist/. /data/persist/
    chown -R 10001:10001 /data
    echo "files: $(find /from/uploads /from/persist -type f | wc -l) -> $(find /data/uploads /data/persist -type f | wc -l)"'
# --->8---
VCOUNT="$(docker run --rm -v drawtogether-data:/data:ro --entrypoint sh "$IMAGE" -c 'find /data -type f | wc -l')"
[ "$LCOUNT" = "$VCOUNT" ] || fail "file count legacy $LCOUNT != volume $VCOUNT"

step "3. hosh-deploy compose (docker-compose.example.yml + .env.example), register check, deploy"
mkdir -p "$SRV/deploy"
cp "$REPO/docker-compose.example.yml" "$SRV/docker-compose.yml"
cp "$REPO/deploy/hosh-deploy.conf" "$REPO/deploy/traefik-route.yml.tmpl" "$SRV/deploy/"
install -m 600 "$REPO/.env.example" "$SRV/drawtogether.env"
sed -i "s|^APP_IMAGE=.*|APP_IMAGE='$IMAGE'|" "$SRV/drawtogether.env"   # what hosh-deploy deploy rewrites
grep -q 'Host(`@@HOST@@`)' "$SRV/deploy/traefik-route.yml.tmpl" || fail "route template has no Host(@@HOST@@)"
"${COMPOSE[@]}" config --format json | python3 "$REPO/.github/scripts/register-check.py" "$SERVICE" "$BIND"
"${COMPOSE[@]}" up -d --pull never
cid="$("${COMPOSE[@]}" ps -q "$SERVICE")"
for _ in $(seq 1 60); do h="$(docker inspect -f '{{.State.Health.Status}}' "$cid")"; [ "$h" = healthy ] && break; [ "$h" = unhealthy ] && break; sleep 2; done
[ "$h" = healthy ] || fail "not healthy ($h)"
[ "$(docker inspect -f '{{.Config.User}}' "$cid")" = 10001:10001 ] || fail "not uid 10001"
[ "$(docker inspect -f '{{.HostConfig.ReadonlyRootfs}}' "$cid")" = true ] || fail "rootfs writable"
code 200 "$NBASE$(conf HEALTH)"
python3 -c 'import json,sys; b=json.load(open("body.out")); assert b["status"]=="ok" and b["rooms"]==3, b'
docker logs "$cid" 2>&1 | grep -E 'node-persist migration .*: 0 copied, [1-9][0-9]* already migrated, 0 skipped' \
  || fail "the moved store is not seen as migrated"
snapshot cutover "$NBASE"
same legacy cutover
read -r -a pd <<< "$(conf POST_DEPLOY)"
"${COMPOSE[@]}" exec -T "$SERVICE" "${pd[@]}" || fail "POST_DEPLOY"
code 200 "$NBASE/api/room/all"; cp body.out after-pd.json
"${COMPOSE[@]}" restart >/dev/null
up "$NBASE"
code 200 "$NBASE/api/room/all"; cmp -s body.out after-pd.json || fail "room list changed across a restart"
code 200 "$NBASE/uploads/$ROOM_A/pixel.png"; cmp -s body.out pixel.png || fail "image lost across a restart"

step "4. rollback: compose down (volume kept), legacy again on its untouched dirs"
"${COMPOSE[@]}" down >/dev/null
docker volume inspect drawtogether-data >/dev/null || fail "volume removed by down"
legacy_start
snapshot rollback "$LBASE"
same legacy rollback

SMOKE_OK=1
echo "CUTOVER SMOKE OK ($IMAGE)"
