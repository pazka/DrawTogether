# CLAUDE.md — pazka/DrawTogether

Live multi-user whiteboard (https://draw.hosh.it). Node/Express + Socket.IO + node-persist server; CRA front
in `front/`. The image runs the **committed `*.js`**, not the `*.ts`. Owner: Alexandre (pazka).
Read **TESTING.md** first.

## Maintenance (autonomous agent)
Goal: keep the base image, dependencies and Actions current **without changing behaviour**.
- **Gate = `ci` green**: `server tests (node 26)`, `container smoke (deployed)`, `container smoke (hardened)`,
  `container smoke (legacy)` (= the box's legacy compose; must keep passing until the hosh-deploy cutover),
  `container smoke (template)`, `cutover smoke (legacy -> hosh-deploy)`.
- **Deploy**: a final `vX.Y.Z` release deploys itself through hosh-deploy once `HOSH_DEPLOY_KEY` is set
  (DEPLOY.md; before that the deploy job is a no-op). So never tag without the owner.
- **Branches**: work on `agent/<topic>`; CI runs without a PR. Never push to `master` (`build-scan-push.yml` /
  `release.yml` publish from it), never tag. **The owner merges.**
- **Dependabot PRs**: green → summarise risk in a PR comment. Red → reproduce per TESTING.md, smallest fix on
  an `agent/` branch. Never weaken or delete a test; if behaviour must change, ask the owner.
- If you change a `.ts` file, recompile and commit the `.js` too (see TESTING.md: `tsc` needs a fix first).

## Rules
- No new dependency without the owner's yes (tests use Node built-ins only).
- Never read or commit room data (`.node-persist/`, `uploads/`).
- Run installs and tests in containers (TESTING.md), not on the owner's machine.
