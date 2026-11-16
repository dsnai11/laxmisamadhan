import { describe, it, expect, vi } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  ticket: { findUnique: vi.fn(), update: vi.fn(), findMany: vi.fn() },
  user: { findUnique: vi.fn() },
  team: { findUnique: vi.fn() },
  notification: { create: vi.fn().mockResolvedValue({}) },
}));
vi.mock('@config/prisma', () => ({ prisma: prismaMock }));
vi.mock('@middleware/audit.middleware', () => ({ logActivity: vi.fn() }));
vi.mock('../services/email.service', () => ({ default: new Proxy({}, { get: () => vi.fn().mockResolvedValue(true) }) }));
vi.mock('../services/websocket.service', () => ({ default: new Proxy({}, { get: () => vi.fn() }) }));

import { slaStateAt, slaBreachedWhere, slaApproachingWhere } from '../services/sla.service';
import { ticketService } from '../services/ticket.service';

const at = (s: string) => new Date(s);

// Timeline of TKT-26-00058: raised Nov 5 15:47 IST, response due 19:47, resolution due Nov 9 21:47.
const t58 = {
  respondedAt: at('2026-11-05T10:17:07Z'),      // responded (at creation/assignment)
  responseDueAt: at('2026-11-05T14:17:07Z'),    // 19:47 IST
  resolutionDueAt: at('2026-11-09T16:17:00Z'),  // Nov 9 21:47 IST
};

describe('slaStateAt — when a ticket is breached', () => {
  it('responded ticket is NOT breached just because the response deadline passed (the Nov 5 bug)', () => {
    expect(slaStateAt(t58, at('2026-11-05T14:21:00Z'))).toBe('WITHIN_SLA'); // 19:51 IST, when it was wrongly breached
  });

  it('responded ticket is breached once the RESOLUTION deadline passes', () => {
    expect(slaStateAt(t58, at('2026-11-10T00:00:00Z'))).toBe('BREACHED');
  });

  it('un-responded ticket is breached when the response deadline passes', () => {
    expect(slaStateAt({ ...t58, respondedAt: null }, at('2026-11-05T14:21:00Z'))).toBe('BREACHED');
  });

  it('approaching: un-responded within 30 min of response deadline, or within 60 min of resolution', () => {
    expect(slaStateAt({ ...t58, respondedAt: null }, at('2026-11-05T14:00:00Z'))).toBe('APPROACHING_BREACH');
    expect(slaStateAt(t58, at('2026-11-05T14:00:00Z'))).toBe('WITHIN_SLA');
    expect(slaStateAt(t58, at('2026-11-09T15:30:00Z'))).toBe('APPROACHING_BREACH');
  });

  it('no SLA dates → within SLA', () => {
    expect(slaStateAt({ respondedAt: null, responseDueAt: null, resolutionDueAt: null }, new Date())).toBe('WITHIN_SLA');
  });
});

describe('SLA timer queries only use the response deadline while unanswered', () => {
  const now = at('2026-11-05T14:21:00Z');
  it('breached query', () => {
    const or = slaBreachedWhere(now).OR as any[];
    const responseClause = or.find((c) => c.responseDueAt);
    expect(responseClause.respondedAt).toBeNull();
    expect(or.some((c) => c.resolutionDueAt && c.respondedAt === undefined)).toBe(true);
  });
  it('approaching query', () => {
    const or = slaApproachingWhere(now).OR as any[];
    expect(or.find((c) => c.responseDueAt).respondedAt).toBeNull();
  });
});

describe('assignTicket — assigning is not a response', () => {
  it('auto-assignment does not set respondedAt', async () => {
    prismaMock.ticket.findUnique.mockResolvedValue({
      id: 't1', ticketNumber: 'TKT-26-00099', departmentId: 'd1', raisedById: 'raiser', teamId: null,
      respondedAt: null, assignedTo: null, assignedToId: null, department: { id: 'd1', headId: 'head' }, title: 'x',
    });
    prismaMock.user.findUnique.mockResolvedValue({ id: 'agent', firstName: 'A', lastName: 'B', email: 'a@lifc.in', role: 'AGENT', roles: ['AGENT'], status: 'ACTIVE' });
    prismaMock.ticket.update.mockResolvedValue({ id: 't1', ticketNumber: 'TKT-26-00099', title: 'x', raisedBy: { id: 'raiser' }, assignedTo: { id: 'agent' }, assignedBy: null, department: {} });

    await ticketService.assignTicket('t1', 'agent', undefined as any, undefined, 'Auto-assigned by system').catch(() => undefined);

    const data = prismaMock.ticket.update.mock.calls[0][0].data;
    expect(data.assignedToId).toBe('agent');
    expect('respondedAt' in data).toBe(false);
  });
});
