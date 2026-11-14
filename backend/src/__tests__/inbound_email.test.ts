import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TicketCategory, TicketPriority } from '@prisma/client';
import { planFetch, skipReason, extractTicketNumber, canReplyToTicket, guessCategory } from '../services/inboundRules';

// ---------------------------------------------------------------- pure rules
describe('planFetch — which mailbox messages to process', () => {
  it('first run records a baseline and processes nothing (no backlog of old mail becomes tickets)', () => {
    const p = planFetch({ uidValidity: null, lastUid: null }, { uidValidity: '7', uidNext: 1201 });
    expect(p).toEqual({ baseline: true, fromUid: null, cursor: { uidValidity: '7', lastUid: 1200 } });
  });

  it('after the baseline, processes everything above lastUid', () => {
    const p = planFetch({ uidValidity: '7', lastUid: 1200 }, { uidValidity: '7', uidNext: 1204 });
    expect(p.baseline).toBe(false);
    expect(p.fromUid).toBe(1201);
  });

  it('mailbox reset on the server (UIDVALIDITY changed) -> new baseline, no reprocessing', () => {
    const p = planFetch({ uidValidity: '7', lastUid: 1200 }, { uidValidity: '9', uidNext: 15 });
    expect(p.baseline).toBe(true);
    expect(p.cursor).toEqual({ uidValidity: '9', lastUid: 14 });
  });

  it('empty mailbox baseline is 0', () => {
    expect(planFetch({ uidValidity: null, lastUid: null }, { uidValidity: '1', uidNext: 1 }).cursor.lastUid).toBe(0);
  });
});

describe('skipReason — mail that must never become a ticket', () => {
  const opts = { systemAddresses: ['laxmisamadhan@lifc.in', 'project@lifc.in'], allowedDomains: ['lifc.in'] };

  it('processes a normal colleague email', () => {
    expect(skipReason('yusuf.khan@lifc.in', 'LMS not working', opts)).toBeNull();
  });

  it('skips the system\'s own mail (the Oct 24 "Ticket Created" loop)', () => {
    expect(skipReason('laxmisamadhan@lifc.in', '[HW-26-00044] Ticket Created: test', opts)).toMatch(/loop/);
    expect(skipReason('PROJECT@lifc.in', 'anything', opts)).toMatch(/loop/);
  });

  it('skips bounces and auto-replies', () => {
    expect(skipReason('mailer-daemon@lifc.in', 'x', opts)).toMatch(/bounce/);
    expect(skipReason('noreply@lifc.in', 'x', opts)).toMatch(/bounce/);
    expect(skipReason('a@lifc.in', 'Automatic reply: Out of office', opts)).toMatch(/bounce/);
    expect(skipReason('a@lifc.in', 'Undeliverable: test', opts)).toMatch(/bounce/);
  });

  it('skips senders outside the company domain (no spam tickets / accounts)', () => {
    expect(skipReason('someone@gmail.com', 'hello', opts)).toMatch(/not a company domain/);
  });

  it('skips missing sender', () => {
    expect(skipReason('', 'x', opts)).toMatch(/missing/);
  });
});

describe('extractTicketNumber', () => {
  it('finds ticket numbers in reply subjects', () => {
    expect(extractTicketNumber('RE: [sw-26-00063] Password not receiving')).toBe('SW-26-00063');
    expect(extractTicketNumber('Fwd: TKT-26-00060 access')).toBe('TKT-26-00060');
  });
  it('ignores employee codes and other numbers', () => {
    expect(extractTicketNumber('EMP CODE-5040 laptop issue')).toBeNull();
    expect(extractTicketNumber('LIF-5487 cannot login')).toBeNull();
  });
});

describe('canReplyToTicket — who may comment on a ticket by email', () => {
  const ticket = { raisedById: 'yusuf', assignedToId: 'asheesh', watcherIds: ['manager'] };
  it('raiser, assignee, watcher and staff may reply', () => {
    expect(canReplyToTicket({ id: 'yusuf', role: 'RAISER' }, ticket)).toBe(true);
    expect(canReplyToTicket({ id: 'asheesh', role: 'AGENT' }, ticket)).toBe(true);
    expect(canReplyToTicket({ id: 'manager', role: 'RAISER' }, ticket)).toBe(true);
    expect(canReplyToTicket({ id: 'sunil', role: 'TEAM_LEAD' }, ticket)).toBe(true);
  });
  it('an unrelated employee cannot add to someone else\'s ticket', () => {
    expect(canReplyToTicket({ id: 'random', role: 'RAISER', roles: ['RAISER'] }, ticket)).toBe(false);
  });
});

describe('guessCategory', () => {
  it('maps common requests', () => {
    expect(guessCategory('Laptop keypad not working', '')).toEqual({ category: TicketCategory.HARDWARE_REQUEST, subCategory: 'Laptop' });
    expect(guessCategory('Need Synoriq LOS access', '').category).toBe(TicketCategory.ACCESS_REQUEST);
    expect(guessCategory('CRM showing error', '').category).toBe(TicketCategory.SOFTWARE_REQUEST);
    expect(guessCategory('Hello', 'please help').category).toBe(TicketCategory.INCIDENT);
  });
});

// ---------------------------------------------------------------- service wiring
const prismaMock = vi.hoisted(() => ({
  department: { findMany: vi.fn(), findUnique: vi.fn(), findFirst: vi.fn() },
  user: { findFirst: vi.fn(), create: vi.fn() },
  ticket: { findUnique: vi.fn(), update: vi.fn() },
  comment: { create: vi.fn() },
}));
const createTicket = vi.hoisted(() => vi.fn());

vi.mock('@config/prisma', () => ({ prisma: prismaMock }));
vi.mock('../services/ticket.service', () => ({ default: { createTicket } }));
vi.mock('../services/websocket.service', () => ({ default: { sendToTicket: vi.fn() } }));
vi.mock('@middleware/audit.middleware', () => ({ logActivity: vi.fn() }));

import { inboundEmailService } from '../services/inboundEmail.service';

const itApp = { id: 'dept-itapp', name: 'IT Application', supportEmail: 'project@lifc.in' };
const yusuf = { id: 'yusuf', email: 'yusuf.khan@lifc.in', role: 'RAISER', roles: ['RAISER'] };
const mail = (over: Record<string, any> = {}) => ({
  fromEmail: 'Yusuf.Khan@lifc.in', fromName: 'Yusuf Khan', toEmail: 'project@lifc.in',
  subject: 'CRM application showing an error', body: 'Please check', ...over,
});

describe('processInboundEmail — creates the ticket in the mailbox\'s department via the normal path', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.department.findMany.mockResolvedValue([{ supportEmail: 'project@lifc.in' }, { supportEmail: 'itsupport@lifc.in' }]);
    prismaMock.department.findUnique.mockResolvedValue(itApp);
    prismaMock.user.findFirst.mockResolvedValue(yusuf);
    createTicket.mockResolvedValue({ id: 't1', ticketNumber: 'SW-26-00070' });
  });

  it('uses ticketService.createTicket (SLA, team routing, auto-assign) with MEDIUM priority, not CRITICAL', async () => {
    const r = await inboundEmailService.processInboundEmail(mail(), 'dept-itapp');
    expect(r.action).toBe('TICKET_CREATED');
    expect(createTicket).toHaveBeenCalledTimes(1);
    const data = createTicket.mock.calls[0][0];
    expect(data.departmentId).toBe('dept-itapp');
    expect(data.raisedById).toBe('yusuf');
    expect(data.priority).toBe(TicketPriority.MEDIUM);
    expect(data.category).toBe(TicketCategory.SOFTWARE_REQUEST);
    expect(data.tags).toContain('EMAIL');
  });

  it('never tickets mail sent by a department mailbox itself', async () => {
    const r = await inboundEmailService.processInboundEmail(mail({ fromEmail: 'project@lifc.in' }), 'dept-itapp');
    expect(r.action).toBe('SKIPPED');
    expect(createTicket).not.toHaveBeenCalled();
  });

  it('a reply with a ticket number from someone unrelated becomes a new ticket, not a comment', async () => {
    prismaMock.ticket.findUnique.mockResolvedValue({ id: 'old', ticketNumber: 'SW-26-00063', raisedById: 'other', assignedToId: 'asheesh', status: 'OPEN', watchers: [] });
    const r = await inboundEmailService.processInboundEmail(mail({ subject: 'RE: SW-26-00063 CRM error' }), 'dept-itapp');
    expect(prismaMock.comment.create).not.toHaveBeenCalled();
    expect(r.action).toBe('TICKET_CREATED');
  });

  it('the raiser replying with the ticket number adds a comment', async () => {
    prismaMock.ticket.findUnique.mockResolvedValue({ id: 'mine', ticketNumber: 'SW-26-00063', raisedById: 'yusuf', assignedToId: 'asheesh', status: 'OPEN', watchers: [] });
    prismaMock.comment.create.mockResolvedValue({ id: 'c1' });
    const r = await inboundEmailService.processInboundEmail(mail({ subject: 'RE: SW-26-00063 CRM error' }), 'dept-itapp');
    expect(r.action).toBe('COMMENT_ADDED');
    expect(createTicket).not.toHaveBeenCalled();
  });

  it('without a mailbox department (admin simulator), routes by the department support email', async () => {
    prismaMock.department.findFirst.mockResolvedValue(itApp);
    await inboundEmailService.processInboundEmail(mail());
    expect(prismaMock.department.findFirst.mock.calls[0][0].where.supportEmail.equals).toBe('project@lifc.in');
    expect(createTicket.mock.calls[0][0].departmentId).toBe('dept-itapp');
  });

  it('an address no department uses is skipped, not dumped into a random department', async () => {
    prismaMock.department.findFirst.mockResolvedValue(null);
    const r = await inboundEmailService.processInboundEmail(mail({ toEmail: 'unknown@lifc.in' }));
    expect(r.action).toBe('SKIPPED');
    expect(createTicket).not.toHaveBeenCalled();
  });
});
