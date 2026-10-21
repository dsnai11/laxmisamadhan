import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '@services/api';
import { useAuth } from '@context/AuthContext';
import { formatDuration, humanize } from '@utils/helpers';
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
  PriorityBadge,
  PRIORITY_OPTIONS,
} from '@components/common/ui';

const blank = {
  name: '',
  description: '',
  departmentId: '',
  category: '',
  subCategory: '',
  priority: 'MEDIUM',
  responseTimeMins: 240,
  resolutionTimeMins: 1440,
  businessHoursOnly: true,
  excludesWeekends: true
};

export default function AdminSLAPolicies() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const isSuperOrAdmin = ['SUPER_ADMIN', 'ADMIN'].includes(user?.role || '');
  const isDeptHead = user?.role === 'DEPARTMENT_HEAD';
  const isTeamLead = user?.role === 'TEAM_LEAD';
  const isDeptHeadOrLead = isDeptHead || isTeamLead;
  const canCreate = isSuperOrAdmin || isDeptHeadOrLead;

  const canEditPolicy = (p: any) => {
    if (isSuperOrAdmin) return true;
    if (isDeptHeadOrLead && p.departmentId === user?.departmentId) return true;
    return false;
  };

  const { data: policies, isLoading, error, refetch } = useQuery<any[]>({ queryKey: ['sla-policies'], queryFn: () => api.getSLAPolicies() });
  const { data: compliance } = useQuery<any>({ queryKey: ['sla-compliance'], queryFn: () => api.getSLACompliance() });
  const { data: departments } = useQuery({ queryKey: ['departments'], queryFn: () => api.getDepartments() });

  const [editing, setEditing] = useState<any | 'new' | null>(null);
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<any | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [filterPriority, setFilterPriority] = useState('');

  const activeDeptId = isDeptHeadOrLead ? (user?.departmentId || '') : form.departmentId;
  const { data: deptCategoryConfigs } = useQuery<any[]>({
    queryKey: ['category-configs', activeDeptId],
    queryFn: () => api.getCategoryConfigs(activeDeptId),
    enabled: !!activeDeptId,
  });

  const currentCategoryConfig = (deptCategoryConfigs || []).find((c: any) => c.category === form.category);
  const categoryFormFields = currentCategoryConfig?.formFields || {};
  const configuredSubCategories: string[] = Array.isArray(categoryFormFields.subCategories) ? categoryFormFields.subCategories : [];
  const defaultSubCategories = ['LOS', 'LMS', 'CRM', 'CLU-collection', 'Desktop', 'Laptop', 'Peripheral', 'Software', 'Network'];
  const availableSubCategories = Array.from(new Set([
    ...configuredSubCategories,
    ...(form.subCategory ? [form.subCategory] : []),
    ...(configuredSubCategories.length === 0 ? defaultSubCategories : [])
  ]));

  const openNew = () => {
    setForm({
      ...blank,
      departmentId: isDeptHeadOrLead ? (user?.departmentId || '') : '',
    });
    setEditing('new');
  };
  const openEdit = (p: any) => {
    setForm({
      name: p.name,
      description: p.description || '',
      departmentId: p.departmentId || '',
      category: p.category || '',
      subCategory: p.subCategory || '',
      priority: p.priority,
      responseTimeMins: p.responseTimeMins,
      resolutionTimeMins: p.resolutionTimeMins,
      businessHoursOnly: !!p.businessHoursOnly,
      excludesWeekends: !!p.excludesWeekends,
    });
    setEditing(p);
  };

  const save = async () => {
    if (!form.name.trim()) return toast.error('Give the policy a name');
    if (!(form.responseTimeMins > 0) || !(form.resolutionTimeMins > 0)) return toast.error('Times must be greater than zero');
    if (form.resolutionTimeMins < form.responseTimeMins) return toast.error('Resolution time cannot be shorter than response time');
    setSaving(true);
    try {
      const body: any = {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        departmentId: isDeptHeadOrLead ? (user?.departmentId || undefined) : (form.departmentId || undefined),
        category: form.category || undefined,
        subCategory: form.subCategory.trim() || undefined,
        priority: form.priority,
        responseTimeMins: Number(form.responseTimeMins),
        resolutionTimeMins: Number(form.resolutionTimeMins),
        businessHoursOnly: form.businessHoursOnly,
        excludesWeekends: form.excludesWeekends,
      };
      if (editing === 'new') await api.createSLAPolicy(body);
      else await api.updateSLAPolicy(editing.id, body);
      toast.success(editing === 'new' ? 'Policy created' : 'Policy updated');
      setEditing(null);
      qc.invalidateQueries({ queryKey: ['sla-policies'] });
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    try {
      await api.deleteSLAPolicy(deleting.id);
      toast.success('Policy deleted');
      qc.invalidateQueries({ queryKey: ['sla-policies'] });
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setDeleting(null);
    }
  };

  if (isLoading) return <PageLoader />;
  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;

  const rawList = policies || [];
  const list = rawList.filter((p) => {
    if (filterDept) {
      if (filterDept === 'global' && p.departmentId) return false;
      if (filterDept !== 'global' && p.departmentId !== filterDept) return false;
    }
    if (filterPriority && p.priority !== filterPriority) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = p.name?.toLowerCase().includes(q);
      const matchSub = p.subCategory?.toLowerCase().includes(q);
      const matchDept = p.department?.name?.toLowerCase().includes(q);
      if (!matchName && !matchSub && !matchDept) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="SLA Policies"
        subtitle="Response and resolution targets applied to tickets"
        actions={canCreate ? <button className="btn-primary" onClick={openNew}>New policy</button> : undefined}
      />

      {compliance && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="card p-4"><p className="text-sm text-gray-500">Compliance</p><p className="text-2xl font-bold">{Math.round(compliance.complianceRate ?? 0)}%</p></div>
          <div className="card p-4"><p className="text-sm text-gray-500">Tickets tracked</p><p className="text-2xl font-bold">{compliance.totalTickets ?? 0}</p></div>
          <div className="card p-4"><p className="text-sm text-gray-500">Breached</p><p className="text-2xl font-bold text-danger-600">{compliance.breached ?? 0}</p></div>
          <div className="card p-4"><p className="text-sm text-gray-500">Avg resolution</p><p className="text-2xl font-bold">{formatDuration(compliance.avgResolutionTime)}</p></div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="card p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex-1">
          <input
            type="search"
            className="input text-sm"
            placeholder="Search policies by name, sub-category, or department..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="input text-sm w-auto min-w-[170px]"
            value={filterDept}
            onChange={(e) => setFilterDept(e.target.value)}
          >
            <option value="">All Departments</option>
            <option value="global">Global Fallbacks Only</option>
            {(departments || []).map((d: any) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>

          <select
            className="input text-sm w-auto min-w-[140px]"
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
          >
            <option value="">All Priorities</option>
            <option value="CRITICAL">Critical (P1)</option>
            <option value="HIGH">High (P2)</option>
            <option value="MEDIUM">Medium (P3)</option>
            <option value="LOW">Low (P4)</option>
          </select>

          {(searchQuery || filterDept || filterPriority) && (
            <button
              className="btn-ghost btn-sm text-xs text-gray-500"
              onClick={() => {
                setSearchQuery('');
                setFilterDept('');
                setFilterPriority('');
              }}
            >
              Reset
            </button>
          )}
        </div>
      </div>

      <div className="card">
        {list.length === 0 ? (
          <EmptyState title="No SLA policies" message="Tickets get no due dates until at least one policy exists." />
        ) : (
          <div className="table-container">
            <table className="table">
              <thead><tr><th>Policy</th><th>Applies to</th><th>Priority</th><th>Response</th><th>Resolution</th><th>Hours</th>{(isSuperOrAdmin || isDeptHeadOrLead) && <th />}</tr></thead>
              <tbody>
                {list.map((p) => (
                  <tr key={p.id}>
                    <td className="font-medium text-gray-900">{p.name}</td>
                    <td className="text-sm text-gray-600">
                      {p.department?.name || 'All departments'}
                      {p.category ? ` · ${humanize(p.category)}` : ''}
                      {p.subCategory ? (
                        <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300">
                          Sub: {p.subCategory}
                        </span>
                      ) : ''}
                    </td>
                    <td><PriorityBadge priority={p.priority} /></td>
                    <td className="text-sm">{formatDuration(p.responseTimeMins)}</td>
                    <td className="text-sm">{formatDuration(p.resolutionTimeMins)}</td>
                    <td className="text-sm text-gray-500">{p.businessHoursOnly ? 'Business hours' : '24/7'}</td>
                    {(isSuperOrAdmin || isDeptHeadOrLead) && (
                      <td className="text-right whitespace-nowrap">
                        {canEditPolicy(p) ? (
                          <>
                            <button className="btn-ghost btn-sm" onClick={() => openEdit(p)}>Edit</button>
                            <button className="btn-ghost btn-sm text-danger-600" onClick={() => setDeleting(p)}>Delete</button>
                          </>
                        ) : (
                          <span className="text-xs text-gray-400">View only</span>
                        )}
                      </td>
                    )}
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
        title={editing === 'new' ? 'New SLA policy' : 'Edit SLA policy'}
        wide
        footer={
          <>
            <button className="btn-secondary" onClick={() => setEditing(null)}>Cancel</button>
            <button className="btn-primary" disabled={saving} onClick={save}>{saving ? 'Saving...' : 'Save policy'}</button>
          </>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2"><Field label="Name"><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field></div>
          <div className="md:col-span-2"><Field label="Description (optional)"><input className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field></div>
          <Field label="Department" hint={isDeptHeadOrLead ? "SLA policy will apply to your department." : "Leave empty to apply to every department."}>
            <select
              className="input"
              disabled={isDeptHeadOrLead}
              value={isDeptHeadOrLead ? (user?.departmentId || '') : form.departmentId}
              onChange={(e) => setForm({ ...form, departmentId: e.target.value })}
            >
              {!isDeptHeadOrLead && <option value="">All departments</option>}
              {(departments || []).filter((d: any) => !isDeptHeadOrLead || d.id === user?.departmentId).map((d: any) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Category (optional)">
            <select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              <option value="">Any category</option>
              {CATEGORY_OPTIONS.map((c) => <option key={c} value={c}>{humanize(c)}</option>)}
            </select>
          </Field>
          <Field label="Subcategory (optional)" hint="Mark subcategory to apply this policy specifically.">
            <div className="space-y-1.5">
              <select
                className="input"
                value={availableSubCategories.includes(form.subCategory) ? form.subCategory : (form.subCategory ? '__custom__' : '')}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === '__custom__') setForm({ ...form, subCategory: ' ' });
                  else setForm({ ...form, subCategory: val });
                }}
              >
                <option value="">Any subcategory</option>
                {availableSubCategories.map((sc) => (
                  <option key={sc} value={sc}>{sc}</option>
                ))}
                <option value="__custom__">+ Custom subcategory...</option>
              </select>
              {(!availableSubCategories.includes(form.subCategory) && form.subCategory !== '') && (
                <input
                  className="input mt-1"
                  placeholder="Enter subcategory name..."
                  value={form.subCategory.trim()}
                  onChange={(e) => setForm({ ...form, subCategory: e.target.value })}
                />
              )}
            </div>
          </Field>
          <Field label="Priority">
            <select className="input" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
              {PRIORITY_OPTIONS.map((p) => <option key={p} value={p}>{humanize(p)}</option>)}
            </select>
          </Field>
          <Field label="First response within (minutes)" hint={formatDuration(form.responseTimeMins)}>
            <input type="number" min={1} className="input" value={form.responseTimeMins} onChange={(e) => setForm({ ...form, responseTimeMins: Number(e.target.value) })} />
          </Field>
          <Field label="Resolution within (minutes)" hint={formatDuration(form.resolutionTimeMins)}>
            <input type="number" min={1} className="input" value={form.resolutionTimeMins} onChange={(e) => setForm({ ...form, resolutionTimeMins: Number(e.target.value) })} />
          </Field>
          <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" className="h-4 w-4 rounded border-gray-300 text-primary-600" checked={form.businessHoursOnly} onChange={(e) => setForm({ ...form, businessHoursOnly: e.target.checked })} /> Count business hours only</label>
          <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" className="h-4 w-4 rounded border-gray-300 text-primary-600" checked={form.excludesWeekends} onChange={(e) => setForm({ ...form, excludesWeekends: e.target.checked })} /> Exclude weekends</label>
        </div>
      </Modal>

      <ConfirmModal
        open={!!deleting}
        title="Delete SLA policy"
        message={`Delete "${deleting?.name}"? Existing tickets keep their due dates, but new tickets will no longer use it.`}
        confirmLabel="Delete"
        danger
        onConfirm={remove}
        onClose={() => setDeleting(null)}
      />
    </div>
  );
}
