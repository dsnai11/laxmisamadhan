import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '@services/api';
import { humanize } from '@utils/helpers';
import {
  CATEGORY_OPTIONS,
  ConfirmModal,
  EmptyState,
  ErrorState,
  Field,
  getErrorMessage,
  Modal,
  PageHeader,
  PageLoader,
} from '@components/common/ui';

const FIELD_TYPES = ['TEXT', 'TEXTAREA', 'NUMBER', 'SELECT', 'MULTISELECT', 'BOOLEAN', 'DATE', 'EMAIL', 'URL'];
const blank = { name: '', label: '', type: 'TEXT', departmentId: '', category: '', isRequired: false, options: '' };

export default function AdminSettings() {
  const qc = useQueryClient();
  const { data: fields, isLoading, error, refetch } = useQuery<any[]>({ queryKey: ['custom-fields'], queryFn: () => api.getCustomFields() });
  const { data: departments } = useQuery({ queryKey: ['departments'], queryFn: () => api.getDepartments() });

  const [editing, setEditing] = useState<any | 'new' | null>(null);
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<any | null>(null);

  const openNew = () => { setForm(blank); setEditing('new'); };
  const openEdit = (f: any) => {
    setForm({
      name: f.name,
      label: f.label,
      type: f.type,
      departmentId: f.departmentId || '',
      category: f.category || '',
      isRequired: !!f.isRequired,
      options: (f.options || []).map((o: any) => o.label).join('\n'),
    });
    setEditing(f);
  };

  const needsOptions = form.type === 'SELECT' || form.type === 'MULTISELECT';

  const save = async () => {
    if (!form.label.trim()) return toast.error('Give the field a label');
    if (editing === 'new' && !/^[a-zA-Z][a-zA-Z0-9_]*$/.test(form.name)) return toast.error('The key must start with a letter and use only letters, numbers and underscores');
    const options = form.options.split('\n').map((l) => l.trim()).filter(Boolean).map((label) => ({ label, value: label }));
    if (needsOptions && options.length === 0) return toast.error('Add at least one option');
    setSaving(true);
    try {
      const body: any = {
        label: form.label.trim(),
        type: form.type,
        isRequired: form.isRequired,
        departmentId: form.departmentId || undefined,
        category: form.category || undefined,
        options: needsOptions ? options : undefined,
      };
      if (editing === 'new') await api.createCustomField({ ...body, name: form.name });
      else await api.updateCustomField(editing.id, body);
      toast.success('Field saved');
      setEditing(null);
      qc.invalidateQueries({ queryKey: ['custom-fields'] });
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    try {
      await api.deleteCustomField(deleting.id);
      toast.success('Field deleted');
      qc.invalidateQueries({ queryKey: ['custom-fields'] });
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setDeleting(null);
    }
  };

  if (isLoading) return <PageLoader />;
  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;

  const list = fields || [];

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" subtitle="Configure your ticket portal" actions={<button className="btn-primary" onClick={openNew}>New field</button>} />

      {/* Quick links */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Link
          to="/admin/role-permissions"
          className="card p-4 hover:shadow-md transition-shadow flex items-start gap-3 group"
        >
          <div className="w-10 h-10 rounded-lg bg-violet-100 text-violet-700 flex items-center justify-center text-lg shrink-0 group-hover:bg-violet-200 transition-colors">
            🛡
          </div>
          <div>
            <p className="font-semibold text-gray-900">Role Permissions</p>
            <p className="text-xs text-gray-500 mt-0.5">View the full permission matrix for all roles</p>
          </div>
        </Link>
      </div>

      <PageHeader title="Custom Ticket Fields" subtitle="Extra fields shown to people when they raise a ticket" />

      <div className="card">
        {list.length === 0 ? <EmptyState title="No custom fields" message="Add fields to collect extra details, for example a device model or software version." /> : (
          <div className="table-container">
            <table className="table">
              <thead><tr><th>Label</th><th>Key</th><th>Type</th><th>Shown for</th><th>Required</th><th /></tr></thead>
              <tbody>
                {list.map((f) => (
                  <tr key={f.id}>
                    <td className="font-medium text-gray-900">{f.label}</td>
                    <td className="text-sm font-mono text-gray-500">{f.name}</td>
                    <td className="text-sm">{humanize(f.type)}</td>
                    <td className="text-sm text-gray-600">
                      {(departments || []).find((d) => d.id === f.departmentId)?.name || 'All departments'}
                      {f.category ? ` · ${humanize(f.category)}` : ''}
                    </td>
                    <td className="text-sm">{f.isRequired ? 'Yes' : 'No'}</td>
                    <td className="text-right whitespace-nowrap">
                      <button className="btn-ghost btn-sm" onClick={() => openEdit(f)}>Edit</button>
                      <button className="btn-ghost btn-sm text-danger-600" onClick={() => setDeleting(f)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? 'New custom field' : 'Edit custom field'}
        wide
        footer={<><button className="btn-secondary" onClick={() => setEditing(null)}>Cancel</button><button className="btn-primary" disabled={saving} onClick={save}>{saving ? 'Saving...' : 'Save field'}</button></>}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Label"><input className="input" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} /></Field>
          <Field label="Key" hint="Letters, numbers and underscores. Cannot be changed later.">
            <input className="input font-mono" disabled={editing !== 'new'} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Type">
            <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              {FIELD_TYPES.map((t) => <option key={t} value={t}>{humanize(t)}</option>)}
            </select>
          </Field>
          <label className="flex items-center gap-2 text-sm text-gray-700 md:mt-7"><input type="checkbox" className="h-4 w-4 rounded border-gray-300 text-primary-600" checked={form.isRequired} onChange={(e) => setForm({ ...form, isRequired: e.target.checked })} /> Required</label>
          <Field label="Department (optional)">
            <select className="input" value={form.departmentId} onChange={(e) => setForm({ ...form, departmentId: e.target.value })}>
              <option value="">All departments</option>
              {(departments || []).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </Field>
          <Field label="Category (optional)">
            <select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              <option value="">Any category</option>
              {CATEGORY_OPTIONS.map((c) => <option key={c} value={c}>{humanize(c)}</option>)}
            </select>
          </Field>
          {needsOptions && (
            <div className="md:col-span-2">
              <Field label="Options" hint="One option per line."><textarea className="input min-h-[100px]" value={form.options} onChange={(e) => setForm({ ...form, options: e.target.value })} /></Field>
            </div>
          )}
        </div>
      </Modal>

      <ConfirmModal open={!!deleting} title="Delete field" message={`Delete "${deleting?.label}"? Values already saved on tickets are kept.`} confirmLabel="Delete" danger onConfirm={remove} onClose={() => setDeleting(null)} />
    </div>
  );
}
