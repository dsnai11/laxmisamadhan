import { Link } from 'react-router-dom';
import { PageHeader } from '@components/common/ui';
import { cn } from '@utils/helpers';

// Mirror of backend permissions.ts for UI display
const ROLES = ['SUPER_ADMIN', 'ADMIN', 'DEPARTMENT_HEAD', 'TEAM_LEAD', 'AGENT', 'RAISER', 'VIEWER'] as const;
type Role = typeof ROLES[number];

type AccessLevel = 'full' | 'dept' | 'team' | 'own' | 'none';

interface PermissionRow {
  category: string;
  permission: string;
  description: string;
  access: Record<Role, AccessLevel>;
}

const rows: PermissionRow[] = [
  // Tickets
  {
    category: 'Tickets',
    permission: 'Create Ticket',
    description: 'Raise a new support ticket',
    access: { SUPER_ADMIN: 'full', ADMIN: 'full', DEPARTMENT_HEAD: 'full', TEAM_LEAD: 'full', AGENT: 'full', RAISER: 'full', VIEWER: 'none' },
  },
  {
    category: 'Tickets',
    permission: 'View Tickets',
    description: 'See ticket list and details',
    access: { SUPER_ADMIN: 'full', ADMIN: 'full', DEPARTMENT_HEAD: 'dept', TEAM_LEAD: 'team', AGENT: 'own', RAISER: 'own', VIEWER: 'own' },
  },
  {
    category: 'Tickets',
    permission: 'Update Ticket',
    description: 'Edit ticket fields (title, description, tags)',
    access: { SUPER_ADMIN: 'full', ADMIN: 'full', DEPARTMENT_HEAD: 'dept', TEAM_LEAD: 'team', AGENT: 'own', RAISER: 'own', VIEWER: 'none' },
  },
  {
    category: 'Tickets',
    permission: 'Assign / Reassign',
    description: 'Assign tickets to agents',
    access: { SUPER_ADMIN: 'full', ADMIN: 'full', DEPARTMENT_HEAD: 'dept', TEAM_LEAD: 'team', AGENT: 'none', RAISER: 'none', VIEWER: 'none' },
  },
  {
    category: 'Tickets',
    permission: 'Close / Resolve',
    description: 'Mark tickets as resolved or closed',
    access: { SUPER_ADMIN: 'full', ADMIN: 'full', DEPARTMENT_HEAD: 'dept', TEAM_LEAD: 'team', AGENT: 'own', RAISER: 'none', VIEWER: 'none' },
  },
  {
    category: 'Tickets',
    permission: 'Bulk Actions',
    description: 'Apply actions to multiple tickets at once',
    access: { SUPER_ADMIN: 'full', ADMIN: 'full', DEPARTMENT_HEAD: 'dept', TEAM_LEAD: 'none', AGENT: 'none', RAISER: 'none', VIEWER: 'none' },
  },
  {
    category: 'Tickets',
    permission: 'Delete Ticket',
    description: 'Permanently delete a ticket',
    access: { SUPER_ADMIN: 'full', ADMIN: 'full', DEPARTMENT_HEAD: 'none', TEAM_LEAD: 'none', AGENT: 'none', RAISER: 'none', VIEWER: 'none' },
  },
  // Comments
  {
    category: 'Comments',
    permission: 'Add Comment',
    description: 'Post a public reply on a ticket',
    access: { SUPER_ADMIN: 'full', ADMIN: 'full', DEPARTMENT_HEAD: 'full', TEAM_LEAD: 'full', AGENT: 'full', RAISER: 'full', VIEWER: 'none' },
  },
  {
    category: 'Comments',
    permission: 'Internal Notes',
    description: 'Post internal notes (hidden from raiser)',
    access: { SUPER_ADMIN: 'full', ADMIN: 'full', DEPARTMENT_HEAD: 'full', TEAM_LEAD: 'full', AGENT: 'full', RAISER: 'none', VIEWER: 'none' },
  },
  // Users
  {
    category: 'Users',
    permission: 'Create User',
    description: 'Register a new user account',
    access: { SUPER_ADMIN: 'full', ADMIN: 'full', DEPARTMENT_HEAD: 'dept', TEAM_LEAD: 'none', AGENT: 'none', RAISER: 'none', VIEWER: 'none' },
  },
  {
    category: 'Users',
    permission: 'View Users',
    description: 'Browse and search user list',
    access: { SUPER_ADMIN: 'full', ADMIN: 'full', DEPARTMENT_HEAD: 'full', TEAM_LEAD: 'full', AGENT: 'full', RAISER: 'none', VIEWER: 'none' },
  },
  {
    category: 'Users',
    permission: 'Update User',
    description: 'Edit user profile and settings',
    access: { SUPER_ADMIN: 'full', ADMIN: 'full', DEPARTMENT_HEAD: 'dept', TEAM_LEAD: 'none', AGENT: 'none', RAISER: 'none', VIEWER: 'none' },
  },
  {
    category: 'Users',
    permission: 'Change Role',
    description: 'Promote or demote a user\'s role',
    access: { SUPER_ADMIN: 'full', ADMIN: 'full', DEPARTMENT_HEAD: 'none', TEAM_LEAD: 'none', AGENT: 'none', RAISER: 'none', VIEWER: 'none' },
  },
  {
    category: 'Users',
    permission: 'Delete User',
    description: 'Remove a user account',
    access: { SUPER_ADMIN: 'full', ADMIN: 'full', DEPARTMENT_HEAD: 'none', TEAM_LEAD: 'none', AGENT: 'none', RAISER: 'none', VIEWER: 'none' },
  },
  // Teams
  {
    category: 'Teams',
    permission: 'Create / Delete Team',
    description: 'Add or remove teams in a department',
    access: { SUPER_ADMIN: 'full', ADMIN: 'full', DEPARTMENT_HEAD: 'dept', TEAM_LEAD: 'none', AGENT: 'none', RAISER: 'none', VIEWER: 'none' },
  },
  {
    category: 'Teams',
    permission: 'Manage Team Members',
    description: 'Add or remove members from a team',
    access: { SUPER_ADMIN: 'full', ADMIN: 'full', DEPARTMENT_HEAD: 'dept', TEAM_LEAD: 'team', AGENT: 'none', RAISER: 'none', VIEWER: 'none' },
  },
  {
    category: 'Teams',
    permission: 'View Team Bucket',
    description: 'See all tickets assigned to team members',
    access: { SUPER_ADMIN: 'full', ADMIN: 'full', DEPARTMENT_HEAD: 'dept', TEAM_LEAD: 'team', AGENT: 'none', RAISER: 'none', VIEWER: 'none' },
  },
  // Departments
  {
    category: 'Departments',
    permission: 'Manage Departments',
    description: 'Create, edit and delete departments',
    access: { SUPER_ADMIN: 'full', ADMIN: 'full', DEPARTMENT_HEAD: 'none', TEAM_LEAD: 'none', AGENT: 'none', RAISER: 'none', VIEWER: 'none' },
  },
  {
    category: 'Departments',
    permission: 'Manage Categories',
    description: 'Configure ticket categories per department',
    access: { SUPER_ADMIN: 'full', ADMIN: 'full', DEPARTMENT_HEAD: 'dept', TEAM_LEAD: 'none', AGENT: 'none', RAISER: 'none', VIEWER: 'none' },
  },
  // SLA
  {
    category: 'SLA',
    permission: 'Manage SLA Policies',
    description: 'Create and edit SLA policies and timers',
    access: { SUPER_ADMIN: 'full', ADMIN: 'full', DEPARTMENT_HEAD: 'dept', TEAM_LEAD: 'none', AGENT: 'none', RAISER: 'none', VIEWER: 'none' },
  },
  {
    category: 'SLA',
    permission: 'View SLA Status',
    description: 'See SLA timers and breach warnings',
    access: { SUPER_ADMIN: 'full', ADMIN: 'full', DEPARTMENT_HEAD: 'full', TEAM_LEAD: 'full', AGENT: 'full', RAISER: 'none', VIEWER: 'none' },
  },
  {
    category: 'SLA',
    permission: 'Receive SLA Breach Alerts',
    description: 'Get notified when a ticket breaches SLA',
    access: { SUPER_ADMIN: 'full', ADMIN: 'full', DEPARTMENT_HEAD: 'dept', TEAM_LEAD: 'team', AGENT: 'own', RAISER: 'none', VIEWER: 'none' },
  },
  // Knowledge
  {
    category: 'Knowledge Base',
    permission: 'Read Articles',
    description: 'Browse and search knowledge base',
    access: { SUPER_ADMIN: 'full', ADMIN: 'full', DEPARTMENT_HEAD: 'full', TEAM_LEAD: 'full', AGENT: 'full', RAISER: 'full', VIEWER: 'full' },
  },
  {
    category: 'Knowledge Base',
    permission: 'Write / Edit Articles',
    description: 'Create and edit knowledge base articles',
    access: { SUPER_ADMIN: 'full', ADMIN: 'full', DEPARTMENT_HEAD: 'full', TEAM_LEAD: 'full', AGENT: 'full', RAISER: 'none', VIEWER: 'none' },
  },
  {
    category: 'Knowledge Base',
    permission: 'Publish Articles',
    description: 'Publish or unpublish articles publicly',
    access: { SUPER_ADMIN: 'full', ADMIN: 'full', DEPARTMENT_HEAD: 'full', TEAM_LEAD: 'none', AGENT: 'none', RAISER: 'none', VIEWER: 'none' },
  },
  // Assets
  {
    category: 'Assets',
    permission: 'View Assets',
    description: 'Browse the asset inventory',
    access: { SUPER_ADMIN: 'full', ADMIN: 'full', DEPARTMENT_HEAD: 'full', TEAM_LEAD: 'full', AGENT: 'full', RAISER: 'none', VIEWER: 'none' },
  },
  {
    category: 'Assets',
    permission: 'Manage Assets',
    description: 'Create, edit, and assign assets',
    access: { SUPER_ADMIN: 'full', ADMIN: 'full', DEPARTMENT_HEAD: 'dept', TEAM_LEAD: 'none', AGENT: 'none', RAISER: 'none', VIEWER: 'none' },
  },
  // Reports
  {
    category: 'Reports',
    permission: 'View Reports',
    description: 'Access dashboards and analytics',
    access: { SUPER_ADMIN: 'full', ADMIN: 'full', DEPARTMENT_HEAD: 'dept', TEAM_LEAD: 'team', AGENT: 'none', RAISER: 'none', VIEWER: 'none' },
  },
  // System
  {
    category: 'System',
    permission: 'View Audit Logs',
    description: 'Access security and audit trail',
    access: { SUPER_ADMIN: 'full', ADMIN: 'full', DEPARTMENT_HEAD: 'none', TEAM_LEAD: 'none', AGENT: 'none', RAISER: 'none', VIEWER: 'none' },
  },
  {
    category: 'System',
    permission: 'System Settings',
    description: 'Configure system-wide settings',
    access: { SUPER_ADMIN: 'full', ADMIN: 'full', DEPARTMENT_HEAD: 'none', TEAM_LEAD: 'none', AGENT: 'none', RAISER: 'none', VIEWER: 'none' },
  },
  {
    category: 'System',
    permission: 'Manage Approvals',
    description: 'Create and respond to approval requests',
    access: { SUPER_ADMIN: 'full', ADMIN: 'full', DEPARTMENT_HEAD: 'full', TEAM_LEAD: 'full', AGENT: 'none', RAISER: 'none', VIEWER: 'none' },
  },
];

const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Admin',
  DEPARTMENT_HEAD: 'Dept Head',
  TEAM_LEAD: 'Team Lead',
  AGENT: 'Agent',
  RAISER: 'Raiser',
  VIEWER: 'Viewer',
};

const ROLE_COLORS: Record<Role, string> = {
  SUPER_ADMIN: '#7c3aed',
  ADMIN: '#2563eb',
  DEPARTMENT_HEAD: '#0891b2',
  TEAM_LEAD: '#059669',
  AGENT: '#d97706',
  RAISER: '#6b7280',
  VIEWER: '#9ca3af',
};

function AccessCell({ level }: { level: AccessLevel }) {
  const config: Record<AccessLevel, { icon: string; label: string; cls: string }> = {
    full: { icon: '✓', label: 'Full', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    dept: { icon: '◐', label: 'Dept', cls: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
    team: { icon: '◑', label: 'Team', cls: 'bg-violet-50 text-violet-700 border-violet-200' },
    own: { icon: '○', label: 'Own', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
    none: { icon: '✕', label: 'None', cls: 'bg-gray-50 text-gray-300 border-gray-100' },
  };
  const c = config[level];
  return (
    <td className="text-center px-2 py-3">
      <span className={cn('inline-flex flex-col items-center gap-0.5 text-xs font-semibold px-2 py-1 rounded border', c.cls)}>
        <span className="text-base leading-none">{c.icon}</span>
        <span className="text-[10px]">{c.label}</span>
      </span>
    </td>
  );
}

export default function RolePermissions() {
  const categories = [...new Set(rows.map(r => r.category))];

  return (
    <div className="space-y-6 max-w-full">
      <PageHeader
        title="Role Permissions"
        subtitle="Reference guide for what each role can access and manage"
        actions={<Link to="/admin/settings" className="btn-secondary btn-sm">← Settings</Link>}
      />

      {/* Legend */}
      <div className="card p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Access Level Legend</h3>
        <div className="flex flex-wrap gap-3 text-sm">
          {[
            { icon: '✓', label: 'Full', desc: 'Unrestricted access', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
            { icon: '◐', label: 'Dept', desc: 'Own department only', cls: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
            { icon: '◑', label: 'Team', desc: 'Own team only', cls: 'bg-violet-50 text-violet-700 border-violet-200' },
            { icon: '○', label: 'Own', desc: 'Own data only', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
            { icon: '✕', label: 'None', desc: 'No access', cls: 'bg-gray-50 text-gray-300 border-gray-100' },
          ].map(l => (
            <div key={l.label} className="flex items-center gap-2">
              <span className={cn('inline-flex items-center justify-center w-6 h-6 rounded border font-bold text-sm', l.cls)}>{l.icon}</span>
              <span className="font-medium text-gray-700">{l.label}</span>
              <span className="text-gray-400">—</span>
              <span className="text-gray-600">{l.desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Matrix */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-semibold text-gray-700 w-48">Permission</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700 w-56 hidden md:table-cell">Description</th>
                {ROLES.map(role => (
                  <th key={role} className="text-center px-2 py-3 font-semibold min-w-[80px]">
                    <div
                      className="text-xs px-2 py-1 rounded-full text-white inline-block"
                      style={{ background: ROLE_COLORS[role] }}
                    >
                      {ROLE_LABELS[role]}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {categories.map(cat => {
                const catRows = rows.filter(r => r.category === cat);
                return (
                  <>
                    <tr key={`cat-${cat}`} className="bg-gray-50">
                      <td colSpan={ROLES.length + 2} className="px-4 py-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-gray-500">{cat}</span>
                      </td>
                    </tr>
                    {catRows.map(row => (
                      <tr key={row.permission} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 pl-8">
                          <p className="font-medium text-gray-800">{row.permission}</p>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <p className="text-xs text-gray-500">{row.description}</p>
                        </td>
                        {ROLES.map(role => <AccessCell key={role} level={row.access[role]} />)}
                      </tr>
                    ))}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-gray-400 pb-4">
        * Permissions are enforced on both the API layer (backend middleware) and the UI (route guards and conditional rendering).
        The SUPER_ADMIN role always has unrestricted access regardless of any department or team restrictions.
      </p>
    </div>
  );
}
