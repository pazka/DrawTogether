#!/usr/bin/env bash
# dependabot-merge.sh — merge Dependabot's tested minor/patch updates (box standard,
# hosh-migration 11-BOX-STANDARD.md §2 "Dependency updates"). Source of truth:
# hosh-migration templates/new-project/.github/scripts/dependabot-merge.sh; copy it unchanged.
#
#   dependabot-merge.sh decide < commit-message   prints "merge" or "review"
#   dependabot-merge.sh run                       env: GH_TOKEN REPO BRANCH SHA CI_WORKFLOW
#   dependabot-merge.sh self-test                 checks "decide" against known messages
#
# Policy: merge only when every update in Dependabot's own metadata block is semver-patch or
# semver-minor (a minor bump of a 0.x version counts as a major), the PR is Dependabot's alone (one GitHub-verified commit by dependabot[bot], from
# this repo), and CI passed on that exact commit. Anything else (major, unknown, someone else
# pushed) is labelled "needs-review" and left open. After a merge the CI is re-run on the default
# branch, because a merge made with GITHUB_TOKEN does not trigger push workflows.
# No third-party action: only the GitHub API through the runner's preinstalled gh and jq.
set -euo pipefail

log() { printf '%s\n' "$*" >&2; }

# Reads a Dependabot commit message on stdin. Only the YAML block that Dependabot writes
# ("updated-dependencies:" up to the "..." line) counts, so text from release notes can't
# change the answer. No block, no update-type, or any type other than minor/patch → review.
decide() {
  awk '
    function judge() {
      if (!item) return
      seen++
      ok = (type == "version-update:semver-patch" || type == "version-update:semver-minor")
      # 0.y.z: a minor bump is a breaking release (SemVer §4), so it waits like a major.
      if (type == "version-update:semver-minor" && ver ~ /^v?0\./) ok = 0
      if (!ok) bad++
      item = 0; type = ""; ver = ""
    }
    function val(line) {
      sub(/^[[:space:]-]*[a-z-]+:[[:space:]]*/, "", line)
      gsub(/["\047\r[:space:]]/, "", line)
      return line
    }
    /^updated-dependencies:[[:space:]]*$/ { inblock = 1; next }
    inblock && /^\.\.\.[[:space:]]*$/     { judge(); inblock = 0; next }
    inblock && /^-[[:space:]]+dependency-name:/ { judge(); item = 1; next }
    inblock && /^[[:space:]]*dependency-version:/ { ver = val($0); next }
    inblock && /^[[:space:]]*update-type:/ { type = val($0); next }
    END { if (inblock) bad++; print (seen > 0 && bad == 0) ? "merge" : "review" }
  '
}

self_test() {
  local fails=0
  check() {  # $1 expected, $2 name, stdin message
    local got
    got=$(decide)
    if [ "$got" = "$1" ]; then log "ok   $2"; else log "FAIL $2: expected $1, got $got"; fails=$((fails + 1)); fi
  }
  check merge "single patch" <<'M'
build(deps): Bump serde from 1.0.210 to 1.0.214 in /app

Bumps [serde](https://github.com/serde-rs/serde) from 1.0.210 to 1.0.214.

---
updated-dependencies:
- dependency-name: serde
  dependency-version: 1.0.214
  dependency-type: direct:production
  update-type: version-update:semver-patch
...

Signed-off-by: dependabot[bot] <support@github.com>
M
  check merge "group of minor and patch" <<'M'
build(deps): Bump the minor-and-patch group in /app with 2 updates

---
updated-dependencies:
- dependency-name: tauri
  dependency-version: 2.9.0
  dependency-type: direct:production
  update-type: version-update:semver-minor
  dependency-group: minor-and-patch
- dependency-name: serde_json
  dependency-version: 1.0.133
  dependency-type: direct:production
  update-type: 'version-update:semver-patch'
  dependency-group: minor-and-patch
...
M
  check review "major" <<'M'
build(deps): Bump actions/checkout from 5 to 7

---
updated-dependencies:
- dependency-name: actions/checkout
  dependency-version: '7'
  dependency-type: direct:production
  update-type: version-update:semver-major
...
M
  check review "group with one major" <<'M'
build(deps): Bump the npm group with 2 updates

---
updated-dependencies:
- dependency-name: a
  update-type: version-update:semver-patch
- dependency-name: b
  update-type: version-update:semver-major
...
M
  check review "no metadata block" <<'M'
chore: something a person wrote
update-type: version-update:semver-patch
M
  check review "block without update-type (e.g. digest bump)" <<'M'
build(deps): Bump python from 3.13-slim@sha256:aaa to 3.13-slim@sha256:bbb

---
updated-dependencies:
- dependency-name: python
  dependency-version: 3.13-slim
  dependency-type: direct:production
...
M
  check review "release notes cannot add a patch line after a major" <<'M'
build(deps): Bump x from 1.0.0 to 2.0.0

<li>update-type: version-update:semver-patch</li>

---
updated-dependencies:
- dependency-name: x
  update-type: version-update:semver-major
...
M
  check review "0.x minor is breaking" <<'M'
build(deps): Bump fastapi from 0.143.0 to 0.148.0

---
updated-dependencies:
- dependency-name: fastapi
  dependency-version: 0.148.0
  dependency-type: direct:production
  update-type: version-update:semver-minor
...
M
  check merge "0.x patch" <<'M'
---
updated-dependencies:
- dependency-name: fastapi
  dependency-version: 0.148.1
  update-type: version-update:semver-patch
...
M
  check review "group with a 0.x minor" <<'M'
---
updated-dependencies:
- dependency-name: fastapi
  dependency-version: 0.148.0
  update-type: version-update:semver-minor
- dependency-name: starlette
  dependency-version: 1.9.0
  update-type: version-update:semver-minor
...
M
  check review "item without update-type" <<'M'
---
updated-dependencies:
- dependency-name: a
  dependency-version: 1.2.4
  update-type: version-update:semver-patch
- dependency-name: b
  dependency-version: 2.0.0
...
M
  check review "block never closed" <<'M'
---
updated-dependencies:
- dependency-name: a
  dependency-version: 1.2.4
  update-type: version-update:semver-patch
M
  check review "empty message" </dev/null
  [ "$fails" -eq 0 ] || { log "$fails self-test(s) failed"; return 1; }
  log "self-test passed"
}

run() {
  : "${GH_TOKEN:?}" "${REPO:?}" "${BRANCH:?}" "${SHA:?}" "${CI_WORKFLOW:?}"
  local pr pr_json commit_json decision base
  pr=$(gh api "repos/$REPO/pulls?state=open&head=${REPO%%/*}:$BRANCH" --jq '.[0].number // empty')
  [ -n "$pr" ] || { log "no open pull request for $BRANCH: nothing to do"; return 0; }
  pr_json=$(gh api "repos/$REPO/pulls/$pr")
  base=$(jq -r .base.ref <<<"$pr_json")

  # Each check below stops quietly: the PR stays open for a person or for its next CI run.
  [ "$(jq -r .user.login <<<"$pr_json")" = "dependabot[bot]" ] || { log "#$pr is not Dependabot's"; return 0; }
  [ "$(jq -r .head.repo.full_name <<<"$pr_json")" = "$REPO" ] || { log "#$pr comes from a fork"; return 0; }
  [ "$(jq -r .head.sha <<<"$pr_json")" = "$SHA" ] || { log "#$pr moved on since this CI run; the next run decides"; return 0; }
  [ "$(jq -r .draft <<<"$pr_json")" = "false" ] || { log "#$pr is a draft"; return 0; }
  [ "$base" = "$(gh api "repos/$REPO" --jq .default_branch)" ] || { log "#$pr does not target the default branch"; return 0; }

  commit_json=$(gh api "repos/$REPO/commits/$SHA")
  if [ "$(jq -r .commits <<<"$pr_json")" != "1" ] \
    || [ "$(jq -r '.author.login // empty' <<<"$commit_json")" != "dependabot[bot]" ] \
    || [ "$(jq -r .commit.verification.verified <<<"$commit_json")" != "true" ]; then
    decision=review
    log "#$pr has commits that are not Dependabot's own signed commit"
  else
    decision=$(jq -r .commit.message <<<"$commit_json" | decide)
  fi

  if [ "$decision" != "merge" ]; then
    log "#$pr needs a person (major or unknown update): labelled needs-review, left open"
    gh api -X POST "repos/$REPO/issues/$pr/labels" -f 'labels[]=needs-review' >/dev/null
    return 0
  fi

  log "#$pr: tested minor/patch update, merging $SHA"
  gh api -X PUT "repos/$REPO/pulls/$pr/merge" -f merge_method=squash -f sha="$SHA" >/dev/null
  log "merged; re-running $CI_WORKFLOW on $base"
  gh workflow run "$CI_WORKFLOW" --repo "$REPO" --ref "$base"
}

case "${1:-}" in
  decide) decide ;;
  run) run ;;
  self-test) self_test ;;
  *) sed -n '2,8p' "$0" >&2; exit 2 ;;
esac
