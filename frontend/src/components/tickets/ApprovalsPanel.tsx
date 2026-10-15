import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '@services/api';
import { formatRelativeTime, humanize } from '@utils/helpers';
import { Field, getErrorMessage, Modal } from '@components/common/ui';

const badge: Record<string, string> = { PENDING: 'badge-warning', APPROVED: 'badge-success', REJECTED: 'badge-danger', EXPIRED: 'badge-gray' };
const MANAGER_ROLES = ['SUPER_ADMIN', 'ADMIN', 'DEPARTMENT_HEAD', 'TEAM_LEAD'];

const name = (u?: { firstName?: string; lastName?: string }) => (u ? `${u.firstName || ''} ${u.lastName || ''}`.trim() : '');

export default function ApprovalsPanel({
  ticket,
  currentUserId,
  canRequest,
  isAdmin,
}: {
  ticket: any;
  currentUserId?: string;
  canRequest: boolean;
  isAdmin: boolean;
}) {
  const qc = useQueryClient();
  const approvals: any[] = ticket.approvals || [];
  const [requestOpen, setRequestOpen] = useState(false);
  const [form, setForm] = useState({ approverId: '', title: '', description: '' });
  const [responding, setResponding] = useState<{ approval: any; status: 'APPROVED' | 'REJECTED' } | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const { data: dept } = useQuery<any>({
    queryKey: ['department', ticket.departmentId],
    queryFn: () => api.getDepartmentById(ticket.departmentId),
    enabled: requestOpen,
  });
  const managers: any[] = (dept?.users || []).filter((u: any) => MANAGER_ROLES.includes(u.role) && u.status === 'ACTIVE' && u.id !== currentUserId);

  const refresh = () => qc.invalidateQueries();

  const run = async (fn: () => Promise<unknown>, success: string, after?: () => void) => {
    setBusy(true);
    try {
      await fn();
      toast.success(success);
      after?.();
      await refresh();
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  if (approvals.length === 0 && !canRequest) return null;

  return (
    <div className="card">
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        <h2 className="font-semibold text-gray-900">Approvals ({approvals.length})</h2>
        {canRequest && <button className="btn-secondary btn-sm" onClick={() => { setForm({ approverId: '', title: '', description: '' }); setRequestOpen(true); }}>Request approval</button>}
      </div>

      {approvals.length === 0 ? (
        <p className="p-4 text-sm text-gray-500">No approvals requested.</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {approvals.map((a) => (
            <li key={a.id} className="p-4 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-gray-900">{a.title}</span>
                <span className={`badge ${badge[a.status] || 'badge-gray'}`}>{humanize(a.status)}</span>
              </div>
              {a.description && <p className="text-sm text-gray-700 whitespace-pre-wrap">{a.description}</p>}
              <p className="text-xs text-gray-500">
                Requested by {name(a.requester)} from {name(a.approver)} · {formatRelativeTime(a.createdAt)}
              </p>
              {a.response && <p className="text-sm bg-gray-50 rounded-lg p-2 text-gray-700">“{a.response}”</p>}
              {a.status === 'PENDING' && (
                <div className="flex gap-2 pt-1">
                  {a.approverId === currentUserId && (
                    <>
                      <button className="btn-success btn-sm" onClick={() => { setNote(''); setResponding({ approval: a, status: 'APPROVED' }); }}>Approve</button>
                      <button className="btn-danger btn-sm" onClick={() => { setNote(''); setResponding({ approval: a, status: 'REJECTED' }); }}>Reject</button>
                    </>
                  )}
                  {(a.requesterId === currentUserId || a.approverId === currentUserId || isAdmin) && (
                    <button className="btn-ghost btn-sm" disabled={busy} onClick={() => run(() => api.cancelApproval(a.id), 'Approval request cancelled')}>Cancel request</button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={requestOpen}
        onClose={() => setRequestOpen(false)}
        title="Request approval"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setRequestOpen(false)}>Cancel</button>
            <button
              className="btn-primary"
              disabled={busy}
              onClick={() => {
                if (!form.approverId) return toast.error('Choose who should approve');
                if (!form.title.trim()) return toast.error('Give the request a title');
                run(() => api.createApproval({ ticketId: ticket.id, approverId: form.approverId, title: form.title.trim(), description: form.description.trim() } as any), 'Approval requested', () => setRequestOpen(false));
              }}
            >
              {busy ? 'Sending...' : 'Send request'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Approver">
            <select className="input" value={form.approverId} onChange={(e) => setForm({ ...form, approverId: e.target.value })}>
              <option value="">Select a manager...</option>
              {managers.map((u) => <option key={u.id} value={u.id}>{name(u)} ({humanize(u.role)})</option>)}
            </select>
          </Field>
          <Field label="What needs approval?"><input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
          <Field label="Details"><textarea className="input min-h-[100px]" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
          <p className="text-xs text-gray-500">The ticket moves to "Pending approval" until the approver responds.</p>
        </div>
      </Modal>

      <Modal
        open={!!responding}
        onClose={() => setResponding(null)}
        title={responding?.status === 'APPROVED' ? 'Approve request' : 'Reject request'}
        footer={
          <>
            <button className="btn-secondary" onClick={() => setResponding(null)}>Cancel</button>
            <button
              className={responding?.status === 'APPROVED' ? 'btn-success' : 'btn-danger'}
              disabled={busy}
              onClick={() => responding && run(() => api.respondToApproval(responding.approval.id, responding.status, note.trim() || undefined), responding.status === 'APPROVED' ? 'Approved' : 'Rejected', () => setResponding(null))}
            >
              {responding?.status === 'APPROVED' ? 'Approve' : 'Reject'}
            </button>
          </>
        }
      >
        <p className="text-sm text-gray-700 mb-3">{responding?.approval.title}</p>
        <Field label="Comment (optional)"><textarea className="input min-h-[90px]" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
      </Modal>
    </div>
  );
}
