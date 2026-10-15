import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '@services/api';
import { useAuth } from '@context/AuthContext';
import { humanize } from '@utils/helpers';
import { ConfirmModal, ErrorState, Field, getErrorMessage, Modal, PageHeader, PageLoader } from '@components/common/ui';

const PRESET_CATEGORIES = [
  'Human Resources (HR)',
  'Administration (Admin)',
  'Finance & Accounts',
  'Operations',
  'Digital Security and AI',
  'IT Hardware',
  'IT Software',
  'Legal & Compliance',
  'Custom Category',
];

export default function AdminDepartments() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const isOrgWide = ['SUPER_ADMIN', 'ADMIN'].includes(user?.role || '');
  const isDeptHead = user?.role === 'DEPARTMENT_HEAD';
  const { data: departments, isLoading, error, refetch } = useQuery({ queryKey: ['departments'], queryFn: () => api.getDepartments() });
  const [open, setOpen] = useState(false);
  const [deletingDept, setDeletingDept] = useState<any | null>(null);
  const [form, setForm] = useState({ name: '', type: 'Human Resources (HR)', customType: '', description: '', supportEmail: '', color: '#EF4444' });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (isLoading) return <PageLoader />;
  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;

  const list: any[] = isDeptHead
    ? (departments || []).filter((d: any) => d.id === user?.departmentId || d.head?.id === user?.id)
    : (departments || []);

  const openCreate = () => {
    setForm({ name: '', type: 'Human Resources (HR)', customType: '', description: '', supportEmail: '', color: '#EF4444' });
    setOpen(true);
  };

  const create = async () => {
    if (!form.name.trim()) return toast.error('Give the department a name');
    const finalType = form.type === 'Custom Category' ? form.customType.trim() : form.type;
    if (!finalType) return toast.error('Please specify a department category');
    setSaving(true);
    try {
      await api.createDepartment({
        name: form.name.trim(),
        type: finalType,
        description: form.description.trim() || undefined,
        supportEmail: form.supportEmail.trim() || undefined,
        color: form.color
      } as any);
      toast.success('Department created');
      setOpen(false);
      qc.invalidateQueries({ queryKey: ['departments'] });
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const deleteDepartment = async () => {
    if (!deletingDept) return;
    setDeleting(true);
    try {
      await api.deleteDepartment(deletingDept.id);
      toast.success(`Department "${deletingDept.name}" deleted`);
      setDeletingDept(null);
      qc.invalidateQueries({ queryKey: ['departments'] });
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Departments"
        subtitle="The teams that receive and resolve tickets"
        actions={isOrgWide ? <button className="btn-primary" onClick={openCreate}>Add department</button> : undefined}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {list.map((d) => (
          <div key={d.id} className="card-hover block relative group">
            <div className="h-1.5" style={{ backgroundColor: d.color }} />
            <div className="p-5">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2.5">
                <Link to={`/admin/departments/${d.id}`} className="hover:text-primary-700">
                  <h2 className="font-semibold text-gray-900 text-base">{d.name}</h2>
                  <p className="text-xs text-gray-500 mt-0.5">{humanize(d.type)}</p>
                </Link>

                <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                  {d.supportEmail && (
                    <span className="badge badge-secondary text-[11px] font-mono" title="Inbound Email Gateway">
                      ✉ {d.supportEmail}
                    </span>
                  )}
                  {d.autoAssign && <span className="badge badge-primary">Auto-assign</span>}
                  {isOrgWide && (
                    <button
                      type="button"
                      className="text-xs text-danger-600 hover:text-danger-800 p-1 rounded hover:bg-danger-50 font-medium"
                      title="Delete Department"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeletingDept(d);
                      }}
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>

              {d.description && <p className="text-sm text-gray-600 mt-2">{d.description}</p>}

              <Link to={`/admin/departments/${d.id}`} className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-sm text-gray-600 pt-2 border-t border-gray-100">
                <span>Head: <span className="text-gray-900 font-medium">{d.head ? `${d.head.firstName} ${d.head.lastName}` : 'Not assigned'}</span></span>
                {d._count && <span>{d._count.users} people · {d._count.tickets} tickets · {d._count.teams} teams</span>}
              </Link>
            </div>
          </div>
        ))}
      </div>

      {/* Add Department Modal */}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Add department"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setOpen(false)}>Cancel</button>
            <button className="btn-primary" disabled={saving} onClick={create}>{saving ? 'Creating...' : 'Create Department'}</button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Department Name"><input className="input" placeholder="e.g. Digital Security and AI" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Inbound Support Email (optional)">
            <input className="input" placeholder="e.g. hr.support@lifc.in or project.lifc.in" value={form.supportEmail} onChange={(e) => setForm({ ...form, supportEmail: e.target.value })} />
            <p className="text-xs text-gray-500 mt-1">Emails sent to this address will automatically route new tickets to this department.</p>
          </Field>
          <Field label="Department Category / Type">
            <div className="space-y-2">
              <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                {PRESET_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              {form.type === 'Custom Category' && (
                <input
                  className="input"
                  placeholder="e.g. HR, Admin, Operations, Finance..."
                  value={form.customType}
                  onChange={(e) => setForm({ ...form, customType: e.target.value })}
                />
              )}
            </div>
          </Field>
          <Field label="Description (optional)"><textarea className="input" placeholder="Describe the responsibility of this department..." value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
          <Field label="Colour Badge"><input type="color" className="h-10 w-20 rounded border border-gray-300 cursor-pointer" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} /></Field>
        </div>
      </Modal>

      {/* Confirm Delete Department Modal */}
      <ConfirmModal
        open={!!deletingDept}
        title="Delete Department"
        message={`Are you sure you want to delete "${deletingDept?.name}"? Any users, teams, or custom fields will be unassigned automatically.`}
        confirmLabel="Delete Department"
        danger
        busy={deleting}
        onConfirm={deleteDepartment}
        onClose={() => setDeletingDept(null)}
      />
    </div>
  );
}
