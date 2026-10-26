import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '@context/AuthContext';
import api from '@services/api';
import { formatRelativeTime, cn, humanize } from '@utils/helpers';
import { PageHeader, PageLoader, ErrorState, EmptyState, StatusBadge, PriorityBadge, SLABadge } from '@components/common/ui';


const STATUS_OPTIONS = ['', 'OPEN', 'DEPENDENCY_ON_CLIENT', 'DEPENDENCY_ON_VENDOR', 'RESOLVED', 'REOPENED'];
const PRIORITY_OPTIONS = ['', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL', 'URGENT'];

export default function TeamBucket() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [filterMember, setFilterMember] = useState('');
  const [reassigning, setReassigning] = useState<{ ticketId: string; currentAssignee: string } | null>(null);
  const [newAssignee, setNewAssignee] = useState('');
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [selectedDeptId, setSelectedDeptId] = useState<string>('');

  const userRoles = Array.from(new Set([
    ...(user?.role ? [user.role] : []),
    ...(user?.roles || [])
  ]));
  const isLeadership = userRoles.some(r => ['SUPER_ADMIN', 'ADMIN', 'DEPARTMENT_HEAD'].includes(r));

  // If user has no department assigned (e.g. SUPER_ADMIN), fetch departments list
  const { data: allDepts } = useQuery({
    queryKey: ['all-departments-bucket'],
    queryFn: () => api.getDepartments(),
    enabled: !user?.departmentId && isLeadership,
  });

  const departmentId = user?.departmentId || selectedDeptId || (allDepts?.[0]?.id) || '';

  // Fetch all teams in department
  const { data: allTeams, isLoading: teamsLoading, error: teamsError, refetch: refetchTeams } = useQuery({
    queryKey: ['my-dept-teams', departmentId],
    queryFn: () => api.getMyTeam(departmentId),
    enabled: !!departmentId,
  });

  const eligibleTeams = (allTeams || []).filter((t: any) =>
    isLeadership || t.leadId === user?.id || (t.members || []).some((m: any) => m.id === user?.id)
  );

  const myTeam = eligibleTeams.find((t: any) => t.id === (selectedTeamId || eligibleTeams[0]?.id)) || eligibleTeams[0];
  const canReassign = isLeadership || userRoles.includes('TEAM_LEAD') || myTeam?.leadId === user?.id;

  const { data: bucketData, isLoading: bucketLoading, error: bucketError, refetch: refetchBucket } = useQuery({
    queryKey: ['team-bucket', departmentId, myTeam?.id, page, status, priority, filterMember],
    queryFn: () =>
      api.getTeamBucket(departmentId, myTeam!.id, {
        page,
        limit: 20,
        status: status || undefined,
        priority: priority || undefined,
        assignedToId: filterMember || undefined,
      }),
    enabled: !!departmentId && !!myTeam?.id,
  });

  const reassignMutation = useMutation({
    mutationFn: ({ ticketId, assignedToId }: { ticketId: string; assignedToId: string }) =>
      api.reassignTicket(ticketId, assignedToId),
    onSuccess: () => {
      toast.success('Ticket reassigned');
      setReassigning(null);
      setNewAssignee('');
      qc.invalidateQueries({ queryKey: ['team-bucket'] });
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Failed to reassign ticket'),
  });

  if (teamsLoading || bucketLoading) return <PageLoader />;
  if (teamsError) return <ErrorState error={teamsError} onRetry={() => refetchTeams()} />;
  if (!myTeam) {
    return (
      <div className="space-y-6">
        <PageHeader title="Team Bucket" subtitle="Your team's ticket queue" />
        <EmptyState
          title="No team assigned"
          message="You are not currently assigned to a team in your department. Ask an admin or team lead to add you to a team."
        />
      </div>
    );
  }
  if (bucketError) return <ErrorState error={bucketError} onRetry={() => refetchBucket()} />;

  const tickets: any[] = bucketData?.tickets || [];
  const totalPages: number = bucketData?.totalPages || 1;
  const members: any[] = myTeam.members || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <PageHeader
          title={`Team Bucket — ${myTeam.name}`}
          subtitle={`${bucketData?.total ?? 0} tickets across ${members.length} team members`}
        />
        <div className="flex flex-wrap items-center gap-3">
          {allDepts && allDepts.length > 1 && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-500 uppercase">Dept:</span>
              <select
                className="input input-sm text-sm"
                value={departmentId}
                onChange={(e) => {
                  setSelectedDeptId(e.target.value);
                  setSelectedTeamId('');
                  setPage(1);
                  setFilterMember('');
                }}
              >
                {allDepts.map((d: any) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
          )}
          {eligibleTeams.length > 1 && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-500 uppercase">Team:</span>
              <select
                className="input input-sm text-sm font-medium"
                value={myTeam.id}
                onChange={(e) => {
                  setSelectedTeamId(e.target.value);
                  setPage(1);
                  setFilterMember('');
                }}
              >
                {eligibleTeams.map((t: any) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Member stats strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {members.map((m: any) => {
          const memberTickets = tickets.filter((t: any) => t.assignedTo?.id === m.id);
          const open = memberTickets.filter((t: any) => t.status !== 'RESOLVED').length;
          return (
            <button
              key={m.id}
              onClick={() => setFilterMember(filterMember === m.id ? '' : m.id)}
              className={cn(
                'card p-3 text-left transition-all border-2',
                filterMember === m.id ? 'border-primary-500 bg-primary-50' : 'border-transparent hover:border-gray-200'
              )}
            >
              <div className="flex items-center gap-2 mb-1">
                <div className="w-7 h-7 rounded-full bg-primary-100 flex items-center justify-center text-xs font-bold text-primary-700 shrink-0">
                  {m.firstName?.[0]}{m.lastName?.[0]}
                </div>
                <p className="text-sm font-medium text-gray-900 truncate">{m.firstName} {m.lastName}</p>
              </div>
              <p className="text-xs text-gray-500">{open} active ticket{open !== 1 ? 's' : ''}</p>
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-wrap gap-3">
        <select className="input input-sm w-36" value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}>
          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s ? humanize(s) : 'All Statuses'}</option>)}
        </select>
        <select className="input input-sm w-36" value={priority} onChange={e => { setPriority(e.target.value); setPage(1); }}>
          {PRIORITY_OPTIONS.map(p => <option key={p} value={p}>{p || 'All Priorities'}</option>)}
        </select>
        {(status || priority || filterMember) && (
          <button className="btn-secondary btn-sm" onClick={() => { setStatus(''); setPriority(''); setFilterMember(''); setPage(1); }}>
            Clear filters
          </button>
        )}
      </div>

      {/* Ticket table */}
      <div className="card overflow-hidden">
        {tickets.length === 0 ? (
          <EmptyState title="No tickets" message="No tickets match the current filters." />
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Ticket</th>
                  <th>Assigned To</th>
                  <th>Status</th>
                  <th>Priority</th>
                  <th>SLA</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((ticket: any) => (
                  <tr key={ticket.id}>
                    <td>
                      <Link to={`/agent/tickets/${ticket.id}`} className="font-medium text-primary-600 hover:underline">
                        {ticket.ticketNumber}
                      </Link>
                      <p className="text-xs text-gray-500 mt-0.5 max-w-[200px] truncate">{ticket.title}</p>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-xs font-semibold text-gray-600 shrink-0">
                          {ticket.assignedTo?.firstName?.[0]}{ticket.assignedTo?.lastName?.[0]}
                        </div>
                        <span className="text-sm">{ticket.assignedTo ? `${ticket.assignedTo.firstName} ${ticket.assignedTo.lastName}` : '—'}</span>
                      </div>
                    </td>
                    <td><StatusBadge status={ticket.status} /></td>
                    <td><PriorityBadge priority={ticket.priority} /></td>
                    <td><SLABadge status={ticket.slaStatus} /></td>
                    <td className="text-sm text-gray-500">{formatRelativeTime(ticket.createdAt)}</td>
                    <td>
                      {canReassign ? (
                        <button
                          className="btn-ghost btn-sm text-primary-600"
                          onClick={() => { setReassigning({ ticketId: ticket.id, currentAssignee: ticket.assignedTo?.id || '' }); setNewAssignee(''); }}
                        >
                          Reassign
                        </button>
                      ) : (
                        <span className="text-gray-400 text-xs">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t border-gray-100">
            <p className="text-sm text-gray-500">Page {page} of {totalPages}</p>
            <div className="flex gap-2">
              <button className="btn-secondary btn-sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</button>
              <button className="btn-secondary btn-sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next</button>
            </div>
          </div>
        )}
      </div>

      {/* Reassign modal */}
      {reassigning && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Reassign Ticket</h3>
            <p className="text-sm text-gray-600">Select a team member to reassign this ticket to:</p>
            <select
              className="input w-full"
              value={newAssignee}
              onChange={e => setNewAssignee(e.target.value)}
            >
              <option value="">Select member…</option>
              {members
                .filter((m: any) => m.id !== reassigning.currentAssignee)
                .map((m: any) => (
                  <option key={m.id} value={m.id}>{m.firstName} {m.lastName}</option>
                ))}
            </select>
            <div className="flex gap-3 justify-end">
              <button className="btn-secondary" onClick={() => setReassigning(null)}>Cancel</button>
              <button
                className="btn-primary"
                disabled={!newAssignee || reassignMutation.isPending}
                onClick={() => reassignMutation.mutate({ ticketId: reassigning.ticketId, assignedToId: newAssignee })}
              >
                {reassignMutation.isPending ? 'Reassigning…' : 'Reassign'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
