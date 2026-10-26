#!/usr/bin/env bash
# Upgrade smoke for the node-persist 3 -> 4 data migration (MIGRATIONS.md, TESTING.md).
#
#   bash scripts/upgrade-smoke.sh <old image (node-persist 3)> <new image> [deployed|hardened]
#
# On the same two volumes, like the box: the OLD image creates rooms through the real API (new room, custom
# room, imported room with layers + texts, uploaded layer image), then the NEW image must serve exactly the
# same rooms, list and image; a room drawn on the new image survives a restart (the migration never
# overwrites newer data); and the OLD image again (rollback) still serves the pre-upgrade rooms.
set -euo pipefail

OLD="${1:?old image}"
NEW="${2:?new image}"
MODE="${3:-deployed}"
NAME="drawtogether-upgrade-$$"
PORT="${SMOKE_PORT:-18002}"
BASE="http://127.0.0.1:${PORT}"
TMP="$(mktemp -d)"
cd "$TMP"

dk() { MSYS_NO_PATHCONV=1 docker "$@"; }
cleanup() {
  cd /
  if [ "${SMOKE_OK:-0}" != 1 ]; then echo "---- container log ----"; dk logs "$NAME" 2>&1 | tail -n 40 || true; fi
  dk rm -f "$NAME" >/dev/null 2>&1 || true
  dk volume rm -f "$NAME-uploads" "$NAME-persist" >/dev/null 2>&1 || true
  rm -rf "$TMP"
}
trap cleanup EXIT
fail() { echo "UPGRADE SMOKE FAIL ($MODE): $*" >&2; exit 1; }
step() { echo "== $*"; }
code() { # code <expected> <curl args...>   body saved to body.out
  local want="$1"; shift
  local got
  got="$(curl -sS -o body.out -w '%{http_code}' "$@")"
  [ "$got" = "$want" ] || { head -c 300 body.out >&2; echo >&2; fail "expected $want got $got for: $*"; }
}

flags=()
if [ "$MODE" = hardened ]; then
  dk run --rm -v "$NAME-uploads:/u" -v "$NAME-persist:/p" --entrypoint sh "$NEW" -c 'chown 1000:1000 /u /p'
  flags+=(--user 1000:1000 --read-only --tmpfs /tmp --cap-drop ALL --security-opt no-new-privileges:true)
fi

start() { # start <image>
  dk rm -f "$NAME" >/dev/null 2>&1 || true
  dk run -d --name "$NAME" "${flags[@]}" \
    -v "$NAME-uploads:/app/front/build/uploads" -v "$NAME-persist:/app/.node-persist" \
    -p "127.0.0.1:${PORT}:80" "$1" >/dev/null
  for _ in $(seq 1 60); do
    dk logs "$NAME" 2>&1 | grep -q 'Listening on 80' && return 0
    [ "$(dk inspect --format '{{.State.Running}}' "$NAME")" = true ] || fail "container exited ($1)"
    sleep 1
  done
  fail "did not start ($1)"
}
stop() { # node-persist writes through a 1 s write queue: let it flush, then stop like compose does
  sleep 3
  if dk logs "$NAME" 2>&1 | grep -E 'Error: E[A-Z]+|UnhandledPromiseRejection|Uncaught'; then fail "errors in log"; fi
  dk stop -t 10 "$NAME" >/dev/null
}
snapshot() { # snapshot <prefix>: the API view of every room + the list
  code 200 "$BASE/api/room/all"; cp body.out "$1-all.json"
  for r in "$ROOM_A" "$ROOM_B" "$ROOM_C"; do code 200 "$BASE/api/room/$r"; cp body.out "$1-$r.json"; done
}
same() { # same <prefixA> <prefixB>
  for f in all "$ROOM_A" "$ROOM_B" "$ROOM_C"; do
    cmp -s "$1-$f.json" "$2-$f.json" || { echo "$1: $(cat "$1-$f.json")"; echo "$2: $(cat "$2-$f.json")"; fail "$f differs ($1 vs $2)"; }
  done
}

printf '%s' 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==' \
  | base64 -d >pixel.png

step "old image ($OLD): create rooms, layers, texts, an uploaded drawing"
start "$OLD"
ROOM_A="$(curl -sS -o /dev/null -w '%{redirect_url}' "$BASE/" | sed 's#.*/##')"
[[ "$ROOM_A" =~ ^[A-Za-z0-9]{8}$ ]] || fail "GET / did not redirect to a new room ($ROOM_A)"
ROOM_B="upgrade-custom"
ROOM_C="upgrade-import"
code 200 "$BASE/$ROOM_B/"    # custom URL creates the room
code 200 "$BASE/$ROOM_C/"
NOW="$(date +%s)000"
code 200 -H 'content-type: application/json' --data-binary @- "$BASE/api/room/$ROOM_C/import" <<EOF
{"lastUpdate":$NOW,"version":5,"cantDie":true,"layers":[{"id":1,"name":"Carte","imgPath":"","texts":[{"name":"Élodie","x":12,"y":34}]},{"id":2,"name":"Layer","imgPath":"","texts":[]}]}
EOF
code 200 -F "layerImg=@pixel.png;type=image/png" "$BASE/api/room/$ROOM_A/1/upload"
snapshot old
grep -q "/uploads/$ROOM_A/pixel.png" "old-$ROOM_A.json" || fail "image not linked on the old image"
grep -q 'Élodie' "old-$ROOM_C.json" || fail "import not stored on the old image"
for r in "$ROOM_A" "$ROOM_B" "$ROOM_C"; do grep -q "$r" old-all.json || fail "$r not listed on the old image"; done
stop

step "new image ($NEW): migration copies the 3.x files, same rooms served"
start "$NEW"
dk logs "$NAME" 2>&1 | grep -E 'node-persist migration .*: [1-9][0-9]* copied, 0 already migrated, 0 skipped' \
  || fail "no migration line in the log"
snapshot new
same old new
code 200 "$BASE/uploads/$ROOM_A/pixel.png"
cmp -s body.out pixel.png || fail "uploaded drawing not served after upgrade"

step "new image: draw after the upgrade (upload to room C), survives a restart"
code 200 -F "layerImg=@pixel.png;type=image/png" "$BASE/api/room/$ROOM_C/2/upload"
snapshot drawn
grep -q "/uploads/$ROOM_C/pixel.png" "drawn-$ROOM_C.json" || fail "upload after upgrade not linked"
stop
start "$NEW"
dk logs "$NAME" 2>&1 | grep -E 'node-persist migration .*: 0 copied, [1-9][0-9]* already migrated, 0 skipped' \
  || fail "second start is not a no-op"
snapshot restarted
same drawn restarted
stop

step "rollback: old image again serves the pre-upgrade rooms (md5 originals kept)"
start "$OLD"
snapshot rollback
same old rollback
stop

SMOKE_OK=1
echo "UPGRADE SMOKE OK ($OLD -> $NEW, $MODE)"
