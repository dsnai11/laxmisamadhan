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
    departmentId: hardware.id, temporaryPassword: account.password, sendWelcomeEmail: false,
  });
  if (created.status >= 300) throw new Error(`Creating ${account.email}: ${JSON.stringify(created.json)}`);
  console.log(`Created ${role} ${account.email}`);
  return created.json.data?.user ?? created.json.data;
}

const lead = await ensureUser(ACCOUNTS.teamLead, 'TEAM_LEAD', 'Tara', 'Lead');
await ensureUser(ACCOUNTS.viewer, 'VIEWER', 'Vikram', 'Viewer');

const { json: teamRes } = await call('GET', `/departments/${hardware.id}/teams`, token);
const team = (teamRes.data?.teams ?? teamRes.data ?? [])[0];
if (team) {
  const { user: agent } = await login(ACCOUNTS.agent);
  const memberIds = [...new Set([...(team.members ?? []).map((m) => m.id), lead.id, agent.id])];
  const upd = await call('PATCH', `/departments/${hardware.id}/teams/${team.id}`, token, { leadId: lead.id, memberIds });
  console.log(`Team "${team.name}" lead set: HTTP ${upd.status}`);
}
// The admin video creates this user; remove it so the video can be re-recorded.
const { json: priyaRes } = await call('GET', '/users?search=priya.sharma', token);
for (const u of priyaRes.data?.users ?? priyaRes.data ?? []) {
  if (u.email === 'priya.sharma@company.com') await call('DELETE', `/users/${u.id}`, token);
}
console.log('Setup complete');
