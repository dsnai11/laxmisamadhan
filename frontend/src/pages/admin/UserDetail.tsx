import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '@services/api';
import { useAuth } from '@context/AuthContext';
import { formatDate, humanize } from '@utils/helpers';
import {
  assignableRoles,
  Avatar,
  canManageRole,
  ConfirmModal,
  ErrorState,
  Field,
  getErrorMessage,
  PageLoader,
  ROLE_OPTIONS,
  ROLE_RANK,
  USER_STATUS_OPTIONS,
} from '@components/common/ui';

export default function AdminUserDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user: me } = useAuth();

  const myRoles = Array.from(new Set([
    ...(me?.role ? [me.role] : []),
    ...((me as any)?.roles || []),
  ]));
  const isSuperAdmin = myRoles.includes('SUPER_ADMIN');
  const isOrgWide = isSuperAdmin || myRoles.includes('ADMIN');

  const { data: user, isLoading, error, refetch } = useQuery<any>({ queryKey: ['admin-user', id], queryFn: () => api.getUserById(id) });
  const { data: departments } = useQuery({ queryKey: ['departments'], queryFn: () => api.getDepartments() });

  const [form, setForm] = useState<{
    email: string;
    firstName: string;
    lastName: string;
    phone: string;
    mobile: string;
    employeeId: string;
    jobTitle: string;
    site: string;
    branch: string;
    state: string;
    reportingManagerName: string;
    departmentRaiserName: string;
    departmentId: string;
    role: string;
    roles: string[];
    status: string;
    canViewTeamBucket: boolean;
  }>({
    email: '',
    firstName: '',
    lastName: '',
    phone: '',
    mobile: '',
    employeeId: '',
    jobTitle: '',
    site: '',
    branch: '',
    state: '',
    reportingManagerName: '',
    departmentRaiserName: '',
    departmentId: '',
    role: '',
    roles: [],
    status: '',
    canViewTeamBucket: false,
  });
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    if (user) {
      const currentRoles = (user.roles && user.roles.length > 0 ? user.roles : [user.role]) as string[];
      setForm({
        email: user.email || '',
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        phone: user.phone || '',
        mobile: user.mobile || '',
        employeeId: user.employeeId || '',
        jobTitle: user.jobTitle || '',
        site: user.branch || user.site || '',
        branch: user.branch || user.site || '',
        state: user.state || '',
        reportingManagerName: user.reportingManagerName || '',
        departmentRaiserName: user.departmentRaiserName || '',
        departmentId: user.departmentId || '',
        role: user.role,
        roles: currentRoles,
        status: user.status,
        canViewTeamBucket: user.canViewTeamBucket || false,
      });
    }
  }, [user]);

  if (isLoading) return <PageLoader />;
  if (error || !user) return <ErrorState error={error || new Error('User not found')} onRetry={() => refetch()} />;

  const isSelf = user.id === me?.id;
  const targetRoles = (user.roles && user.roles.length > 0 ? user.roles : [user.role]) as string[];
  const myMaxRank = Math.max(...myRoles.map(r => ROLE_RANK[r] ?? 0), 0);
  const targetRank = Math.max(...targetRoles.map(r => ROLE_RANK[r] ?? 0), 0);
  const sameDept = !user.departmentId || !me?.departmentId || user.departmentId === me?.departmentId;
  const editable = isSuperAdmin || (!isSelf && myMaxRank > targetRank && (isOrgWide || sameDept));
  const canDelete = !isSelf && (isSuperAdmin || (myMaxRank > targetRank && myMaxRank >= 70 && (isOrgWide || sameDept)));
  const roles = isSuperAdmin ? ROLE_OPTIONS : Array.from(new Set([...assignableRoles(me?.role), user.role]));

  const save = async () => {
    if (!form.email || !form.email.includes('@')) {
      return toast.error('A valid email address is required');
    }
    if (!form.firstName.trim() || !form.lastName.trim()) {
      return toast.error('First name and last name are required');
    }
    if (form.roles.length === 0) {
      return toast.error('User must have at least one assigned role');
    }
    setSaving(true);
    try {
      await api.updateUser(user.id, {
        email: form.email.trim(),
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        phone: form.phone.trim() || null,
        mobile: form.mobile.trim() || null,
        employeeId: form.employeeId.trim() || null,
        jobTitle: form.jobTitle.trim() || null,
        site: form.branch.trim() || form.site.trim() || null,
        branch: form.branch.trim() || form.site.trim() || null,
        state: form.state.trim() || null,
        reportingManagerName: form.reportingManagerName.trim() || null,
        departmentRaiserName: form.departmentRaiserName.trim() || null,
        canViewTeamBucket: form.canViewTeamBucket,
        ...(isOrgWide ? { departmentId: (form.departmentId || null) as any } : {}),
      } as any);
      const oldRoles = ((user.roles && user.roles.length > 0 ? user.roles : [user.role]) as string[]).slice().sort();
      const newRoles = form.roles.slice().sort();
      if (JSON.stringify(oldRoles) !== JSON.stringify(newRoles)) {
        await api.updateUserRole(user.id, form.roles);
      }
      if (form.status !== user.status) {
        await api.updateUserStatus(user.id, form.status);
      }
      toast.success('User updated successfully');
      await qc.invalidateQueries();
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const resetPassword = async () => {
    if (newPassword.length < 12) return toast.error('The password must be at least 12 characters');
    setResetting(true);
    try {
      await api.resetUserPassword(user.id, newPassword);
      toast.success('Password reset. The user has been signed out everywhere.');
      setNewPassword('');
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setResetting(false);
    }
  };

  const remove = async () => {
    setDeleting(true);
    try {
      await api.deleteUser(user.id);
      toast.success('User deleted');
      await qc.invalidateQueries();
      navigate('/admin/users');
    } catch (e) {
      toast.error(getErrorMessage(e));
      setDeleting(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link to="/admin/users" className="text-sm text-primary-600 hover:underline">← Users</Link>
        <div className="mt-3 flex items-center gap-4">
          <Avatar firstName={user.firstName} lastName={user.lastName} size={14} />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="page-title">{user.firstName} {user.lastName}</h1>
              {user.employeeId && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-medium bg-blue-50 text-blue-700 border border-blue-200">
                  {user.employeeId}
                </span>
              )}
            </div>
            <p className="page-subtitle">
              {user.email} · {(user.roles && user.roles.length > 0 ? user.roles : [user.role]).map(humanize).join(', ')} · joined {formatDate(user.createdAt)}
            </p>
          </div>
        </div>
      </div>

      {!editable && (
        <div className="rounded-lg bg-warning-50 border border-warning-200 text-warning-800 text-sm px-4 py-3">
          {isSelf ? 'This is your own account. Edit your details from your profile page; role and status cannot be changed here.' : 'You do not have permission to edit this user.'}
        </div>
      )}

      <div className="card p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="First name" required>
          <input className="input" disabled={!editable} value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
        </Field>
        <Field label="Last name" required>
          <input className="input" disabled={!editable} value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
        </Field>
        <Field label="Email address" required hint="Login email & notification recipient">
          <input type="email" className="input" disabled={!editable} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </Field>
        <Field label="Employee / User ID" hint="Unique identifier">
          <input className="input" disabled={!editable} placeholder="e.g. LIFC-1001" value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })} />
        </Field>
        <Field label="Phone / Landline">
          <input className="input" disabled={!editable} placeholder="e.g. 022-12345678" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </Field>
        <Field label="Mobile Number" hint="Primary mobile number">
          <input className="input" disabled={!editable} placeholder="e.g. 9876543210" value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} />
        </Field>
        <Field label="Job Title / Designation">
          <input className="input" disabled={!editable} placeholder="e.g. Senior Manager" value={form.jobTitle} onChange={(e) => setForm({ ...form, jobTitle: e.target.value })} />
        </Field>
        <Field label="Department Raiser Name">
          <input className="input" disabled={!editable} placeholder="e.g. Priya Singh" value={form.departmentRaiserName} onChange={(e) => setForm({ ...form, departmentRaiserName: e.target.value })} />
        </Field>
        <Field label="Branch / Location">
          <input className="input" disabled={!editable} placeholder="e.g. ROSHAN TOWER JAIPUR HO" value={form.branch} onChange={(e) => setForm({ ...form, branch: e.target.value, site: e.target.value })} />
        </Field>
        <Field label="State">
          <input className="input" disabled={!editable} placeholder="e.g. RAJASTHAN" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
        </Field>
        <Field label="Reporting Manager Name">
          <input className="input" disabled={!editable} placeholder="e.g. Rajesh Kumar" value={form.reportingManagerName} onChange={(e) => setForm({ ...form, reportingManagerName: e.target.value })} />
        </Field>
        <Field label="Department">
          <select className="input" disabled={!editable || !isOrgWide} value={form.departmentId} onChange={(e) => setForm({ ...form, departmentId: e.target.value })}>
            <option value="">None</option>
            {(departments || []).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </Field>
        <Field label="Status">
          <select className="input" disabled={!editable} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            {USER_STATUS_OPTIONS.map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
          </select>
        </Field>
        <div className="md:col-span-2">
          <Field label="Assigned Roles" hint="Select one or more roles for this user. Their effective permissions will combine all selected roles.">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-1">
              {roles.map((r) => {
                const checked = form.roles.includes(r);
                return (
                  <label
                    key={r}
                    className={`flex items-center gap-2 p-2.5 rounded-lg border text-sm font-medium transition-all ${
                      !editable ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
                    } ${
                      checked
                        ? 'bg-primary-50/90 border-primary-400 text-primary-900 shadow-xs dark:bg-primary-950/40 dark:border-primary-600'
                        : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-300'
                    }`}
                  >
                    <input
                      type="checkbox"
                      disabled={!editable}
                      checked={checked}
                      onChange={(e) => {
                        if (!editable) return;
                        if (e.target.checked) {
                          setForm({ ...form, roles: [...form.roles, r] });
                        } else {
                          if (form.roles.length <= 1) {
                            toast.error('User must have at least one assigned role');
                            return;
                          }
                          setForm({ ...form, roles: form.roles.filter((x) => x !== r) });
                        }
                      }}
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span>{humanize(r)}</span>
                  </label>
                );
              })}
            </div>
          </Field>
        </div>
        <div className="md:col-span-2">
          <Field label="Special Privileges / Permissions" hint="Control granular feature access for this user without changing their primary role.">
            <label className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/40 hover:bg-gray-100/60 transition-colors cursor-pointer">
              <input
                type="checkbox"
                disabled={!editable}
                checked={form.canViewTeamBucket}
                onChange={(e) => setForm({ ...form, canViewTeamBucket: e.target.checked })}
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 h-4 w-4"
              />
              <div>
                <span className="text-sm font-semibold text-gray-900 dark:text-white">Team Bucket Access</span>
                <p className="text-xs text-gray-500 dark:text-slate-400">
                  Allow this agent to access the Team Bucket and view tickets assigned to their team queue.
                </p>
              </div>
            </label>
          </Field>
        </div>
        <div className="md:col-span-2 flex justify-end">
          <button className="btn-primary" disabled={!editable || saving} onClick={save}>{saving ? 'Saving...' : 'Save changes'}</button>
        </div>
      </div>

      <div className="card p-6 text-sm grid grid-cols-2 gap-3">
        <div><span className="text-gray-500">Last login</span><p>{user.lastLoginAt ? formatDate(user.lastLoginAt, 'datetime') : 'Never'}</p></div>
        <div><span className="text-gray-500">Two-factor authentication</span><p>{user.mfaEnabled ? 'Enabled' : 'Off'}</p></div>
        <div><span className="text-gray-500">Manager</span><p>{user.manager ? `${user.manager.firstName} ${user.manager.lastName}` : (user.reportingManagerName || '-')}</p></div>
        <div><span className="text-gray-500">Account created</span><p>{formatDate(user.createdAt, 'datetime')}</p></div>
      </div>

      {editable && (
        <div className="card p-6 space-y-3">
          <h2 className="font-semibold text-gray-900">Reset password</h2>
          <p className="text-sm text-gray-600">Set a new password for this user. They are signed out everywhere and should change it after signing in. Use at least 12 characters with upper and lower case letters, a number and a symbol.</p>
          <div className="flex gap-2">
            <input type="text" autoComplete="off" className="input" placeholder="New password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            <button className="btn-secondary whitespace-nowrap" disabled={resetting || !newPassword} onClick={resetPassword}>{resetting ? 'Resetting...' : 'Reset password'}</button>
          </div>
        </div>
      )}

      {canDelete && (
        <div className="card p-6 border-danger-200">
          <h2 className="font-semibold text-danger-700">Danger zone</h2>
          <p className="text-sm text-gray-600 mt-1">Deleting a user removes their account. Consider setting the status to Inactive instead if they have ticket history.</p>
          <button className="btn-danger mt-4" onClick={() => setDeleteOpen(true)}>Delete user</button>
        </div>
      )}

      <ConfirmModal
        open={deleteOpen}
        title="Delete user"
        message={`Permanently delete ${user.firstName} ${user.lastName}? This cannot be undone.`}
        confirmLabel="Delete"
        danger
        busy={deleting}
        onConfirm={remove}
        onClose={() => setDeleteOpen(false)}
      />
    </div>
  );
}

