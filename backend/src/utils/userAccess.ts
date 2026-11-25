import { prisma } from '@config/prisma';
import { AppError } from '@middleware/error.middleware';
import { UserRole } from '@prisma/client';

export interface Actor {
  userId: string;
  role: string;
  roles?: string[];
  departmentId?: string;
  /** The "Manage users" right: may create and delete low-privilege user IDs (see MANAGED_BY_RIGHT_ROLES). */
  canManageUsers?: boolean;
}

export const RANK: Record<string, number> = {
  SUPER_ADMIN: 100,
  ADMIN: 90,
  DEPARTMENT_HEAD: 70,
  TEAM_LEAD: 50,
  AGENT: 40,
  RAISER: 20,
  VIEWER: 10,
};

/** Roles a holder of the "Manage users" right may create and delete. Never Team Lead, Department Head, Admin or Super Admin. */
export const MANAGED_BY_RIGHT_ROLES = ['RAISER', 'AGENT', 'VIEWER'];

export function hasUserMgmtRight(actor: Actor): boolean {
  return actor.canManageUsers === true;
}

const forbidden = (message: string) => new AppError(message, 403, 'FORBIDDEN');

export function getActorRoles(actor: Actor): string[] {
  const roles = actor.roles && actor.roles.length > 0 ? actor.roles : [actor.role];
  return Array.from(new Set(roles.filter(Boolean)));
}

export function getEffectiveRank(actor: Actor): number {
  const roles = getActorRoles(actor);
  return Math.max(...roles.map((r) => RANK[r] ?? 0), 0);
}

export function getPrimaryRole(roles: (string | UserRole)[]): UserRole {
  if (!roles || roles.length === 0) return UserRole.RAISER;
  const sorted = [...roles].sort((a, b) => (RANK[b] ?? 0) - (RANK[a] ?? 0));
  return (sorted[0] as UserRole) || UserRole.RAISER;
}

export function assertCanAssignRole(actor: Actor, roleOrRoles: string | string[]): void {
  const actorRoles = getActorRoles(actor);
  if (actorRoles.includes('SUPER_ADMIN')) return;

  const actorRank = getEffectiveRank(actor);
  const targetRoles = Array.isArray(roleOrRoles) ? roleOrRoles : [roleOrRoles];

  // The "Manage users" right allows creating Raiser / Agent / Viewer IDs whatever the creator's own role.
  if (hasUserMgmtRight(actor) && targetRoles.every((r) => MANAGED_BY_RIGHT_ROLES.includes(r))) return;

  for (const r of targetRoles) {
    if ((RANK[r] ?? 0) >= actorRank) {
      throw forbidden(`You cannot assign role '${r}' which is equal to or higher than your highest role`);
    }
  }
}

export function isOrgWide(actor: Actor): boolean {
  const roles = getActorRoles(actor);
  return roles.includes('SUPER_ADMIN') || roles.includes('ADMIN');
}

export async function assertCanManageUser(actor: Actor, targetId: string, opts: { allowSelf?: boolean } = {}): Promise<void> {
  const actorRoles = getActorRoles(actor);
  if (actorRoles.includes('SUPER_ADMIN')) return;

  if (targetId === actor.userId) {
    if (opts.allowSelf) return;
    throw forbidden('You cannot perform this action on your own account');
  }

  const target = await prisma.user.findUnique({
    where: { id: targetId },
    select: { role: true, roles: true, departmentId: true },
  });
  if (!target) throw new AppError('User not found', 404, 'NOT_FOUND');

  const targetRoles = target.roles && target.roles.length > 0 ? target.roles : [target.role];
  const targetRank = Math.max(...targetRoles.map((r) => RANK[r] ?? 0), 0);
  const actorRank = getEffectiveRank(actor);

  if (targetRank >= actorRank) {
    throw forbidden('You cannot manage a user with an equal or higher role');
  }
  if (!isOrgWide(actor) && (!actor.departmentId || target.departmentId !== actor.departmentId)) {
    throw forbidden('You can only manage users in your own department');
  }
}

/**
 * Who may delete this user. Super Admin / Admin: under the normal rules (lower role, own department
 * unless org-wide). Anyone else needs the "Manage users" right and may only delete Raiser / Agent /
 * Viewer accounts, never their own. Tested in manage_users_right.test.ts.
 */
export async function assertCanDeleteUser(actor: Actor, targetId: string): Promise<void> {
  const roles = getActorRoles(actor);
  if (roles.includes('SUPER_ADMIN') || roles.includes('ADMIN')) {
    return assertCanManageUser(actor, targetId);
  }
  if (!hasUserMgmtRight(actor)) throw forbidden('You do not have permission to delete users');
  if (targetId === actor.userId) throw forbidden('You cannot perform this action on your own account');

  const target = await prisma.user.findUnique({ where: { id: targetId }, select: { role: true, roles: true } });
  if (!target) throw new AppError('User not found', 404, 'NOT_FOUND');
  const targetRoles = target.roles && target.roles.length > 0 ? target.roles : [target.role];
  if (!targetRoles.every((r) => MANAGED_BY_RIGHT_ROLES.includes(r))) {
    throw forbidden('You can only delete Raiser, Agent and Viewer accounts');
  }
}
