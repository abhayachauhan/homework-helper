# Homework Helper — Deploy Implementation Plan (3 of 3)

> **For agentic workers:** This plan is operational (Docker + Proxmox LXC + Cloudflare Tunnel), not TDD. Steps use checkbox (`- [ ]`) syntax. Several steps **require the user** (interactive `claude login`, Cloudflare account/DNS, Proxmox host access, Claude credit) — these are marked **[NEEDS USER]**.

**Goal:** Package the app as one Docker image (built `web` SPA served by the `api`), run it via Docker Compose inside a Debian LXC on Proxmox, expose it over HTTPS with a Cloudflare Tunnel, and confirm it works end-to-end from a phone — including the first real-model smoke test.

**Architecture:** Multi-stage Dockerfile → single runtime image (`node:20-slim` + the `claude` CLI for OAuth). Compose mounts a `claude-auth` named volume (persists `~/.claude` login) and a `./data` bind mount (SQLite). **No `ANTHROPIC_API_KEY`** is ever passed — billing routes to the Max subscription's Agent SDK bucket; the startup guard enforces this. Cloudflare Tunnel (existing `cloudflared` LXC 105) routes a public hostname → the container's `:8080`.

**Tech Stack:** Docker, Docker Compose, Proxmox `pct`, Cloudflare Tunnel, `@anthropic-ai/claude-code` (the CLI the Agent SDK authenticates through).

**Spec:** `docs/superpowers/specs/2026-06-13-homework-helper-design.md` · **Proxmox access:** host `pve` at `192.168.7.253` (root SSH; client must be on `192.168.7.x` — see the `proxmox-access` memory).

## Load-bearing layout fact
The built API resolves the SPA at `join(dirname(index.js), "..", "..", "web", "dist")`. So in the image the API must live at `/app/api/dist/index.js` and the SPA at `/app/web/dist` (then `../../web/dist` from `/app/api/dist` = `/app/web/dist`). The Dockerfile below places them exactly there. **Do not flatten this.**

---

## File Structure (new files, all at repo root)

```
Dockerfile           multi-stage: web build → api build → runtime (+ claude CLI)
.dockerignore        keep node_modules / dist / data / .git out of build context
docker-compose.yml   one service; claude-auth volume; ./data bind; no ANTHROPIC_API_KEY
Makefile             build / login / up / down / logs / update
.env.example         documents PORT / HH_DAILY_CAP (no secrets)
```

---

## Task 1: Dockerfile + .dockerignore

**Files:** Create `Dockerfile`, `.dockerignore`.

- [ ] **Step 1: `.dockerignore`**

```
**/node_modules
**/dist
data
.git
.superpowers
*.log
*.tsbuildinfo
docs
pm
.env
.env.*
```

- [ ] **Step 2: `Dockerfile`**

```dockerfile
# syntax=docker/dockerfile:1

# ---- 1) Build the web SPA (Vite) ----
FROM node:20-slim AS web
WORKDIR /web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
RUN npm run build            # -> /web/dist

# ---- 2) Build the api (tsc) ----
FROM node:20-slim AS api-build
WORKDIR /api
COPY api/package.json api/package-lock.json ./
RUN npm ci
COPY api/ ./
RUN npm run build            # -> /api/dist

# ---- 3) Runtime ----
FROM node:20-slim AS runtime
# Toolchain so `npm ci` can compile better-sqlite3 + sharp native bindings.
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
# Production deps only, compiled for this image, under /app/api.
WORKDIR /app/api
COPY api/package.json api/package-lock.json ./
RUN npm ci --omit=dev
# The Agent SDK authenticates through the claude CLI's OAuth creds (~/.claude).
RUN npm i -g @anthropic-ai/claude-code
# Built api + the static SPA, positioned so ../../web/dist resolves from /app/api/dist.
COPY --from=api-build /api/dist ./dist
COPY --from=web /web/dist /app/web/dist
# Data dir for the SQLite bind mount; run unprivileged.
RUN mkdir -p /app/data && chown -R node:node /app
WORKDIR /app
USER node
ENV PORT=8080 HH_DB_PATH=/app/data/homework.db
EXPOSE 8080
CMD ["node", "api/dist/index.js"]
```

- [ ] **Step 3: Commit**

```bash
cd /Users/abhayachauhan/kids && git add Dockerfile .dockerignore && git -c user.name="abhayachauhan" -c user.email="abhaya@meandu.com" commit -m "feat(deploy): multi-stage Dockerfile (+ dockerignore)"
```

---

## Task 2: docker-compose.yml

**Files:** Create `docker-compose.yml`.

- [ ] **Step 1: `docker-compose.yml`**

```yaml
services:
  app:
    build: .
    image: homework-helper:latest
    container_name: homework-helper
    restart: unless-stopped
    ports:
      - "8080:8080"
    environment:
      PORT: "8080"
      HH_DB_PATH: "/app/data/homework.db"
      HH_DAILY_CAP: "${HH_DAILY_CAP:-50}"
      # NOTE: ANTHROPIC_API_KEY is deliberately NEVER set — billing must route to the
      # Max subscription via the Agent SDK; the app's startup guard refuses to boot if
      # it sees this var.
    volumes:
      - claude-auth:/home/node/.claude   # persists `claude login` across rebuilds
      - ./data:/app/data                 # SQLite (host-owned)

volumes:
  claude-auth:
```

- [ ] **Step 2: Commit**

```bash
cd /Users/abhayachauhan/kids && git add docker-compose.yml && git -c user.name="abhayachauhan" -c user.email="abhaya@meandu.com" commit -m "feat(deploy): docker-compose (no ANTHROPIC_API_KEY; claude-auth + data volumes)"
```

---

## Task 3: Makefile + .env.example

**Files:** Create `Makefile`, `.env.example`.

- [ ] **Step 1: `.env.example`**

```
# Optional overrides for docker-compose. Copy to .env to use. NO SECRETS HERE.
HH_DAILY_CAP=50
```

- [ ] **Step 2: `Makefile`** (use TAB indentation for recipes)

```makefile
.PHONY: build login up down logs update smoke

build:
	docker compose build

# Interactive one-time Claude login; writes OAuth creds to the claude-auth volume.
login:
	docker compose run --rm app claude login

up:
	docker compose up -d

down:
	docker compose down

logs:
	docker compose logs -f --tail=100

# Pull latest, rebuild, restart.
update:
	git pull --ff-only
	docker compose build
	docker compose up -d

# Local sanity check that the app is serving (after `up`).
smoke:
	curl -fsS localhost:8080/api/profiles && echo "  <- profiles OK"
```

- [ ] **Step 3: Commit**

```bash
cd /Users/abhayachauhan/kids && git add Makefile .env.example && git -c user.name="abhayachauhan" -c user.email="abhaya@meandu.com" commit -m "feat(deploy): make targets (build/login/up/down/logs/update/smoke)"
```

---

## Task 4: Build & smoke-test locally (on the Mac, via Docker/OrbStack) — **[NEEDS USER for `claude login` + credit]**

This is the first real-model run (folds in Plan 1's deferred Task 8). Do it locally before touching Proxmox.

- [ ] **Step 1: Confirm Docker is available** — `docker version`. (OrbStack provides it.)

- [ ] **Step 2: Build the image** — `cd /Users/abhayachauhan/kids && make build`. Expect a successful multi-stage build; the runtime stage compiles `better-sqlite3` + `sharp` and installs the `claude` CLI.

- [ ] **Step 3: One-time Claude login [NEEDS USER]** — `make login`. This runs `claude login` interactively in a throwaway container; the user completes the browser auth. Creds persist in the `claude-auth` volume. **Ensure `ANTHROPIC_API_KEY` is unset in the shell** (`echo $ANTHROPIC_API_KEY` should be empty) — the container won't receive it regardless, but keep the host clean.

- [ ] **Step 4: Start it** — `make up`, then `make smoke`. Expect `[{"id":"jai",...}]  <- profiles OK`. Also open `http://localhost:8080/` in a browser → the SPA loads (kid picker).

- [ ] **Step 5: LIVE tutoring smoke test [NEEDS USER — spends a few cents]**

```bash
curl -fsS localhost:8080/api/submit -H 'content-type: application/json' \
  -d '{"profileId":"keeran","text":"Question: 5/6 - 1/3 = ?  My answer: 4/3"}' | python3 -m json.tool
```
Expect JSON `{id, result}` where the incorrect item has exactly 3 hints (nudge/concept/worked_example), none containing `1/2`, and a non-null `solution` that *does* contain `1/2`. Then in the browser: pick Keeran → type the same → walk the hint reveal + the gated "show me" solution + a 🔊 button.

- [ ] **Step 6: Verify the billing guard path** — confirm the logs show no API-key warning and the call succeeded on the subscription:
`docker compose logs --tail=50 app`. (If it instead refused to boot citing `ANTHROPIC_API_KEY`, unset it and rebuild — that's the guard working.)

- [ ] **Step 7: If the Agent SDK could not authenticate** (e.g. it shells to `claude` and the creds/Path differ in-container): capture the error, then verify how `@anthropic-ai/claude-agent-sdk@0.1.77` locates credentials (it uses the `claude` CLI / `~/.claude`). Adjust the Dockerfile (e.g. ensure the CLI is on PATH for user `node`, or set `CLAUDE_CONFIG_DIR`) and rebuild. Commit any fix:
```bash
git add Dockerfile && git -c user.name="abhayachauhan" -c user.email="abhaya@meandu.com" commit -m "fix(deploy): ensure Agent SDK finds claude OAuth creds in-container"
```

- [ ] **Step 8: Tear down local** — `make down`. (The `claude-auth` volume persists; `./data/homework.db` remains on the host — gitignored.)

---

## Task 5: Provision the Debian LXC on Proxmox — **[NEEDS USER: host access]**

Run from a machine that can reach `192.168.7.253` (must be on `192.168.7.x` per the `proxmox-access` memory), as root via SSH, OR from the Proxmox shell. Adjust `CTID`, storage, and bridge to your host.

- [ ] **Step 1: Pick an unused container id + confirm a Debian template exists**

```bash
ssh root@192.168.7.253 'pveam available | grep debian-12 ; pct list'
# If no debian-12 template is downloaded:
ssh root@192.168.7.253 'pveam update && pveam download local debian-12-standard_*_amd64.tar.zst'
```

- [ ] **Step 2: Create an unprivileged LXC with nesting + keyctl (required for Docker)**

```bash
ssh root@192.168.7.253 'pct create 120 local:vztmpl/debian-12-standard_12.7-1_amd64.tar.zst \
  --hostname homework-helper \
  --cores 2 --memory 2048 --swap 512 \
  --rootfs local-lvm:8 \
  --net0 name=eth0,bridge=vmbr0,ip=dhcp \
  --features nesting=1,keyctl=1 \
  --unprivileged 1 \
  --onboot 1'
ssh root@192.168.7.253 'pct start 120 && sleep 5 && pct exec 120 -- ip -4 addr show eth0 | grep inet'
```
Note the container's IP (call it `<CT_IP>`). Verify the template filename matches what Step 1 downloaded.

- [ ] **Step 3: Install Docker inside the LXC**

```bash
ssh root@192.168.7.253 'pct exec 120 -- bash -lc "apt-get update && apt-get install -y ca-certificates curl git && install -m0755 -d /etc/apt/keyrings && curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc && chmod a+r /etc/apt/keyrings/docker.asc && echo deb [arch=amd64 signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian bookworm stable > /etc/apt/sources.list.d/docker.list && apt-get update && apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin"'
ssh root@192.168.7.253 'pct exec 120 -- docker run --rm hello-world'
```
Expect the `hello-world` success message (confirms Docker-in-LXC nesting works).

---

## Task 6: Deploy the app into the LXC — **[NEEDS USER: `claude login`]**

- [ ] **Step 1: Get the code onto the container** (public repo — clone directly)

```bash
ssh root@192.168.7.253 'pct exec 120 -- bash -lc "cd /opt && git clone https://github.com/abhayachauhan/homework-helper.git && cd homework-helper && git rev-parse --short HEAD"'
```

- [ ] **Step 2: Fix the `./data` ownership gotcha (unprivileged LXC)** — the container runs the app as UID 1000 (`node`); in an unprivileged LXC that maps to host UID 101000. Create + chown the bind dir so SQLite can write:

```bash
ssh root@192.168.7.253 'pct exec 120 -- bash -lc "mkdir -p /opt/homework-helper/data && chown -R 1000:1000 /opt/homework-helper/data"'
```
(Inside the container, UID 1000 is correct; the userns remap to 101000 is handled by Proxmox automatically.)

- [ ] **Step 3: Build** — `ssh root@192.168.7.253 'pct exec 120 -- bash -lc "cd /opt/homework-helper && docker compose build"'`. Expect success (native deps compile inside the build).

- [ ] **Step 4: Claude login [NEEDS USER]** — must be interactive; use a real TTY:

```bash
ssh -t root@192.168.7.253 'pct exec 120 -- bash -lc "cd /opt/homework-helper && docker compose run --rm app claude login"'
```
Complete the browser auth. Creds land in the `claude-auth` volume.

- [ ] **Step 5: Start + verify locally on the container**

```bash
ssh root@192.168.7.253 'pct exec 120 -- bash -lc "cd /opt/homework-helper && docker compose up -d && sleep 3 && curl -fsS localhost:8080/api/profiles"'
```
Expect the profiles JSON. If it fails, `docker compose logs --tail=80 app` and resolve (most likely the `claude` auth path — see Task 4 Step 7).

---

## Task 7: Expose via Cloudflare Tunnel — **[NEEDS USER: Cloudflare account + DNS]**

The existing `cloudflared` runs as Proxmox LXC 105. Add an ingress rule routing a public hostname → `http://<CT_IP>:8080`.

- [ ] **Step 1: Choose the hostname** (e.g. `homework.<your-domain>`) on a zone managed in the user's Cloudflare account.

- [ ] **Step 2: Add the ingress route.** If `cloudflared` uses a config file (LXC 105, typically `/etc/cloudflared/config.yml`):

```yaml
# add under `ingress:` — BEFORE the catch-all `- service: http_status:404`
  - hostname: homework.example.com
    service: http://<CT_IP>:8080
```
Then route DNS + restart:
```bash
ssh root@192.168.7.253 'pct exec 105 -- bash -lc "cloudflared tunnel route dns <TUNNEL_NAME> homework.example.com && systemctl restart cloudflared"'
```
(If the tunnel is managed from the Cloudflare Zero Trust dashboard instead, add the Public Hostname there: `homework.example.com` → `http://<CT_IP>:8080`. **[NEEDS USER in dashboard]**.)

- [ ] **Step 3: Verify HTTPS reachability** — from any network (cellular included):
`curl -fsS https://homework.example.com/api/profiles` → profiles JSON. Camera capture requires HTTPS; the tunnel provides it.

---

## Task 8: End-to-end verification from a phone — **[NEEDS USER]**

- [ ] **Step 1:** On a kid's phone, open `https://homework.example.com/`.
- [ ] **Step 2:** Pick a kid → 📸 take a photo of a real homework page → confirm results, status badges, the per-item transcription, hint reveal gating, the gated "show me" solution, and 🔊 read-aloud (test on the actual phones — iOS Safari voice quality varies).
- [ ] **Step 3:** Try ⌨️ type input and the History list.
- [ ] **Step 4:** Confirm the daily cap message appears after the configured number of submissions (or trust the unit test and skip).
- [ ] **Step 5:** Set autostart so it survives reboots: the LXC has `--onboot 1` (Task 5) and compose has `restart: unless-stopped` — verify with `ssh root@192.168.7.253 'pct exec 120 -- bash -lc "cd /opt/homework-helper && docker compose ps"'` after a container reboot.

---

## Operating notes
- **Update flow:** `cd /opt/homework-helper && make update` inside the LXC (git pull + rebuild + restart). The `claude-auth` volume and `./data` survive.
- **Re-login:** if Claude auth expires, re-run Task 6 Step 4.
- **Backups:** the only state is `/opt/homework-helper/data/homework.db` — back it up if history matters.
- **Costs:** every photo/type submission is one Sonnet call on the Max bucket; the `HH_DAILY_CAP` (default 50/day) is the backstop against a leaked URL.

## Self-Review (completed by author)
**Spec coverage:** Docker Compose in a Debian LXC w/ nesting ✓; multi-stage Dockerfile (web build → api build → runtime + claude CLI) ✓; `claude-auth` volume + `./data` bind ✓; **no `ANTHROPIC_API_KEY`** + startup guard ✓; Cloudflare Tunnel HTTPS (camera) ✓; the deferred live smoke test ✓ (Task 4 local + Task 8 phone); the `./data` chown gotcha ✓; Makefile targets ✓.
**Placeholder scan:** concrete commands throughout; user-specific values (`<CT_IP>`, hostname, `<TUNNEL_NAME>`, CTID 120, storage `local-lvm`) are clearly marked to substitute — not vague TODOs.
**Layout consistency:** the runtime image places api at `/app/api/dist` and SPA at `/app/web/dist`, satisfying the API's hardcoded `../../web/dist` resolution; `HH_DB_PATH=/app/data/homework.db` matches the bind mount. No contradictions with the built backend.
**Open risks:** (1) Agent SDK ↔ `claude` CLI credential discovery in-container (Task 4 Step 7 mitigates); (2) exact Debian template filename/storage names vary per host (flagged to substitute); (3) Cloudflare tunnel may be file- or dashboard-managed (both paths given).
