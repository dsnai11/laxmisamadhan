import { useEffect, useState } from 'react';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '@services/api';
import { useAuth } from '@context/AuthContext';
import { formatDate, humanize } from '@utils/helpers';
import {
  ConfirmModal,
  EmptyState,
  ErrorState,
  Field,
  getErrorMessage,
  Modal,
  PageHeader,
  PageLoader,
  Pagination,
} from '@components/common/ui';

const TYPES = ['LAPTOP', 'DESKTOP', 'MONITOR', 'PHONE', 'TABLET', 'SERVER', 'NETWORK_DEVICE', 'PERIPHERAL', 'SOFTWARE_LICENSE', 'AI_MODEL', 'OTHER'];

const blank = { assetTag: '', name: '', type: 'LAPTOP', serialNumber: '', model: '', manufacturer: '', departmentId: '', location: '', purchaseDate: '', warrantyExpiry: '', value: '', currency: 'USD' };

const toIso = (d: string) => (d ? new Date(`${d}T00:00:00.000Z`).toISOString() : undefined);
const toDateInput = (iso?: string) => (iso ? iso.slice(0, 10) : '');

export default function AdminAssets() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const canEdit = ['SUPER_ADMIN', 'ADMIN', 'DEPARTMENT_HEAD'].includes(user?.role || '');
  const canDelete = ['SUPER_ADMIN', 'ADMIN'].includes(user?.role || '');

  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [editing, setEditing] = useState<any | 'new' | null>(null);
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<any | null>(null);
  const [assigning, setAssigning] = useState<any | null>(null);
  const [assigneeId, setAssigneeId] = useState('');

  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput.trim()); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const params = { page, limit: 15, ...(search && { search }), ...(type && { type }) };
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['assets', params], queryFn: () => api.getAssets(params), placeholderData: keepPreviousData });
  const { data: stats } = useQuery<any>({ queryKey: ['asset-stats'], queryFn: () => api.getAssetStats() });
  const { data: departments } = useQuery({ queryKey: ['departments'], queryFn: () => api.getDepartments() });
  const { data: people } = useQuery({ queryKey: ['assignable-users', assigning?.departmentId], queryFn: () => api.getUsers({ limit: 100, status: 'ACTIVE', departmentId: assigning.departmentId }), enabled: canEdit && !!assigning });

  const assets: any[] = data?.data || [];
  const refresh = () => qc.invalidateQueries({ queryKey: ['assets'] }).then(() => qc.invalidateQueries({ queryKey: ['asset-stats'] }));

  const openNew = () => { setForm({ ...blank, departmentId: user?.departmentId || '' }); setEditing('new'); };
  const openEdit = (a: any) => {
    setForm({
      assetTag: a.assetTag, name: a.name, type: a.type, serialNumber: a.serialNumber || '', model: a.model || '', manufacturer: a.manufacturer || '',
      departmentId: a.departmentId, location: a.location || '', purchaseDate: toDateInput(a.purchaseDate), warrantyExpiry: toDateInput(a.warrantyExpiry),
      value: a.value ?? '', currency: a.currency || 'USD',
    } as any);
    setEditing(a);
  };

  const save = async () => {
    if (!form.assetTag.trim() || !form.name.trim()) return toast.error('Asset tag and name are required');
    if (!form.departmentId) return toast.error('Choose a department');
    setSaving(true);
    try {
      const body: any = {
        assetTag: form.assetTag.trim(),
        name: form.name.trim(),
        type: form.type,
        departmentId: form.departmentId,
        currency: (form.currency || 'USD').toUpperCase(),
        ...(form.serialNumber.trim() && { serialNumber: form.serialNumber.trim() }),
        ...(form.model.trim() && { model: form.model.trim() }),
        ...(form.manufacturer.trim() && { manufacturer: form.manufacturer.trim() }),
        ...(form.location.trim() && { location: form.location.trim() }),
        ...(form.purchaseDate && { purchaseDate: toIso(form.purchaseDate) }),
        ...(form.warrantyExpiry && { warrantyExpiry: toIso(form.warrantyExpiry) }),
        ...(String(form.value) !== '' && { value: Number(form.value) }),
      };
      if (editing === 'new') await api.createAsset(body);
      else await api.updateAsset(editing.id, body);
      toast.success(editing === 'new' ? 'Asset added' : 'Asset updated');
      setEditing(null);
      refresh();
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    try {
      await api.deleteAsset(deleting.id);
      toast.success('Asset deleted');
      refresh();
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setDeleting(null);
    }
  };

  const assign = async () => {
    try {
      await api.assignAsset(assigning.id, assigneeId || null);
      toast.success(assigneeId ? 'Asset assigned' : 'Asset unassigned');
      setAssigning(null);
      refresh();
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Assets" subtitle="Equipment, licences and models the company owns" actions={canEdit ? <button className="btn-primary" onClick={openNew}>Add asset</button> : undefined} />

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="card p-4"><p className="text-sm text-gray-500">Total assets</p><p className="text-2xl font-bold">{stats.totalAssets ?? 0}</p></div>
          <div className="card p-4"><p className="text-sm text-gray-500">Warranty expiring soon</p><p className="text-2xl font-bold">{Array.isArray(stats.warrantyExpiring) ? stats.warrantyExpiring.length : stats.warrantyExpiring ?? 0}</p></div>
          <div className="card p-4"><p className="text-sm text-gray-500">Total value</p><p className="text-2xl font-bold">{Number(stats.totalValue || 0).toLocaleString()}</p></div>
        </div>
      )}

      <div className="card">
        <div className="p-4 border-b border-gray-200 grid grid-cols-1 md:grid-cols-3 gap-3">
          <input className="input md:col-span-2" placeholder="Search by tag, name or serial number" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} aria-label="Search assets" />
          <select className="input" value={type} onChange={(e) => { setType(e.target.value); setPage(1); }} aria-label="Filter by type">
            <option value="">All types</option>
            {TYPES.map((t) => <option key={t} value={t}>{humanize(t)}</option>)}
          </select>
        </div>

        {isLoading ? <PageLoader /> : error ? <div className="p-4"><ErrorState error={error} onRetry={() => refetch()} /></div> : assets.length === 0 ? (
          <EmptyState title="No assets found" />
        ) : (
          <>
            <div className="table-container">
              <table className="table">
                <thead><tr><th>Asset</th><th>Type</th><th>Department</th><th>Assigned to</th><th>Warranty</th>{canEdit && <th />}</tr></thead>
                <tbody>
                  {assets.map((a) => (
                    <tr key={a.id}>
                      <td><p className="font-medium text-gray-900">{a.name}</p><p className="text-xs text-gray-500 font-mono">{a.assetTag}{a.serialNumber ? ` · ${a.serialNumber}` : ''}</p></td>
                      <td className="text-sm">{humanize(a.type)}</td>
                      <td className="text-sm text-gray-600">{a.department?.name}</td>
                      <td className="text-sm">{a.assignedTo ? `${a.assignedTo.firstName} ${a.assignedTo.lastName}` : <span className="text-gray-400">Unassigned</span>}</td>
                      <td className="text-sm text-gray-500">{a.warrantyExpiry ? formatDate(a.warrantyExpiry) : '-'}</td>
                      {canEdit && (
                        <td className="text-right whitespace-nowrap">
                          <button className="btn-ghost btn-sm" onClick={() => { setAssigning(a); setAssigneeId(a.assignedToId || ''); }}>Assign</button>
                          <button className="btn-ghost btn-sm" onClick={() => openEdit(a)}>Edit</button>
                          {canDelete && <button className="btn-ghost btn-sm text-danger-600" onClick={() => setDeleting(a)}>Delete</button>}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={data?.page || page} totalPages={data?.totalPages || 1} total={data?.total || 0} onPageChange={setPage} />
          </>
        )}
      </div>

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? 'Add asset' : 'Edit asset'}
        wide
        footer={
          <>
            <button className="btn-secondary" onClick={() => setEditing(null)}>Cancel</button>
            <button className="btn-primary" disabled={saving} onClick={save}>{saving ? 'Saving...' : 'Save asset'}</button>
          </>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Asset tag"><input className="input" value={form.assetTag} onChange={(e) => setForm({ ...form, assetTag: e.target.value })} /></Field>
          <Field label="Name"><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Type"><select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>{TYPES.map((t) => <option key={t} value={t}>{humanize(t)}</option>)}</select></Field>
          <Field label="Department">
            <select className="input" value={form.departmentId} onChange={(e) => setForm({ ...form, departmentId: e.target.value })}>
              <option value="">Select...</option>
              {(departments || []).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </Field>
          <Field label="Manufacturer"><input className="input" value={form.manufacturer} onChange={(e) => setForm({ ...form, manufacturer: e.target.value })} /></Field>
          <Field label="Model"><input className="input" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} /></Field>
          <Field label="Serial number"><input className="input" value={form.serialNumber} onChange={(e) => setForm({ ...form, serialNumber: e.target.value })} /></Field>
          <Field label="Location"><input className="input" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></Field>
          <Field label="Purchase date"><input type="date" className="input" value={form.purchaseDate} onChange={(e) => setForm({ ...form, purchaseDate: e.target.value })} /></Field>
          <Field label="Warranty expires"><input type="date" className="input" value={form.warrantyExpiry} onChange={(e) => setForm({ ...form, warrantyExpiry: e.target.value })} /></Field>
          <Field label="Value"><input type="number" min={0} className="input" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} /></Field>
          <Field label="Currency (3 letters)"><input maxLength={3} className="input" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} /></Field>
        </div>
      </Modal>

      <Modal
        open={!!assigning}
        onClose={() => setAssigning(null)}
        title={`Assign ${assigning?.name || 'asset'}`}
        footer={
          <>
            <button className="btn-secondary" onClick={() => setAssigning(null)}>Cancel</button>
            <button className="btn-primary" onClick={assign}>Save</button>
          </>
        }
      >
        <Field label="Assigned to" hint="Assets can only be assigned to people in the asset's department.">
          <select className="input" value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
            <option value="">Unassigned</option>
            {(people?.data || []).map((u: any) => <option key={u.id} value={u.id}>{u.firstName} {u.lastName} ({u.email})</option>)}
          </select>
        </Field>
      </Modal>

      <ConfirmModal open={!!deleting} title="Delete asset" message={`Delete ${deleting?.name} (${deleting?.assetTag})?`} confirmLabel="Delete" danger onConfirm={remove} onClose={() => setDeleting(null)} />
    </div>
  );
}
