import { describe, it, expect, vi, beforeEach } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  ticket: { findUnique: vi.fn(), update: vi.fn() },
  user: { findUnique: vi.fn() },
  team: { count: vi.fn(), findMany: vi.fn() },
  notification: { create: vi.fn().mockResolvedValue({}) },
}));
vi.mock('@config/prisma', () => ({ prisma: prismaMock }));
vi.mock('@middleware/audit.middleware', () => ({ logActivity: vi.fn() }));
vi.mock('../services/email.service', () => ({ default: new Proxy({}, { get: () => vi.fn().mockResolvedValue(true) }) }));
vi.mock('../services/websocket.service', () => ({ default: new Proxy({}, { get: () => vi.fn() }) }));

import { canReassignTicket, assigneeBelongsToDepartment, ticketService } from '../services/ticket.service';

const HW = 'dept-hw';   // IT Hardware/Software — head Sunil, team lead Hari
const APP = 'dept-app'; // IT Application — head Vinod
const base = { ticketDeptId: HW, deptHeadId: 'sunil', leadsTeamInDept: false };

describe('canReassignTicket — who may reassign a department\'s tickets', () => {
  it('the department head (Sunil) can', () => {
    expect(canReassignTicket({ ...base, actorId: 'sunil', actorRoles: ['DEPARTMENT_HEAD'], actorDeptId: HW })).toBe(true);
  });
  it('a team lead of that department (Hari) can', () => {
    expect(canReassignTicket({ ...base, actorId: 'hari', actorRoles: ['TEAM_LEAD'], actorDeptId: HW })).toBe(true);
  });
  it('the lead of a team in that department can, even without the Team Lead role or department set', () => {
    expect(canReassignTicket({ ...base, actorId: 'x', actorRoles: ['AGENT'], actorDeptId: null, leadsTeamInDept: true })).toBe(true);
  });
  it('Super Admin / Admin can', () => {
    expect(canReassignTicket({ ...base, actorId: 'a', actorRoles: ['SUPER_ADMIN'], actorDeptId: null })).toBe(true);
    expect(canReassignTicket({ ...base, actorId: 'b', actorRoles: ['ADMIN'], actorDeptId: APP })).toBe(true);
  });
  it('an agent cannot, even in the same department (Asheesh)', () => {
    expect(canReassignTicket({ ...base, actorId: 'asheesh', actorRoles: ['AGENT'], actorDeptId: HW })).toBe(false);
  });
  it('another department\'s head (Vinod) or team lead cannot', () => {
    expect(canReassignTicket({ ...base, actorId: 'vinod', actorRoles: ['DEPARTMENT_HEAD'], actorDeptId: APP })).toBe(false);
    expect(canReassignTicket({ ...base, actorId: 'shailesh', actorRoles: ['TEAM_LEAD'], actorDeptId: APP })).toBe(false);
  });
  it('a raiser cannot', () => {
    expect(canReassignTicket({ ...base, actorId: 'yusuf', actorRoles: ['RAISER'], actorDeptId: HW })).toBe(false);
  });
});

describe('assigneeBelongsToDepartment — tickets stay in their department', () => {
  it('member by department or by team', () => {
    expect(assigneeBelongsToDepartment({ assigneeDeptId: HW, assigneeTeamDeptIds: [], ticketDeptId: HW, isDeptHead: false })).toBe(true);
    expect(assigneeBelongsToDepartment({ assigneeDeptId: null, assigneeTeamDeptIds: [HW], ticketDeptId: HW, isDeptHead: false })).toBe(true);
  });
  it('the department head always qualifies', () => {
    expect(assigneeBelongsToDepartment({ assigneeDeptId: APP, assigneeTeamDeptIds: [], ticketDeptId: HW, isDeptHead: true })).toBe(true);
  });
  it('someone from another department does not', () => {
    expect(assigneeBelongsToDepartment({ assigneeDeptId: APP, assigneeTeamDeptIds: [APP], ticketDeptId: HW, isDeptHead: false })).toBe(false);
  });
});

describe('assignTicket / updateTicket enforcement', () => {
  const users: Record<string, any> = {
    hari: { id: 'hari', firstName: 'Hari', lastName: 'Yadav', role: 'TEAM_LEAD', roles: ['TEAM_LEAD'], status: 'ACTIVE', departmentId: HW },
    asheesh: { id: 'asheesh', firstName: 'Asheesh', lastName: 'Gupta', role: 'AGENT', roles: ['AGENT'], status: 'ACTIVE', departmentId: HW },
    narendra: { id: 'narendra', firstName: 'Narendra', lastName: 'Saini', role: 'AGENT', roles: ['AGENT'], status: 'ACTIVE', departmentId: HW },
    ansul: { id: 'ansul', firstName: 'Ansul', lastName: 'Khandelwal', role: 'AGENT', roles: ['AGENT'], status: 'ACTIVE', departmentId: APP },
  };
  const ticket = { id: 't1', ticketNumber: 'TKT-26-00080', departmentId: HW, raisedById: 'yusuf', assignedToId: 'asheesh', teamId: null,
    assignedTo: users.asheesh, department: { id: HW, headId: 'sunil' }, respondedAt: null, title: 'x' };

  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.ticket.findUnique.mockResolvedValue(ticket);
    prismaMock.user.findUnique.mockImplementation(({ where }: any) => Promise.resolve(users[where.id] || null));
    prismaMock.team.count.mockResolvedValue(0);
    prismaMock.team.findMany.mockImplementation(({ where }: any) => Promise.resolve(users[where.members.some.id]?.departmentId === HW ? [{ departmentId: HW }] : []));
    prismaMock.ticket.update.mockResolvedValue({ ...ticket, assignedTo: users.narendra, raisedBy: { id: 'yusuf' }, assignedBy: users.hari });
  });

  it('team lead Hari can reassign Asheesh\'s ticket to Narendra', async () => {
    await ticketService.assignTicket('t1', 'narendra', 'hari', undefined, undefined, 'TEAM_LEAD' as any, ['TEAM_LEAD'] as any);
    expect(prismaMock.ticket.update.mock.calls[0][0].data.assignedToId).toBe('narendra');
  });

  it('agent Asheesh cannot reassign his ticket to Narendra', async () => {
    await expect(ticketService.assignTicket('t1', 'narendra', 'asheesh', undefined, undefined, 'AGENT' as any, ['AGENT'] as any))
      .rejects.toThrow(/Team Leads and Department Head/);
    expect(prismaMock.ticket.update).not.toHaveBeenCalled();
  });

  it('cannot reassign to someone in another department (Ansul, IT Application)', async () => {
    await expect(ticketService.assignTicket('t1', 'ansul', 'hari', undefined, undefined, 'TEAM_LEAD' as any, ['TEAM_LEAD'] as any))
      .rejects.toThrow(/not in this ticket's department/);
    expect(prismaMock.ticket.update).not.toHaveBeenCalled();
  });

  it('the edit request can no longer change the assignee (side door closed)', async () => {
    await expect(ticketService.updateTicket('t1', { assignedToId: 'narendra' } as any, 'asheesh', 'AGENT' as any, ['AGENT'] as any))
      .rejects.toThrow(/Assign action/);
    await expect(ticketService.updateTicket('t1', { teamId: 'team-x' } as any, 'asheesh', 'AGENT' as any))
      .rejects.toThrow(/Assign action/);
  });
});
