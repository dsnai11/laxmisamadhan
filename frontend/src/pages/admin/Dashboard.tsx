import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { TicketIcon, ClockIcon, CheckCircleIcon, ExclamationTriangleIcon, UsersIcon, BuildingOfficeIcon, ChartBarIcon, Cog6ToothIcon } from '@heroicons/react/24/outline';
import api from '@services/api';
import { formatRelativeTime, getPriorityColor, getStatusColor, cn } from '@utils/helpers';

const formatNumber = (num: number) => {
  return typeof num === 'number' ? num.toLocaleString() : '0';
};

const statCards = [
  { name: 'Total Tickets', key: 'totalTickets', icon: TicketIcon, color: 'bg-blue-500', href: '/admin/tickets' },
  { name: 'Open Tickets', key: 'openTickets', icon: ClockIcon, color: 'bg-yellow-500', href: '/admin/tickets?status=OPEN' },
  { name: 'In Progress', key: 'inProgressTickets', icon: ChartBarIcon, color: 'bg-blue-500', href: '/admin/tickets?status=IN_PROGRESS' },
  { name: 'Resolved', key: 'resolvedTickets', icon: CheckCircleIcon, color: 'bg-green-500', href: '/admin/tickets?status=RESOLVED' },
  { name: 'Critical', key: 'criticalTickets', icon: ExclamationTriangleIcon, color: 'bg-red-500', href: '/admin/tickets?priority=CRITICAL' },
  { name: 'SLA Breached', key: 'slaBreached', icon: ExclamationTriangleIcon, color: 'bg-orange-500', href: '/admin/tickets?slaStatus=BREACHED' },
];

export default function AdminDashboard() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboardStats'],
    queryFn: () => api.getDashboardStats(),
    refetchInterval: 30000,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="card p-6 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div className="h-8 bg-gray-200 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const overview = stats?.overview || {};
  const recentTickets = stats?.recentTickets || [];
  const topAssignees = stats?.topAssignees || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Overview of your IT ticketing system</p>
        </div>
        <Link to="/admin/reports" className="btn-primary w-full sm:w-auto">
          <ChartBarIcon className="h-5 w-5 mr-2" />
          View Reports
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
        {statCards.map((card) => {
          const value = overview[card.key as keyof typeof overview] || 0;
          return (
            <Link key={card.name} to={card.href} className="card p-4 sm:p-6 hover:shadow-card-hover transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm font-medium text-gray-500 dark:text-slate-400 truncate">{card.name}</p>
                  <p className="mt-1 text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">{formatNumber(value)}</p>
                </div>
                <div className={cn('p-2.5 sm:p-3 rounded-xl', card.color, 'text-white shrink-0')}>
                  <card.icon className="h-5 w-5 sm:h-6 sm:w-6" />
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tickets by Status */}
        <div className="card">
          <div className="p-6 border-b border-gray-200 dark:border-slate-800">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Tickets by Status</h3>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {stats?.charts?.byStatus?.map((item: any) => (
                <div key={item.status} className="flex items-center gap-4">
                  <span className={cn('badge w-32', getStatusColor(item.status))}>
                    {item.status.replace('_', ' ')}
                  </span>
                  <div className="flex-1 h-2 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary-600 transition-all duration-500"
                      style={{ width: `${overview.totalTickets > 0 ? (item.count / overview.totalTickets) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium text-gray-900 dark:text-slate-200 w-12 text-right">{formatNumber(item.count)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Tickets by Priority */}
        <div className="card">
          <div className="p-6 border-b border-gray-200 dark:border-slate-800">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Tickets by Priority</h3>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {stats?.charts?.byPriority?.map((item: any) => (
                <div key={item.priority} className="flex items-center gap-4">
                  <span className={cn('badge w-32', getPriorityColor(item.priority))}>
                    {item.priority}
                  </span>
                  <div className="flex-1 h-2 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary-600 transition-all duration-500"
                      style={{ width: `${overview.totalTickets > 0 ? (item.count / overview.totalTickets) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium text-gray-900 dark:text-slate-200 w-12 text-right">{formatNumber(item.count)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Recent Tickets & Top Assignees */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <div className="p-6 border-b border-gray-200 dark:border-slate-800 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Recent Tickets</h3>
            <Link to="/admin/tickets" className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700">View all</Link>
          </div>
          <div className="divide-y divide-gray-200 dark:divide-slate-800">
            {recentTickets.length === 0 ? (
              <div className="p-6 text-center text-gray-500 dark:text-slate-400">No recent tickets</div>
            ) : (
              recentTickets.map((ticket: any) => (
                <Link key={ticket.id} to={`/admin/tickets/${ticket.id}`} className="p-4 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors flex items-center gap-4">
                  <div className={cn('p-2 rounded-lg', getStatusColor(ticket.status))}>
                    <TicketIcon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{ticket.ticketNumber}: {ticket.title}</p>
                    <p className="text-xs text-gray-500 dark:text-slate-400">{formatRelativeTime(ticket.createdAt)}</p>
                  </div>
                  <span className={cn('badge', getPriorityColor(ticket.priority))}>{ticket.priority}</span>
                </Link>
              ))
            )}
          </div>
        </div>

        <div className="card">
          <div className="p-6 border-b border-gray-200 dark:border-slate-800 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Top Assignees</h3>
            <Link to="/admin/users" className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700">View all</Link>
          </div>
          <div className="divide-y divide-gray-200 dark:divide-slate-800">
            {topAssignees.length === 0 ? (
              <div className="p-6 text-center text-gray-500 dark:text-slate-400">No assignees yet</div>
            ) : (
              topAssignees.map((item: any) => (
                <div key={item.user?.id} className="p-4 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-950/60 flex items-center justify-center">
                    <span className="text-sm font-medium text-primary-700 dark:text-primary-300">
                      {item.user?.firstName?.[0]}{item.user?.lastName?.[0]}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{item.user?.firstName} {item.user?.lastName}</p>
                    <p className="text-xs text-gray-500 dark:text-slate-400">{item.count} assigned ticket{item.count === 1 ? '' : 's'}</p>
                  </div>
                  <span className="text-sm font-medium text-primary-600 dark:text-primary-400">{item.count}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}