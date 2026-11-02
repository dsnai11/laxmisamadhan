import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '@services/api';
import { formatRelativeTime, cn } from '@utils/helpers';
import { EmptyState, ErrorState, Field, getErrorMessage, Modal, PageHeader, PageLoader, PriorityBadge } from '@components/common/ui';
import { useAuth } from '@context/AuthContext';

export default function ApprovalsPage({ ticketBase }: { ticketBase: string }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';
  const [scope, setScope] = useState<'mine' | 'all'>('mine');

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['pending-approvals', scope],
    queryFn: () => api.getPendingApprovals({ page: 1, limit: 50, all: scope === 'all' }),
  });
  const [responding, setResponding] = useState<{ approval: any; status: 'APPROVED' | 'REJECTED' } | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!responding) return;
    setBusy(true);
    try {
      await api.respondToApproval(responding.approval.id, responding.status, note.trim() || undefined);
      toast.success(responding.status === 'APPROVED' ? 'Approved' : 'Rejected');
      setResponding(null);
      setNote('');
      await qc.invalidateQueries();
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  if (isLoading) return <PageLoader />;
  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;

  const approvals: any[] = data?.data || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <PageHeader title="Approvals" subtitle="Requests waiting for your decision" />
        {isAdmin && (
          <div className="inline-flex rounded-lg border border-gray-200 bg-white p-1 shadow-sm">
            <button
              onClick={() => setScope('mine')}
              className={cn(
                'px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors',
                scope === 'mine' ? 'bg-primary-600 text-white shadow' : 'text-gray-600 hover:text-gray-900'
              )}
            >
              Assigned to Me
            </button>
            <button
              onClick={() => setScope('all')}
              className={cn(
                'px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors',
                scope === 'all' ? 'bg-primary-600 text-white shadow' : 'text-gray-600 hover:text-gray-900'
              )}
            >
              All Org Approvals
            </button>
          </div>
        )}
      </div>

      <div className="card">
        {approvals.length === 0 ? (
          <EmptyState
            title="Nothing waiting for you"
            message={scope === 'all' ? 'No pending approval requests across the organization.' : 'When someone asks for your approval on a ticket, it will show up here.'}
          />
        ) : (
          <ul className="divide-y divide-gray-100">
            {approvals.map((a) => (
              <li key={a.id} className="p-5 flex flex-col md:flex-row md:items-center gap-4">
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link to={`${ticketBase}/${a.ticket.id}`} className="font-mono text-sm text-primary-600 hover:underline">{a.ticket.ticketNumber}</Link>
                    <PriorityBadge priority={a.ticket.priority} />
                    <span className="text-xs text-gray-400">{formatRelativeTime(a.createdAt)}</span>
                  </div>
                  <p className="font-medium text-gray-900">{a.title}</p>
                  {a.description && <p className="text-sm text-gray-600 whitespace-pre-wrap">{a.description}</p>}
                  <p className="text-xs text-gray-500">
                    Ticket: {a.ticket.title} · Requested by {a.requester?.firstName} {a.requester?.lastName}
                    {scope === 'all' && a.approver && (
                      <span className="ml-2 font-medium text-primary-700">· Assigned to: {a.approver.firstName} {a.approver.lastName}</span>
                    )}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button className="btn-success" onClick={() => { setNote(''); setResponding({ approval: a, status: 'APPROVED' }); }}>Approve</button>
                  <button className="btn-danger" onClick={() => { setNote(''); setResponding({ approval: a, status: 'REJECTED' }); }}>Reject</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Modal
        open={!!responding}
        onClose={() => setResponding(null)}
        title={responding?.status === 'APPROVED' ? 'Approve request' : 'Reject request'}
        footer={
          <>
            <button className="btn-secondary" onClick={() => setResponding(null)}>Cancel</button>
            <button className={responding?.status === 'APPROVED' ? 'btn-success' : 'btn-danger'} disabled={busy} onClick={submit}>{busy ? 'Saving...' : responding?.status === 'APPROVED' ? 'Approve' : 'Reject'}</button>
          </>
        }
      >
        <p className="text-sm text-gray-700 mb-3">{responding?.approval.title}</p>
        <Field label="Comment (optional)"><textarea className="input min-h-[90px]" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
      </Modal>
    </div>
  );
}
