import { describe, it, expect, vi, beforeEach } from 'vitest';

const prismaMock = vi.hoisted(() => ({ user: { findUnique: vi.fn() } }));
vi.mock('@config/prisma', () => ({ prisma: prismaMock }));

import { assertCanAssignRole, assertCanDeleteUser, hasUserMgmtRight, MANAGED_BY_RIGHT_ROLES } from '../utils/userAccess';
import { requireRoleOrRight } from '../middleware/auth.middleware';

const agentWithRight = { userId: 'hr1', role: 'AGENT', roles: ['AGENT'], departmentId: 'd1', canManageUsers: true };
const agentWithout = { userId: 'a1', role: 'AGENT', roles: ['AGENT'], departmentId: 'd1' };

describe('the "Manage users" right — creating user IDs', () => {
  it('the right is only on when explicitly true', () => {
    expect(hasUserMgmtRight(agentWithRight)).toBe(true);
    expect(hasUserMgmtRight(agentWithout)).toBe(false);
    expect(hasUserMgmtRight({ ...agentWithout, canManageUsers: undefined })).toBe(false);
  });
  it('a holder can create Raiser, Agent and Viewer IDs (even one at their own level)', () => {
    for (const r of MANAGED_BY_RIGHT_ROLES) expect(() => assertCanAssignRole(agentWithRight, r)).not.toThrow();
    expect(() => assertCanAssignRole({ ...agentWithRight, role: 'RAISER', roles: ['RAISER'] }, ['RAISER', 'AGENT'])).not.toThrow();
  });
  it('a holder can NOT create Team Lead, Department Head, Admin or Super Admin IDs', () => {
    for (const r of ['TEAM_LEAD', 'DEPARTMENT_HEAD', 'ADMIN', 'SUPER_ADMIN']) {
      expect(() => assertCanAssignRole(agentWithRight, r)).toThrow(/cannot assign role/i);
    }
    expect(() => assertCanAssignRole(agentWithRight, ['AGENT', 'ADMIN'])).toThrow();
  });
  it('without the right an agent still cannot create IDs of their own level', () => {
    expect(() => assertCanAssignRole(agentWithout, 'RAISER')).not.toThrow(); // lower rank: allowed as before
    expect(() => assertCanAssignRole(agentWithout, 'AGENT')).toThrow();
  });
  it('Super Admin is unchanged', () => {
    expect(() => assertCanAssignRole({ userId: 's', role: 'SUPER_ADMIN' }, 'ADMIN')).not.toThrow();
  });
});

describe('the "Manage users" right — deleting user IDs', () => {
  beforeEach(() => vi.clearAllMocks());

  it('a holder can delete a Raiser, Agent or Viewer', async () => {
    for (const role of ['RAISER', 'AGENT', 'VIEWER']) {
      prismaMock.user.findUnique.mockResolvedValue({ role, roles: [role] });
      await expect(assertCanDeleteUser(agentWithRight, 'target')).resolves.toBeUndefined();
    }
  });
  it('a holder can NOT delete a Team Lead, Department Head, Admin or Super Admin', async () => {
    for (const role of ['TEAM_LEAD', 'DEPARTMENT_HEAD', 'ADMIN', 'SUPER_ADMIN']) {
      prismaMock.user.findUnique.mockResolvedValue({ role, roles: [role] });
      await expect(assertCanDeleteUser(agentWithRight, 'target')).rejects.toThrow(/only delete Raiser, Agent and Viewer/);
    }
  });
  it('a user with several roles is protected by their highest one', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ role: 'TEAM_LEAD', roles: ['AGENT', 'TEAM_LEAD'] });
    await expect(assertCanDeleteUser(agentWithRight, 'target')).rejects.toThrow();
  });
  it('a holder cannot delete their own account', async () => {
    await expect(assertCanDeleteUser(agentWithRight, 'hr1')).rejects.toThrow(/own account/);
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
  });
  it('without the right nobody below Admin can delete', async () => {
    await expect(assertCanDeleteUser(agentWithout, 'target')).rejects.toThrow(/permission to delete/);
    await expect(assertCanDeleteUser({ userId: 'dh', role: 'DEPARTMENT_HEAD', departmentId: 'd1' }, 'target')).rejects.toThrow(/permission to delete/);
  });
  it('a missing user is a 404, not a silent success', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    await expect(assertCanDeleteUser(agentWithRight, 'ghost')).rejects.toThrow(/not found/i);
  });
  it('Super Admin / Admin keep their normal rules', async () => {
    await expect(assertCanDeleteUser({ userId: 'sa', role: 'SUPER_ADMIN' }, 'anyone')).resolves.toBeUndefined();
    prismaMock.user.findUnique.mockResolvedValue({ role: 'SUPER_ADMIN', roles: ['SUPER_ADMIN'], departmentId: null });
    await expect(assertCanDeleteUser({ userId: 'ad', role: 'ADMIN', roles: ['ADMIN'] }, 'boss')).rejects.toThrow(/equal or higher/);
  });
});

describe('requireRoleOrRight — route gate', () => {
  const run = (user: any) => {
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();
    requireRoleOrRight(['ADMIN'], 'canManageUsers')({ user } as any, res, next);
    return { next, res };
  };
  it('lets the listed roles and Super Admin through', () => {
    expect(run({ role: 'ADMIN', roles: ['ADMIN'] }).next).toHaveBeenCalled();
    expect(run({ role: 'SUPER_ADMIN', roles: ['SUPER_ADMIN'] }).next).toHaveBeenCalled();
  });
  it('lets a holder of the right through, even as a plain Raiser', () => {
    expect(run({ role: 'RAISER', roles: ['RAISER'], canManageUsers: true }).next).toHaveBeenCalled();
  });
  it('blocks everyone else with 403', () => {
    const { next, res } = run({ role: 'AGENT', roles: ['AGENT'], canManageUsers: false });
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });
  it('blocks an unauthenticated request with 401', () => {
    const { next, res } = run(undefined);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });
});

import { assertCanManageUser } from '../utils/userAccess';

describe('the "Manage users" right — viewing, editing, activating/deactivating', () => {
  beforeEach(() => vi.clearAllMocks());

  it('a holder can manage Raiser / Agent / Viewer accounts in ANY department', async () => {
    for (const role of ['RAISER', 'AGENT', 'VIEWER']) {
      prismaMock.user.findUnique.mockResolvedValue({ role, roles: [role], departmentId: 'other-dept' });
      await expect(assertCanManageUser({ ...agentWithRight, role: 'RAISER', roles: ['RAISER'] }, 'target')).resolves.toBeUndefined();
    }
  });
  it('a holder can NOT manage Team Lead, Department Head, Admin or Super Admin accounts', async () => {
    for (const role of ['TEAM_LEAD', 'DEPARTMENT_HEAD', 'ADMIN', 'SUPER_ADMIN']) {
      prismaMock.user.findUnique.mockResolvedValue({ role, roles: [role], departmentId: 'd1' });
      await expect(assertCanManageUser(agentWithRight, 'target')).rejects.toThrow(/equal or higher/);
    }
  });
  it('a user holding a senior role as well is protected by it', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ role: 'TEAM_LEAD', roles: ['AGENT', 'TEAM_LEAD'], departmentId: 'd1' });
    await expect(assertCanManageUser(agentWithRight, 'target')).rejects.toThrow();
  });
  it('without the right an agent still cannot manage anyone', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ role: 'RAISER', roles: ['RAISER'], departmentId: 'd1' });
    await expect(assertCanManageUser(agentWithout, 'target')).resolves.toBeUndefined(); // same department, lower rank: unchanged old rule
    prismaMock.user.findUnique.mockResolvedValue({ role: 'RAISER', roles: ['RAISER'], departmentId: 'elsewhere' });
    await expect(assertCanManageUser(agentWithout, 'target')).rejects.toThrow(/own department/);
  });
  it('a holder still cannot act on their own account unless the action allows it', async () => {
    await expect(assertCanManageUser(agentWithRight, 'hr1')).rejects.toThrow(/own account/);
  });
});
