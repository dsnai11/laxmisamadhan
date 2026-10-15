import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { PlusIcon, TicketIcon, ClockIcon, CheckCircleIcon, ArrowPathIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import api from '@services/api';
import { formatRelativeTime, getStatusColor, getPriorityColor, cn } from '@utils/helpers';

const statCards = [
  { name: 'My Tickets', key: 'total', icon: TicketIcon, color: 'bg-blue-500' },
  { name: 'Open', key: 'open', icon: ClockIcon, color: 'bg-yellow-500' },
  { name: 'In Progress', key: 'inProgress', icon: ArrowPathIcon, color: 'bg-blue-500' },
  { name: 'Resolved', key: 'resolved', icon: CheckCircleIcon, color: 'bg-green-500' },
];

export default function RaiserDashboard() {
  const { data: tickets, isLoading } = useQuery({
    queryKey: ['myTickets', { page: 1, limit: 5 }],
    queryFn: () => api.getMyTickets({ page: 1, limit: 5, sortBy: 'updatedAt', sortOrder: 'desc' }),
  });

  const stats = tickets?.data || [];

  const getMyStats = () => {
    const total = tickets?.total || 0;
    const open = stats.filter((t: any) => ['OPEN', 'ASSIGNED'].includes(t.status)).length;
    const inProgress = stats.filter((t: any) => t.status === 'IN_PROGRESS').length;
    const resolved = stats.filter((t: any) => ['RESOLVED', 'CLOSED'].includes(t.status)).length;
    return { total, open, inProgress, resolved };
  };

  const myStats = getMyStats();

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
          <h1 className="page-title">My Tickets</h1>
          <p className="page-subtitle">Track and manage your support requests</p>
        </div>
        <Link to="/raiser/create-ticket" className="btn-primary w-full sm:w-auto">
          <PlusIcon className="h-5 w-5 mr-2" />
          Create Ticket
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        {statCards.map((card) => {
          const value = myStats[card.key as keyof typeof myStats] || 0;
          return (
            <Link key={card.name} to="/raiser/my-tickets" className="card p-4 sm:p-6 hover:shadow-card-hover transition-shadow">
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
                <th>Updated</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {stats.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
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
                stats.map((ticket: any) => (
                  <tr key={ticket.id}>
                    <td>
                      <Link to={`/raiser/tickets/${ticket.id}`} className="font-mono text-sm font-medium text-primary-600 hover:text-primary-700">
                        {ticket.ticketNumber}
                      </Link>
                    </td>
                    <td>
                      <Link to={`/raiser/tickets/${ticket.id}`} className="text-sm font-medium text-gray-900 hover:text-primary-600 truncate max-w-xs block">
                        {ticket.title}
                      </Link>
                    </td>
                    <td>
                      <span className="text-sm text-gray-600 capitalize">{ticket.category.replace('_', ' ').toLowerCase()}</span>
                    </td>
                    <td>
                      <span className={cn('badge', getPriorityColor(ticket.priority))}>{ticket.priority}</span>
                    </td>
                    <td>
                      <span className={cn('badge', getStatusColor(ticket.status))}>{ticket.status.replace('_', ' ')}</span>
                    </td>
                    <td className="text-sm text-gray-500">{formatRelativeTime(ticket.updatedAt)}</td>
                    <td>
                      <Link to={`/raiser/tickets/${ticket.id}`} className="text-primary-600 hover:text-primary-700 text-sm font-medium">View</Link>
                    </td>
                  </tr>
                ))
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