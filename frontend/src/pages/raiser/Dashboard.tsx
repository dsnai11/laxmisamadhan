import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { PlusIcon, TicketIcon, ClockIcon, CheckCircleIcon, ArrowPathIcon, MagnifyingGlassIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import api from '@services/api';
import { formatRelativeTime, getStatusColor, getPriorityColor, cn } from '@utils/helpers';
import { SLABadge } from '@components/common/ui';

const statCards = [
  { name: 'Total Tickets', key: 'total', icon: TicketIcon, color: 'bg-blue-500', href: '/raiser/my-tickets' },
  { name: 'Open', key: 'open', icon: ClockIcon, color: 'bg-yellow-500', href: '/raiser/my-tickets?status=OPEN' },
  { name: 'Overdue', key: 'overdue', icon: ExclamationTriangleIcon, color: 'bg-red-500', href: '/raiser/my-tickets?slaStatus=BREACHED' },
  { name: 'Waiting on Me', key: 'dependency', icon: ArrowPathIcon, color: 'bg-amber-500', href: '/raiser/my-tickets?status=DEPENDENCY_ON_CLIENT' },
  { name: 'Resolved', key: 'resolved', icon: CheckCircleIcon, color: 'bg-green-500', href: '/raiser/my-tickets?status=RESOLVED' },
];

export default function RaiserDashboard() {
  const { data: tickets, isLoading } = useQuery({
    queryKey: ['myTickets', { page: 1, limit: 5 }],
    queryFn: () => api.getMyTickets({ page: 1, limit: 5, sortBy: 'updatedAt', sortOrder: 'desc' }),
  });

  const { data: statsData } = useQuery({
    queryKey: ['ticketStats'],
    queryFn: () => api.getTicketStats(),
  });

  const { data: overdueData } = useQuery({
    queryKey: ['myOverdueTicketsCount'],
    queryFn: () => api.getMyTickets({ slaStatus: 'BREACHED', limit: 1 }),
  });

  const recentTickets = tickets?.data || [];

  const myStats = useMemo(() => {
    const statusMap: Record<string, number> = {};
    statsData?.byStatus?.forEach((s: any) => { statusMap[s.status] = s.count; });

    const total = statsData?.totalTickets ?? tickets?.total ?? 0;
    const open = (statusMap['OPEN'] || 0) + (statusMap['REOPENED'] || 0) + (statusMap['IN_PROGRESS'] || 0);
    const dependency = statusMap['DEPENDENCY_ON_CLIENT'] || 0;
    const resolved = (statusMap['RESOLVED'] || 0) + (statusMap['CLOSED'] || 0);
    const overdue = overdueData?.total ?? 0;

    return { total, open, overdue, dependency, resolved };
  }, [statsData, tickets?.total, overdueData?.total]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="card p-6 animate-pulse">
              <div className="h-4 bg-gray-200 dark:bg-slate-700 rounded w-3/4 mb-2"></div>
              <div className="h-8 bg-gray-200 dark:bg-slate-700 rounded w-1/2"></div>
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
          <h1 className="page-title">My Tickets</h1>
          <p className="page-subtitle">Track and manage your support requests</p>
        </div>
        <Link to="/raiser/create-ticket" className="btn-primary w-full sm:w-auto">
          <PlusIcon className="h-5 w-5 mr-2" />
          Create Ticket
        </Link>
      </div>

      {/* Overdue Alert Banner for Raiser */}
      {myStats.overdue > 0 && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/60 text-red-600 dark:text-red-400 shrink-0">
              <ExclamationTriangleIcon className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-semibold text-red-900 dark:text-red-200">
                You have {myStats.overdue} overdue ticket{myStats.overdue > 1 ? 's' : ''} past resolution SLA!
              </p>
              <p className="text-xs text-red-700 dark:text-red-400">
                These tickets have exceeded their promised resolution time and require priority follow-up.
              </p>
            </div>
          </div>
          <Link
            to="/raiser/my-tickets?slaStatus=BREACHED"
            className="btn-sm bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg px-3 py-1.5 shrink-0 transition-colors self-end sm:self-center"
          >
            View Overdue Tickets →
          </Link>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        {statCards.map((card) => {
          const value = myStats[card.key as keyof typeof myStats] || 0;
          return (
            <Link key={card.name} to={card.href} className="card p-4 sm:p-5 hover:shadow-card-hover transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm font-medium text-gray-500 dark:text-slate-400 truncate">{card.name}</p>
                  <p className="mt-1 text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">{value}</p>
                </div>
                <div className={cn('p-2.5 sm:p-3 rounded-xl', card.color, 'text-white shrink-0')}>
                  <card.icon className="h-5 w-5 sm:h-6 sm:w-6" />
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Recent Tickets */}
      <div className="card">
        <div className="p-6 border-b border-gray-200 dark:border-slate-800 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Recent Tickets</h3>
          <div className="flex items-center gap-2">
            <Link to="/raiser/my-tickets" className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700">View all</Link>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Ticket</th>
                <th>Title</th>
                <th>Category</th>
                <th>Priority</th>
                <th>Status</th>
                <th>SLA Status</th>
                <th>Updated</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {recentTickets.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center gap-4 text-gray-500">
                      <TicketIcon className="h-12 w-12" />
                      <p>No tickets yet</p>
                      <Link to="/raiser/create-ticket" className="btn-primary">
                        <PlusIcon className="h-5 w-5 mr-2" />
                        Create your first ticket
                      </Link>
                    </div>
                  </td>
                </tr>
              ) : (
                recentTickets.map((ticket: any) => {
                  const isOverdue =
                    ticket.slaStatus === 'BREACHED' ||
                    (ticket.resolutionDueAt &&
                      !ticket.resolvedAt &&
                      new Date(ticket.resolutionDueAt).getTime() < Date.now());

                  return (
                    <tr key={ticket.id}>
                      <td>
                        <Link to={`/raiser/tickets/${ticket.id}`} className="font-mono text-sm font-medium text-primary-600 hover:text-primary-700">
                          {ticket.ticketNumber}
                        </Link>
                      </td>
                      <td>
                        <Link to={`/raiser/tickets/${ticket.id}`} className="text-sm font-medium text-gray-900 dark:text-white hover:text-primary-600 truncate max-w-xs block">
                          {ticket.title}
                        </Link>
                      </td>
                      <td>
                        <span className="text-sm text-gray-600 dark:text-slate-400 capitalize">{ticket.category.replace(/_/g, ' ').toLowerCase()}</span>
                      </td>
                      <td>
                        <span className={cn('badge', getPriorityColor(ticket.priority))}>{ticket.priority}</span>
                      </td>
                      <td>
                        <span className={cn('badge', getStatusColor(ticket.status))}>{ticket.status.replace(/_/g, ' ')}</span>
                      </td>
                      <td>
                        <SLABadge status={ticket.slaStatus} isOverdue={isOverdue} />
                      </td>
                      <td className="text-sm text-gray-500 dark:text-slate-400">{formatRelativeTime(ticket.updatedAt)}</td>
                      <td>
                        <Link to={`/raiser/tickets/${ticket.id}`} className="text-primary-600 hover:text-primary-700 text-sm font-medium">View</Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link to="/raiser/create-ticket" className="card p-6 text-center hover:shadow-card-hover transition-shadow">
          <div className="p-3 rounded-xl bg-primary-100 text-primary-600 mx-auto w-16 h-16 flex items-center justify-center mb-4">
            <PlusIcon className="h-8 w-8" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900">Create New Ticket</h3>
          <p className="mt-1 text-sm text-gray-500">Report an issue or request a service</p>
        </Link>

        <Link to="/raiser/my-tickets" className="card p-6 text-center hover:shadow-card-hover transition-shadow">
          <div className="p-3 rounded-xl bg-green-100 text-green-600 mx-auto w-16 h-16 flex items-center justify-center mb-4">
            <TicketIcon className="h-8 w-8" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900">View All Tickets</h3>
          <p className="mt-1 text-sm text-gray-500">Track status and history of your requests</p>
        </Link>

        <Link to="/raiser/knowledge" className="card p-6 text-center hover:shadow-card-hover transition-shadow">
          <div className="p-3 rounded-xl bg-purple-100 text-purple-600 mx-auto w-16 h-16 flex items-center justify-center mb-4">
            <MagnifyingGlassIcon className="h-8 w-8" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900">Browse Knowledge Base</h3>
          <p className="mt-1 text-sm text-gray-500">Find answers to common questions</p>
        </Link>
      </div>
    </div>
  );
}