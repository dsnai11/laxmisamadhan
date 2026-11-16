import { describe, it, expect, vi, beforeEach } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  ticket: { findUnique: vi.fn(), update: vi.fn() },
  user: { findUnique: vi.fn() },
  notification: { create: vi.fn().mockResolvedValue({}) },
}));
vi.mock('@config/prisma', () => ({ prisma: prismaMock }));
vi.mock('@middleware/audit.middleware', () => ({ logActivity: vi.fn() }));
vi.mock('../services/email.service', () => ({ default: new Proxy({}, { get: () => vi.fn().mockResolvedValue(true) }) }));
vi.mock('../services/websocket.service', () => ({ default: new Proxy({}, { get: () => vi.fn() }) }));

import { resolutionCredit, ticketService } from '../services/ticket.service';

// Team bucket case: ticket assigned to Asheesh, Asheesh is away, teammate Narendra resolves it.
const users: Record<string, any> = {
  asheesh: { id: 'asheesh', firstName: 'Asheesh', lastName: 'Gupta', role: 'AGENT', roles: ['AGENT'], departmentId: 'hw' },
  narendra: { id: 'narendra', firstName: 'Narendra', lastName: 'Saini', role: 'AGENT', roles: ['AGENT'], departmentId: 'hw' },
  yusuf: { id: 'yusuf', firstName: 'Yusuf', lastName: 'Khan', role: 'RAISER', roles: ['RAISER'], departmentId: 'hw' },
};

describe('resolutionCredit — who gets the resolved ticket', () => {
  it('teammate resolving someone else\'s ticket gets it reassigned to them', () => {
    expect(resolutionCredit({ resolverId: 'narendra', resolverRoles: ['AGENT'], assignedToId: 'asheesh' })).toEqual({ reassign: true });
  });
  it('team lead / dept head / admin resolving also takes the credit', () => {
    for (const r of ['TEAM_LEAD', 'DEPARTMENT_HEAD', 'ADMIN', 'SUPER_ADMIN']) {
      expect(resolutionCredit({ resolverId: 'x', resolverRoles: [r], assignedToId: 'asheesh' }).reassign).toBe(true);
    }
  });
  it('the assignee resolving their own ticket → no change', () => {
    expect(resolutionCredit({ resolverId: 'asheesh', resolverRoles: ['AGENT'], assignedToId: 'asheesh' })).toEqual({ reassign: false });
  });
  it('unassigned ticket resolved by staff → assigned to the resolver', () => {
    expect(resolutionCredit({ resolverId: 'narendra', resolverRoles: ['AGENT'], assignedToId: null }).reassign).toBe(true);
  });
  it('a non-staff user never becomes the assignee', () => {
    expect(resolutionCredit({ resolverId: 'yusuf', resolverRoles: ['RAISER'], assignedToId: 'asheesh' }).reassign).toBe(false);
  });
});

describe('updateStatus — resolving records the resolver and reassigns', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.user.findUnique.mockImplementation(({ where }: any) => Promise.resolve(users[where.id] || null));
    prismaMock.ticket.update.mockImplementation(({ data }: any) => Promise.resolve({ id: 't1', ticketNumber: 'HW-26-00100', status: data.status, raisedBy: users.yusuf, assignedTo: users.narendra, watchers: [], department: {} }));
  });

  const openTicket = (over: Record<string, any> = {}) => ({
    id: 't1', ticketNumber: 'HW-26-00100', status: 'OPEN', departmentId: 'hw', raisedById: 'yusuf',
    assignedToId: 'asheesh', assignedTo: users.asheesh, raisedBy: users.yusuf, department: { id: 'hw', headId: 'sunil' }, ...over,
  });

  it('teammate resolves → resolvedBy + assignee = teammate, with an assignment history row', async () => {
    prismaMock.ticket.findUnique.mockResolvedValue(openTicket());
    await ticketService.updateStatus('t1', 'RESOLVED' as any, 'narendra', 'AGENT' as any, 'Replaced keyboard');

    const data = prismaMock.ticket.update.mock.calls[0][0].data;
    expect(data.resolvedBy).toEqual({ connect: { id: 'narendra' } });
    expect(data.assignedTo).toEqual({ connect: { id: 'narendra' } });
    const rows = data.updates.create;
    expect(rows.find((r: any) => r.field === 'assignedTo')).toMatchObject({ oldValue: 'Asheesh Gupta', newValue: 'Narendra Saini' });
    expect(rows.find((r: any) => r.field === 'status')).toMatchObject({ newValue: 'RESOLVED' });
    // the previous assignee is told
    expect(prismaMock.notification.create.mock.calls.some((c: any) => c[0].data.userId === 'asheesh')).toBe(true);
  });

  it('assignee resolves own ticket → resolvedBy set, no reassignment', async () => {
    prismaMock.ticket.findUnique.mockResolvedValue(openTicket());
    await ticketService.updateStatus('t1', 'RESOLVED' as any, 'asheesh', 'AGENT' as any, 'Fixed');

    const data = prismaMock.ticket.update.mock.calls[0][0].data;
    expect(data.resolvedBy).toEqual({ connect: { id: 'asheesh' } });
    expect(data.assignedTo).toBeUndefined();
    expect(data.updates.create.some((r: any) => r.field === 'assignedTo')).toBe(false);
  });

  it('reopening clears resolvedBy', async () => {
    prismaMock.ticket.findUnique.mockResolvedValue(openTicket({ status: 'RESOLVED', assignedToId: 'narendra', assignedTo: users.narendra }));
    await ticketService.updateStatus('t1', 'REOPENED' as any, 'yusuf', 'RAISER' as any);

    const data = prismaMock.ticket.update.mock.calls[0][0].data;
    expect(data.resolvedBy).toEqual({ disconnect: true });
    expect(data.assignedTo).toBeUndefined();
  });
});

import { creditedResolverId, resolvedByPersonWhere } from '../services/report.service';

describe('reports — resolved tickets count for the person who resolved them', () => {
  it('credits the resolver, even if the ticket is assigned to someone else', () => {
    expect(creditedResolverId({ resolvedById: 'narendra', assignedToId: 'asheesh' })).toBe('narendra');
  });
  it('falls back to the assignee for old tickets with no recorded resolver', () => {
    expect(creditedResolverId({ resolvedById: null, assignedToId: 'asheesh' })).toBe('asheesh');
  });
  it('per-person filter matches the same rule', () => {
    expect(resolvedByPersonWhere('narendra')).toEqual({
      status: 'RESOLVED',
      OR: [{ resolvedById: 'narendra' }, { resolvedById: null, assignedToId: 'narendra' }],
    });
  });
});
