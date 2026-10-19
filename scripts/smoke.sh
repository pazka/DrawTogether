#!/usr/bin/env bash
# Container smoke test (upgrade safety net, see TESTING.md).
#
#   docker build -t drawtogether:smoke . && bash scripts/smoke.sh drawtogether:smoke [deployed|hardened]
#
# deployed (default): exactly like docker-compose.yml today (no extra flags; uploads + persist volumes).
# hardened: non-root (node, uid 1000), read-only rootfs, cap_drop ALL, no-new-privileges, same volumes.
#           On master the upload fails here (multer temp dir on the rootfs: EROFS/EACCES, and a rename
#           across devices: EXDEV). Owner PR #5 is meant to fix exactly that; this mode validates it.
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
  dk volume rm -f "$NAME-uploads" "$NAME-persist" >/dev/null 2>&1 || true
  rm -rf "$TMP"
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

flags=()
if [ "$MODE" = hardened ]; then
  # Volumes must be writable by uid 1000 (a fresh named volume is root-owned).
  dk run --rm -v "$NAME-uploads:/u" -v "$NAME-persist:/p" --entrypoint sh "$IMAGE" -c 'chown 1000:1000 /u /p'
  flags+=(--user 1000:1000 --read-only --tmpfs /tmp --cap-drop ALL --security-opt no-new-privileges:true)
fi

step "start $IMAGE ($MODE)"
dk run -d --name "$NAME" "${flags[@]}" \
  -v "$NAME-uploads:/app/front/build/uploads" -v "$NAME-persist:/app/.node-persist" \
  -p "127.0.0.1:${PORT}:80" "$IMAGE" >/dev/null
for _ in $(seq 1 60); do
  dk logs "$NAME" 2>&1 | grep -q 'Listening on 80' && break
  [ "$(dk inspect --format '{{.State.Running}}' "$NAME")" = true ] || fail "container exited"
  sleep 1
done

step "new room + REST"
ROOM="$(curl -sS -o /dev/null -w '%{redirect_url}' "$BASE/" | sed 's#.*/##')"
[[ "$ROOM" =~ ^[A-Za-z0-9]{8}$ ]] || fail "GET / did not redirect to a new room ($ROOM)"
code 200 "$BASE/api/room/$ROOM"
grep -q "\"id\":\"$ROOM\"" body.out || fail "room not persisted"
code 200 "$BASE/api/room/all"
grep -q "$ROOM" body.out || fail "room not listed"

step "front"
if dk exec "$NAME" test -f /app/front/build/index.html; then
  code 200 -L "$BASE/$ROOM"   # serve-static answers 301 /room -> /room/
  grep -qi '<div id="root">' body.out || fail "front index not served"
else
  echo "   (image has no front/build: master's Dockerfile does not build the front; PR #5 does)"
fi

step "Socket.IO handshake"
code 200 "$BASE/socket.io/?EIO=4&transport=polling"
grep -q '"sid"' body.out || fail "no engine.io sid"

printf '%s' 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==' \
  | base64 -d >pixel.png
if [ "$MODE" = deployed ] && [ "${SMOKE_UPLOAD_FIXED:-0}" != 1 ]; then
  # Pinned known bug (TESTING.md): multer writes to /app/uploads (rootfs) and rename() to the uploads
  # volume fails with EXDEV, so uploads 403 in the compose setup. PR #5 targets this: once it is merged,
  # set SMOKE_UPLOAD_FIXED=1 (or drop this branch) so the success path below is required.
  step "image upload to the uploads volume: known EXDEV failure (pinned)"
  code 403 -F "layerImg=@pixel.png;type=image/png" "$BASE/api/room/$ROOM/1/upload"
  grep -q EXDEV body.out || fail "upload failed, but not with the known EXDEV error: $(cat body.out)"
  SMOKE_OK=1
  echo "SMOKE OK ($IMAGE, $MODE; upload EXDEV pinned)"
  exit 0
fi
step "image upload to the uploads volume, served back"
code 200 -F "layerImg=@pixel.png;type=image/png" "$BASE/api/room/$ROOM/1/upload"
code 200 "$BASE/uploads/$ROOM/pixel.png"
cmp -s body.out pixel.png || fail "served image differs"
code 200 "$BASE/api/room/$ROOM"
grep -q "/uploads/$ROOM/pixel.png" body.out || fail "image not linked in the layer"

step "no crash in logs"
if dk logs "$NAME" 2>&1 | grep -E 'Error: E[A-Z]+|UnhandledPromiseRejection|Uncaught'; then fail "errors in container log"; fi

SMOKE_OK=1
echo "SMOKE OK ($IMAGE, $MODE)"
