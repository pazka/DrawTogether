# Data migrations

Changes to what is stored on the persist volume (`/app/.node-persist`, node-persist files in `storage/`).
Newest first.

## 2026-10-26 — node-persist 3.1.3 → 4.0.4: storage file names md5 → sha256

**Why.** node-persist stores each key (`rooms`, `room-<id>`) in one file `storage/<hash(key)>` containing
`{"key", "value", "ttl"}`. 3.x names it `md5(key)`, 4.x `sha256(key)`, and 4.x ships no migration: on 3.x
data it finds nothing, so every room would vanish.

**What it does.** At startup, right after `persist.init` and before the first read
(`Services/persistMigration.ts`, called from `Services/storage.ts`):

- for each regular file in `storage/` named like an md5 (32 hex chars) whose JSON `key` hashes back to that
  name, if `sha256(key)` does not exist yet, write a byte-identical copy under that name (dot-prefixed temp
  file + fsync + rename; node-persist ignores dotfiles);
- **the md5 originals are kept**; files already migrated are left alone (idempotent: never overwrites what
  4.x wrote since); unparseable, foreign, symlinked or non-file entries are skipped and logged, never fatal;
- logs one line: `node-persist migration (md5 -> sha256 names) in /app/.node-persist/storage: N copied,
  M already migrated, K skipped`. First start after the upgrade: `N` = number of rooms + 1 (the `rooms` list),
  `K` should be 0. Every later start: `0 copied`.

Tested by `test/persistMigration.test.js` and `scripts/upgrade-smoke.sh` (CI job `upgrade smoke (node-persist
3 -> 4)`: rooms created by the last 3.x image come back identical with the new one, survive a restart, and
the 3.x image still serves them after a rollback). See TESTING.md.

**Box steps (owner / on-box session).**

1. Smoke before (`scripts/smoke.sh` on the box), and note `GET /api/room/all` (room count).
2. Back up the persist data first. Named volume:
   `docker run --rm -v <volume>:/d:ro -v "$PWD":/b alpine tar czf /b/drawtogether-persist-$(date +%F).tgz -C /d .`
   (bind mount `./persist` as in `docker-compose.yml`: `tar czf drawtogether-persist-$(date +%F).tgz -C persist .`).
3. Update the image in the app's compose (pazka/hosh-deploy pins it by digest: use the digest of the new
   `master` / release image), deploy (`hosh-deploy deploy drawtogether …`).
4. Check the log line above (`N copied`, `0 skipped`), then smoke after: same `GET /api/room/all`, an existing
   room opens with its layers/images, a new room can be drawn in, and survives `docker restart`.

**Rollback.** Redeploy the previous (node-persist 3) image digest: it reads the untouched md5 files, so every
room is back **as it was before the upgrade**. Rooms created or drawn in after the upgrade exist only in the
sha256 files: they are not visible to 3.x (they come back if you upgrade again). If rooms were changed while
on 3.x and you upgrade again, delete the sha256 (64-hex) files first so the migration copies the newer md5
files, or restore the backup from step 2:
`docker run --rm -v <volume>:/d -v "$PWD":/b alpine sh -c 'rm -rf /d/* && tar xzf /b/drawtogether-persist-<date>.tgz -C /d'`.

**Later.** Once the upgrade is settled, the md5 originals can be removed (separate change: the 2-minute
expiry sweep reads every file in `storage/`, so they double that I/O; they are otherwise harmless).
