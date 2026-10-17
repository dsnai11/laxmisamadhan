// One entry per tutorial video. Each `run` is a sequence of narrated scenes.
// Videos run in order and share `state`, so the ticket the Raiser creates is
// the one the Agent, Team Lead and Department Head work on.
import { ACCOUNTS } from './accounts.mjs';
import { call, login } from './lib/api.mjs';

const TICKET_TITLE = 'Wireless mouse not working';

const field = (page, label) =>
  page.locator(`div:has(> label.label:text-is("${label}"))`).locator('input, select, textarea').first();
const modal = (page) => page.locator('.modal-overlay').last();
const replyBox = (page) => page.getByPlaceholder(/^Write (a reply|an internal note)/);

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
      await d.scene('Welcome to Laxmi Samadhan, the I T service desk. This video is for employees, called Raisers, who report problems and request I T services.');
      await d.hideCard();
      await d.scene('Open the portal and sign in with your corporate email address and password.', () => d.login(this.account));
      await d.badge(this.badge);
      await d.scene('Your dashboard shows how many tickets you have open, which ones are waiting on you, and your most recent requests.', async () => {
        await d.show(p.getByText('Recent Tickets').first());
      });
      await d.scene('The menu on the left lists everything you can do: raise a ticket, follow your tickets, search the knowledge base, and manage your profile.', async () => {
        await d.show(p.locator('nav[aria-label="Main navigation"]'), 2500);
      });
      await d.scene('To report a problem, click Raise Ticket, then choose the department that should handle it. Here, I T Hardware.', async () => {
        await d.nav('Raise Ticket');
        await d.select(p.locator('select[name="departmentId"]'), 'IT Hardware');
      });
      await d.scene('Pick a category and, if it applies, the system or device involved.', async () => {
        await d.select(p.locator('select[name="category"]'), 'Hardware Request');
        await selectOptionContaining(d, p.locator('select[name="subCategory"]'), 'Peripheral').catch(() => {});
      });
      await d.scene('Give the ticket a short, clear title, and describe what happened and what you expected.', async () => {
        await d.type(p.locator('input[name="title"]'), TICKET_TITLE);
        await d.type(p.locator('textarea[name="description"]'),
          'My wireless mouse stopped responding this morning. I replaced the battery but the cursor still does not move. Asset tag AFC4719.', { delay: 12 });
      });
      await d.scene('You can attach screenshots or documents if they help. Then click Submit ticket.', async () => {
        await d.show(p.getByText('Attachments (Optional)'), 1200);
        await d.click(p.getByRole('button', { name: 'Submit ticket' }), { wait: 2500 });
        const m = p.url().match(/tickets\/([0-9a-f-]{36})/);
        if (m) state.ticketId = m[1];
      });
      await d.scene('The ticket opens straight away. You can see its number, status, priority, and the S L A badge, which tells you whether it is on track to be resolved in time.', async () => {
        await d.show(p.locator('main').locator('h1, h2').first(), 2500);
      });
      await d.scene('Use the conversation box to add information or answer questions from the support agent. You are notified by the bell icon and by email when someone replies.', async () => {
        await d.type(replyBox(p), 'The mouse is a Logitech M185. I can bring it to the IT desk if needed.', { delay: 14 });
        await d.click(p.getByRole('button', { name: 'Post reply' }), { wait: 1500 });
        await d.show(p.locator('header button').filter({ has: p.locator('svg') }).nth(2), 1200).catch(() => {});
      });
      await d.scene('My Tickets lists everything you have raised. Filter by status, priority or category, or switch to the Kanban board view.', async () => {
        await d.nav('My Tickets');
        await d.show(p.getByText('Kanban Board').first(), 1500);
      });
      await d.scene('When a ticket is resolved you will see the resolution note. If the problem comes back, open the ticket and click Reopen.');
      await d.scene('Before raising a ticket, try the Knowledge Base. It has step by step answers to common questions.', async () => {
        await d.nav('Knowledge Base');
        await d.click(p.getByText('Laptop Replacement Policy').first(), { wait: 2500 });
        await d.click(modal(p).getByRole('button', { name: 'Close' }).last(), { wait: 300 });
      });
      await d.scene('Finally, on your Profile page you can update your details, change your password, and turn on two factor authentication for extra security.', async () => {
        await d.nav('Profile');
        await d.show(p.getByText('Two-factor authentication').first(), 2000);
      });
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
      await d.scene('Viewers sign in the same way as everyone else.', () => d.login(this.account));
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
      await call('POST', `/tickets/${state.ticketId}/assign`, token, { assignedToId: user.id });
    },
    async run(d, state) {
      const p = d.page;
      await d.scene('This video is for Agents, the technicians who pick up and resolve tickets.');
      await d.hideCard();
      await d.scene('Sign in with your agent account. You land on the Agent Dashboard.', () => d.login(this.account));
      await d.badge(this.badge);
      await d.scene('The dashboard shows your queue at a glance: open tickets, tickets waiting on the client, reopened tickets, and what you resolved today.', async () => {
        await d.show(p.getByText('My Assignments').nth(1), 1500).catch(() => {});
      });
      await d.scene('The Ticket Queue shows unassigned tickets in your department, with filters and a Kanban board view. Your team lead or the routing rules assign them to agents.', async () => {
        await d.nav('Ticket Queue');
      });
      await d.scene('My Assignments lists the tickets assigned to you. The mouse ticket John raised has just been assigned to us, so let us open it.', async () => {
        await d.nav('My Assignments');
        await openOurTicket(d, state);
      });
      await d.scene('The ticket page shows the description, who raised it, the S L A policy and due times, and the requester\'s contact details.', async () => {
        await d.show(p.getByText('Ticket Raiser Contact Details').first(), 1500);
      });
      await d.scene('Reply to the requester in the conversation box. Agent Canned Macros on the right insert ready made replies with one click.', async () => {
        await d.show(p.getByText('Agent Canned Macros').first(), 1200);
        await d.type(replyBox(p), 'Thanks John. Please try the mouse on another USB port while I check spare stock.', { delay: 12 });
        await d.click(p.getByRole('button', { name: 'Post reply' }), { wait: 1500 });
      });
      await d.scene('Tick Internal note to leave a message only staff can see. Use it for findings, stock checks, or handover notes.', async () => {
        await d.click(p.getByText('Internal note (hidden from requester)'), { wait: 300 });
        await d.type(replyBox(p), 'Receiver likely faulty. Replacement needs team lead approval.', { delay: 12 });
        await d.click(p.getByRole('button', { name: 'Add note' }), { wait: 1500 });
      });
      await d.scene('The Enterprise A I Copilot can summarise the ticket, draft a reply in different tones, and suggest matching knowledge base articles.', async () => {
        await d.show(p.getByText('Enterprise AI Copilot').first(), 2000);
      });
      await d.scene('When something needs a manager\'s sign off, such as a replacement device, click Request approval and choose the approver.', async () => {
        await d.click(p.getByRole('button', { name: 'Request approval' }), { wait: 800 });
        const m = modal(p);
        await selectOptionContaining(d, field(m, 'Approver'), 'Tara');
        await d.type(field(m, 'What needs approval?'), 'Replace wireless mouse AFC4719');
        await d.type(field(m, 'Details'), 'Receiver is faulty. Issue a new Logitech M185 from spare stock.', { delay: 12 });
        await d.click(m.getByRole('button', { name: 'Send request' }), { wait: 1500 });
      });
      await d.scene('Use Change status in the Actions panel to move the ticket along, for example to Dependency on client while you wait for the requester, which pauses the S L A clock.', async () => {
        await d.show(p.getByText('Change status', { exact: true }).locator('xpath=following::select[1]'), 2000);
      });
      await d.scene('When the work is done, choose Resolved and write a resolution note that the requester will see.');
      await d.scene('Finally, agents can read and write Knowledge Base articles, so a fix you find once can help everyone.', async () => {
        await d.nav('Knowledge Base');
      });
      await d.scene('That is the Agent workflow: take a ticket, communicate, request approvals when needed, and resolve it within the S L A.');
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
      await d.scene('Sign in with your team lead account.', () => d.login(this.account));
      await d.badge(this.badge);
      await d.scene('Your menu adds Teams, Approvals, and S L A Policies to the agent tools.', async () => {
        await d.show(p.locator('nav[aria-label="Main navigation"]'), 2500);
      });
      await d.scene('Team Bucket shows every ticket your team is working on, grouped by team member, so you can spot overloaded agents and rebalance work.', async () => {
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
      await d.scene('Team leads can also reassign tickets within the team, add internal notes, and close tickets on the team\'s behalf.');
      await d.scene('On the Teams page you manage your own team: its members and support email.', async () => {
        await d.nav('Teams');
      });
      await d.scene('S L A Policies shows the response and resolution targets that apply to your tickets. Team leads can view them; department heads and admins change them.', async () => {
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
      await d.scene('This video is for Department Heads. You manage everything inside your own department: tickets, people, teams, S L As, assets, and knowledge.');
      await d.hideCard();
      await d.scene('Sign in, and you land on the department dashboard.', () => d.login(this.account));
      await d.badge(this.badge);
      await d.scene('The dashboard summarises your department: total and open tickets, S L A breaches, tickets by status and priority, and your busiest agents.', async () => {
        await d.show(p.getByText('Top Assignees').first(), 1500).catch(() => {});
      });
      await d.scene('All Tickets is your service desk console. Switch between views, search, and use Pick Up, Assign, Merge, and Link to act on several tickets at once.', async () => {
        await d.nav('All Tickets');
        await d.click(p.getByText('My Open Requests').first(), { wait: 1200 }).catch(() => {});
        await d.show(p.getByText('Assign ▾').first(), 1200).catch(() => {});
      });
      await d.scene('Department heads can update any ticket in their department. Let us resolve the mouse ticket now that the replacement is approved.', async () => {
        if (state.ticketId) await d.goto(`/admin/tickets/${state.ticketId}`);
        await d.click(p.getByRole('button', { name: 'Change Status' }), { wait: 800 });
        await d.select(modal(p).locator('select').first(), 'RESOLVED');
        await d.type(modal(p).getByPlaceholder(/Describe how the ticket was resolved/), 'Replaced the faulty wireless mouse with a new Logitech M185 from spare stock.', { delay: 12 });
        await d.click(modal(p).getByRole('button', { name: 'Update' }), { wait: 2000 });
      });
      await d.scene('Users lets you add people to your department, edit their details, and bulk import users from a sheet.', async () => {
        await d.nav('Users');
        await d.show(p.getByRole('button', { name: 'Add user' }), 1200);
      });
      await d.scene('Teams lets you create teams, add members, appoint a team lead, and set up sub categories that route tickets to the right team.', async () => {
        await d.nav('Teams');
      });
      await d.scene('In S L A Policies you create and edit the response and resolution targets for your department, per priority.', async () => {
        await d.nav('SLA Policies');
        await d.show(p.getByRole('button', { name: 'New policy' }), 1200);
      });
      await d.scene('Assets tracks laptops, monitors, licences and other equipment, who they are assigned to, and when warranties expire.', async () => {
        await d.nav('Assets');
      });
      await d.scene('In the Knowledge Base you write articles and publish them, so employees can solve common problems themselves.', async () => {
        await d.nav('Knowledge Base');
      });
      await d.scene('Reports shows S L A compliance, agent performance and ticket trends, and lets you export ticket data.', async () => {
        await d.nav('Reports');
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
      await d.scene('Sign in with the administrator account.', () => d.login(this.account));
      await d.badge(this.badge);
      await d.scene('The admin dashboard covers the whole organisation, across all departments.', async () => {
        await d.show(p.getByText('Tickets by Status').first(), 1500).catch(() => {});
      });
      await d.scene('To add a person, open Users and click Add user. Enter their name and email, tick one or more roles, choose a department, and set a temporary password.', async () => {
        await d.nav('Users');
        await d.click(p.getByRole('button', { name: 'Add user' }), { wait: 800 });
        const m = modal(p);
        await d.type(field(m, 'First name'), 'Priya');
        await d.type(field(m, 'Last name'), 'Sharma');
        await d.type(field(m, 'Email'), 'priya.sharma@company.com');
        await d.click(m.locator('label').filter({ hasText: /^Agent$/ }), { wait: 300 });
        await d.select(field(m, 'Department'), 'IT Hardware');
        await d.type(field(m, 'Temporary password'), 'Welcome@2026');
      });
      await d.scene('Click Create user. The new account can sign in straight away. From the user list you can also change roles, suspend, or delete accounts.', async () => {
        await d.click(modal(p).getByRole('button', { name: 'Create user' }), { wait: 2000 });
      });
      await d.scene('Departments is where you add departments, assign department heads, and configure categories.', async () => {
        await d.nav('Departments');
      });
      await d.scene('In Settings you define custom ticket fields, extra questions shown to employees for a particular department and category.', async () => {
        await d.nav('Settings');
        await d.show(p.getByText('Custom Ticket Fields').first(), 1500);
      });
      await d.scene('Role Permissions is a reference of what every role can do, from full access down to own data only.', async () => {
        await d.click(p.getByText('Role Permissions').first(), { wait: 1500 });
        await d.scroll(400);
      });
      await d.scene('Audit Logs records who did what and when, including the user we just created.', async () => {
        await d.nav('Audit Logs');
      });
      await d.scene('Admins also see every department\'s tickets, S L A policies, assets, knowledge base, and reports. Admin and Super Admin have the same permissions; the Super Admin is the first account created on installation.');
      await d.scene('That completes the Laxmi Samadhan tutorial series. Thank you for watching.');
    },
  },
];
