// Prepares demo data the seed doesn't include: a Team Lead and a Viewer
// account, with the Team Lead leading the IT Hardware support team.
// Safe to run more than once.
import { ACCOUNTS } from './accounts.mjs';
import { call, login } from './lib/api.mjs';

const { token } = await login(ACCOUNTS.admin);

const { json: deptRes } = await call('GET', '/departments', token);
const departments = deptRes.data?.departments ?? deptRes.data ?? [];
const hardware = departments.find((d) => d.name === 'IT Hardware');
if (!hardware) throw new Error('IT Hardware department not found - did you run the seed?');

async function ensureUser(account, role, firstName, lastName) {
  const { json } = await call('GET', `/users?search=${encodeURIComponent(account.email)}`, token);
  const users = json.data?.users ?? json.data ?? [];
  const existing = users.find((u) => u.email === account.email);
  if (existing) return existing;
  const created = await call('POST', '/users', token, {
    email: account.email, firstName, lastName, role,
    departmentId: hardware.id, temporaryPassword: `Tmp-${account.password}`, sendWelcomeEmail: false,
  });
  if (created.status >= 300) throw new Error(`Creating ${account.email}: ${JSON.stringify(created.json)}`);
  // New accounts must replace their temporary password on first login; do that
  // here so only the Raiser video shows the forced reset.
  const { token: own } = await login({ email: account.email, password: `Tmp-${account.password}` });
  await call('POST', '/auth/force-reset-password', own, { currentPassword: `Tmp-${account.password}`, newPassword: account.password });
  console.log(`Created ${role} ${account.email}`);
  return created.json.data?.user ?? created.json.data;
}

const lead = await ensureUser(ACCOUNTS.teamLead, 'TEAM_LEAD', 'Tara', 'Lead');
await ensureUser(ACCOUNTS.viewer, 'VIEWER', 'Vikram', 'Viewer');

// Team Bucket filters by team, so the demo ticket is routed to a team that the
// Team Lead leads. Create it through the API (the seeded team's id is not a UUID,
// which the assignment endpoint requires).
const TEAM_NAME = 'Desktop & Peripheral Support';
const { user: agent } = await login(ACCOUNTS.agent);
const { json: teamRes } = await call('GET', `/departments/${hardware.id}/teams`, token);
let team = (teamRes.data?.teams ?? teamRes.data ?? []).find((t) => t.name === TEAM_NAME);
const teamBody = { name: TEAM_NAME, description: 'Laptops, desktops, mice, keyboards and printers', leadId: lead.id, memberIds: [lead.id, agent.id] };
const teamUpd = team
  ? await call('PATCH', `/departments/${hardware.id}/teams/${team.id}`, token, teamBody)
  : await call('POST', `/departments/${hardware.id}/teams`, token, teamBody);
team = team ?? teamUpd.json.data;
console.log(`Team "${TEAM_NAME}" ready: HTTP ${teamUpd.status}`);

// Sign-in is by Employee ID, so give every demo account one.
async function findUser(email) {
  const { json } = await call('GET', `/users?search=${encodeURIComponent(email)}`, token);
  return (json.data?.users ?? json.data ?? []).find((u) => u.email === email);
}
for (const account of Object.values(ACCOUNTS)) {
  const u = await findUser(account.email);
  if (u && u.employeeId !== account.employeeId) await call('PATCH', `/users/${u.id}`, token, { employeeId: account.employeeId });
}

// The Team Lead video shows Team Bucket, which needs access granted by a Super Admin.
await call('PATCH', `/users/${lead.id}`, token, { canViewTeamBucket: true });

// The Raiser video starts from the default password an admin gives new users,
// which forces a password reset on first login.
const raiser = await findUser(ACCOUNTS.raiser.email);
if (raiser) await call('POST', `/users/${raiser.id}/reset-password`, token, { password: ACCOUNTS.raiser.defaultPassword });

// The admin video creates this user; remove it so the video can be re-recorded.
const { json: priyaRes } = await call('GET', '/users?search=priya.sharma', token);
for (const u of priyaRes.data?.users ?? priyaRes.data ?? []) {
  if (u.email === 'priya.sharma@company.com') await call('DELETE', `/users/${u.id}`, token);
}
console.log('Setup complete');
