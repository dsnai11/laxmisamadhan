# Laxmi Samadhan – Role-by-Role Tutorial Video Plan

Everything below is derived from the code: `backend/src/utils/permissions.ts`, `frontend/src/App.tsx`, `frontend/src/components/layout/Layout.tsx` and `backend/prisma/seed.ts`.

## 1. Series structure

| # | Video | Audience | Target length |
|---|-------|----------|---------------|
| 0 | Intro: what the portal is + how roles work | Everyone | 2 min |
| 1 | Getting started: login, MFA, profile, notifications | Everyone | 3 min |
| 2 | Raiser / Viewer | Employees | 4 min |
| 3 | Agent | Technicians | 6 min |
| 4 | Team Lead | Team leads | 5 min |
| 5 | Department Head | Dept heads | 6 min |
| 6 | Admin / Super Admin | IT admins | 8 min |
| 7 | Wrap-up: ticket lifecycle across all roles (one ticket, four people) | Everyone | 4 min |

Tip: record 0, 1 and 7 once; videos 2-6 are independent so each role can watch only their own.

## 2. Recording setup

1. Run the stack (`./deploy-lan.sh` or `docker-compose up -d --build`), then seed demo data: `docker exec ticket-portal-backend npx prisma db seed`.
2. Use these seeded demo accounts (one browser profile or incognito window per role):

| Role | Email | Password |
|------|-------|----------|
| Super Admin | `admin@ticketportal.local` | from backend log (`Temporary Password`) |
| Department Head | `hardware.head@ticketportal.local` (also software / security / ai) | `Head@123456` |
| Agent | `agent.hardware@ticketportal.local` (also software / security / ai) | `Agent@123456` |
| Raiser | `john.doe@company.com`, `jane.smith@company.com` | `User@123456` |

   **Gaps in the seed:** there is no seeded Team Lead, no Viewer and no plain Admin. Create them in video 6 (Admin → Users) or add them to `seed.ts` before recording. Check whether seeded passwords were changed in your environment.
3. Record at 1920×1080, browser zoom 110%, hide bookmarks. Use OBS or the built-in Windows/macOS recorder. Record the mobile app (Capacitor Android/iOS) separately for a short "on your phone" clip.
4. Use two windows side by side for hand-off moments (e.g. Raiser submits → Agent sees it appear in real time via WebSocket).

## 3. Role capability matrix (what each video must cover)

| Capability | Viewer | Raiser | Agent | Team Lead | Dept Head | Admin / Super Admin |
|---|:-:|:-:|:-:|:-:|:-:|:-:|
| Create ticket | – | ✔ | ✔ | ✔ | ✔ | ✔ |
| See tickets | own | own | own | team | department | all |
| Update tickets | – | own | own | team | department | any |
| Assign tickets | – | – | – | team | ✔ | ✔ |
| Close / resolve | – | – | ✔ | ✔ | ✔ | ✔ |
| Bulk actions | – | – | – | – | ✔ | ✔ |
| Delete ticket | – | – | – | – | – | ✔ |
| Comments | – | public | public + internal | public + internal | public + internal | public + internal |
| Knowledge base | read | read | read + write | read + write | read + write + publish | read + write + publish |
| Teams | – | – | – | manage own | manage | manage |
| Team bucket | – | – | ✔ (menu) | own team | ✔ | ✔ |
| Approvals | – | – | – | ✔ | ✔ | ✔ |
| SLA policies | – | – | view | view | manage | manage |
| Assets | – | – | view | view | manage | manage |
| Users | – | – | view | view | create/edit | full incl. delete + change role |
| Departments | – | – | – | – | manage categories | create / edit / delete |
| Reports | – | – | – | own team | department | all |
| Settings, Audit logs, Role permissions | – | – | – | – | – | ✔ |

Note: users may hold several roles (`roles[]`); the sidebar shows the union of menu items for all of them.

## 4. Video scripts

### Video 0 – Intro (2 min)
- **Show:** login screen, then a quick montage of each role's dashboard.
- **Say:** "Laxmi Samadhan is our IT ticketing portal for four departments: IT Hardware, IT Software, Digital Security and AI. What you can see and do depends on your role. Pick the video for your role."
- **Show:** Admin → Role Permissions page (the access matrix) as the visual summary.

### Video 1 – Getting started (3 min)
1. `/login` – sign in. Show **Register** (email verification via `/verify-email`) and **Forgot password** → reset link flow.
2. MFA: `/mfa-setup` – scan the QR with an authenticator app, save the backup codes.
3. Top bar: notification bell (real-time), user menu, theme toggle (dark/light).
4. Profile page (`/raiser/profile`): update details and change password.

### Video 2 – Raiser / Viewer (4 min)
Login as `john.doe@company.com`. Lands on `/raiser/dashboard`.
1. **Dashboard** – ticket counts and recent requests.
2. **Raise Ticket** – choose department and category (Incident, Service Request, Hardware Request, Software Request, …), priority, title, description, attachments, any department-specific custom fields. Show the **knowledge-base suggestions** that appear while typing (deflection widget) before submitting.
3. **My Tickets** – list, search/filter, open a ticket.
4. **Ticket detail** – status, SLA countdown, assigned agent card, comments, add a reply, upload a file. Show **Reopen ticket** after resolution, and **Cancel request** while pending.
5. **Knowledge Base** – search, read, rate an article.
6. **Viewer variant (30 s):** same screens, but read-only – no Raise Ticket button, no commenting.

### Video 3 – Agent (6 min)
Login as `agent.hardware@ticketportal.local`. Lands on `/agent/dashboard`.
1. **Dashboard** – assigned, due-soon, breached SLA widgets.
2. **Ticket Queue** – filters (status, priority, department); table vs. Kanban view; self-pick an unassigned ticket.
3. **My Assignments** – work list.
4. **Ticket detail** –
   - Change status: OPEN → DEPENDENCY_ON_CLIENT (SLA pauses) → RESOLVED, with resolution notes.
   - Public reply vs. **Internal note** (visible to staff only).
   - Macros (canned replies) via the macro selector.
   - AI Copilot panel for suggested replies/summaries.
   - Requester hover card, linked assets.
   - Request approval (e.g. purchase).
5. **Team Bucket** – see what the team is handling.
6. **Knowledge Base** – write/edit an article from a resolved ticket.
7. Remember: agents can also **Raise Ticket** and see **My Requests** like any employee.

### Video 4 – Team Lead (5 min)
Create a Team Lead user first (see §2). Everything in the Agent video, plus:
1. **Team-scoped visibility** – tickets for the whole team, not just own.
2. **Assign / reassign** within the team (Reassign Ticket dialog).
3. **Teams** page – manage own team members.
4. **Approvals** – approve / reject requests with a comment.
5. **SLA Policies** – view-only.
6. **Team reports** (report:own-team).
7. Close tickets on the team's behalf.

### Video 5 – Department Head (6 min)
Login as `hardware.head@ticketportal.local`. Lands on the admin-style dashboard (`/admin/dashboard`), scoped to their department.
1. **Dashboard & Reports** – department KPIs, SLA compliance, agent performance, ticket trend, CSV/JSON export.
2. **All Tickets** – department tickets; **bulk actions** (assign, change status/priority).
3. **Users** – create agents/raisers in the department, edit details (cannot change roles or delete).
4. **Teams** – create teams, add members, appoint a team lead.
5. **Department detail** – manage categories and custom ticket fields.
6. **SLA Policies** – create/edit response and resolution targets and escalation rules.
7. **Assets** – add hardware/software assets, assign to users.
8. **Knowledge Base** – approve and **publish** articles.
9. **Approvals** queue.
10. Not available (state clearly): Settings, Audit Logs, Role Permissions, deleting tickets/users/departments.

### Video 6 – Admin / Super Admin (8 min)
Login as `admin@ticketportal.local`.
1. **Dashboard** – organisation-wide view.
2. **Users** – create user, assign role (and additional roles), activate/suspend, reset access, delete. Open **User Detail** for sessions/activity.
3. **Departments** – create / edit / delete, assign head, categories.
4. **Role Permissions** – walk through the Full / Dept / Team / Own / None matrix.
5. **SLA Policies** and **Escalations**.
6. **Assets**, **Knowledge Bases** (all content).
7. **Reports** – all departments, export.
8. **Settings** – portal configuration, custom ticket fields, email (SMTP / inbound email simulator).
9. **Audit Logs** – filter by user/action; show a role change you just made appearing.
10. Super Admin vs Admin: both hold every permission in code, so present them together and mention Super Admin is the bootstrap account.

### Video 7 – One ticket, four people (4 min, split screen)
1. Raiser submits "Laptop not charging" → Agent sees it in the queue in real time.
2. Agent picks it up, asks for details (status → DEPENDENCY_ON_CLIENT, SLA paused).
3. Raiser replies → Agent requests approval for a replacement.
4. Team Lead / Dept Head approves.
5. Agent resolves → Raiser reopens or confirms → Admin checks the audit log and report.

## 5. Narration/format tips
- Open every video with "Logged in as <role>" and show the sidebar – the sidebar itself changes per role, which is the clearest teaching moment.
- Pause on each permission boundary (e.g. type `/admin/settings` as an Agent and show the redirect to `/unauthorized`).
- Add chapter markers matching the numbered steps above.
- Keep a "what you can't do" 15-second segment per role.

## 6. Next steps I can do for you
- Add Team Lead, Viewer and Admin demo accounts to `backend/prisma/seed.ts` so recording is repeatable.
- Automate the screen recording with Playwright (scripted logins and clicks per role → `.webm` clips), leaving only narration to add.
- Turn each script into a narration-only text file for text-to-speech, or into slides.
