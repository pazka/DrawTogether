#!/usr/bin/env bash
# Visual regression of the built image (hosh-management AGENTS.md §3, use cases in TESTING.md
# "Visual use cases"). Pattern of pazka/MyMurderParty visual/ (itself from pazka/plats):
#   visual/run.sh [IMAGE]                (default drawtogether:smoke)
# Starts the image as docker-compose.example.yml runs it (uid 10001, read-only rootfs, tmpfs /tmp, cap_drop ALL,
# no-new-privileges, PORT 8000, all state in a fresh /data volume), starts two headless Chromes on the runner
# (mouse / touch) that open http://draw.test:9875 (mapped to 127.0.0.1; every other host name resolves to
# nothing), then runs visual/shoot.mjs with the image's own node (built-in fetch + WebSocket, no package
# installed): the board is seeded through the API, every use case at 1400 / 1024 / 390 is compared with
# visual/baseline/. Shots, diffs and report.json: $OUT.
#   CHROME=/path/to/chrome (default google-chrome)   OUT=visual/out   VISUAL_PRINT_NEW=1 (CI: failing
#   shots printed in the log, visual/from-log.mjs writes them back as files).
# New baselines (QA, in a PR that says the change is wanted): take them from the CI log of the runner's
# Chrome with visual/from-log.mjs, look at every picture, commit them.
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT="$PWD"
IMAGE="${1:-drawtogether:smoke}"
[ $# -gt 0 ] && shift
OUT="${OUT:-visual/out}"
NAME="dt-visual-$$"
VOL="dt-visual-$$"
PORT=9875
CDP_DESKTOP=9351
CDP_PHONE=9352
P1="$(mktemp -d)"; P2="$(mktemp -d)"
PIDS=()
dk() { MSYS_NO_PATHCONV=1 docker "$@"; }
cleanup() {
  for p in "${PIDS[@]}"; do kill "$p" 2>/dev/null || true; done
  # wait for the Chromes to exit: a profile still being written makes rm -rf fail ("Directory not empty")
  # and, under set -e, that turned a green run red after "0 failure(s)" (fix of pazka/StoraAlex#31)
  for p in "${PIDS[@]}"; do wait "$p" 2>/dev/null || true; done
  dk rm -f "$NAME" >/dev/null 2>&1 || true
  dk volume rm -f "$VOL" >/dev/null 2>&1 || true
  rm -rf "$P1" "$P2" "$P1.log" "$P2.log" "$P1.server.log" 2>/dev/null \
    || { sleep 2; rm -rf "$P1" "$P2" "$P1.log" "$P2.log" "$P1.server.log" || true; }
  return 0
}
trap cleanup EXIT

dk run -d --name "$NAME" \
  --user 10001:10001 --read-only --tmpfs /tmp --cap-drop ALL --security-opt no-new-privileges \
  -e PORT=8000 -e UPLOADS_DIR=/data/uploads -e PERSIST_DIR=/data/persist -v "$VOL:/data" \
  -p "127.0.0.1:$PORT:8000" "$IMAGE" >/dev/null
for _ in $(seq 1 60); do
  curl -fsS "http://127.0.0.1:$PORT/healthz" >/dev/null 2>&1 && break
  sleep 0.5
done
curl -fsS "http://127.0.0.1:$PORT/healthz" >/dev/null || { dk logs "$NAME" | tail -40; exit 1; }
test "$(dk exec "$NAME" id -u)" = 10001

RULES="MAP draw.test 127.0.0.1, MAP * ~NOTFOUND"  # = visual/cdp.mjs RESOLVER_RULES
COMMON=(--headless=new --no-sandbox --disable-gpu --mute-audio --no-first-run --hide-scrollbars
  --force-color-profile=srgb --font-render-hinting=none --disable-features=Translate,MediaRouter
  --disable-background-networking "--host-resolver-rules=$RULES")
"${CHROME:-google-chrome}" "${COMMON[@]}" \
  --blink-settings=primaryHoverType=2,availableHoverTypes=2,primaryPointerType=4,availablePointerTypes=4 \
  --remote-debugging-port=$CDP_DESKTOP --user-data-dir="$P1" about:blank >"$P1.log" 2>&1 &
PIDS+=($!)
"${CHROME:-google-chrome}" "${COMMON[@]}" \
  --remote-debugging-port=$CDP_PHONE --user-data-dir="$P2" about:blank >"$P2.log" 2>&1 &
PIDS+=($!)
# both DevTools endpoints up before the harness connects (Chrome's own output shown if one never comes)
for port in $CDP_DESKTOP $CDP_PHONE; do
  for _ in $(seq 1 120); do curl -fsS "http://127.0.0.1:$port/json/version" >/dev/null 2>&1 && break; sleep 0.5; done
  curl -fsS "http://127.0.0.1:$port/json/version" >/dev/null 2>&1 || {
    echo "VISUAL FAIL: Chrome (${CHROME:-google-chrome}) has no DevTools endpoint on 127.0.0.1:$port" >&2
    tail -30 "$P1.log" "$P2.log" >&2; exit 1; }
done

rm -rf "$OUT"; mkdir -p "$OUT"; chmod 777 "$OUT"
set +e
dk run --rm --network host --user 10001:10001 --read-only --cap-drop ALL --security-opt no-new-privileges \
  -e CDP_DESKTOP=$CDP_DESKTOP -e CDP_PHONE=$CDP_PHONE -e OUT=/out -e BASELINE=/v/baseline/ \
  -e VISUAL_PRINT_NEW="${VISUAL_PRINT_NEW:-}" -e ONLY="${ONLY:-}" \
  -v "$ROOT/visual:/v:ro" -v "$ROOT/$OUT:/out" --entrypoint node "$IMAGE" \
  /v/shoot.mjs "http://draw.test:$PORT" "http://127.0.0.1:$PORT" "$@"
rc=$?
set -e
# logs to a file first: under pipefail a pipe into grep -q can lose the match (SIGPIPE) and hide an error
dk logs "$NAME" >"$P1.server.log" 2>&1 || true
grep -qiE 'unhandled|TypeError|ReferenceError' "$P1.server.log" && { echo "VISUAL FAIL: server logged an error" >&2; grep -iE -B2 -A5 'unhandled|TypeError|ReferenceError' "$P1.server.log" | head -40 >&2; rc=1; }
exit $rc
