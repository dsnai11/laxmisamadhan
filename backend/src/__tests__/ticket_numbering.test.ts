import { describe, it, expect, vi, beforeEach } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  department: { findUnique: vi.fn() },
  ticketSequence: { findUnique: vi.fn(), update: vi.fn(), create: vi.fn() },
  ticket: { findMany: vi.fn(), findUnique: vi.fn() },
  activityLog: { findMany: vi.fn() },
}));
vi.mock('@config/prisma', () => ({ prisma: prismaMock }));
vi.mock('@middleware/audit.middleware', () => ({ logActivity: vi.fn() }));

import { highestTicketSequence, formatTicketNumber, ticketService } from '../services/ticket.service';

const year = new Date().getFullYear().toString().slice(-2);
const key = `TKT-${year}`;
const gen = () => (ticketService as any).generateTicketNumber('dept-1');

describe('highestTicketSequence', () => {
  it('finds the highest number in ticket numbers and activity-log lines', () => {
    expect(highestTicketSequence([`${key}-00012`, `Created ticket ${key}-00068`, `${key}-00040`], key)).toBe(68);
  });
  it('ignores other prefixes and years', () => {
    expect(highestTicketSequence([`HW-${year}-00999`, `TKT-24-00500`, `${key}-00007`], key)).toBe(7);
  });
  it('0 when nothing issued yet', () => {
    expect(highestTicketSequence(['no numbers here'], key)).toBe(0);
  });
  it('formats with 5 digits', () => {
    expect(formatTicketNumber('TKT-26', 74)).toBe('TKT-26-00074');
  });
});

describe('generateTicketNumber — numbers are never reused', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.department.findUnique.mockResolvedValue({ id: 'dept-1', type: 'IT Software' }); // -> TKT prefix
    prismaMock.ticket.findUnique.mockResolvedValue(null);
  });

  it('first use: starts after the highest number ever issued, including DELETED tickets (the TKT-26-00023 case)', async () => {
    prismaMock.ticketSequence.findUnique.mockResolvedValue(null);
    // live tickets only go up to 00060, but the activity log shows 00068 was issued (then deleted)
    prismaMock.ticket.findMany.mockResolvedValue([{ ticketNumber: `${key}-00010` }, { ticketNumber: `${key}-00060` }]);
    prismaMock.activityLog.findMany.mockResolvedValue([{ description: `Created ticket ${key}-00068` }, { description: `Created ticket ${key}-00023` }]);
    prismaMock.ticketSequence.create.mockResolvedValue({ key, lastValue: 69 });

    expect(await gen()).toBe(`${key}-00069`);
    expect(prismaMock.ticketSequence.create.mock.calls[0][0].data).toEqual({ key, lastValue: 69 });
  });

  it('afterwards: atomically increments the counter (count of tickets is irrelevant)', async () => {
    prismaMock.ticketSequence.findUnique.mockResolvedValue({ key, lastValue: 73 });
    prismaMock.ticketSequence.update.mockResolvedValue({ key, lastValue: 74 });

    expect(await gen()).toBe(`${key}-00074`);
    expect(prismaMock.ticketSequence.update.mock.calls[0][0].data).toEqual({ lastValue: { increment: 1 } });
    expect(prismaMock.ticket.findMany).not.toHaveBeenCalled();
  });

  it('skips a number that somehow already exists', async () => {
    prismaMock.ticketSequence.findUnique.mockResolvedValue({ key, lastValue: 73 });
    prismaMock.ticketSequence.update.mockResolvedValueOnce({ key, lastValue: 74 }).mockResolvedValueOnce({ key, lastValue: 75 });
    prismaMock.ticket.findUnique.mockResolvedValueOnce({ id: 'taken' }).mockResolvedValueOnce(null);

    expect(await gen()).toBe(`${key}-00075`);
  });

  it('two requests racing on first use: the loser retries via increment', async () => {
    prismaMock.ticketSequence.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({ key, lastValue: 69 });
    prismaMock.ticket.findMany.mockResolvedValue([]);
    prismaMock.activityLog.findMany.mockResolvedValue([{ description: `Created ticket ${key}-00068` }]);
    prismaMock.ticketSequence.create.mockRejectedValueOnce(Object.assign(new Error('unique'), { code: 'P2002' }));
    prismaMock.ticketSequence.update.mockResolvedValue({ key, lastValue: 70 });

    expect(await gen()).toBe(`${key}-00070`);
  });
});
