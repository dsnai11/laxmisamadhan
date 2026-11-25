# Laxmi Samadhan — Handover Guide

Written 2026-11-16, last updated 2026-11-16 (evening). For any developer, or any AI assistant/model (Claude, ChatGPT, Gemini, Copilot…), picking this project up.
**This is a LIVE production system** (https://laxmisamadhan.lifc.in). Read "Golden rules" first.

---

## 1. What this project is

An enterprise IT ticketing portal ("IT Ticketing Portal – Enterprise Edition") for LIFC.

- Departments on production: **IT Application**, **IT Hardware/Software**, **Digital Security and AI** (seed data uses IT Hardware / IT Software / Digital Security / AI)
- Roles: Super Admin, Admin, Dept Head, Team Lead, Agent, Raiser, Viewer
- Features: tickets + SLA tracking/escalation, approvals, knowledge base, assets, custom fields, reports, MFA, WebSocket live updates, email-to-ticket (one IMAP mailbox per department), resolver credit, image shrinking + upload progress, mobile apps (Capacitor Android/iOS)

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
7. **Never run `backend/src/scripts/*` against production.** On 2026-11-13 a test script (`test_sla_breach_ansul.ts`) ran the escalation job twice on the live DB and pushed five real tickets Agent → Team Lead → Dept Head in one second. That script now refuses to run in production; treat every other script the same way.
8. **Every bug fix gets a regression test** that fails on the old behaviour. Several bugs here came back because a fix only patched one screen. Put the rule in a small tested function (see §5a) and use it everywhere.
9. **Others push to `main` too.** Always `git pull --rebase` before pushing; never `--force`.

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
| SSH works on the hotspot but sometimes times out | The mobile network occasionally routes via a path that blocks port 22 (public IP changes) | Wait ~20 s and retry; check `curl https://api.ipify.org` |
| Live updates (WebSocket) error "timeout" in the browser console | Production port 3001 is **not** reachable from outside | Web builds must connect to the site origin (`/socket.io/` is proxied by nginx). Don't set `VITE_WS_URL` to `:3001` for production builds; `scripts/deploy.sh` builds without it on purpose. Rule: `frontend/src/utils/socketUrl.ts` |
| Attachment upload fails with 413 | nginx `client_max_body_size 25M` | The browser now blocks >25 MB with a clear message (`frontend/src/utils/upload.ts`). Raise both nginx and `MAX_FILE_SIZE` together if the limit must change |
| Attachment upload fails with "Uploaded file could not be processed" | Upload route and `addAttachment` disagreeing on memory vs disk storage (happened 13–16 Nov) | Uploads stream to `backend/upload-tmp/` (outside the public `uploads/`), then get type-checked and moved. A test fails if the route goes back to memory storage |
| WebP images rejected | Production `ALLOWED_MIME_TYPES` doesn't include `image/webp` | The browser shrinks large images to **JPEG**. Add `image/webp` to the server env if WebP must be accepted |
| Users still see an old version after a frontend deploy | Browsers cached `index.html` | nginx now sends `Cache-Control: no-cache` for `index.html` (`expires -1` in `location /`). Hashed `/assets/` keep long caching |
| An old reset-password link opens the login page | That URL was cached before the no-cache fix | Reset emails link to `/reset-password?v=2#token=…`; just request a new link |

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

## 5a. Business rules (each one is locked in by unit tests)

Change these only in the listed place, and update its tests in the same commit.

| Rule | Where | Tests |
|------|-------|-------|
| **Who is shown on a ticket.** Agents/team leads/assignee see the **raiser** on the top card; the raiser sees the **assigned agent**. Auto-assignments are never shown as "assigned by" the raiser or the agent. Resolved tickets show "Resolved by X · previously assigned to Y". | `frontend/src/utils/ticketContacts.ts` | `ticketContacts.test.ts` |
| **Who may assign / reassign.** Only Super Admin, Admin, the ticket's department head and that department's team leads (Team Lead role in the department, or lead of any team in it). The new assignee must be in the ticket's department (to move it elsewhere, transfer it). Assignment only goes through `POST /tickets/:id/assign`; the general edit request refuses `assignedToId`/`teamId`. **Transfer** (forwarding a wrongly raised ticket to another department; on the agent ticket page under *Reassign department*, and on the admin ticket page as *Transfer to another department…*) is allowed for the same group. The shared dialog (`TransferTicketDialog.tsx`) asks for **department → team → person (optional)**: with a person the ticket is assigned straight to them; with a team only it is auto-assigned within that team; with neither it is auto-assigned in the department (if auto-assign is on). The team must belong to the target department and the person to that team or department (`validateTransferTarget`). The new department's head and the chosen person are notified. Which screens show these buttons uses the same rule: `canManageAssignment()`. | `canReassignTicket()` / `canTransferTicket()` / `assigneeBelongsToDepartment()` in `ticket.service.ts`; UI: `frontend/src/utils/assignmentRights.ts` | `reassign_rights.test.ts`, `assignmentRights.test.ts` |
| **Auto-assignments are recorded as system actions** (`assignedById = null`, history `isSystem = true`). | `resolveAssignmentActor()` in `ticket.service.ts` | `assignment_actor.test.ts` |
| **Resolver credit.** Whoever resolves a ticket is stored as `resolvedById`. If that's a staff member other than the assignee (e.g. a teammate covering from the team bucket), the ticket is **reassigned to the resolver** and the old assignee is notified. Reopening clears `resolvedById`. Reports count resolved tickets for `resolvedById` (falling back to the assignee for old tickets). | `resolutionCredit()` in `ticket.service.ts`; `creditedResolverId()` in `report.service.ts` | `resolution_credit.test.ts` |
| **SLA breach.** The response deadline counts only while nobody has responded; after that only the resolution deadline counts. Assigning a ticket is **not** a response (the first public staff reply or staff status change is). | `slaBreachedWhere` / `slaStateAt` in `sla.service.ts` | `sla_breach_rules.test.ts` |
| **SLA pause (all departments).** While a ticket is *Dependency on Client* or *Dependency on Vendor* the SLA clock is stopped (`slaStatus = PAUSED`, `slaPausedAt` set): it is never marked breached or escalated. When it goes back to Open (status change, the raiser's reply or an email reply) the deadlines move later by the waiting time. A breach that happened before the pause stays. Every status change goes through `slaPauseTransition` (directly or via `setTicketStatusWithSla`). | `sla.service.ts` | `sla_pause.test.ts` |
| **"Manage users" right (create + delete user IDs).** A per-user switch (`User.canManageUsers`, default off) that only Super Admin can grant or revoke (Users page → *Manage Users Right* column; changes are logged). A holder, whatever their role, gets the Users page and may create and delete **Raiser, Agent and Viewer** accounts in any department — never Team Lead, Department Head, Admin or Super Admin accounts, never their own. Without the switch nothing changes: delete stays Super Admin / Admin. The switch can only be set through the Super-Admin-only update, never at user creation. | `utils/userAccess.ts` (`assertCanAssignRole`, `assertCanDeleteUser`), `requireRoleOrRight` in `auth.middleware.ts`; `utils/userManagement.ts` | `manage_users_right.test.ts`, `userManagement.test.ts` |
| **Ticket attachments can be added but not deleted.** Anyone with access to a ticket can add files; only Super Admin / Admin can remove one (the uploader cannot remove their own). The API refuses everyone else with 403 and the Remove button is hidden for them. Files are evidence while resolving the ticket. | `canDeleteAttachment` in `ticket.service.ts`; `utils/attachmentRights.ts` | `attachment_delete.test.ts`, `attachmentRights.test.ts` |
| **SLA working hours (all departments).** The SLA clock only runs Mon–Sat 09:45–18:45 IST; it stops every evening, on Sundays, on 2nd Saturdays and on a policy's listed holidays, and resumes at 09:45 on the next working day. Deadlines (`calculateSLATimes`), resume-after-pause, escalation age and the 2-hour dept-head grace all use working minutes. Computed in explicit IST, so the server's UTC clock doesn't matter. The frontend countdown uses an identical copy (a test fails if the two drift). | `utils/workingHours.ts` (backend + frontend) | `working_hours.test.ts`, `workingHours.test.ts` |
| **Escalation.** Runs every 10 min. L1 (unassigned > 30 min) notifies the dept head **once**; L2 (approaching breach) bumps priority **once**; on breach: Agent → **team lead** (the `leadId` on the agent's team) → dept head, with a **2-hour grace** for the team lead (`DEPT_HEAD_GRACE_MINUTES`). Paused tickets are never escalated. Tags like `ESCALATED_L1` mark a step as done. | `escalation.service.ts` | `escalation_repeat.test.ts` |
| **Ticket numbers are never reused.** One counter per prefix+year in the `TicketSequence` table, which only goes up. It started after the highest number ever issued (including deleted tickets, found in the activity log). | `generateTicketNumber()` in `ticket.service.ts` | `ticket_numbering.test.ts` |
| **Login & forgot password by employee code** (e.g. `1234`, `LIF1234`, `01234`, or the email). Exact matches only, and only when **exactly one** account matches. No "ends with" matching. | `findUserByIdentifier()` in `auth.service.ts` | `forgot_password_lookup.test.ts` |
| **Email-to-ticket.** Each department has its own mailbox (its *Inbound Support Email*). Every minute the server reads mail newer than its saved UID (read/unread flags are ignored). First run only records a baseline, so old mail is never ticketed. Skips bounces/auto-replies, the system's own addresses and non-company domains. Tickets go through the normal `createTicket` path (SLA, team routing, auto-assign). A reply quoting a ticket number becomes a comment only if the sender is involved (raiser, assignee, watcher or staff). | `inboundRules.ts`, `inboundEmail.service.ts`, `mailPoller.service.ts` | `inbound_email.test.ts` |
| **Attachments.** Large photos (>1 MB or >2560 px) are resized in the browser to 1920 px JPEG before upload. The 25 MB limit is checked after shrinking. Progress is shown. | `frontend/src/utils/imageCompress.ts`, `upload.ts` | `imageCompress.test.ts`, `upload.test.ts`, `attachment_upload.test.ts` |
| **Branding.** Only Laxmi India Finance / Laxmi Samadhan. A test fails if another company's name or template placeholders ("Aavas", "TicketPortal", "Acme"…) appear in app code. | — | `frontend/src/branding.test.ts` |

`scripts/deploy.sh` and the GitHub **Tests** workflow (`.github/workflows/test.yml`) run all of these. Don't deploy on a red test.

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
`laxmisamadhan.conf` in the repo mirrors the live config (synced from the server). Edit here, copy to `/etc/nginx/sites-available/`, then `sudo nginx -t && sudo systemctl reload nginx`. Never put `add_header` inside `location /`: it would drop the server-level HSTS / X-Frame-Options headers (`expires` is fine).

### Changing production data (deleting tickets, reassigning, fixing records)
1. Show the owner the exact list first, and get a clear yes.
2. Take a DB dump: `sudo -u postgres pg_dump ticket_portal | gzip > /var/www/laxmisamadhan/backups/db_before_<what>_$(date +%Y%m%d_%H%M%S).sql.gz`, then check it with `gunzip -t`.
3. Run the change as **one SQL transaction** with a guard that aborts unless the expected row count matches.
4. Write a history row (`TicketUpdate`) and an `ActivityLog` entry for anything users will see, and append a line to `/var/www/laxmisamadhan/DEPLOY_LOG`.
5. Verify afterwards (counts, and that unrelated recent tickets are untouched).

### After every deploy — verify
1. `scripts/deploy.sh status`
2. Open https://laxmisamadhan.lifc.in → log in → open a ticket
3. `scripts/deploy.sh ssh` → `pm2 logs ticket-backend --lines 50 --nostream`

---

## 7. Configuration (environment variables)

Never commit real values. Templates: `backend/.env.example`, `.env.production.example`.

Key backend variables: `DATABASE_URL`, `PORT`, `API_PREFIX`, `FRONTEND_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET` (+ expiries), `ENCRYPTION_KEY`, `SMTP_*`, `EMAIL_FROM`, `MFA_ISSUER` (production: "Laxmi Samadhan"), `UPLOAD_DIR`, `MAX_FILE_SIZE`, `RATE_LIMIT_*`, `LOG_*`, `WS_PORT`.
**Email-to-ticket mailboxes are configured in the app, not in `.env`:** Admin → Departments → *department* → "Email-to-ticket mailbox" (Super Admin/Admin only). Enter the mailbox password, **Test connection**, tick **Enabled**, then **Save mailbox**. The password is stored AES-encrypted in the `DepartmentMailbox` table and never shown again. The old shared inbox is no longer polled.
Frontend (build-time): `VITE_API_URL`, `VITE_WS_URL`.
Production secrets live only on the EC2 server (backend `.env`) — the previous VAPT remediation made secrets **fail-closed** (the app refuses to start with weak/default secrets).

---

## 8. Where things live (code map)

- `backend/src/index.ts` — entry; `routes/` → `controllers/` → `services/` (business logic) → Prisma
- `backend/src/services/`: `ticket`, `sla`, `escalation` (hierarchical Agent → Team Lead → Dept Head), `auth`, `user`, `inboundEmail` / `inboundRules` / `mailPoller` (email-to-ticket), `notification`, `websocket`, `report`, `knowledge`, `asset`, `approval`, `customField`, `macro`, `ai`
- `backend/src/controllers/mailbox.controller.ts`: department mailbox API (`/departments/:id/mailbox`, `…/test`, `…/check-now`; password write-only)
- Notable tables: `DepartmentMailbox` (encrypted IMAP credentials + UID cursor), `TicketSequence` (ticket-number counters), `Ticket.resolvedById`
- `frontend/src/utils/`: `ticketContacts.ts` (who is shown), `imageCompress.ts` + `upload.ts` (attachments), `socketUrl.ts` (live updates URL)
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
- ~~Automated DB backups~~ done: nightly 02:00 (root cron → `scripts/backup_db.sh`, 14-day retention in `/var/backups/laxmisamadhan`). Still to do: copy them off the server (e.g. S3), and document restore steps.
- Close public port 3001 in the EC2 Security Group (the backend only needs nginx).
- Turn on email-to-ticket for each department that has a support address (Admin → Departments).
- The published KB article "Security Incident Reporting Guide" still has placeholder contacts (security email / hotline). Replace them with the real ones.
- The Agent Performance report lists only Agent/Team Lead roles; dept heads and admins who resolve tickets appear on the Management Dashboard instead.
- Add `image/webp` to the server's `ALLOWED_MIME_TYPES` if WebP uploads are wanted.

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
| Deploy / DB backups (server) | `/var/www/laxmisamadhan/backups` (made by deploy.sh and before data changes), nightly DB dumps in `/var/backups/laxmisamadhan` |
| Change log on server | `/var/www/laxmisamadhan/DEPLOY_LOG` |
| Unit tests | backend `npx vitest run` (~104), frontend `npx -y pnpm@9 exec vitest run` (~42) |
