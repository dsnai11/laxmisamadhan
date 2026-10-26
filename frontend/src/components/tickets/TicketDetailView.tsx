import { useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '@services/api';
import { useAuth } from '@context/AuthContext';
import { downloadBlob, formatDate, formatFileSize, formatRelativeTime, getFileIcon, humanize } from '@utils/helpers';
import ApprovalsPanel from '@components/tickets/ApprovalsPanel';
import AICopilotPanel from '@components/ai/AICopilotPanel';
import MacroSelector from '@components/macros/MacroSelector';
import SLACountdown from '@components/sla/SLACountdown';
import TicketContactCards from '@components/tickets/TicketContactCards';
import AssignedAgentTopTile from '@components/tickets/AssignedAgentTopTile';
import {
  Avatar,
  ConfirmModal,
  ErrorState,
  Field,
  getErrorMessage,
  Modal,
  PageLoader,
  PriorityBadge,
  PRIORITY_OPTIONS,
  SLABadge,
  STAFF_ROLES,
  StatusBadge,
} from '@components/common/ui';

const TRANSITIONS: Record<string, string[]> = {
  OPEN: ['DEPENDENCY_ON_CLIENT', 'DEPENDENCY_ON_VENDOR', 'RESOLVED'],
  DEPENDENCY_ON_CLIENT: ['OPEN', 'DEPENDENCY_ON_VENDOR', 'RESOLVED'],
  DEPENDENCY_ON_VENDOR: ['OPEN', 'DEPENDENCY_ON_CLIENT', 'RESOLVED'],
  RESOLVED: ['REOPENED'],
  REOPENED: ['OPEN', 'DEPENDENCY_ON_CLIENT', 'DEPENDENCY_ON_VENDOR', 'RESOLVED'],
};

const ACTIVE_STATUSES = ['OPEN', 'DEPENDENCY_ON_CLIENT', 'DEPENDENCY_ON_VENDOR', 'REOPENED'];

function fullName(u?: { firstName?: string; lastName?: string } | null) {
  return u ? `${u.firstName || ''} ${u.lastName || ''}`.trim() : '';
}

function describeUpdate(u: any): string {
  const who = fullName(u.user) || 'Someone';
  if (u.field === 'status') return `${who} changed status from ${humanize(u.oldValue)} to ${humanize(u.newValue)}`;
  if (u.field === 'assignedTo') return `${who} assigned the ticket`;
  if (u.newValue !== null && u.newValue !== undefined) return `${who} changed ${humanize(u.field)} from ${humanize(u.oldValue) || 'none'} to ${humanize(u.newValue)}`;
  return `${who} updated ${humanize(u.field)}`;
}

function DueRow({ label, due, done }: { label: string; due?: string | null; done?: string | null }) {
  if (!due) return null;
  const overdue = !done && new Date(due).getTime() < Date.now();
  return (
    <div className="flex justify-between gap-3 text-sm">
      <span className="text-gray-500">{label}</span>
      <span className={overdue ? 'text-danger-600 font-medium text-right' : 'text-gray-900 text-right'}>
        {formatDate(due, 'datetime')}
        {done ? ' (met)' : overdue ? ' (overdue)' : ''}
      </span>
    </div>
  );
}

export default function TicketDetailView({ backPath, backLabel }: { backPath: string; backLabel: string }) {
  const { id = '' } = useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);

  const [comment, setComment] = useState('');
  const [internal, setInternal] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [nextStatus, setNextStatus] = useState('');
  const [resolveOpen, setResolveOpen] = useState(false);
  const [resolution, setResolution] = useState('');
  const [resolutionSummary, setResolutionSummary] = useState('');
  const [reopenOpen, setReopenOpen] = useState(false);
  const [reopenReason, setReopenReason] = useState('');
  const [cancelOpen, setCancelOpen] = useState(false);
  const [assigneeId, setAssigneeId] = useState('');
  const [showAllActivity, setShowAllActivity] = useState(false);
  const [targetDeptId, setTargetDeptId] = useState('');
  const [transferReason, setTransferReason] = useState('');
  const [transferModalOpen, setTransferModalOpen] = useState(false);

  const { data: ticket, isLoading, error, refetch } = useQuery<any>({
    queryKey: ['ticket', id],
    queryFn: () => api.getTicketById(id),
    refetchInterval: 30000,
  });

  const userRoles = Array.from(new Set([
    ...(user?.role ? [user.role] : []),
    ...(user?.roles || [])
  ]));
  const role = user?.role || '';
  const isAdmin = userRoles.some(r => ['SUPER_ADMIN', 'ADMIN'].includes(r));
  const isStaff = userRoles.some(r => STAFF_ROLES.includes(r));
  const sameDept = !!ticket && !!user?.departmentId && user.departmentId === ticket.departmentId;
  const isDeptHeadOrLead = userRoles.some(r => ['DEPARTMENT_HEAD', 'TEAM_LEAD'].includes(r));
  const isManager = isAdmin || (isDeptHeadOrLead && sameDept);
  const isAssignee = !!ticket && ticket.assignedToId === user?.id;
  const isRaiser = !!ticket && ticket.raisedById === user?.id;
  const canWork = isManager || isAssignee || (isStaff && sameDept);
  const canClose = isAdmin || (isStaff && (sameDept || isAssignee));
  const isActive = !!ticket && ACTIVE_STATUSES.includes(ticket.status);
  // User rule: Only Team Lead, Department Head, and Super Admin can assign/reassign tickets (not regular agents)
  const canTake = !!ticket && !ticket.assignedToId && isManager && isActive;

  const { data: staffPool } = useQuery({
    queryKey: ['assignable-staff', ticket?.departmentId],
    queryFn: () => api.getUsers({ departmentId: ticket.departmentId, limit: 100 }),
    enabled: !!ticket && isManager,
  });
  const assignable: any[] = (staffPool?.data || []).filter((u: any) => STAFF_ROLES.includes(u.role) && u.status === 'ACTIVE');

  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: () => api.getDepartments(),
    enabled: !!ticket && isManager,
  });

  const refreshAll = () => qc.invalidateQueries();

  const run = async (key: string, fn: () => Promise<unknown>, success: string) => {
    setBusy(key);
    try {
      await fn();
      toast.success(success);
      await refreshAll();
      return true;
    } catch (e) {
      toast.error(getErrorMessage(e));
      return false;
    } finally {
      setBusy(null);
    }
  };

  if (isLoading) return <PageLoader label="Loading ticket..." />;
  if (error || !ticket) {
    return (
      <div className="space-y-4">
        <Link to={backPath} className="text-sm text-primary-600 hover:underline">← {backLabel}</Link>
        <ErrorState error={error || new Error('Ticket not found')} onRetry={() => refetch()} />
      </div>
    );
  }

  const staffTransitions = (TRANSITIONS[ticket.status] || []);
  // Raiser can only reopen tickets (when RESOLVED)
  const raiserTransitions = (TRANSITIONS[ticket.status] || []).filter((s) => s === 'REOPENED');
  const comments: any[] = ticket.comments || [];
  const attachments: any[] = ticket.attachments || [];
  const updates: any[] = ticket.updates || [];
  const visibleUpdates = showAllActivity ? updates : updates.slice(0, 8);
  const canComment = true;

  const postComment = async () => {
    const text = comment.trim();
    if (!text) return;
    const ok = await run('comment', () => api.addComment(ticket.id, text, isStaff && internal), internal && isStaff ? 'Internal note added' : 'Comment posted');
    if (ok) {
      setComment('');
      setInternal(false);
    }
  };

  const changeStatus = async (status: string) => {
    if (status === 'RESOLVED') {
      setResolveOpen(true);
      return;
    }
    if (status === 'REOPENED') {
      setReopenOpen(true);
      return;
    }
    const ok = await run('status', () => api.updateTicketStatus(ticket.id, status), `Status changed to ${humanize(status)}`);
    if (ok) setNextStatus('');
  };

  const submitResolution = async () => {
    if (!resolution.trim()) {
      toast.error('Please describe how the ticket was resolved');
      return;
    }
    const ok = await run('status', () => api.updateTicketStatus(ticket.id, 'RESOLVED', resolution.trim(), resolutionSummary.trim() || undefined), 'Ticket resolved');
    if (ok) {
      setResolveOpen(false);
      setResolution('');
      setResolutionSummary('');
      setNextStatus('');
    }
  };

  const submitReopen = async () => {
    if (isRaiser && !isStaff && !reopenReason.trim()) {
      toast.error('Please tell us why you are reopening this ticket');
      return;
    }
    const ok = await run(
      'status',
      async () => {
        if (reopenReason.trim()) await api.addComment(ticket.id, `Reopened: ${reopenReason.trim()}`, false);
        await api.updateTicketStatus(ticket.id, 'REOPENED');
      },
      'Ticket reopened'
    );
    if (ok) {
      setReopenOpen(false);
      setReopenReason('');
      setNextStatus('');
    }
  };

  const submitCancel = async () => {
    const ok = await run('status', () => api.updateTicketStatus(ticket.id, 'CANCELLED'), 'Ticket cancelled');
    if (ok) {
      setCancelOpen(false);
      setNextStatus('');
    }
  };

  const onUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    for (const file of Array.from(files)) {
      await run('upload', () => api.uploadAttachment(ticket.id, file), `${file.name} uploaded`);
    }
    if (fileInput.current) fileInput.current.value = '';
  };

  const onDownload = async (a: any) => {
    try {
      const blob = await api.downloadAttachment(ticket.id, a.id);
      downloadBlob(blob, a.originalName);
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  const isOverdue =
    ticket.slaStatus === 'BREACHED' ||
    (ticket.resolutionDueAt &&
      !ticket.resolvedAt &&
      new Date(ticket.resolutionDueAt).getTime() < Date.now());
  const isTicketClosedOrResolved = ['RESOLVED', 'CLOSED', 'CANCELLED'].includes(ticket.status);

  return (
    <div className="space-y-6">
      <div>
        <Link to={backPath} className="text-sm text-primary-600 hover:underline">← {backLabel}</Link>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm text-gray-500">{ticket.ticketNumber}</span>
          <StatusBadge status={ticket.status} />
          <PriorityBadge priority={ticket.priority} />
          <SLABadge status={ticket.slaStatus} isOverdue={isOverdue} />
        </div>
        <h1 className="mt-1 text-2xl font-bold text-gray-900 break-words">{ticket.title}</h1>
        <p className="text-sm text-gray-500 mt-1">
          Raised by {fullName(ticket.raisedBy)} · {formatDate(ticket.createdAt, 'datetime')} · {ticket.department?.name}
        </p>
      </div>

      {/* Overdue Warning Alert */}
      {isOverdue && !isTicketClosedOrResolved && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 flex items-start gap-3">
          <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/60 text-red-600 dark:text-red-400 shrink-0">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-semibold text-red-900 dark:text-red-200">Ticket Resolution Overdue</h4>
            <p className="text-xs sm:text-sm text-red-700 dark:text-red-300 mt-0.5">
              This ticket has exceeded its resolution SLA target (due {ticket.resolutionDueAt ? formatDate(ticket.resolutionDueAt, 'datetime') : 'earlier'}). The assigned department has been alerted for priority resolution.
            </p>
          </div>
        </div>
      )}

      {/* Top Tile: Assigned Support Agent Contact Details */}
      <AssignedAgentTopTile ticket={ticket} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="card p-6">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Description</h2>
            <p className="text-gray-900 whitespace-pre-wrap break-words">{ticket.description}</p>
            {ticket.resolution && (
              <div className="mt-5 rounded-lg bg-success-50 border border-success-200 p-4">
                <p className="text-sm font-semibold text-success-800">Resolution</p>
                <p className="text-sm text-success-900 whitespace-pre-wrap mt-1">{ticket.resolution}</p>
              </div>
            )}
          </div>

          <ApprovalsPanel ticket={ticket} currentUserId={user?.id} canRequest={canWork && isActive && isStaff} isAdmin={isAdmin} />

          <div className="card">
            <div className="p-4 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h2 className="font-semibold text-gray-900">Attachments ({attachments.length})</h2>
              <div>
                <input ref={fileInput} type="file" multiple hidden onChange={(e) => onUpload(e.target.files)} />
                <button className="btn-secondary btn-sm w-full sm:w-auto" disabled={busy === 'upload'} onClick={() => fileInput.current?.click()}>
                  {busy === 'upload' ? 'Uploading...' : 'Add file'}
                </button>
              </div>
            </div>
            {attachments.length === 0 ? (
              <p className="p-4 text-sm text-gray-500">No attachments.</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {attachments.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <button className="flex items-center gap-3 min-w-0 text-left hover:text-primary-700" onClick={() => onDownload(a)}>
                      <span className="text-xl">{getFileIcon(a.mimeType)}</span>
                      <span className="min-w-0">
                        <span className="block text-sm font-medium truncate">{a.originalName}</span>
                        <span className="block text-xs text-gray-500">{formatFileSize(a.size)} · {fullName(a.user)} · {formatRelativeTime(a.createdAt)}</span>
                      </span>
                    </button>
                    {(a.userId === user?.id || isAdmin) && (
                      <button
                        className="text-xs text-danger-600 hover:underline shrink-0"
                        onClick={() => run('att-' + a.id, () => api.deleteAttachment(ticket.id, a.id), 'Attachment removed')}
                      >
                        Remove
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="card">
            <div className="p-4 border-b border-gray-200">
              <h2 className="font-semibold text-gray-900">Conversation ({comments.length})</h2>
            </div>
            <div className="divide-y divide-gray-100">
              {comments.length === 0 && <p className="p-4 text-sm text-gray-500">No messages yet.</p>}
              {comments.map((c) => (
                <div key={c.id} className={`p-4 flex gap-3 ${c.isInternal ? 'bg-warning-50' : ''}`}>
                  <Avatar firstName={c.user?.firstName} lastName={c.user?.lastName} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="font-medium text-gray-900">{fullName(c.user)}</span>
                      {c.userId === ticket.raisedById && <span className="badge badge-gray">Requester</span>}
                      {c.isInternal && <span className="badge badge-warning">Internal note</span>}
                      <span className="text-gray-400 text-xs">{formatRelativeTime(c.createdAt)}</span>
                    </div>
                    <p className="text-sm text-gray-800 whitespace-pre-wrap break-words mt-1">{c.content}</p>
                    {(c.userId === user?.id || isAdmin) && (
                      <button
                        className="text-xs text-gray-400 hover:text-danger-600 mt-1"
                        onClick={() => run('del-' + c.id, () => api.deleteComment(ticket.id, c.id), 'Comment deleted')}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {canComment ? (
              <div className="p-4 border-t border-gray-200 space-y-3">
                <textarea
                  className="input min-h-[100px]"
                  placeholder={internal ? 'Write an internal note (only staff can see this)...' : 'Write a reply...'}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  aria-label="Comment"
                />
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  {isStaff ? (
                    <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
                      <input type="checkbox" className="h-4 w-4 rounded border-gray-300 text-warning-600" checked={internal} onChange={(e) => setInternal(e.target.checked)} />
                      Internal note (hidden from requester)
                    </label>
                  ) : <span />}
                  <button className="btn-primary w-full sm:w-auto" disabled={busy === 'comment' || !comment.trim()} onClick={postComment}>
                    {busy === 'comment' ? 'Posting...' : internal ? 'Add note' : 'Post reply'}
                  </button>
                </div>
              </div>
            ) : (
              <p className="p-4 border-t border-gray-200 text-sm text-gray-500">This ticket is {humanize(ticket.status).toLowerCase()}. Reopen it to continue the conversation.</p>
            )}
          </div>

          <div className="card">
            <div className="p-4 border-b border-gray-200">
              <h2 className="font-semibold text-gray-900">Activity</h2>
            </div>
            {updates.length === 0 ? (
              <p className="p-4 text-sm text-gray-500">No changes recorded yet.</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {visibleUpdates.map((u) => (
                  <li key={u.id} className="px-4 py-3 text-sm flex justify-between gap-3">
                    <span className="text-gray-700">{describeUpdate(u)}</span>
                    <span className="text-gray-400 whitespace-nowrap">{formatRelativeTime(u.createdAt)}</span>
                  </li>
                ))}
              </ul>
            )}
            {updates.length > 8 && (
              <button className="w-full py-2 text-sm text-primary-600 hover:bg-gray-50 border-t border-gray-100" onClick={() => setShowAllActivity((v) => !v)}>
                {showAllActivity ? 'Show less' : `Show all ${updates.length}`}
              </button>
            )}
          </div>
        </div>

        <div className="space-y-6">
          {/* 1. FIRST SECTION: Actions */}
          {(canWork || canTake || isManager || (isRaiser && raiserTransitions.length > 0)) && (
            <div className="card p-5 space-y-4 border-primary-100 dark:border-primary-900/40 shadow-xs">
              <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-2">
                <h2 className="font-bold text-gray-900 dark:text-white text-base">Actions</h2>
                <span className="text-[11px] font-semibold text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-950/60 px-2 py-0.5 rounded">
                  Quick Actions
                </span>
              </div>

              {canTake && (
                <button className="btn-primary w-full" disabled={busy === 'assign'} onClick={() => run('assign', () => api.assignTicket(ticket.id, user!.id), 'Ticket assigned to you')}>
                  {busy === 'assign' ? 'Assigning...' : 'Assign to me'}
                </button>
              )}

              {isManager && isActive && (
                <div className="space-y-2">
                  <label className="label">{ticket.assignedTo ? 'Reassign to' : 'Assign to'}</label>
                  <div className="flex gap-2">
                    <select className="input" value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
                      <option value="">Select staff member...</option>
                      {assignable.map((u) => (
                        <option key={u.id} value={u.id}>{fullName(u)} ({humanize(u.role)})</option>
                      ))}
                    </select>
                    <button
                      className="btn-primary"
                      disabled={!assigneeId || busy === 'assign'}
                      onClick={async () => {
                        const isReassign = !!ticket.assignedTo;
                        if (await run('assign', () => api.assignTicket(ticket.id, assigneeId), isReassign ? 'Ticket reassigned' : 'Ticket assigned')) setAssigneeId('');
                      }}
                    >
                      {ticket.assignedTo ? 'Reassign' : 'Assign'}
                    </button>
                  </div>
                  {assignable.length === 0 && <p className="text-xs text-gray-500">No active staff found in this department.</p>}
                </div>
              )}

              {isManager && isActive && (
                <div className="space-y-2 pt-2 border-t border-gray-100 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <label className="label mb-0">Reassign department</label>
                    <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-800">
                      Wrong Dept?
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <select
                      className="input text-xs"
                      value={targetDeptId}
                      onChange={(e) => setTargetDeptId(e.target.value)}
                    >
                      <option value="">Select correct department...</option>
                      {(departments || [])
                        .filter((d: any) => d.id !== ticket.departmentId)
                        .map((d: any) => (
                          <option key={d.id} value={d.id}>
                            {d.name}
                          </option>
                        ))}
                    </select>
                    <button
                      type="button"
                      className="btn-secondary text-xs px-3 whitespace-nowrap"
                      disabled={!targetDeptId || busy === 'transferDept'}
                      onClick={() => setTransferModalOpen(true)}
                    >
                      Transfer
                    </button>
                  </div>
                  <p className="text-[11px] text-gray-500">
                    If raised in the wrong department, transfer to the right team. Current assignee will be unassigned and SLA updated.
                  </p>
                </div>
              )}

              {canWork && isActive && (
                <div className="space-y-2 pt-2 border-t border-gray-100 dark:border-slate-800">
                  <label className="label mb-1">Quick Status Actions</label>
                  <div className="grid grid-cols-2 gap-2">
                    {ticket.status !== 'DEPENDENCY_ON_CLIENT' && (
                      <button
                        type="button"
                        disabled={busy === 'status'}
                        onClick={() => changeStatus('DEPENDENCY_ON_CLIENT')}
                        className="btn-secondary text-xs py-1.5 px-2 bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800 flex items-center justify-center gap-1 font-medium shadow-xs"
                      >
                        ⏳ Dep. on User
                      </button>
                    )}
                    {ticket.status !== 'DEPENDENCY_ON_VENDOR' && (
                      <button
                        type="button"
                        disabled={busy === 'status'}
                        onClick={() => changeStatus('DEPENDENCY_ON_VENDOR')}
                        className="btn-secondary text-xs py-1.5 px-2 bg-purple-50 text-purple-800 border-purple-200 hover:bg-purple-100 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800 flex items-center justify-center gap-1 font-medium shadow-xs"
                      >
                        🏢 Dep. on Vendor
                      </button>
                    )}
                    {ticket.status !== 'OPEN' && (
                      <button
                        type="button"
                        disabled={busy === 'status'}
                        onClick={() => changeStatus('OPEN')}
                        className="btn-secondary text-xs py-1.5 px-2 bg-blue-50 text-blue-800 border-blue-200 hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800 flex items-center justify-center gap-1 font-medium shadow-xs"
                      >
                        🔄 Back to Open
                      </button>
                    )}
                    {canClose && (
                      <button
                        type="button"
                        disabled={busy === 'status'}
                        onClick={() => changeStatus('RESOLVED')}
                        className="btn-secondary text-xs py-1.5 px-2 bg-green-50 text-green-800 border-green-200 hover:bg-green-100 dark:bg-green-950/40 dark:text-green-300 dark:border-green-800 flex items-center justify-center gap-1 font-medium shadow-xs"
                      >
                        ✅ Resolve
                      </button>
                    )}
                  </div>
                </div>
              )}

              {canWork && staffTransitions.length > 0 && (
                <div className="space-y-2">
                  <label className="label">Change status</label>
                  <div className="flex gap-2">
                    <select className="input" value={nextStatus} onChange={(e) => setNextStatus(e.target.value)}>
                      <option value="">Select...</option>
                      {staffTransitions.map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
                    </select>
                    <button className="btn-primary" disabled={!nextStatus || busy === 'status'} onClick={() => changeStatus(nextStatus)}>Apply</button>
                  </div>
                </div>
              )}

              {canWork && isActive && (
                <div className="space-y-2">
                  <label className="label">Priority</label>
                  <select
                    className="input"
                    value={ticket.priority}
                    onChange={(e) => run('priority', () => api.updateTicket(ticket.id, { priority: e.target.value } as any), 'Priority updated')}
                  >
                    {PRIORITY_OPTIONS.map((p) => <option key={p} value={p}>{humanize(p)}</option>)}
                  </select>
                </div>
              )}

              {!canWork && isRaiser && raiserTransitions.length > 0 && (
                <div className="flex flex-col gap-2 pt-2 border-t border-gray-100 dark:border-slate-800">
                  {raiserTransitions.includes('REOPENED') && (
                    <button className="btn-secondary w-full" onClick={() => changeStatus('REOPENED')}>Reopen ticket</button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 2. SLA Countdown */}
          <SLACountdown
            responseDueAt={ticket.responseDueAt}
            resolutionDueAt={ticket.resolutionDueAt}
            respondedAt={ticket.respondedAt}
            resolvedAt={ticket.resolvedAt}
            createdAt={ticket.createdAt}
            slaStatus={ticket.slaStatus}
            slaPolicy={ticket.slaPolicy}
          />

          {/* 3. Contact Cards */}
          <TicketContactCards ticket={ticket} currentUserId={user?.id} />

          {/* 4. AI Copilot */}
          <AICopilotPanel ticketId={ticket.id} onApplyReply={(replyText) => setComment(replyText)} />

          {/* 5. Macro Selector */}
          {(canWork || isManager) && <MacroSelector ticketId={ticket.id} onApplied={() => refreshAll()} />}

          <div className="card p-5 space-y-3">
            <h2 className="font-semibold text-gray-900">Details</h2>
            <div className="flex justify-between gap-3 text-sm"><span className="text-gray-500">Category</span><span className="text-right">{humanize(ticket.category)}</span></div>
            {ticket.subCategory && <div className="flex justify-between gap-3 text-sm"><span className="text-gray-500">Sub-Category</span><span className="text-right font-medium">{ticket.subCategory}</span></div>}
            {(ticket.subIssue || ticket.item) && <div className="flex justify-between gap-3 text-sm"><span className="text-gray-500">Sub-Issue</span><span className="text-right font-medium text-primary-600 dark:text-primary-400">{ticket.subIssue || ticket.item}</span></div>}
            <div className="flex justify-between gap-3 text-sm"><span className="text-gray-500">Department</span><span className="text-right">{ticket.department?.name}</span></div>
            {ticket.team && <div className="flex justify-between gap-3 text-sm"><span className="text-gray-500">Team</span><span className="text-right">{ticket.team.name}</span></div>}
            <div className="flex justify-between gap-3 text-sm items-center">
              <span className="text-gray-500">Assigned to</span>
              <span className="text-right">{ticket.assignedTo ? fullName(ticket.assignedTo) : <span className="text-gray-400">Unassigned</span>}</span>
            </div>
            <div className="flex justify-between gap-3 text-sm">
              <span className="text-gray-500">Requester</span>
              <span className="text-right">{fullName(ticket.raisedBy)}<br /><span className="text-xs text-gray-400">{ticket.raisedBy?.email}</span></span>
            </div>
            {ticket.slaPolicy && <div className="flex justify-between gap-3 text-sm"><span className="text-gray-500">SLA policy</span><span className="text-right">{ticket.slaPolicy.name}</span></div>}
            <DueRow label="First response due" due={ticket.responseDueAt} done={ticket.respondedAt} />
            <DueRow label="Resolution due" due={ticket.resolutionDueAt} done={ticket.resolvedAt} />
            {ticket.resolvedAt && <div className="flex justify-between gap-3 text-sm"><span className="text-gray-500">Resolved</span><span className="text-right">{formatDate(ticket.resolvedAt, 'datetime')}</span></div>}
            {ticket.reopenedCount > 0 && <div className="flex justify-between gap-3 text-sm"><span className="text-gray-500">Reopened</span><span>{ticket.reopenedCount}×</span></div>}
            {ticket.assets?.length > 0 && (
              <div className="text-sm">
                <span className="text-gray-500">Assets</span>
                <ul className="mt-1 space-y-1">
                  {ticket.assets.map((a: any) => <li key={a.id}>{a.name} <span className="text-gray-400">({a.assetTag})</span></li>)}
                </ul>
              </div>
            )}
            {ticket.customFields && Object.keys(ticket.customFields).length > 0 && (
              <div className="text-sm border-t border-gray-100 pt-3 space-y-1">
                {Object.entries(ticket.customFields).map(([key, value]) => (
                  <div key={key} className="flex justify-between gap-3">
                    <span className="text-gray-500">{humanize(key.replace(/([a-z])([A-Z])/g, '$1_$2'))}</span>
                    <span className="text-right break-words">{Array.isArray(value) ? value.join(', ') : typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value)}</span>
                  </div>
                ))}
              </div>
            )}
            {ticket.tags?.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">{ticket.tags.map((t: string) => <span key={t} className="badge badge-gray">{t}</span>)}</div>
            )}
          </div>
        </div>
      </div>

      <Modal
        open={resolveOpen}
        onClose={() => setResolveOpen(false)}
        title="Resolve ticket"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setResolveOpen(false)}>Cancel</button>
            <button className="btn-success" disabled={busy === 'status'} onClick={submitResolution}>{busy === 'status' ? 'Saving...' : 'Mark as resolved'}</button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="How was it resolved?" hint="The requester will see this note.">
            <textarea className="input min-h-[120px]" value={resolution} onChange={(e) => setResolution(e.target.value)} />
          </Field>
          <Field label="Short summary (optional)">
            <input className="input" maxLength={500} value={resolutionSummary} onChange={(e) => setResolutionSummary(e.target.value)} />
          </Field>
        </div>
      </Modal>

      <Modal
        open={reopenOpen}
        onClose={() => setReopenOpen(false)}
        title="Reopen ticket"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setReopenOpen(false)}>Cancel</button>
            <button className="btn-primary" disabled={busy === 'status'} onClick={submitReopen}>{busy === 'status' ? 'Reopening...' : 'Reopen'}</button>
          </>
        }
      >
        <Field label={isStaff ? 'Reason (optional)' : 'Why are you reopening this ticket?'}>
          <textarea className="input min-h-[100px]" value={reopenReason} onChange={(e) => setReopenReason(e.target.value)} />
        </Field>
      </Modal>

      <Modal
        open={transferModalOpen}
        onClose={() => setTransferModalOpen(false)}
        title="Transfer ticket to another department"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setTransferModalOpen(false)}>Cancel</button>
            <button
              className="btn-primary"
              disabled={!targetDeptId || busy === 'transferDept'}
              onClick={async () => {
                const targetDept = (departments || []).find((d: any) => d.id === targetDeptId);
                const ok = await run(
                  'transferDept',
                  () => api.updateTicket(ticket.id, { departmentId: targetDeptId, transferReason }),
                  `Ticket transferred to ${targetDept?.name || 'new department'}`
                );
                if (ok) {
                  setTransferModalOpen(false);
                  setTargetDeptId('');
                  setTransferReason('');
                }
              }}
            >
              {busy === 'transferDept' ? 'Transferring...' : 'Confirm Transfer'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            You are transferring ticket <strong className="text-gray-900 dark:text-white">#{ticket.ticketNumber}</strong> from{' '}
            <strong className="text-gray-900 dark:text-white">{ticket.department?.name}</strong> to{' '}
            <strong className="text-primary-600 dark:text-primary-400">
              {(departments || []).find((d: any) => d.id === targetDeptId)?.name}
            </strong>.
          </p>
          <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md text-xs text-amber-800 dark:text-amber-300">
            <strong>Note:</strong> The ticket will be unassigned from current staff, its SLA policy will recalculate for the new department, and an audit trail comment will be recorded.
          </div>
          <Field label="Transfer Reason (optional)" hint="e.g. Raised in IT instead of HR / Accounts">
            <textarea
              className="input min-h-[90px]"
              placeholder="Why is this ticket being transferred?"
              value={transferReason}
              onChange={(e) => setTransferReason(e.target.value)}
            />
          </Field>
        </div>
      </Modal>

    </div>
  );
}
