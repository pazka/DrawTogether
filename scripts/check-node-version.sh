#!/usr/bin/env bash
# check-node-version.sh IMAGE [NODE_BIN]
# Guardrail (pazka/hosh-management#5, CVE-2026-111497): fail if the Node runtime inside IMAGE is
# end-of-life or below the minimum patched release of its line. Trivy does not reliably flag the
# Node binary of official images, so CI checks it directly. Run in CI after the image build, and in
# release.yml before anything is pushed.
#   NODE_BIN: path of node inside the image (default: node; distroless: /nodejs/bin/node).
# The minimums are bumped by the daily security routine when Node ships a security release.
set -euo pipefail
IMAGE=${1:?usage: check-node-version.sh IMAGE [NODE_BIN]}
NODE_BIN=${2:-node}
MIN_22=22.23.5
MIN_24=24.22.3
MIN_26=26.13.1
v=$(docker run --rm --network none --entrypoint "$NODE_BIN" "$IMAGE" -p 'process.versions.node')
major=${v%%.*}
case "$major" in
  22) min=$MIN_22 ;;
  24) min=$MIN_24 ;;
  26) min=$MIN_26 ;;
  *) echo "::error::$IMAGE runs Node $v: major $major is EOL or not an LTS line (allowed: 22, 24, 26)"; exit 1 ;;
esac
if [ "$(printf '%s\n%s\n' "$min" "$v" | sort -V | head -1)" != "$min" ]; then
  echo "::error::$IMAGE runs Node $v < $min (patched minimum for Node $major, CVE-2026-111497 and later)"
  exit 1
fi
echo "Node $v in $IMAGE: OK (>= $min)"
