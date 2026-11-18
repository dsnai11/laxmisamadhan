// Who may assign, reassign or transfer tickets — mirrors canReassignTicket / canTransferTicket in
// backend/src/services/ticket.service.ts (the server enforces it; this only decides which buttons
// to show). Rule: Super Admin, Admin, and the ticket's department head / team leads. Never agents,
// raisers or viewers. Tested in assignmentRights.test.ts.

export const ASSIGNMENT_ROLES = ['SUPER_ADMIN', 'ADMIN', 'DEPARTMENT_HEAD', 'TEAM_LEAD'] as const;

type UserLike = { id?: string; role?: string; roles?: string[]; departmentId?: string | null } | null | undefined;
type TicketLike = { departmentId?: string; department?: { headId?: string | null } | null } | null | undefined;

const rolesOf = (u: UserLike): string[] => Array.from(new Set([...(u?.role ? [u.role] : []), ...(u?.roles || [])]));

/**
 * With a ticket: may this user assign/reassign/transfer THIS ticket?
 * Without a ticket (list pages): does this user hold a role that can assign at all?
 * `leadsTeamInDept` = the user is the lead of a team in the ticket's department.
 */
export function canManageAssignment(user: UserLike, ticket?: TicketLike, leadsTeamInDept = false): boolean {
  const roles = rolesOf(user);
  if (roles.includes('SUPER_ADMIN') || roles.includes('ADMIN')) return true;
  if (!ticket) return roles.includes('DEPARTMENT_HEAD') || roles.includes('TEAM_LEAD') || leadsTeamInDept;
  if (!user?.id) return false;
  if (ticket.department?.headId === user.id || leadsTeamInDept) return true;
  const sameDept = !!user.departmentId && user.departmentId === ticket.departmentId;
  return sameDept && (roles.includes('DEPARTMENT_HEAD') || roles.includes('TEAM_LEAD'));
}
