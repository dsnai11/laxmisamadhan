// The "Manage users" right: a Super-Admin-granted switch on a user that lets them create and delete
// Raiser / Agent / Viewer IDs (never Team Lead, Department Head, Admin or Super Admin). The server
// enforces the same rules (backend/src/utils/userAccess.ts); this only decides what to show.
// Tested in userManagement.test.ts.

export const MANAGED_BY_RIGHT_ROLES = ['RAISER', 'AGENT', 'VIEWER'];

type Me = { id?: string; role?: string; roles?: string[]; canManageUsers?: boolean } | null | undefined;
type Target = { id: string; role?: string; roles?: string[] };

const rolesOf = (u: { role?: string; roles?: string[] } | null | undefined): string[] =>
  Array.from(new Set([...(u?.role ? [u.role] : []), ...(u?.roles || [])]));

export function hasManageUsersRight(me: Me): boolean {
  return me?.canManageUsers === true;
}

/** Super Admin / Admin: unrestricted here (the server applies the normal rank rules). */
function isOrgAdmin(me: Me): boolean {
  return rolesOf(me).some((r) => r === 'SUPER_ADMIN' || r === 'ADMIN');
}

/** Show the Delete button for this row? Never for yourself. */
export function canDeleteUserAccount(me: Me, target: Target): boolean {
  if (!me?.id || target.id === me.id) return false;
  if (isOrgAdmin(me)) return true;
  if (!hasManageUsersRight(me)) return false;
  const targetRoles = rolesOf(target);
  return targetRoles.length > 0 && targetRoles.every((r) => MANAGED_BY_RIGHT_ROLES.includes(r));
}

/** Roles offered in the create-user form: the usual ones, plus Raiser/Agent/Viewer for a holder of the right. */
export function creatableRoles(usual: string[], me: Me, allRoles: string[]): string[] {
  if (!hasManageUsersRight(me)) return usual;
  const set = new Set([...usual, ...MANAGED_BY_RIGHT_ROLES]);
  return allRoles.filter((r) => set.has(r));
}

/** Where the Users page lives for this person (admin area, or the agent/raiser area for holders of the right). */
export function usersPageHref(roles: string[]): string {
  if (roles.some((r) => ['SUPER_ADMIN', 'ADMIN', 'DEPARTMENT_HEAD'].includes(r))) return '/admin/users';
  if (roles.some((r) => ['AGENT', 'TEAM_LEAD'].includes(r))) return '/agent/users';
  return '/raiser/users';
}

/** May this person open the Users page at all? */
export function canOpenUsersPage(me: Me): boolean {
  return hasManageUsersRight(me) || rolesOf(me).some((r) => ['SUPER_ADMIN', 'ADMIN', 'DEPARTMENT_HEAD'].includes(r));
}
