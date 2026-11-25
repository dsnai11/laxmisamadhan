import { describe, it, expect, vi, beforeEach } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  ticket: { findUnique: vi.fn() },
  attachment: { findFirst: vi.fn(), delete: vi.fn() },
}));
vi.mock('@config/prisma', () => ({ prisma: prismaMock }));
vi.mock('@middleware/audit.middleware', () => ({ logActivity: vi.fn() }));
vi.mock('../services/email.service', () => ({ default: new Proxy({}, { get: () => vi.fn().mockResolvedValue(true) }) }));
vi.mock('../services/websocket.service', () => ({ default: new Proxy({}, { get: () => vi.fn() }) }));

import { canDeleteAttachment, ticketService } from '../services/ticket.service';

describe('canDeleteAttachment — files are evidence, only Admin / Super Admin may remove them', () => {
  it('Super Admin and Admin can', () => {
    expect(canDeleteAttachment(['SUPER_ADMIN'])).toBe(true);
    expect(canDeleteAttachment(['RAISER', 'ADMIN'])).toBe(true);
  });
  it('everyone else cannot', () => {
    for (const r of ['DEPARTMENT_HEAD', 'TEAM_LEAD', 'AGENT', 'RAISER', 'VIEWER']) {
      expect(canDeleteAttachment([r])).toBe(false);
    }
    expect(canDeleteAttachment([])).toBe(false);
    expect(canDeleteAttachment(undefined)).toBe(false);
  });
});

describe('ticketService.deleteAttachment', () => {
  beforeEach(() => vi.clearAllMocks());

  it("a raiser cannot delete a file, not even one they uploaded themselves", async () => {
    prismaMock.ticket.findUnique.mockResolvedValue({ id: 't1' });
    prismaMock.attachment.findFirst.mockResolvedValue({ id: 'a1', userId: 'raiser1', path: '/tmp/x', originalName: 'x.png' });
    await expect(ticketService.deleteAttachment('t1', 'a1', 'raiser1', ['RAISER'])).rejects.toThrow(/permission denied/i);
    expect(prismaMock.attachment.delete).not.toHaveBeenCalled();
  });

  it('an agent and a department head cannot either', async () => {
    prismaMock.ticket.findUnique.mockResolvedValue({ id: 't1' });
    prismaMock.attachment.findFirst.mockResolvedValue({ id: 'a1', userId: 'agent1', path: '/tmp/x', originalName: 'x.png' });
    await expect(ticketService.deleteAttachment('t1', 'a1', 'agent1', ['AGENT'])).rejects.toThrow(/permission denied/i);
    await expect(ticketService.deleteAttachment('t1', 'a1', 'dh', ['DEPARTMENT_HEAD'])).rejects.toThrow(/permission denied/i);
    expect(prismaMock.attachment.delete).not.toHaveBeenCalled();
  });

  it('an admin can', async () => {
    prismaMock.ticket.findUnique.mockResolvedValue({ id: 't1' });
    prismaMock.attachment.findFirst.mockResolvedValue({ id: 'a1', userId: 'raiser1', path: '/tmp/does-not-exist', originalName: 'x.png' });
    prismaMock.attachment.delete.mockResolvedValue({});
    await ticketService.deleteAttachment('t1', 'a1', 'admin1', ['ADMIN']);
    expect(prismaMock.attachment.delete).toHaveBeenCalledWith({ where: { id: 'a1' } });
  });
});
