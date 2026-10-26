import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '@services/api';
import { formatRelativeTime, cn, humanize } from '@utils/helpers';
import { PageHeader, PageLoader, ErrorState, StatusBadge, PriorityBadge, SLABadge, Modal, STATUS_OPTIONS, PRIORITY_OPTIONS, getErrorMessage } from '@components/common/ui';
import AICopilotPanel from '@components/ai/AICopilotPanel';
import MacroSelector from '@components/macros/MacroSelector';
import TicketContactCards from '@components/tickets/TicketContactCards';
import AssignedAgentTopTile from '@components/tickets/AssignedAgentTopTile';

export default function AdminTicketDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [comment, setComment] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [assignModal, setAssignModal] = useState(false);
  const [statusModal, setStatusModal] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [resolution, setResolution] = useState('');
  const [newAssignee, setNewAssignee] = useState('');
  const [newTeam, setNewTeam] = useState('');
  const [activeTab, setActiveTab] = useState<'comments' | 'history' | 'approvals' | 'sla'>('comments');

  const { data: ticketData, isLoading, error, refetch } = useQuery({
    queryKey: ['ticket', id],
    queryFn: () => api.getTicketById(id!),
    enabled: !!id,
  });
  // Backend returns extended fields (comments, updates, approvals, slaEvents, watchers) not in the base Ticket type
  const ticket = ticketData as any;

  const { data: users } = useQuery({
    queryKey: ['dept-users-assign', ticket?.departmentId],
    queryFn: () => api.getUsers({ departmentId: ticket?.departmentId, limit: 100 }),
    enabled: !!ticket?.departmentId && assignModal,
  });

  const { data: teams } = useQuery({
    queryKey: ['dept-teams-assign', ticket?.departmentId],
    queryFn: () => api.getTeams(ticket?.departmentId),
    enabled: !!ticket?.departmentId && assignModal,
  });

  const commentMutation = useMutation({
    mutationFn: () => api.addComment(ticket?.id || id!, comment, isInternal),
    onSuccess: () => { toast.success('Comment added'); setComment(''); qc.invalidateQueries({ queryKey: ['ticket', id] }); },
    onError: () => toast.error('Failed to add comment'),
  });

  const assignMutation = useMutation({
    mutationFn: () => api.assignTicket(ticket?.id || id!, newAssignee, newTeam || undefined),
    onSuccess: () => { toast.success('Ticket assigned'); setAssignModal(false); qc.invalidateQueries({ queryKey: ['ticket', id] }); },
    onError: () => toast.error('Assignment failed'),
  });

  const statusMutation = useMutation({
    mutationFn: async () => {
      if (newStatus === 'RESOLVED' && !resolution.trim()) {
        throw new Error('Resolution notes are required when resolving a ticket.');
      }
      return api.updateTicketStatus(ticket?.id || id!, newStatus, resolution.trim() || undefined);
    },
    onSuccess: () => { toast.success('Status updated'); setStatusModal(false); qc.invalidateQueries({ queryKey: ['ticket', id] }); },
    onError: (err: any) => toast.error(getErrorMessage(err)),
  });

  if (isLoading) return <PageLoader />;
  if (error || !ticket) return <ErrorState error={error || 'Ticket not found'} onRetry={refetch} />;

  const agents = (users?.data || []).filter((u: any) => ['AGENT', 'TEAM_LEAD', 'DEPARTMENT_HEAD', 'ADMIN', 'SUPER_ADMIN'].includes(u.role));
  const teamList = teams || [];
  const needsResolution = newStatus === 'RESOLVED';

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <button onClick={() => navigate('/admin/tickets')} className="text-gray-400 hover:text-gray-600 text-sm">← All Tickets</button>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 break-words">{ticket.ticketNumber}</h1>
          <p className="text-gray-600 mt-1 text-sm sm:text-base break-words">{ticket.title}</p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <StatusBadge status={ticket.status} />
          <PriorityBadge priority={ticket.priority} />
          <SLABadge status={ticket.slaStatus} />
        </div>
      </div>

      {/* Top Tile: Assigned Support Agent Contact Details */}
      <AssignedAgentTopTile ticket={ticket} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main panel */}
        <div className="lg:col-span-2 space-y-4">
          {/* Description */}
          <div className="card p-4 sm:p-5">
            <h2 className="font-semibold text-gray-900 mb-3">Description</h2>
            <p className="text-gray-700 whitespace-pre-wrap text-sm leading-relaxed">{ticket.description}</p>
          </div>

          {/* Tabs */}
          <div className="card overflow-hidden">
            <div className="flex border-b border-gray-200 overflow-x-auto scrollbar-thin">
              {(['comments', 'history', 'approvals', 'sla'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    'px-3.5 sm:px-4 py-2.5 sm:py-3 text-sm font-medium capitalize transition-colors whitespace-nowrap shrink-0',
                    activeTab === tab ? 'border-b-2 border-primary-600 text-primary-600' : 'text-gray-500 hover:text-gray-700'
                  )}
                >
                  {tab === 'sla' ? 'SLA Events' : tab}
                  {tab === 'comments' && ticket._count?.comments > 0 && (
                    <span className="ml-1.5 badge badge-gray">{ticket._count.comments}</span>
                  )}
                  {tab === 'approvals' && ticket._count?.approvals > 0 && (
                    <span className="ml-1.5 badge badge-gray">{ticket._count.approvals}</span>
                  )}
                </button>
              ))}
            </div>

            <div className="p-5">
              {/* Comments tab */}
              {activeTab === 'comments' && (
                <div className="space-y-4">
                  {(ticket.comments || []).length === 0 && (
                    <p className="text-sm text-gray-500 text-center py-4">No comments yet.</p>
                  )}
                  {(ticket.comments || []).map((c: any) => (
                    <div key={c.id} className={cn('flex gap-3', c.isInternal && 'bg-amber-50 rounded-lg p-3 -mx-1')}>
                      <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-xs font-bold text-primary-700 shrink-0">
                        {c.user?.firstName?.[0]}{c.user?.lastName?.[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium">{c.user?.firstName} {c.user?.lastName}</span>
                          {c.isInternal && <span className="badge badge-warning text-xs">Internal</span>}
                          <span className="text-xs text-gray-400">{formatRelativeTime(c.createdAt)}</span>
                        </div>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">{c.content}</p>
                      </div>
                    </div>
                  ))}

                  {/* Add comment */}
                  <div className="border-t border-gray-100 pt-4">
                    <textarea
                      className="input w-full min-h-[80px] resize-y"
                      placeholder="Write a comment…"
                      value={comment}
                      onChange={e => setComment(e.target.value)}
                    />
                    <div className="flex items-center justify-between mt-2">
                      <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                        <input type="checkbox" checked={isInternal} onChange={e => setIsInternal(e.target.checked)} className="rounded" />
                        Internal note (not visible to raiser)
                      </label>
                      <button
                        className="btn-primary btn-sm"
                        disabled={!comment.trim() || commentMutation.isPending}
                        onClick={() => commentMutation.mutate()}
                      >
                        {commentMutation.isPending ? 'Posting…' : isInternal ? 'Add Note' : 'Post Comment'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* History tab */}
              {activeTab === 'history' && (
                <div className="space-y-2">
                  {(ticket.updates || []).length === 0 && <p className="text-sm text-gray-500 text-center py-4">No history.</p>}
                  {(ticket.updates || []).map((u: any) => {
                    const formatValue = (val: string) => {
                      if (!val) return '';
                      if (/^[0-9a-fA-F-]{36}$/.test(val)) {
                        const matched = agents.find((a: any) => a.id === val);
                        if (matched) return `${matched.firstName} ${matched.lastName}`;
                      }
                      return val.replace(/_/g, ' ');
                    };
                    return (
                      <div key={u.id} className="flex items-start gap-2 text-sm">
                        <span className="text-gray-400 whitespace-nowrap mt-0.5">{formatRelativeTime(u.createdAt)}</span>
                        <span className="text-gray-700">
                          <strong>{u.user?.firstName} {u.user?.lastName}</strong> changed <em>{u.field}</em>
                          {u.oldValue && <> from <span className="text-red-500 font-medium">{formatValue(u.oldValue)}</span></>}
                          {u.newValue && <> to <span className="text-green-600 font-medium">{formatValue(u.newValue)}</span></>}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Approvals tab */}
              {activeTab === 'approvals' && (
                <div className="space-y-3">
                  {(ticket.approvals || []).length === 0 && <p className="text-sm text-gray-500 text-center py-4">No approvals.</p>}
                  {(ticket.approvals || []).map((a: any) => (
                    <div key={a.id} className="flex items-center justify-between p-3 border border-gray-100 rounded-lg">
                      <div>
                        <p className="text-sm font-medium">{a.title}</p>
                        <p className="text-xs text-gray-500">Approver: {a.approver?.firstName} {a.approver?.lastName}</p>
                      </div>
                      <span className={cn('badge', a.status === 'APPROVED' ? 'badge-success' : a.status === 'REJECTED' ? 'badge-danger' : 'badge-warning')}>
                        {a.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* SLA tab */}
              {activeTab === 'sla' && (
                <div className="space-y-2">
                  {(ticket.slaEvents || []).length === 0 && <p className="text-sm text-gray-500 text-center py-4">No SLA events.</p>}
                  {(ticket.slaEvents || []).map((e: any) => (
                    <div key={e.id} className="flex items-center gap-3 text-sm">
                      <span className={cn(
                        'w-2 h-2 rounded-full shrink-0',
                        e.eventType.includes('BREACH') ? 'bg-red-500' : e.eventType.includes('WARNING') ? 'bg-amber-500' : 'bg-green-500'
                      )} />
                      <span className="text-gray-700">{e.description}</span>
                      <span className="text-gray-400 ml-auto whitespace-nowrap">{formatRelativeTime(e.triggerTime)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Side panel */}
        <div className="space-y-4">
          {/* Direct Contact Cards */}
          <TicketContactCards ticket={ticket} />

          {/* AI Copilot Panel */}
          <AICopilotPanel ticketId={ticket.id} onApplyReply={(replyText) => setComment(replyText)} />

          {/* Agent Canned Macros */}
          <MacroSelector ticketId={ticket.id} onApplied={() => refetch()} />

          {/* Admin Actions */}
          <div className="card p-4 space-y-2.5">
            <h3 className="font-semibold text-gray-900 text-sm mb-2">Admin Actions</h3>
            <button className="btn-primary btn-sm w-full" onClick={() => { setNewAssignee(ticket.assignedToId || ''); setNewTeam(ticket.teamId || ''); setAssignModal(true); }}>
              {ticket.assignedTo ? 'Reassign Ticket' : 'Assign Ticket'}
            </button>
            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-gray-100">
              {ticket.status !== 'DEPENDENCY_ON_CLIENT' && ticket.status !== 'RESOLVED' && (
                <button
                  type="button"
                  disabled={statusMutation.isPending}
                  onClick={() => api.updateTicketStatus(ticket.id, 'DEPENDENCY_ON_CLIENT').then(() => { toast.success('Status updated to Dependency on User'); qc.invalidateQueries({ queryKey: ['ticket', id] }); })}
                  className="btn-secondary text-xs py-1.5 px-2 bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100 font-medium flex items-center justify-center gap-1 shadow-xs"
                >
                  ⏳ Dep. on User
                </button>
              )}
              {ticket.status !== 'DEPENDENCY_ON_VENDOR' && ticket.status !== 'RESOLVED' && (
                <button
                  type="button"
                  disabled={statusMutation.isPending}
                  onClick={() => api.updateTicketStatus(ticket.id, 'DEPENDENCY_ON_VENDOR').then(() => { toast.success('Status updated to Dependency on Vendor'); qc.invalidateQueries({ queryKey: ['ticket', id] }); })}
                  className="btn-secondary text-xs py-1.5 px-2 bg-purple-50 text-purple-800 border-purple-200 hover:bg-purple-100 font-medium flex items-center justify-center gap-1 shadow-xs"
                >
                  🏢 Dep. on Vendor
                </button>
              )}
              {ticket.status !== 'OPEN' && ticket.status !== 'RESOLVED' && (
                <button
                  type="button"
                  disabled={statusMutation.isPending}
                  onClick={() => api.updateTicketStatus(ticket.id, 'OPEN').then(() => { toast.success('Status updated to Open'); qc.invalidateQueries({ queryKey: ['ticket', id] }); })}
                  className="btn-secondary text-xs py-1.5 px-2 bg-blue-50 text-blue-800 border-blue-200 hover:bg-blue-100 font-medium flex items-center justify-center gap-1 shadow-xs"
                >
                  🔄 Back to Open
                </button>
              )}
            </div>
            <button className="btn-secondary btn-sm w-full" onClick={() => { setNewStatus(ticket.status); setResolution(''); setStatusModal(true); }}>
              Change Status...
            </button>
          </div>

          {/* Details */}
          <div className="card p-4 space-y-3">
            <h3 className="font-semibold text-gray-900 text-sm">Details</h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">Department</dt>
                <dd className="font-medium" style={{ color: ticket.department?.color }}>{ticket.department?.name}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Category</dt>
                <dd>{ticket.category?.replace(/_/g, ' ')}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Team</dt>
                <dd>{ticket.team?.name || '—'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Raised by</dt>
                <dd>
                  <Link to={`/admin/users/${ticket.raisedBy?.id}`} className="text-primary-600 hover:underline">
                    {ticket.raisedBy?.firstName} {ticket.raisedBy?.lastName}
                  </Link>
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Assigned to</dt>
                <dd>{ticket.assignedTo ? `${ticket.assignedTo.firstName} ${ticket.assignedTo.lastName}` : '—'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Created</dt>
                <dd>{formatRelativeTime(ticket.createdAt)}</dd>
              </div>
              {ticket.resolutionDueAt && (
                <div className="flex justify-between">
                  <dt className="text-gray-500">SLA due</dt>
                  <dd className={cn(ticket.slaStatus === 'BREACHED' ? 'text-red-600 font-medium' : ticket.slaStatus === 'APPROACHING_BREACH' ? 'text-amber-600 font-medium' : '')}>
                    {formatRelativeTime(ticket.resolutionDueAt)}
                  </dd>
                </div>
              )}
            </dl>
          </div>

          {/* Watchers */}
          {ticket.watchers?.length > 0 && (
            <div className="card p-4">
              <h3 className="font-semibold text-gray-900 text-sm mb-3">Watchers</h3>
              <div className="flex flex-wrap gap-2">
                {ticket.watchers.map((w: any) => (
                  <div key={w.id} className="flex items-center gap-1.5 text-xs bg-gray-100 rounded-full px-2 py-1">
                    <div className="w-4 h-4 rounded-full bg-primary-200 text-primary-700 flex items-center justify-center font-bold" style={{ fontSize: 9 }}>
                      {w.user?.firstName?.[0]}
                    </div>
                    {w.user?.firstName} {w.user?.lastName}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Assign Modal */}
      <Modal open={assignModal} onClose={() => setAssignModal(false)} title="Assign Ticket" footer={
        <>
          <button className="btn-secondary" onClick={() => setAssignModal(false)}>Cancel</button>
          <button className="btn-primary" disabled={!newAssignee || assignMutation.isPending} onClick={() => assignMutation.mutate()}>
            {assignMutation.isPending ? 'Assigning…' : 'Assign'}
          </button>
        </>
      }>
        <div className="space-y-4">
          <div>
            <label className="label">Assign To</label>
            <select className="input w-full" value={newAssignee} onChange={e => setNewAssignee(e.target.value)}>
              <option value="">Select agent…</option>
              {agents.map((u: any) => (
                <option key={u.id} value={u.id}>{u.firstName} {u.lastName} ({u.role})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Team (optional)</label>
            <select className="input w-full" value={newTeam} onChange={e => setNewTeam(e.target.value)}>
              <option value="">No team</option>
              {teamList.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
        </div>
      </Modal>

      {/* Status Modal */}
      <Modal open={statusModal} onClose={() => setStatusModal(false)} title="Change Status" footer={
        <>
          <button className="btn-secondary" onClick={() => setStatusModal(false)}>Cancel</button>
          <button className="btn-primary" disabled={!newStatus || statusMutation.isPending} onClick={() => statusMutation.mutate()}>
            {statusMutation.isPending ? 'Updating…' : 'Update'}
          </button>
        </>
      }>
        <div className="space-y-4">
          <div>
            <label className="label">New Status</label>
            <select className="input w-full" value={newStatus} onChange={e => setNewStatus(e.target.value)}>
              {STATUS_OPTIONS.map(s => <option key={s} value={s}>{humanize(s)}</option>)}
            </select>
          </div>
          {needsResolution && (
            <div>
              <label className="label">Resolution notes</label>
              <textarea
                className="input w-full min-h-[80px]"
                placeholder="Describe how the ticket was resolved…"
                value={resolution}
                onChange={e => setResolution(e.target.value)}
              />
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
