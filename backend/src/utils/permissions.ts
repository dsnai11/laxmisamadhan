import { UserRole } from '@prisma/client';

// ---------------------------------------------------------------------------
// Permission constants
// ---------------------------------------------------------------------------
export const P = {
  // Tickets
  TICKET_CREATE: 'ticket:create',
  TICKET_READ_OWN: 'ticket:read:own',
  TICKET_READ_DEPT: 'ticket:read:dept',
  TICKET_READ_TEAM: 'ticket:read:team',
  TICKET_READ_ALL: 'ticket:read:all',
  TICKET_UPDATE_OWN: 'ticket:update:own',
  TICKET_UPDATE_DEPT: 'ticket:update:dept',
  TICKET_UPDATE_TEAM: 'ticket:update:team',
  TICKET_UPDATE_ANY: 'ticket:update:any',
  TICKET_ASSIGN: 'ticket:assign',
  TICKET_ASSIGN_TEAM: 'ticket:assign:team',
  TICKET_CLOSE: 'ticket:close',
  TICKET_BULK_ACTION: 'ticket:bulk',
  TICKET_DELETE: 'ticket:delete',

  // Comments
  COMMENT_ADD: 'comment:add',
  COMMENT_INTERNAL: 'comment:internal',

  // Users
  USER_CREATE: 'user:create',
  USER_READ: 'user:read',
  USER_UPDATE: 'user:update',
  USER_DELETE: 'user:delete',
  USER_CHANGE_ROLE: 'user:change-role',

  // Teams
  TEAM_MANAGE: 'team:manage',
  TEAM_MANAGE_OWN: 'team:manage:own',
  TEAM_VIEW_BUCKET: 'team:view-bucket',
  TEAM_VIEW_BUCKET_OWN: 'team:view-bucket:own',

  // Departments
  DEPT_CREATE: 'department:create',
  DEPT_UPDATE: 'department:update',
  DEPT_DELETE: 'department:delete',
  DEPT_MANAGE_CATEGORIES: 'department:manage-categories',

  // SLA
  SLA_MANAGE: 'sla:manage',
  SLA_VIEW: 'sla:view',

  // Knowledge
  KNOWLEDGE_READ: 'knowledge:read',
  KNOWLEDGE_WRITE: 'knowledge:write',
  KNOWLEDGE_PUBLISH: 'knowledge:publish',

  // Assets
  ASSET_READ: 'asset:read',
  ASSET_MANAGE: 'asset:manage',

  // Reports
  REPORT_OWN_TEAM: 'report:own-team',
  REPORT_DEPT: 'report:dept',
  REPORT_ALL: 'report:all',

  // System
  AUDIT_READ: 'audit:read',
  SETTINGS_MANAGE: 'settings:manage',
  APPROVALS_MANAGE: 'approvals:manage',
} as const;

export type Permission = typeof P[keyof typeof P];

// ---------------------------------------------------------------------------
// Role → permissions mapping
// ---------------------------------------------------------------------------
const ADMIN_PERMS: Permission[] = Object.values(P) as Permission[];

const DEPARTMENT_HEAD_PERMS: Permission[] = [
  P.TICKET_CREATE, P.TICKET_READ_OWN, P.TICKET_READ_DEPT, P.TICKET_UPDATE_DEPT,
  P.TICKET_ASSIGN, P.TICKET_CLOSE, P.TICKET_BULK_ACTION,
  P.COMMENT_ADD, P.COMMENT_INTERNAL,
  P.USER_CREATE, P.USER_READ, P.USER_UPDATE,
  P.TEAM_MANAGE, P.TEAM_VIEW_BUCKET,
  P.DEPT_MANAGE_CATEGORIES,
  P.SLA_MANAGE, P.SLA_VIEW,
  P.KNOWLEDGE_READ, P.KNOWLEDGE_WRITE, P.KNOWLEDGE_PUBLISH,
  P.ASSET_READ, P.ASSET_MANAGE,
  P.REPORT_DEPT, P.APPROVALS_MANAGE,
];

const TEAM_LEAD_PERMS: Permission[] = [
  P.TICKET_CREATE, P.TICKET_READ_OWN, P.TICKET_READ_TEAM, P.TICKET_UPDATE_TEAM,
  P.TICKET_ASSIGN_TEAM, P.TICKET_CLOSE,
  P.COMMENT_ADD, P.COMMENT_INTERNAL,
  P.USER_READ,
  P.TEAM_MANAGE_OWN, P.TEAM_VIEW_BUCKET_OWN,
  P.SLA_VIEW,
  P.KNOWLEDGE_READ, P.KNOWLEDGE_WRITE,
  P.ASSET_READ,
  P.REPORT_OWN_TEAM, P.APPROVALS_MANAGE,
];

const AGENT_PERMS: Permission[] = [
  P.TICKET_CREATE, P.TICKET_READ_OWN, P.TICKET_UPDATE_OWN, P.TICKET_CLOSE,
  P.COMMENT_ADD, P.COMMENT_INTERNAL,
  P.USER_READ,
  P.SLA_VIEW,
  P.KNOWLEDGE_READ, P.KNOWLEDGE_WRITE,
  P.ASSET_READ,
];

const RAISER_PERMS: Permission[] = [
  P.TICKET_CREATE, P.TICKET_READ_OWN, P.TICKET_UPDATE_OWN,
  P.COMMENT_ADD,
  P.KNOWLEDGE_READ,
];

const VIEWER_PERMS: Permission[] = [
  P.TICKET_READ_OWN,
  P.KNOWLEDGE_READ,
];

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  [UserRole.SUPER_ADMIN]: ADMIN_PERMS,
  [UserRole.ADMIN]: ADMIN_PERMS,
  [UserRole.DEPARTMENT_HEAD]: DEPARTMENT_HEAD_PERMS,
  [UserRole.TEAM_LEAD]: TEAM_LEAD_PERMS,
  [UserRole.AGENT]: AGENT_PERMS,
  [UserRole.RAISER]: RAISER_PERMS,
  [UserRole.VIEWER]: VIEWER_PERMS,
};

export function getPermissionsForRole(role: UserRole): Permission[] {
  return ROLE_PERMISSIONS[role] || [];
}

export function hasPermission(role: UserRole, permission: Permission): boolean {
  return getPermissionsForRole(role).includes(permission);
}

export function hasAnyPermission(role: UserRole, permissions: Permission[]): boolean {
  const rolePerms = getPermissionsForRole(role);
  return permissions.some(p => rolePerms.includes(p));
}
