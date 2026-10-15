import { useState, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '@services/api';
import { humanize } from '@utils/helpers';
import { ConfirmModal, EmptyState, ErrorState, Field, getErrorMessage, Modal, PageLoader, STAFF_ROLES } from '@components/common/ui';

const emptyForm = { name: '', description: '', supportEmail: '', leadId: '', memberIds: [] as string[] };

interface BulkTeamRow {
  id: string;
  name: string;
  supportEmail: string;
  leadId: string;
  description: string;
}

export default function TeamsManager({ departmentId, canManage, ownLeadId }: { departmentId: string; canManage: boolean; ownLeadId?: string }) {
  const qc = useQueryClient();
  const { data: teamsRaw, isLoading, error, refetch } = useQuery<any[]>({
    queryKey: ['teams', departmentId],
    queryFn: () => api.getTeams(departmentId),
    enabled: !!departmentId,
  });
  // If ownLeadId is set (TEAM_LEAD), only show their team
  const teams = ownLeadId ? (teamsRaw || []).filter((t: any) => t.leadId === ownLeadId) : (teamsRaw || []);
  const { data: pool } = useQuery({
    queryKey: ['dept-users', departmentId],
    queryFn: () => api.getUsers({ departmentId, limit: 100 }),
    enabled: !!departmentId && canManage,
  });
  const staff: any[] = (pool?.data || []).filter((u: any) => STAFF_ROLES.includes(u.role) && u.status === 'ACTIVE');

  const [editing, setEditing] = useState<any | 'new' | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<any | null>(null);

  // Bulk Teams state
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkRows, setBulkRows] = useState<BulkTeamRow[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isLead = !!ownLeadId;

  const openNew = () => { setForm({ ...emptyForm, leadId: ownLeadId || '' }); setEditing('new'); };
  const openEdit = (t: any) => {
    setForm({ name: t.name, description: t.description || '', supportEmail: t.supportEmail || '', leadId: t.leadId || ownLeadId || '', memberIds: (t.members || []).map((m: any) => m.id) });
    setEditing(t);
  };

  const save = async () => {
    if (!form.name.trim()) return toast.error('Give the team a name');
    setSaving(true);
    try {
      const body: any = {
        departmentId,
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        supportEmail: form.supportEmail.trim() || undefined,
        leadId: ownLeadId || form.leadId || undefined,
        memberIds: form.memberIds
      };
      if (editing === 'new') await api.createTeam(departmentId, body);
      else await api.updateTeam(departmentId, editing.id, body);
      toast.success(editing === 'new' ? 'Team created' : 'Team updated');
      setEditing(null);
      qc.invalidateQueries({ queryKey: ['teams'] });
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    try {
      await api.deleteTeam(departmentId, deleting.id);
      toast.success('Team deleted');
      setDeleting(null);
      qc.invalidateQueries({ queryKey: ['teams'] });
    } catch (e) {
      toast.error(getErrorMessage(e));
      setDeleting(null);
    }
  };

  // Bulk Teams handlers
  const openBulk = () => {
    setBulkRows([
      { id: '1', name: '', supportEmail: '', leadId: '', description: '' },
      { id: '2', name: '', supportEmail: '', leadId: '', description: '' },
    ]);
    setBulkOpen(true);
  };

  const addBulkRow = () => {
    setBulkRows((prev) => [
      ...prev,
      { id: Math.random().toString(36).substring(2, 9), name: '', supportEmail: '', leadId: '', description: '' },
    ]);
  };

  const updateBulkRow = (id: string, field: keyof BulkTeamRow, val: string) => {
    setBulkRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: val } : r)));
  };

  const removeBulkRow = (id: string) => {
    setBulkRows((prev) => prev.filter((r) => r.id !== id));
  };

  const downloadCSVTemplate = () => {
    const csvHeader = 'name,supportEmail,description\n';
    const sampleRows = `Network Support,network.support@lifc.in,Network and connectivity operations\nLOS Operations,los.ops@lifc.in,Loan origination system technical team\n`;
    const blob = new Blob([csvHeader + sampleRows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'laxmi_bulk_teams_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) return;

      const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
      if (lines.length < 2) {
        toast.error('CSV file is empty or missing headers');
        return;
      }

      const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
      const nameIdx = headers.indexOf('name');
      const emailIdx = headers.indexOf('supportemail') !== -1 ? headers.indexOf('supportemail') : headers.indexOf('email');
      const descIdx = headers.indexOf('description') !== -1 ? headers.indexOf('description') : headers.indexOf('desc');

      if (nameIdx === -1) {
        toast.error('CSV must contain column: name');
        return;
      }

      const parsed: BulkTeamRow[] = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',').map((c) => c.trim());
        if (!cols[nameIdx]) continue;
        parsed.push({
          id: Math.random().toString(36).substring(2, 9),
          name: cols[nameIdx] || '',
          supportEmail: emailIdx !== -1 ? cols[emailIdx] : '',
          leadId: '',
          description: descIdx !== -1 ? cols[descIdx] : '',
        });
      }

      if (parsed.length === 0) {
        toast.error('No valid teams found in CSV');
        return;
      }

      setBulkRows(parsed);
      toast.success(`Loaded ${parsed.length} teams from CSV`);
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const executeBulkCreate = async () => {
    const validTeams = bulkRows.filter((r) => r.name.trim().length > 0);
    if (validTeams.length === 0) {
      return toast.error('Please enter at least one team with a valid name');
    }

    setBulkSaving(true);
    let successCount = 0;
    let failCount = 0;

    for (const r of validTeams) {
      try {
        await api.createTeam(departmentId, {
          name: r.name.trim(),
          supportEmail: r.supportEmail.trim() || undefined,
          description: r.description.trim() || undefined,
          leadId: r.leadId || undefined,
        });
        successCount++;
      } catch (err) {
        failCount++;
      }
    }

    setBulkSaving(false);
    if (successCount > 0) {
      toast.success(`Successfully created ${successCount} team(s)!`);
      qc.invalidateQueries({ queryKey: ['teams'] });
      setBulkOpen(false);
    }
    if (failCount > 0) {
      toast.error(`${failCount} team(s) failed to create.`);
    }
  };

  if (isLoading) return <PageLoader />;
  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;

  return (
    <div className="card">
      <div className="p-4 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="font-semibold text-gray-900">Teams</h2>
        {canManage && (
          <div className="flex gap-2 w-full sm:w-auto">
            {!isLead && (
              <button className="btn-secondary btn-sm" onClick={openBulk}>
                <span className="flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Bulk Create Teams
                </span>
              </button>
            )}
            <button className="btn-primary btn-sm" onClick={openNew}>New team</button>
          </div>
        )}
      </div>
      {!teams || teams.length === 0 ? (
        <EmptyState title="No teams yet" message={canManage ? 'Create a team to group agents in this department.' : undefined} />
      ) : (
        <div className="table-container">
          <table className="table">
            <thead><tr><th>Team</th><th>Support Email</th><th>Lead</th><th>Members</th><th>Tickets</th>{canManage && <th />}</tr></thead>
            <tbody>
              {teams.map((t) => (
                <tr key={t.id}>
                  <td>
                    <p className="font-medium text-gray-900">{t.name}</p>
                    {t.description && <p className="text-xs text-gray-500">{t.description}</p>}
                  </td>
                  <td className="text-sm font-mono text-gray-600">{t.supportEmail ? `✉ ${t.supportEmail}` : '-'}</td>
                  <td className="text-sm">{t.lead ? `${t.lead.firstName} ${t.lead.lastName}` : '-'}</td>
                  <td className="text-sm">{(t.members || []).map((m: any) => `${m.firstName} ${m.lastName}`).join(', ') || '-'}</td>
                  <td className="text-sm">{t._count?.tickets ?? 0}</td>
                  {canManage && (
                    <td className="text-right whitespace-nowrap">
                      <button className="btn-ghost btn-sm" onClick={() => openEdit(t)}>Edit</button>
                      {!isLead && (
                        <button className="btn-ghost btn-sm text-danger-600" onClick={() => setDeleting(t)}>Delete</button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? 'New team' : 'Edit team'}
        wide
        footer={
          <>
            <button className="btn-secondary" onClick={() => setEditing(null)}>Cancel</button>
            <button className="btn-primary" disabled={saving} onClick={save}>{saving ? 'Saving...' : 'Save team'}</button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Name"><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Support Email (optional)">
            <input className="input" placeholder="e.g. secops.support@lifc.in" value={form.supportEmail} onChange={(e) => setForm({ ...form, supportEmail: e.target.value })} />
          </Field>
          <Field label="Description (optional)"><input className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
          {!isLead && (
            <Field label="Team lead">
              <select className="input" value={form.leadId} onChange={(e) => setForm({ ...form, leadId: e.target.value })}>
                <option value="">No lead</option>
                {staff.map((u) => <option key={u.id} value={u.id}>{u.firstName} {u.lastName} ({humanize(u.role)})</option>)}
              </select>
            </Field>
          )}
          <Field label="Members">
            <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
              {staff.length === 0 && <p className="p-3 text-sm text-gray-500">No staff in this department.</p>}
              {staff.map((u) => (
                <label key={u.id} className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-gray-50">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300 text-primary-600"
                    checked={form.memberIds.includes(u.id)}
                    onChange={(e) => setForm({ ...form, memberIds: e.target.checked ? [...form.memberIds, u.id] : form.memberIds.filter((id) => id !== u.id) })}
                  />
                  {u.firstName} {u.lastName} <span className="text-gray-400">· {humanize(u.role)}</span>
                </label>
              ))}
            </div>
          </Field>
        </div>
      </Modal>

      {/* Bulk Teams Modal */}
      <Modal
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        title="Bulk Create Teams"
        wide
        footer={
          <>
            <button className="btn-secondary" onClick={() => setBulkOpen(false)}>Cancel</button>
            <button className="btn-primary" disabled={bulkSaving} onClick={executeBulkCreate}>
              {bulkSaving ? 'Creating Teams...' : `Create ${bulkRows.filter(r => r.name.trim()).length} Teams`}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex items-center gap-2">
              <button type="button" className="btn-secondary text-xs" onClick={downloadCSVTemplate}>
                📥 Download CSV Template
              </button>
              <input
                type="file"
                ref={fileInputRef}
                accept=".csv"
                className="hidden"
                onChange={handleFileUpload}
              />
              <button
                type="button"
                className="btn-secondary text-xs"
                onClick={() => fileInputRef.current?.click()}
              >
                📤 Upload CSV
              </button>
            </div>
            <span className="text-xs text-gray-500">Add multiple teams at once for department</span>
          </div>

          <div className="max-h-[360px] overflow-y-auto overflow-x-auto border border-gray-200 rounded-lg scrollbar-thin">
            <table className="w-full text-xs text-left text-gray-700 min-w-[700px]">
              <thead className="bg-gray-100 text-gray-600 font-semibold uppercase sticky top-0 z-10 border-b border-gray-200">
                <tr>
                  <th className="p-2 w-8">#</th>
                  <th className="p-2">Team Name *</th>
                  <th className="p-2">Support Email</th>
                  <th className="p-2">Team Lead</th>
                  <th className="p-2">Description</th>
                  <th className="p-2 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {bulkRows.map((row, idx) => (
                  <tr key={row.id} className="hover:bg-gray-50">
                    <td className="p-2 text-center text-gray-400 font-mono">{idx + 1}</td>
                    <td className="p-1">
                      <input
                        className="w-full input text-xs py-1 px-2 font-medium"
                        placeholder="e.g. LOS Support"
                        value={row.name}
                        onChange={(e) => updateBulkRow(row.id, 'name', e.target.value)}
                      />
                    </td>
                    <td className="p-1">
                      <input
                        type="email"
                        className="w-full input text-xs py-1 px-2"
                        placeholder="e.g. los.support@lifc.in"
                        value={row.supportEmail}
                        onChange={(e) => updateBulkRow(row.id, 'supportEmail', e.target.value)}
                      />
                    </td>
                    <td className="p-1">
                      <select
                        className="w-full input text-xs py-1 px-2"
                        value={row.leadId}
                        onChange={(e) => updateBulkRow(row.id, 'leadId', e.target.value)}
                      >
                        <option value="">No lead</option>
                        {staff.map((u) => <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}
                      </select>
                    </td>
                    <td className="p-1">
                      <input
                        className="w-full input text-xs py-1 px-2"
                        placeholder="Brief team purpose"
                        value={row.description}
                        onChange={(e) => updateBulkRow(row.id, 'description', e.target.value)}
                      />
                    </td>
                    <td className="p-1 text-center">
                      <button
                        type="button"
                        className="text-red-500 hover:text-red-700 p-1"
                        onClick={() => removeBulkRow(row.id)}
                        title="Remove Row"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-between items-center text-xs text-gray-500 pt-1">
            <button
              type="button"
              className="text-primary-600 font-semibold hover:underline flex items-center gap-1"
              onClick={addBulkRow}
            >
              + Add another team
            </button>
            <span>Total teams: {bulkRows.length}</span>
          </div>
        </div>
      </Modal>

      <ConfirmModal
        open={!!deleting}
        title="Delete team"
        message={`Delete the team "${deleting?.name}"? Teams that have tickets cannot be deleted.`}
        confirmLabel="Delete"
        danger
        onConfirm={remove}
        onClose={() => setDeleting(null)}
      />
    </div>
  );
}
