# hosh.it box contract — what an app must look like to deploy first try

Snapshot of the owner's box standard (source of truth: private `hosh-migration/11-BOX-STANDARD.md`).
Public-safe: no secrets, no internal security details. If this copy and the template disagree,
ask the owner. Last synced: 2026-10-31 (dependency updates, Decision #18).

## The box in one paragraph
One Debian 12 VPS (4 vCPU, 15 GiB RAM, IP 54.37.70.57), Docker 29 + compose v2. A single **edge
Traefik v3.3** runs in host network and terminates TLS for every site (ACME resolver **`le`**,
entrypoint **`websecure`**, global HTTP→HTTPS redirect). It routes with its **file provider only**:
apps do **not** use Traefik docker labels (the docker provider is unavailable until the edge moves
to ≥ v3.7). Each app is a compose project **published on a loopback port** `127.0.0.1:<PORT>` and
gets one Traefik route file. Intrusion detection reads Traefik's access log, so apps don't need
their own. Secrets live in a mode-600 env file next to the compose file on the box, never in git.

## The app MUST
1. **Ship as one image** `ghcr.io/pazka/<app>` built by GitHub Actions (CI on `main`: tests →
   build → **Trivy CRITICAL gate** (fixable) → hardened container smoke → push `:ci`, `:<sha>`;
   release on tag `vX.Y.Z` or manual dispatch: same gate → `:vX.Y.Z`, `:X.Y`, `:latest` + GitHub
   release). Templates: `.github/workflows/ci.yml`, `release.yml`.
2. **Run hardened, unchanged**: non-root (uid **10001**), `read_only: true` rootfs with tmpfs `/tmp`,
   `cap_drop: [ALL]`, `no-new-privileges`, `pids_limit 128`, `mem_limit 512m` (raise with a reason).
   Nothing written outside `/data` and `/tmp`.
3. **Keep all state in one named volume at `/data`** (DB, uploads, generated secrets). The box backs
   up `/var/lib/docker/volumes` monthly. Prefer SQLite (WAL) over a separate DB container.
4. **Listen on plain HTTP, one port (8000 by convention)** inside the container. TLS, HSTS and
   HTTP→HTTPS are done by Traefik. WebSockets work through Traefik without extra config.
5. **Expose `GET /healthz`** (and `HEAD`) → `200` JSON `{"status":"ok", …}` that proves the app
   actually works (e.g. DB reachable, row counts), not just that the process is up. The compose
   healthcheck and the box's deploy runner (`hosh-deploy`) both use it.
6. **Be configured only by env vars** from `<app>.env` (one file for compose interpolation and the
   container). `.env.example` is committed, has **box defaults that work unchanged**, and lists
   the owner-provided secrets on a `# required:` line. Secrets the app can generate itself (signing
   keys, salts) are generated once into `/data/.secrets/` (0600).
7. **Trust `X-Forwarded-For` only from proxies** (`127.0.0.0/8`, `::1`, `172.16.0.0/12`). Traefik
   reaches the container through Docker's port proxy, so the peer IP is a 172.x gateway.
8. **Log JSON lines to stdout** (no raw client IPs unless needed; hash them).
9. **Never need the agent to see a secret.** Admin credentials etc. are produced by an
   interactive owner-run script (e.g. `scripts/set-admin.sh`: hidden prompt → hash written into
   the env file).
10. **Deploy only through the box runner `hosh-deploy`.** Ship from the template, rendered for this
    app: `deploy/hosh-deploy.conf` (service, image, env var holding the tag, host, port, health path,
    optional `POST_DEPLOY` smoke run *inside* the container as a plain argv: no shell, so no pipes,
    quotes or `$VARS`), `deploy/traefik-route.yml.tmpl`,
    `.github/workflows/deploy.yml` and the `deploy` job of `release.yml`, `DEPLOY.md`. Every release
    is deployed by GitHub over SSH with a key bound to this app: the box pulls the tag, verifies it
    (healthy, loopback + HTTPS `/healthz`, router, `POST_DEPLOY`) and **rolls back by itself** on
    failure. The box owns compose/env/route: `hosh-deploy register` validates the hardening of
    rule 2 once and refuses root users, writable rootfs, privileged, host network/pid/ipc,
    devices, bind mounts and non-loopback ports. No repo script ever runs on the host.
11. **Prove full capability, not a 200.** `DEPLOY.md` lists the checks that prove each feature works
    (API shape, a write round-trip, websocket echo …). The on-box session turns them into the box's
    smoke harness.
12. **Keep the supply chain minimal and locked.** Prefer the language's standard library and
    first-party packages; **every new third-party dependency needs the owner's explicit yes** (name
    it, say why, wait). Commit a frozen lockfile, require a minimum release age of ≥ 7 days, never
    allow dependency install scripts, pin exact versions and base-image digests, and give Dependabot
    a cooldown. **Keep the template's Dependabot setup** (`.github/dependabot.yml`, add your stack's
    ecosystem; `workflows/dependabot-merge.yml` + `scripts/dependabot-merge.sh` unchanged): tested
    minor/patch updates merge themselves, majors wait for the owner. Your CI must run the full suite
    on pull requests and accept `workflow_dispatch`. Run the app with least privilege at runtime: only the outbound hosts, paths and env
    vars it needs (e.g. Deno `--allow-net=<hosts>` / `--allow-read` / `--allow-env=<vars>`, never
    `--allow-run`/`--allow-ffi`), and list them in `DEPLOY.md` together with any remaining
    exfiltration route. Ask for read-only tokens. Code is executed only in your sandbox and in
    GitHub Actions, never on the box.
13. **Node apps: an LTS line only (target 26), never below the patched minimum.** Pin
    `node:26.x.y-<variant>@sha256:…` (or `gcr.io/distroless/nodejs26-debian13:nonroot@sha256:…`), keep
    `scripts/check-node-version.sh` and its CI/release step (it fails the build on an EOL or unpatched
    Node before anything is pushed; Trivy does not reliably flag the Node binary). Minimums today:
    22.23.4 / 24.22.1 / 26.12.1; they rise with each Node security release.

## The app SHOULD
- Serve everything from its own origin (no CDN/fonts/analytics), with a strict CSP.
- Answer `HEAD` like `GET`. Return 404 for dotfiles (`/.env`, `/.git`); the edge already blocks them.
- Keep one worker/process unless it really needs more (the box is shared by ~20 services).
- Name things after the app everywhere: container `<app>`, volume `<app>-data`, router `<app>`,
  env file `<app>.env`, checkout `/srv/<app>`.

## Given by the owner (don't guess)
- Subdomain `<app>.hosh.it` (DNS A → 54.37.70.57, created before deploy).
- Loopback port `127.0.0.1:<PORT>` from the box's port registry.
- Repo `github.com/pazka/<app>`; who runs the deploy (an on-box Claude session, never the builder).
