# Laxmi Samadhan — Handover Guide

Written 2026-11-16. For any developer, or any AI assistant/model (Claude, ChatGPT, Gemini, Copilot…), picking this project up.
**This is a LIVE production system** (https://laxmisamadhan.lifc.in). Read "Golden rules" first.

---

## 1. What this project is

An enterprise IT ticketing portal ("IT Ticketing Portal – Enterprise Edition") for LIFC.

- Departments: IT Hardware, IT Software, Digital Security, AI
- Roles: Super Admin, Admin, Dept Head, Team Lead, Agent, Raiser, Viewer
- Features: tickets + SLA tracking/escalation, approvals, knowledge base, assets, custom fields, reports, MFA, WebSocket notifications, email-to-ticket (IMAP inbound, per-department mailboxes), mobile apps (Capacitor Android/iOS)

| Part | Tech | Folder |
|------|------|--------|
| Backend API | Node.js, Express, TypeScript, Prisma, **PostgreSQL**, Socket.IO, Zod/express-validator, Winston | `backend/` |
| Frontend | React 18, TypeScript, Vite, Tailwind, React Query, Capacitor | `frontend/` |
| Deploy | `scripts/deploy.sh` (rsync+SSH to EC2), nginx (`laxmisamadhan.conf`), pm2 | repo root / `scripts/` |
| CI | GitHub Actions in `.github/workflows/` | |

Repo: https://github.com/dsnai11/laxmisamadhan (branch `main`).

---

## 2. Golden rules (read before touching anything)

1. **Production is live.** Never test destructive actions (delete, bulk update, schema changes) against the live site/database.
2. **Never commit secrets.** `.env*`, `*.pem`, `*.key`, `remote.env` are git-ignored — keep it that way. Never paste keys/passwords into chat, issues or commits.
3. **Pushing to `main` can trigger workflows.** Android/iOS builds and the web-deploy workflow run on pushes touching `frontend/**` / `backend/**`. Docs-only or empty commits do not trigger them (path filters).
4. **The real deploy tool is `scripts/deploy.sh`**, not the GitHub Action (see §6).
5. **Don't change `prisma/schema.prisma` casually.** There are no migrations; the DB is synced with `prisma db push`. Schema changes need an explicit backup + `--apply-schema` (§6).
6. Ask the owner before: pushing, deploying, rotating keys, changing DNS/nginx, touching the database.

---

## 3. Run it locally (Windows / macOS / Linux)

### Prerequisites
- Node.js 20+ (Node 24 works), npm
- PostgreSQL 14+ on `localhost:5432` (or Docker Desktop and use `docker-compose.yml`)
- pnpm for the frontend: `npx -y pnpm@9 …` (no global install needed)
- Redis is **not required** (only referenced in config, not used)

### Backend
```bash
cd backend
cp .env.example .env          # then edit values (DATABASE_URL, JWT secrets, ENCRYPTION_KEY…)
npm install
npx prisma generate
npx prisma db push            # creates tables (there is no migrations folder)
npm run prisma:seed           # demo users/departments/SLA data (local only!)
npm run dev                   # API on http://localhost:3000/api/v1, WebSocket on 3001
```
Health check: `curl http://localhost:3000/health`

Local DB default in `.env.example`: `postgresql://postgres:password@localhost:5432/ticket_portal`.
No PostgreSQL? Create an empty DB `ticket_portal` any way you like (installer, Docker, `embedded-postgres` npm package).

### Frontend
```bash
cd frontend
npx -y pnpm@9 install --ignore-workspace     # IMPORTANT: use pnpm
VITE_API_URL=http://localhost:3000/api/v1 VITE_WS_URL=http://localhost:3001 npx vite --port 5173
```
Open http://localhost:5173.

PowerShell equivalent:
```powershell
$env:VITE_API_URL="http://localhost:3000/api/v1"; $env:VITE_WS_URL="http://localhost:3001"; npx vite --port 5173
```

### Seed logins (LOCAL database only — they do not exist on production)
`john.doe@company.com / User@123456` (raiser), `agent.hardware@ticketportal.local / Agent@123456`,
`security.head@ticketportal.local / Head@123456`. Full list is printed at the end of `npm run prisma:seed`.
Change/remove these before ever seeding any shared environment.

### Point the local frontend at the LIVE server (use with care)
```bash
VITE_API_URL=https://laxmisamadhan.lifc.in/api/v1 VITE_WS_URL=https://laxmisamadhan.lifc.in npx vite --port 5173
```
The live API allows `http://localhost:5173` via CORS. Everything you do there changes **real data**.

### Docker option
`docker-compose.yml` starts postgres, redis, backend, frontend. `deploy-lan.ps1` / `deploy-lan.sh` are for a LAN/on-prem install (see README.md). Copy `.env.production.example` → `.env.production` first.

---

## 4. Known quirks / gotchas (save yourself hours)

| Problem | Cause | Fix |
|---------|-------|-----|
| `vite` not found / `node_modules/.bin` missing after `npm install` in `frontend/` | `frontend/package-lock.json` is incomplete | Use **pnpm** (`npx -y pnpm@9 install --ignore-workspace`). Don't commit lockfile changes unless intended. |
| Frontend calls go to the wrong port | `vite.config.ts` proxies `/api` to **3001** and serves on **8003**; local backend API is on **3000** (production backend listens on 3001 behind nginx) | Pass `VITE_API_URL` explicitly as above, or run vite with `--port 5173` |
| Login CORS error locally | Backend `FRONTEND_URL` is `http://localhost:5173` | Run frontend on port 5173 |
| Your real account doesn't work locally | Local DB is a fresh seed, real users live only in the production DB | Create a local user, or point the frontend at live (see above) |
| `prisma migrate` fails | No `prisma/migrations` folder | Use `prisma db push` |
| SSH to EC2 times out from office Wi-Fi | Port 22 is blocked on the office network | Use a mobile hotspot |
| Android CI build fails | Needs secrets `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD` | Add them in GitHub → Settings → Secrets → Actions |
| Backend `tsc` shows ~14 errors | Pre-existing; production runs via `tsx` (no type-check) | Deploy script only blocks if the count goes **above** `TSC_BASELINE` in `scripts/deploy.sh`; lower it as errors are fixed |

---

## 5. Everyday workflow (regular updates)

```bash
git pull --ff-only                      # always start up to date
git checkout -b feature/short-name      # optional but recommended for anything non-trivial

# … edit code …

cd backend  && npx vitest run           # backend tests
cd ../frontend && npx -y pnpm@9 exec vitest run   # frontend tests

git add <specific files>                # avoid `git add .` (could include .env etc.)
git commit -m "fix(area): what and why"
git push origin <branch>                # then open a PR, or push main if the owner agrees
```
Commit style used in history: `feat(...)`, `fix(...)`, `chore(...)`, `test:`.
Always `git status` before committing — confirm no `.env`, `.pem`, `node_modules`, logs.

---

## 6. Deploying to production (AWS EC2)

Server: Ubuntu on EC2 `65.2.215.48`, app dir `/var/www/laxmisamadhan` (**not a git clone**), backend runs under **pm2** as `ticket-backend` (port 3001), nginx serves `frontend/dist` and proxies `/api` + `/socket.io`.

### The supported way: `scripts/deploy.sh`
Run from Git Bash / WSL / macOS / Linux, with the SSH key at `<repo>/laxmisamadhan.pem` (git-ignored — ask the owner for it; or set `EC2_KEY=/path/to/key`).

```bash
scripts/deploy.sh status                       # health + what's deployed
scripts/deploy.sh backend  --dry-run           # preview
scripts/deploy.sh backend                      # deploy backend
scripts/deploy.sh frontend                     # deploy frontend (builds with pnpm)
scripts/deploy.sh all                          # backend then frontend
scripts/deploy.sh backups                      # list server-side backups
scripts/deploy.sh rollback backend|frontend [BACKUP_NAME]
scripts/deploy.sh ssh                          # shell on the server
```
What it does for you: refuses uncommitted changes (unless `--allow-dirty`), runs the unit tests (aborts on failure), type-checks against a baseline, backs up what it replaces, rsyncs files, `pm2 reload`s, smoke-tests the site, auto-rolls back an unhealthy backend, keeps the last 10 backups.
Schema change? It stops and requires `--apply-schema`, which takes a `pg_dump` first and runs `prisma db push` (aborts on data loss).

### The GitHub Action (`.github/workflows/deploy-web.yml`)
It SSHes in only if secret `EC2_SSH_KEY` exists (optional `EC2_HOST`, `EC2_USER`). Because the server folder is not a git repo, its `git pull` step is skipped, so **it effectively only restarts pm2 and reloads nginx — it does not ship new code.** Treat `scripts/deploy.sh` as the real deploy. (Improvement idea: make the Action call the same steps as `deploy.sh`.)

### Nginx
`laxmisamadhan.conf` in the repo mirrors the live config (synced from the server). Edit here, copy to `/etc/nginx/sites-available/`, then `sudo nginx -t && sudo systemctl reload nginx`.

### After every deploy — verify
1. `scripts/deploy.sh status`
2. Open https://laxmisamadhan.lifc.in → log in → open a ticket
3. `scripts/deploy.sh ssh` → `pm2 logs ticket-backend --lines 50 --nostream`

---

## 7. Configuration (environment variables)

Never commit real values. Templates: `backend/.env.example`, `.env.production.example`.

Key backend variables: `DATABASE_URL`, `PORT`, `API_PREFIX`, `FRONTEND_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET` (+ expiries), `ENCRYPTION_KEY`, `SMTP_*`, `EMAIL_FROM`, `MFA_ISSUER`, `UPLOAD_DIR`, `MAX_FILE_SIZE`, `RATE_LIMIT_*`, `LOG_*`, `WS_PORT`; inbound-mail (IMAP) settings per department — see `backend/src/services/inboundEmail.service.ts` and `mailPoller.service.ts`.
Frontend (build-time): `VITE_API_URL`, `VITE_WS_URL`.
Production secrets live only on the EC2 server (backend `.env`) — the previous VAPT remediation made secrets **fail-closed** (the app refuses to start with weak/default secrets).

---

## 8. Where things live (code map)

- `backend/src/index.ts` — entry; `routes/` → `controllers/` → `services/` (business logic) → Prisma
- `backend/src/services/`: `ticket`, `sla`, `escalation` (hierarchical Agent → Team Lead → Dept Head), `auth`, `user`, `inboundEmail` / `mailPoller` (email-to-ticket), `notification`, `websocket`, `report`, `knowledge`, `asset`, `approval`, `customField`, `macro`, `ai`
- `backend/prisma/schema.prisma` — the whole data model; `seed.ts`, `seed_sla_policies.sql`
- `backend/src/__tests__/`, `frontend/src/utils/*.test.ts` — vitest unit tests (deploy is gated on them)
- `frontend/src/` — `pages/`, `components/`, `context/` (Auth, Socket), `services/api.ts` (API base URL logic), `utils/`
- `frontend/android`, `frontend/ios`, `capacitor.config.ts` — mobile wrappers (CI builds APK/AAB/IPA; mobile builds talk to the production API)
- `docs/IT_Hardware_Software_SLA_Master.md` — SLA business rules
- `convert_users.py` — one-off user import helper

---

## 9. Working with different AI models / assistants

Paste this section at the start of any new AI session on this repo.

> You are working on **Laxmi Samadhan**, a LIVE production IT-ticketing app (Node/Express/Prisma/PostgreSQL backend in `backend/`, React/Vite frontend in `frontend/`). Read `HANDOVER.md` fully before acting.
> Rules: (1) make the smallest change that solves the request; (2) never read, print, commit, or send secrets (`.env*`, `*.pem`, tokens); (3) never push, deploy, run `prisma db push`, or touch the production server/DB unless the owner explicitly says so in that message; (4) run the relevant vitest tests before proposing a commit; (5) use `pnpm` for the frontend, `npm` for the backend; (6) prefer `git add <file>` over `git add .`; (7) tell the owner exactly what changed and what was *not* verified.

Tips for good results with any model:
- Give it one task at a time and the exact file/page/ticket involved; paste the real error text.
- Ask it to explain the plan first for anything touching auth, SLA, escalation, schema, or deploy scripts.
- Models differ in how they handle Windows vs bash: this repo's scripts target **bash** (Git Bash/WSL on Windows). PowerShell is fine for git and npm.
- After any AI-made change, review `git diff` yourself before committing.
- Keep this file updated — if you (or an AI) discover a new gotcha, add a row to §4.

---

## 10. Suggested improvements / backlog

- Make the GitHub Action deploy via the same logic as `scripts/deploy.sh` (today it does not ship code), after adding `EC2_SSH_KEY` secret.
- Add real Prisma migrations instead of `db push`.
- Complete/replace `frontend/package-lock.json` (or delete it and standardise on pnpm).
- Fix the remaining backend TypeScript errors and lower `TSC_BASELINE` to 0.
- Align `vite.config.ts` proxy/port with the actual backend port for local dev.
- Add the Android signing secrets so the mobile build goes green.
- Add automated DB backups on the server and document restore steps.

---

## 11. Quick reference

| Item | Value |
|------|-------|
| Live site | https://laxmisamadhan.lifc.in |
| GitHub | https://github.com/dsnai11/laxmisamadhan |
| EC2 host / user | `65.2.215.48` / `ubuntu` |
| App dir on server | `/var/www/laxmisamadhan` |
| pm2 app | `ticket-backend` |
| Local ports | frontend 5173, API 3000, WebSocket 3001, Postgres 5432 |
| Deploy | `scripts/deploy.sh status|backend|frontend|all|rollback` |
