// One entry per tutorial video. Each `run` is a sequence of narrated scenes.
// Videos run in order and share `state`, so the ticket the Raiser creates is
// the one the Agent, Team Lead and Department Head work on.
// Scene ids are positional (e.g. `03-agent-05`); keep i18n/*.json in step when
// adding, removing or reordering scenes.
import { ACCOUNTS } from './accounts.mjs';
import { call, login } from './lib/api.mjs';

const TICKET_TITLE = 'Wireless mouse not working';

// Field labels are plain text or wrapped in a <span> (followed by an optional required star).
const field = (page, label) =>
  page.locator(`div:has(> label.label:text-is("${label}")), div:has(> label.label > span:text-is("${label}"))`)
    .locator('input, select, textarea').first();
const modal = (page) => page.locator('.modal-overlay').last();
const replyBox = (page) => page.getByPlaceholder(/^Write (a reply|an internal note)/);
const sidebar = (page) => page.locator('nav[aria-label="Main navigation"]');

async function openOurTicket(d, state) {
  const link = d.page.locator('a, tr').filter({ hasText: TICKET_TITLE }).first();
  if (await link.isVisible().catch(() => false)) await d.click(link, { wait: 2000 });
  else if (state.ticketId) await d.goto(`/tickets/${state.ticketId}`);
}

async function selectOptionContaining(d, select, text) {
  // Options may load after the control appears (e.g. approvers), so wait for them.
  await select.locator('option', { hasText: text }).first().waitFor({ state: 'attached', timeout: 10000 });
  const label = await select.evaluate((el, t) => [...el.options].find((o) => o.text.includes(t))?.text, text);
  if (!label) throw new Error(`No option containing "${text}"`);
  await d.select(select, label);
}

export const videos = [
  {
    id: '01-raiser',
    title: 'Raiser',
    subtitle: 'Employees: raise and track IT requests',
    account: ACCOUNTS.raiser,
    badge: 'Logged in as <b>Raiser</b> · John Doe',
    async run(d, state) {
      const p = d.page;
      await d.scene('Welcome to Laxmi Samadhan, the IT service desk. This video is for employees, called Raisers, who report problems and request IT services.');
      await d.hideCard();
      await d.scene('Open the portal and sign in with your Employee ID and the default password given to you by IT.', () =>
        d.login({ ...this.account, password: this.account.defaultPassword }));
      await d.scene('The first time you sign in with a default or temporary password, you are taken to the Set Your Password page. You must set your own password before you can use the portal.', async () => {
        await d.show(p.getByText('Set Your Password').first(), 2000);
      });
      await d.scene('Enter the default password, then type your new password twice, and click Set New Password and Continue.', async () => {
        await d.type(p.getByPlaceholder('Enter your temporary password'), this.account.defaultPassword, { delay: 40 });
        await d.type(p.getByPlaceholder('At least 8 characters'), this.account.password, { delay: 40 });
        await d.type(p.getByPlaceholder('Repeat new password'), this.account.password, { delay: 40 });
        await d.click(p.getByRole('button', { name: /Set New Password/ }), { wait: 0 });
        await p.waitForURL((u) => !u.pathname.startsWith('/force-reset-password'), { timeout: 20000 });
      });
      await d.badge(this.badge);
      await d.scene('Your new password is saved and the portal opens. Use this new password every time you sign in from now on.');
      await d.scene('Your dashboard shows your total tickets, open tickets, overdue tickets, tickets waiting on you, and resolved tickets, along with the SLA status of each recent request.', async () => {
        await d.show(p.getByText('Recent Tickets').first());
      });
      await d.scene('Use the search bar at the top to find any of your tickets by number, title or keyword.', async () => {
        await d.show(p.getByPlaceholder(/Search tickets by ID/), 2000);
      });
      await d.scene('To report a problem, click Raise Ticket and choose the department. Every field marked with a red star is required.', async () => {
        await d.nav('Raise Ticket');
        await d.select(p.locator('select[name="departmentId"]'), 'IT Hardware');
      });
      await d.scene('Choose the category and the system or device involved.', async () => {
        await selectOptionContaining(d, p.locator('select[name="category"]'), 'Hardware');
        await selectOptionContaining(d, p.locator('select[name="subCategory"]'), 'Peripheral');
      });
      await d.scene('Give the ticket a short, clear title.', async () => {
        await d.type(p.locator('input[name="title"]'), TICKET_TITLE);
      });
      await d.scene('New: you can speak instead of typing. Choose Hindi or English, click Voice Type, and speak your description. Listen reads the text back to you.', async () => {
        await d.select(p.getByLabel('Dictation Language'), 'Hindi (हिंदी)');
        await d.show(p.getByRole('button', { name: 'Voice Type' }), 1200);
        await d.show(p.getByRole('button', { name: 'Listen' }), 800);
      });
      await d.scene('Of course, you can also type the description.', async () => {
        await d.type(p.locator('textarea[name="description"]'),
          'My wireless mouse stopped responding this morning. I replaced the battery but the cursor still does not move. Asset tag AFC4719.', { delay: 12 });
      });
      await d.scene('You can also record a voice message explaining the issue, and attach screenshots or documents. Then click Submit ticket.', async () => {
        await d.show(p.getByRole('button', { name: /Record Voice Message/ }), 1500);
        await d.click(p.getByRole('button', { name: 'Submit ticket' }), { wait: 2500 });
        const m = p.url().match(/tickets\/([0-9a-f-]{36})/);
        if (m) state.ticketId = m[1];
      });
      await d.scene('The ticket opens straight away, with its number, status, priority, and the SLA countdown that shows how much time is left to resolve it.', async () => {
        await d.show(p.locator('main').locator('h1, h2').first(), 2500);
      });
      await d.scene('Use the conversation box to reply to the support agent. You are notified by the bell icon and by email whenever someone replies.', async () => {
        await d.type(replyBox(p), 'The mouse is a Logitech M185. I can bring it to the IT desk if needed.', { delay: 14 });
        await d.click(p.getByRole('button', { name: 'Post reply' }), { wait: 1500 });
      });
      await d.scene('My Tickets lists everything you have raised. Filter by status, priority, category, or SLA, for example to see only overdue tickets, or switch to the Kanban board.', async () => {
        await d.nav('My Tickets');
        await d.show(p.locator('select').filter({ hasText: 'Overdue' }).first(), 1500);
      });
      await d.scene('When a ticket is resolved you will see the resolution note. If the problem comes back, open the ticket and click Reopen.');
      await d.scene('Before raising a ticket, try the Knowledge Base. It has step by step answers to common questions.', async () => {
        await d.nav('Knowledge Base');
        await d.click(p.getByText('Laptop Replacement Policy').first(), { wait: 2500 });
        await d.click(modal(p).getByRole('button', { name: 'Close' }).last(), { wait: 300 });
      });
      await d.scene('On your Profile page you can update your details and change your password. In the mobile app you can also set up Face ID, fingerprint, or a four digit PIN for quick login.', async () => {
        await d.nav('Profile');
        await d.show(p.getByText('Biometric & Quick PIN Login').first(), 2500);
      });
      await d.scene('The Laxmi Samadhan mobile app is also available for Android and iPhone.');
      await d.scene('That is everything a Raiser needs. Raise a ticket, keep the conversation going, and track it to resolution.');
    },
  },

  {
    id: '02-viewer',
    title: 'Viewer',
    subtitle: 'Read-only access',
    account: ACCOUNTS.viewer,
    badge: 'Logged in as <b>Viewer</b> · Vikram Viewer',
    async run(d) {
      const p = d.page;
      await d.scene('This short video covers the Viewer role, a read only account.');
      await d.hideCard();
      await d.scene('Viewers sign in with their Employee ID, like everyone else.', () => d.login(this.account));
      await d.badge(this.badge);
      await d.scene('A Viewer can see their own tickets and their status, but cannot create, update, or comment on tickets.', async () => {
        await d.show(p.getByText('Recent Tickets').first(), 2000);
      });
      await d.scene('Viewers can read every published article in the Knowledge Base.', async () => {
        await d.nav('Knowledge Base');
        await d.show(p.locator('main'), 1500);
      });
      await d.scene('If you need to raise tickets, ask an administrator to change your role to Raiser.');
    },
  },

  {
    id: '03-agent',
    title: 'Agent',
    subtitle: 'Technicians: work and resolve tickets',
    account: ACCOUNTS.agent,
    badge: 'Logged in as <b>Agent</b> · Hardware Agent',
    // Agents cannot self-assign, so route the new ticket to them the way a lead would.
    async prepare(state) {
      if (!state.ticketId) return;
      const { token } = await login(ACCOUNTS.deptHead);
      const { user } = await login(ACCOUNTS.agent);
      const { json } = await call('GET', `/departments/${user.departmentId}/teams`, token);
      const team = (json.data?.teams ?? json.data ?? []).find((t) => t.name === 'Desktop & Peripheral Support');
      await call('POST', `/tickets/${state.ticketId}/assign`, token, { assignedToId: user.id, teamId: team?.id });
    },
    async run(d, state) {
      const p = d.page;
      await d.scene('This video is for Agents, the technicians who pick up and resolve tickets.');
      await d.hideCard();
      await d.scene('Sign in with your Employee ID. You land on the Agent Dashboard.', () => d.login(this.account));
      await d.badge(this.badge);
      await d.scene('The dashboard shows your open tickets, tickets waiting on the user, tickets waiting on a vendor, reopened tickets, and how many you have resolved.', async () => {
        await d.show(p.getByText('Dependency on Vendor').first(), 1500).catch(() => {});
      });
      await d.scene('Below that are your most recent assignments, tickets pending with a vendor, and the unassigned queue for your department.', async () => {
        await d.show(p.getByText('My Active Assignments').first(), 1500).catch(() => {});
      });
      await d.scene('The Ticket Queue lists unassigned tickets in your department. You can filter by status, priority, category, and SLA. Your team lead or the routing rules assign tickets to agents.', async () => {
        await d.nav('Ticket Queue');
      });
      await d.scene('My Assignments lists the tickets assigned to you. John\'s mouse ticket has just been assigned to us, so let us open it.', async () => {
        await d.nav('My Assignments');
        await openOurTicket(d, state);
      });
      await d.scene('The ticket page shows the description, who raised it, the SLA policy and due times, and the requester\'s contact details.', async () => {
        await d.show(p.getByText('Ticket Raiser Contact Details').first(), 1500);
      });
      await d.scene('Reply to the requester in the conversation box. You can type, or use voice typing in Hindi or English. Agent Canned Macros on the right insert ready made replies.', async () => {
        await d.show(p.getByRole('button', { name: 'Voice Type' }).first(), 1000).catch(() => {});
        await d.type(replyBox(p), 'Thanks John. Please try the mouse on another USB port while I check spare stock.', { delay: 12 });
        await d.click(p.getByRole('button', { name: 'Post reply' }), { wait: 1500 });
      });
      await d.scene('Tick Internal note to leave a message only staff can see, such as findings, stock checks, or handover notes.', async () => {
        await d.click(p.getByText('Internal note (hidden from requester)'), { wait: 300 });
        await d.type(replyBox(p), 'Receiver likely faulty. Replacement needs team lead approval.', { delay: 12 });
        await d.click(p.getByRole('button', { name: 'Add note' }), { wait: 1500 });
      });
      await d.scene('The Enterprise AI Copilot can summarise the ticket, draft a reply in different tones, and suggest matching knowledge base articles.', async () => {
        await d.show(p.getByText('Enterprise AI Copilot').first(), 2000);
      });
      await d.scene('New Quick Status Actions change the status with one click. Dependency on User means you are waiting for the requester. Dependency on Vendor means you are waiting for a third party. Both pause the SLA clock.', async () => {
        await d.show(p.getByRole('button', { name: /Dep\. on User/ }), 1200);
        await d.click(p.getByRole('button', { name: /Dep\. on Vendor/ }), { wait: 1500 });
      });
      await d.scene('When something needs a manager\'s sign off, such as a replacement device, click Request approval. Only eligible approvers are listed.', async () => {
        await d.click(p.getByRole('button', { name: 'Request approval' }), { wait: 800 });
        const m = modal(p);
        await selectOptionContaining(d, field(m, 'Approver'), 'Tara');
        await d.type(field(m, 'What needs approval?'), 'Replace wireless mouse AFC4719');
        await d.type(field(m, 'Details'), 'Receiver is faulty. Issue a new Logitech M185 from spare stock.', { delay: 12 });
        await d.click(m.getByRole('button', { name: 'Send request' }), { wait: 1500 });
      });
      await d.scene('Once it is approved and the work is done, click Resolve and write a resolution note that the requester will see.', async () => {
        await d.show(p.getByRole('button', { name: /Resolve$/ }).first(), 1500).catch(() => {});
      });
      await d.scene('Agents can read and write Knowledge Base articles, so a fix you find once can help everyone. If an administrator grants you access, you will also see your team\'s Team Bucket.', async () => {
        await d.nav('Knowledge Base');
      });
      await d.scene('That is the Agent workflow: take a ticket, communicate, request approvals when needed, and resolve it within the SLA.');
    },
  },

  {
    id: '04-team-lead',
    title: 'Team Lead',
    subtitle: 'Oversee your team and approve requests',
    account: ACCOUNTS.teamLead,
    badge: 'Logged in as <b>Team Lead</b> · Tara Lead',
    async run(d, state) {
      const p = d.page;
      await d.scene('This video is for Team Leads. A Team Lead can do everything an Agent can, plus manage their own team.');
      await d.hideCard();
      await d.scene('Sign in with your Employee ID.', () => d.login(this.account));
      await d.badge(this.badge);
      await d.scene('Your menu adds Teams, Approvals, and SLA Policies to the agent tools.', async () => {
        await d.show(sidebar(p), 2500);
      });
      await d.scene('Team Bucket shows every ticket your team is working on, grouped by team member. You can filter by team and search tickets. Team Bucket is visible only to users an administrator has granted access to.', async () => {
        await d.nav('Team Bucket');
        await d.show(p.locator('main'), 1500);
      });
      await d.scene('Approvals lists requests waiting for your decision. Here is the agent\'s request to replace the mouse.', async () => {
        await d.nav('Approvals');
        await d.show(p.locator('main').getByText('Replace wireless mouse').first(), 1500).catch(() => {});
      });
      await d.scene('Open the ticket to see the full context, then click Approve or Reject and add an optional comment.', async () => {
        await openOurTicket(d, state);
        await d.click(p.getByRole('button', { name: 'Approve' }).first(), { wait: 800 });
        await d.type(field(modal(p), 'Comment (optional)'), 'Approved. Issue from spare stock.');
        await d.click(modal(p).getByRole('button', { name: 'Approve' }), { wait: 1500 });
      });
      await d.scene('New: if a ticket was raised in the wrong department, use Reassign department to transfer it. The SLA is recalculated for the new department.', async () => {
        await d.show(p.getByText('Reassign department').first(), 2500).catch(() => {});
      });
      await d.scene('Team leads can also reassign tickets within the team, add internal notes, and close tickets on the team\'s behalf.');
      await d.scene('On the Teams page you manage your own team: its members and support email.', async () => {
        await d.nav('Teams');
      });
      await d.scene('SLA Policies shows the response and resolution targets that apply to your department\'s tickets.', async () => {
        await d.nav('SLA Policies');
      });
      await d.scene('That is the Team Lead role: keep an eye on the bucket, unblock approvals quickly, and keep work balanced across the team.');
    },
  },

  {
    id: '05-department-head',
    title: 'Department Head',
    subtitle: 'Run your department',
    account: ACCOUNTS.deptHead,
    badge: 'Logged in as <b>Department Head</b> · Hardware Head',
    async run(d, state) {
      const p = d.page;
      await d.scene('This video is for Department Heads. You manage everything inside your own department: tickets, people, teams, SLAs, assets, and knowledge.');
      await d.hideCard();
      await d.scene('Sign in with your Employee ID, and you land on the department dashboard.', () => d.login(this.account));
      await d.badge(this.badge);
      await d.scene('The dashboard summarises your department: total and open tickets, SLA breaches, tickets by status and priority, and your busiest agents.', async () => {
        await d.show(p.getByText('Top Assignees').first(), 1500).catch(() => {});
      });
      await d.scene('New: the Management Dashboard gives a live view of SLA compliance, tickets resolved, mean resolution time, and SLA breaches, for any date range.', async () => {
        await d.nav('Management Dashboard');
        await d.click(p.getByRole('button', { name: 'Last 7 Days' }), { wait: 1200 }).catch(() => {});
      });
      await d.scene('Its tabs show trends over time, an SLA matrix for every agent, and department benchmarks. Click Export SLA Report to download the data as a spreadsheet.', async () => {
        await d.click(p.getByText(/Agent SLA Matrix/).first(), { wait: 1500 }).catch(() => {});
        await d.show(p.getByRole('button', { name: /Export SLA Report/ }), 1200).catch(() => {});
      });
      await d.scene('All Tickets is your service desk console. Switch between views, search, and use Pick Up, Assign, Merge, and Link to act on several tickets at once.', async () => {
        await d.nav('All Tickets');
        await d.click(p.getByText('My Open Requests').first(), { wait: 1200 }).catch(() => {});
      });
      await d.scene('Department heads can update any ticket in their department. Let us resolve the mouse ticket now that the replacement is approved.', async () => {
        if (state.ticketId) await d.goto(`/admin/tickets/${state.ticketId}`);
        await d.click(p.getByRole('button', { name: /Change Status/ }), { wait: 800 });
        await selectOptionContaining(d, modal(p).locator('select').first(), 'Resolved');
        await d.type(modal(p).getByPlaceholder(/Describe how the ticket was resolved/), 'Replaced the faulty wireless mouse with a new Logitech M185 from spare stock.', { delay: 12 });
        await d.click(modal(p).getByRole('button', { name: 'Update' }), { wait: 2000 });
      });
      await d.scene('Users lets you add people to your department and bulk import users from a sheet. Every Employee ID must be unique.', async () => {
        await d.nav('Users');
        await d.show(p.getByRole('button', { name: 'Bulk Import Users' }), 1200);
      });
      await d.scene('Teams lets you create teams, add members, appoint a team lead, and set up sub categories that route tickets to the right team.', async () => {
        await d.nav('Teams');
      });
      await d.scene('In SLA Policies you set response and resolution targets for your department, per priority.', async () => {
        await d.nav('SLA Policies');
      });
      await d.scene('New: each policy can escalate automatically on an SLA breach. Turn on Escalation Targets, then choose to reassign the ticket to a senior engineer, alert specific managers, or both.', async () => {
        await d.click(p.getByRole('button', { name: 'New policy' }), { wait: 800 });
        const m = modal(p);
        const toggle = m.getByText('Escalation Targets on SLA Breach');
        await toggle.scrollIntoViewIfNeeded();
        await d.click(m.locator('label:has(input.peer)').first(), { wait: 800 });
        await d.show(field(m, 'Escalation Action'), 1500);
        await d.click(m.getByRole('button', { name: 'Cancel' }), { wait: 500 });
      });
      await d.scene('Assets tracks laptops, monitors, licences and other equipment, who they are assigned to, and when warranties expire.', async () => {
        await d.nav('Assets');
      });
      await d.scene('In the Knowledge Base you write articles and publish them, so employees can solve common problems themselves. Reports shows SLA compliance, agent performance, and ticket trends.', async () => {
        await d.nav('Knowledge Base');
      });
      await d.scene('Settings, Audit Logs, and changing user roles are reserved for administrators. That completes the Department Head tour.');
    },
  },

  {
    id: '06-admin',
    title: 'Administrator',
    subtitle: 'Admin and Super Admin: configure the whole portal',
    account: ACCOUNTS.admin,
    badge: 'Logged in as <b>Super Admin</b>',
    async run(d) {
      const p = d.page;
      await d.scene('This final video is for Administrators and Super Admins, who have full access to every department and every setting.');
      await d.hideCard();
      await d.scene('Sign in with the administrator\'s Employee ID.', () => d.login(this.account));
      await d.badge(this.badge);
      await d.scene('The admin dashboard covers the whole organisation. The Management Dashboard gives leadership the same live SLA view across all departments.', async () => {
        await d.show(p.getByText('Tickets by Status').first(), 1500).catch(() => {});
      });
      await d.scene('To add a person, open Users and click Add user. Enter their name, email, and a unique Employee ID, which they will use to sign in.', async () => {
        await d.nav('Users');
        await d.click(p.getByRole('button', { name: 'Add user' }), { wait: 800 });
        const m = modal(p);
        await d.type(field(m, 'First name'), 'Priya');
        await d.type(field(m, 'Last name'), 'Sharma');
        await d.type(field(m, 'Email'), 'priya.sharma@company.com');
        await d.type(field(m, 'Employee / User ID (optional)'), 'LIF10500');
      });
      await d.scene('Tick one or more roles, choose a department, and set a temporary password. Then click Create user.', async () => {
        const m = modal(p);
        await d.click(m.locator('label').filter({ hasText: /^Agent$/ }), { wait: 300 });
        await d.select(field(m, 'Department'), 'IT Hardware');
        await d.type(field(m, 'Temporary password'), 'Welcome@2026');
        await d.click(m.getByRole('button', { name: 'Create user' }), { wait: 2000 });
      });
      await d.scene('New: Team Bucket access is controlled by the Super Admin. In the Team Bucket Access column, click Restricted to grant a user access, and click again to revoke it.', async () => {
        await d.show(p.getByText('Restricted (Click to Grant)').first(), 2500).catch(() => {});
      });
      await d.scene('On the Approvals page, administrators can switch between approvals assigned to them and all approvals across the organisation.', async () => {
        await d.nav('Approvals');
        await d.click(p.getByText('All Org Approvals').first(), { wait: 1500 }).catch(() => {});
      });
      await d.scene('Departments is where you add departments, assign department heads, and configure categories.', async () => {
        await d.nav('Departments');
      });
      await d.scene('In Settings you define custom ticket fields, and the Role Permissions page shows what every role can do.', async () => {
        await d.nav('Settings');
        await d.show(p.getByText('Custom Ticket Fields').first(), 1500);
      });
      await d.scene('Audit Logs records who did what and when, including the user we just created.', async () => {
        await d.nav('Audit Logs');
      });
      await d.scene('Emails sent to the support mailbox can also be turned into tickets automatically. Admin and Super Admin have the same permissions; the Super Admin is the first account created on installation.');
      await d.scene('That completes the Laxmi Samadhan tutorial series. Thank you for watching.');
    },
  },
];
