import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '@services/api';
import { useAuth } from '@context/AuthContext';
import { formatDuration, humanize } from '@utils/helpers';
import TeamsManager from '@components/admin/TeamsManager';
import CategoryConfigManager from '@components/admin/CategoryConfigManager';
import { ConfirmModal, ErrorState, Field, getErrorMessage, PageLoader, STAFF_ROLES } from '@components/common/ui';

export default function AdminDepartmentDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();

  const { data: dept, isLoading, error, refetch } = useQuery<any>({ queryKey: ['department', id], queryFn: () => api.getDepartmentById(id) });
  const { data: stats } = useQuery<any>({ queryKey: ['department-stats', id], queryFn: () => api.getDepartmentStats(id) });

  const isOrgWide = ['SUPER_ADMIN', 'ADMIN'].includes(user?.role || '');
  const isDeptHead = user?.role === 'DEPARTMENT_HEAD';
  const canManageDept = isOrgWide || (isDeptHead && (user?.departmentId === id || dept?.headId === user?.id));
  const canManageTeams = canManageDept;

  const [form, setForm] = useState({ name: '', type: '', description: '', supportEmail: '', color: '#3B82F6', autoAssign: false, assignStrategy: 'round_robin', headId: '' });
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (dept) {
      setForm({
        name: dept.name,
        type: dept.type || '',
        description: dept.description || '',
        supportEmail: dept.supportEmail || '',
        color: dept.color || '#3B82F6',
        autoAssign: !!dept.autoAssign,
        assignStrategy: dept.assignStrategy || 'round_robin',
        headId: dept.headId || '',
      });
    }
  }, [dept]);

  if (isLoading) return <PageLoader />;
  if (error || !dept) return <ErrorState error={error || new Error('Department not found')} onRetry={() => refetch()} />;

  const people: any[] = dept.users || [];
  const candidates = people.filter((u) => STAFF_ROLES.includes(u.role) && u.status === 'ACTIVE');

  const save = async () => {
    if (!form.name.trim()) return toast.error('The name cannot be empty');
    setSaving(true);
    try {
      await api.updateDepartment(id, {
        name: form.name.trim(),
        type: form.type.trim() || undefined,
        description: form.description.trim() || undefined,
        supportEmail: form.supportEmail.trim() || undefined,
        color: form.color,
        autoAssign: form.autoAssign,
        assignStrategy: form.assignStrategy,
      } as any);
      if (isOrgWide && form.headId !== (dept.headId || '')) await api.assignDepartmentHead(id, form.headId || null);
      toast.success('Department saved');
      await qc.invalidateQueries();
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    setDeleting(true);
    try {
      await api.deleteDepartment(id);
      toast.success('Department deleted successfully');
      navigate('/admin/departments');
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setDeleting(false);
      setDeleteOpen(false);
    }
  };

  const ticketStats = stats?.tickets;

  return (
    <div className="space-y-6">
      <div>
        <Link to="/admin/departments" className="text-sm text-primary-600 hover:underline">← Departments</Link>
        <div className="mt-2 flex items-center gap-3">
          <span className="h-4 w-4 rounded-full" style={{ backgroundColor: dept.color }} />
          <h1 className="page-title">{dept.name}</h1>
          {dept.supportEmail && (
            <span className="badge badge-secondary text-xs font-mono ml-2">
              ✉ {dept.supportEmail}
            </span>
          )}
        </div>
        <p className="page-subtitle">{humanize(dept.type)}</p>
      </div>

      {ticketStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="card p-4"><p className="text-sm text-gray-500">Total tickets</p><p className="text-2xl font-bold">{ticketStats.total ?? 0}</p></div>
          <div className="card p-4"><p className="text-sm text-gray-500">Open</p><p className="text-2xl font-bold">{ticketStats.open ?? 0}</p></div>
          <div className="card p-4"><p className="text-sm text-gray-500">Resolved</p><p className="text-2xl font-bold">{ticketStats.resolved ?? 0}</p></div>
          <div className="card p-4"><p className="text-sm text-gray-500">Avg resolution</p><p className="text-2xl font-bold">{formatDuration(ticketStats.avgResolutionTime)}</p></div>
        </div>
      )}

      {canManageDept && (
        <div className="card p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">Settings</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Name"><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="Inbound Support Email">
              <input
                className="input"
                placeholder="e.g. hr.support@lifc.in or project.lifc.in"
                value={form.supportEmail}
                onChange={(e) => setForm({ ...form, supportEmail: e.target.value })}
              />
            </Field>
            <Field label="Department Category / Type"><input className="input" placeholder="e.g. HR, Admin, IT Hardware..." value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} /></Field>
            {isOrgWide && (
              <Field label="Department head">
                <select className="input" value={form.headId} onChange={(e) => setForm({ ...form, headId: e.target.value })}>
                  <option value="">No head</option>
                  {candidates.map((u) => <option key={u.id} value={u.id}>{u.firstName} {u.lastName} ({humanize(u.role)})</option>)}
                </select>
              </Field>
            )}
            <div className="md:col-span-2">
              <Field label="Description"><textarea className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
            </div>
            <Field label="Colour"><input type="color" className="h-10 w-20 rounded border border-gray-300" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} /></Field>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input type="checkbox" className="h-4 w-4 rounded border-gray-300 text-primary-600" checked={form.autoAssign} onChange={(e) => setForm({ ...form, autoAssign: e.target.checked })} />
                Automatically assign new tickets
              </label>
              <select className="input" disabled={!form.autoAssign} value={form.assignStrategy} onChange={(e) => setForm({ ...form, assignStrategy: e.target.value })}>
                <option value="round_robin">Round robin</option>
                <option value="least_loaded">Least loaded agent</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end"><button className="btn-primary" disabled={saving} onClick={save}>{saving ? 'Saving...' : 'Save changes'}</button></div>
        </div>
      )}

      <CategoryConfigManager departmentId={id} canManage={canManageTeams} />

      <TeamsManager departmentId={id} canManage={canManageTeams} />

      <div className="card">
        <div className="p-4 border-b border-gray-200"><h2 className="font-semibold text-gray-900">People ({people.length})</h2></div>
        <div className="table-container">
          <table className="table">
            <thead><tr><th>Name</th><th>Role</th><th>Email</th></tr></thead>
            <tbody>
              {people.map((u) => (
                <tr key={u.id}>
                  <td className="font-medium">{canManageDept ? <Link className="hover:text-primary-700" to={`/admin/users/${u.id}`}>{u.firstName} {u.lastName}</Link> : `${u.firstName} ${u.lastName}`}</td>
                  <td className="text-sm">{humanize(u.role)}</td>
                  <td className="text-sm text-gray-600">{u.email}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {isOrgWide && (
        <div className="card p-6 border-red-200 bg-red-50/50 dark:bg-red-950/20 dark:border-red-900/40">
          <h2 className="text-base font-semibold text-red-700 dark:text-red-400">Danger Zone</h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Deleting this department will unassign members, teams, and configurations associated with it. This action cannot be undone.
          </p>
          <div className="mt-4 flex justify-end">
            <button
              onClick={() => setDeleteOpen(true)}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
            >
              Delete Department
            </button>
          </div>
        </div>
      )}

      <ConfirmModal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={remove}
        title="Delete Department"
        message={`Are you sure you want to delete "${dept.name}"? This action cannot be undone.`}
        confirmLabel="Delete Department"
        danger
        busy={deleting}
      />
    </div>
  );
}
