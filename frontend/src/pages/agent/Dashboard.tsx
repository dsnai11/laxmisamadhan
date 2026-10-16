import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { TicketIcon, ClockIcon, CheckCircleIcon, ArrowPathIcon, ExclamationTriangleIcon, UserGroupIcon, ChartBarIcon } from '@heroicons/react/24/outline';
import api from '@services/api';
import { formatRelativeTime, getStatusColor, getPriorityColor, cn } from '@utils/helpers';

const statCards = [
  { name: 'Open', key: 'open', icon: TicketIcon, color: 'bg-blue-500', status: 'OPEN' },
  { name: 'Dependency on Client', key: 'dependency', icon: ArrowPathIcon, color: 'bg-amber-500', status: 'DEPENDENCY_ON_CLIENT' },
  { name: 'Reopened', key: 'reopened', icon: ClockIcon, color: 'bg-red-500', status: 'REOPENED' },
  { name: 'Resolved Today', key: 'resolvedToday', icon: CheckCircleIcon, color: 'bg-green-500', status: 'RESOLVED' },
];

export default function AgentDashboard() {
  const { data: assignedTickets, isLoading: assignedLoading } = useQuery({
    queryKey: ['assignedTickets', { page: 1, limit: 10 }],
    queryFn: () => api.getAssignedTickets({ page: 1, limit: 10, sortBy: 'updatedAt', sortOrder: 'desc' }),
  });

  const { data: queueTickets, isLoading: queueLoading } = useQuery({
    queryKey: ['queueTickets', { page: 1, limit: 10 }],
    queryFn: () => api.getTickets({ 
      page: 1, 
      limit: 10, 
      sortBy: 'createdAt', 
      sortOrder: 'asc',
      status: 'OPEN',
    }),
  });

  const isLoading = assignedLoading || queueLoading;
  const tickets = assignedTickets?.data || [];

  const openCount = tickets.filter((t: any) => t.status === 'OPEN').length;
  const dependencyCount = tickets.filter((t: any) => t.status === 'DEPENDENCY_ON_CLIENT').length;
  const reopenedCount = tickets.filter((t: any) => t.status === 'REOPENED').length;
  const resolvedToday = tickets.filter((t: any) => {
    if (!t.resolvedAt) return false;
    const resolved = new Date(t.resolvedAt);
    const today = new Date();
    return resolved.toDateString() === today.toDateString();
  }).length;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="card p-6 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div className="h-8 bg-gray-200 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Agent Dashboard</h1>
          <p className="page-subtitle">Manage your assigned tickets and the queue</p>
        </div>
        <div className="flex gap-2">
          <Link to="/agent/queue" className="btn-primary w-full sm:w-auto">
            <ChartBarIcon className="h-5 w-5 mr-2" />
            Ticket Queue
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <Link to="/agent/my-assignments?status=OPEN" className="card p-6 hover:shadow-card-hover transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-slate-400">Open</p>
              <p className="mt-1 text-3xl font-bold text-gray-900 dark:text-white">{openCount}</p>
            </div>
            <div className="p-3 rounded-xl bg-blue-500 text-white">
              <TicketIcon className="h-6 w-6" />
            </div>
          </div>
        </Link>

        <Link to="/agent/my-assignments?status=DEPENDENCY_ON_CLIENT" className="card p-6 hover:shadow-card-hover transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-slate-400">Dependency on Client</p>
              <p className="mt-1 text-3xl font-bold text-gray-900 dark:text-white">{dependencyCount}</p>
            </div>
            <div className="p-3 rounded-xl bg-amber-500 text-white">
              <ArrowPathIcon className="h-6 w-6" />
            </div>
          </div>
        </Link>

        <Link to="/agent/my-assignments?status=REOPENED" className="card p-6 hover:shadow-card-hover transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-slate-400">Reopened</p>
              <p className="mt-1 text-3xl font-bold text-gray-900 dark:text-white">{reopenedCount}</p>
            </div>
            <div className="p-3 rounded-xl bg-red-500 text-white">
              <ClockIcon className="h-6 w-6" />
            </div>
          </div>
        </Link>

        <Link to="/agent/my-assignments?status=RESOLVED" className="card p-6 hover:shadow-card-hover transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-slate-400">Resolved Today</p>
              <p className="mt-1 text-3xl font-bold text-gray-900 dark:text-white">{resolvedToday}</p>
            </div>
            <div className="p-3 rounded-xl bg-green-500 text-white">
              <CheckCircleIcon className="h-6 w-6" />
            </div>
          </div>
        </Link>
      </div>

      {/* My Assignments & Queue */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* My Assignments */}
        <div className="card">
          <div className="p-6 border-b border-gray-200 dark:border-slate-800 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">My Assignments</h3>
            <Link to="/agent/my-assignments" className="text-sm text-primary-600 hover:text-primary-700">View all</Link>
          </div>
          <div className="divide-y divide-gray-200">
            {tickets.length === 0 ? (
              <div className="p-6 text-center text-gray-500">No assigned tickets</div>
            ) : (
              tickets.slice(0, 10).map((ticket: any) => (
                <Link key={ticket.id} to={`/agent/tickets/${ticket.id}`} className="p-4 hover:bg-gray-50 transition-colors flex items-center gap-4">
                  <div className={cn('p-2 rounded-lg', getStatusColor(ticket.status))}>
                    <TicketIcon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{ticket.ticketNumber}: {ticket.title}</p>
                    <p className="text-xs text-gray-500">{ticket.department?.name} • {formatRelativeTime(ticket.updatedAt)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn('badge', getPriorityColor(ticket.priority))}>{ticket.priority}</span>
                    <span className={cn('badge', getStatusColor(ticket.status))}>{ticket.status.replace('_', ' ')}</span>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Unassigned Queue */}
        <div className="card">
          <div className="p-6 border-b border-gray-200 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Unassigned Queue</h3>
            <Link to="/agent/queue" className="text-sm text-primary-600 hover:text-primary-700">View all</Link>
          </div>
          <div className="divide-y divide-gray-200">
            {queueTickets?.data?.length === 0 ? (
              <div className="p-6 text-center text-gray-500">No unassigned tickets</div>
            ) : (
              queueTickets.data.slice(0, 10).map((ticket: any) => (
                <Link key={ticket.id} to={`/agent/tickets/${ticket.id}`} className="p-4 hover:bg-gray-50 transition-colors flex items-center gap-4">
                  <div className={cn('p-2 rounded-lg', getStatusColor(ticket.status))}>
                    <TicketIcon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{ticket.ticketNumber}: {ticket.title}</p>
                    <p className="text-xs text-gray-500">{ticket.department?.name} • {formatRelativeTime(ticket.createdAt)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn('badge', getPriorityColor(ticket.priority))}>{ticket.priority}</span>
                    <Link
                      to={`/agent/tickets/${ticket.id}`}
                      className="btn-primary btn-sm"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Take
                    </Link>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-3">
            <Link to="/agent/queue" className="btn-secondary text-center py-3">
              <UserGroupIcon className="h-5 w-5 mx-auto mb-1" />
              <span className="text-sm">View Queue</span>
            </Link>
            <Link to="/agent/my-assignments" className="btn-secondary text-center py-3">
              <TicketIcon className="h-5 w-5 mx-auto mb-1" />
              <span className="text-sm">My Tickets</span>
            </Link>
            <Link to="/agent/knowledge" className="btn-secondary text-center py-3">
              <ChartBarIcon className="h-5 w-5 mx-auto mb-1" />
              <span className="text-sm">Knowledge Base</span>
            </Link>
            <Link to="/raiser/create-ticket" className="btn-secondary text-center py-3">
              <ExclamationTriangleIcon className="h-5 w-5 mx-auto mb-1" />
              <span className="text-sm">Create Ticket</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}