import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TicketStatus, TicketPriority, SLAStatus } from '@prisma/client';

const prismaMock = vi.hoisted(() => ({
  ticket: { findMany: vi.fn(), update: vi.fn() },
  notification: { create: vi.fn() },
  ticketUpdate: { create: vi.fn() },
  team: { findFirst: vi.fn() },
  user: { findFirst: vi.fn() },
}));

vi.mock('@config/prisma', () => ({ prisma: prismaMock }));
vi.mock('../services/ticket.service', () => ({ default: {} }));

import { escalationService } from '../services/escalation.service';

const minutesAgo = (m: number) => new Date(Date.now() - m * 60 * 1000);

function makeTicket(overrides: Record<string, any> = {}) {
  return {
    id: 't1',
    ticketNumber: 'HW-26-00001',
    title: 'Printer down',
    status: TicketStatus.OPEN,
    priority: TicketPriority.LOW,
    slaStatus: SLAStatus.WITHIN_SLA,
    resolutionDueAt: null,
    assignedToId: null,
    assignedTo: null,
    departmentId: 'd1',
    department: { id: 'd1', name: 'IT Hardware', headId: 'head1', head: { id: 'head1' }, teams: [] },
    tags: [] as string[],
    createdAt: minutesAgo(45),
    ...overrides,
  };
}

describe('Escalation job does not repeat one-time escalations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('L1: notifies the department head the first time a ticket is unassigned > 30 min', async () => {
    prismaMock.ticket.findMany.mockResolvedValue([makeTicket()]);

    const result = await escalationService.runEscalationCheck();

    expect(result.escalatedL1).toBe(1);
    expect(prismaMock.notification.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.notification.create.mock.calls[0][0].data.userId).toBe('head1');
  });

  it('L1: does not notify again once the ticket is tagged ESCALATED_L1', async () => {
    prismaMock.ticket.findMany.mockResolvedValue([makeTicket({ tags: ['ESCALATED_L1'] })]);

    const result = await escalationService.runEscalationCheck();

    expect(result.escalatedL1).toBe(0);
    expect(prismaMock.notification.create).not.toHaveBeenCalled();
    expect(prismaMock.ticket.update).not.toHaveBeenCalled();
  });

  it('L1: still ignores tickets younger than 30 minutes', async () => {
    prismaMock.ticket.findMany.mockResolvedValue([makeTicket({ createdAt: minutesAgo(10) })]);

    const result = await escalationService.runEscalationCheck();

    expect(result.escalatedL1).toBe(0);
    expect(prismaMock.notification.create).not.toHaveBeenCalled();
  });

  it('L2: bumps priority one step the first time a ticket approaches breach', async () => {
    prismaMock.ticket.findMany.mockResolvedValue([
      makeTicket({
        assignedToId: 'agent1',
        slaStatus: SLAStatus.APPROACHING_BREACH,
        resolutionDueAt: new Date(Date.now() + 20 * 60 * 1000),
      }),
    ]);

    const result = await escalationService.runEscalationCheck();

    expect(result.escalatedL2).toBe(1);
    const data = prismaMock.ticket.update.mock.calls[0][0].data;
    expect(data.priority).toBe(TicketPriority.MEDIUM);
    expect(data.tags.set).toContain('ESCALATED_L2');
  });

  it('L2: does not keep bumping priority on later runs', async () => {
    prismaMock.ticket.findMany.mockResolvedValue([
      makeTicket({
        assignedToId: 'agent1',
        priority: TicketPriority.MEDIUM,
        slaStatus: SLAStatus.APPROACHING_BREACH,
        resolutionDueAt: new Date(Date.now() + 10 * 60 * 1000),
        tags: ['ESCALATED_L2', 'AUTO_PRIORITY_UPGRADE'],
      }),
    ]);

    const result = await escalationService.runEscalationCheck();

    expect(result.escalatedL2).toBe(0);
    expect(prismaMock.ticket.update).not.toHaveBeenCalled();
  });
});
