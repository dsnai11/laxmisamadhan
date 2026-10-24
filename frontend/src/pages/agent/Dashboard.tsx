import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import {
  TicketIcon,
  ClockIcon,
  CheckCircleIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  UserGroupIcon,
  ChartBarIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  ArrowRightIcon,
} from '@heroicons/react/24/outline';
import api from '@services/api';
import { formatRelativeTime, getStatusColor, getPriorityColor, cn } from '@utils/helpers';
import { PriorityBadge, StatusBadge } from '@components/common/ui';

export default function AgentDashboard() {
  const navigate = useNavigate();

  // Search state
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
    }, 300);
    return () => clearTimeout(handler);
  }, [searchInput]);

  // Fetch real-time accurate ticket statistics for the current agent
  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ['agentTicketStats'],
    queryFn: () => api.getTicketStats({ assignedToMe: true }),
  });

  // Fetch live search results when searching
  const { data: searchResults, isFetching: searchLoading } = useQuery({
    queryKey: ['agentTicketSearch', debouncedSearch],
    queryFn: () => api.getAssignedTickets({ search: debouncedSearch, limit: 6 }),
    enabled: debouncedSearch.length >= 2,
  });

  // Fetch recent assigned tickets
  const { data: assignedTickets, isLoading: assignedLoading } = useQuery({
    queryKey: ['assignedTickets', { page: 1, limit: 10 }],
    queryFn: () => api.getAssignedTickets({ page: 1, limit: 10, sortBy: 'updatedAt', sortOrder: 'desc' }),
  });

  // Fetch unassigned tickets queue
  const { data: queueTickets, isLoading: queueLoading } = useQuery({
    queryKey: ['queueTickets', { page: 1, limit: 10 }],
    queryFn: () =>
      api.getTickets({
        page: 1,
        limit: 10,
        sortBy: 'createdAt',
        sortOrder: 'asc',
        status: 'OPEN',
      }),
  });

  const isLoading = statsLoading || assignedLoading || queueLoading;
  const tickets = assignedTickets?.data || [];

  // Accurate counts derived from backend database
  const openCount = statsData?.openCount ?? 0;
  const dependencyCount = statsData?.dependencyCount ?? 0;
  const reopenedCount = statsData?.reopenedCount ?? 0;
  const resolvedCount = statsData?.resolvedCount ?? 0;
  const resolvedToday = statsData?.resolvedTodayCount ?? 0;

  const handleSearchSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (searchInput.trim()) {
      navigate(`/agent/my-assignments?search=${encodeURIComponent(searchInput.trim())}`);
    } else {
      navigate('/agent/my-assignments');
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
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
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Agent Dashboard</h1>
          <p className="page-subtitle">Track your performance, assigned tickets, and department queue</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/agent/my-assignments" className="btn-secondary w-full sm:w-auto">
            <TicketIcon className="h-4 w-4 mr-1.5" />
            My Assignments
          </Link>
          <Link to="/agent/queue" className="btn-primary w-full sm:w-auto">
            <ChartBarIcon className="h-4 w-4 mr-1.5" />
            Ticket Queue
          </Link>
        </div>
      </div>

      {/* Quick Ticket Search Bar */}
      <div className="card p-4 sm:p-5 bg-gradient-to-r from-blue-50/60 via-white to-indigo-50/40 dark:from-slate-800 dark:via-slate-800 dark:to-slate-900 border border-blue-200/60 dark:border-slate-700 shadow-2xs">
        <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400 dark:text-slate-500">
              <MagnifyingGlassIcon className="h-5 w-5" />
            </div>
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search tickets by ID (e.g. TKT-26-00039), title, sub-issue, raiser name, or keyword..."
              className="input pl-10 pr-9 w-full text-sm sm:text-base py-2.5 rounded-xl border-gray-300 dark:border-slate-600 focus:ring-2 focus:ring-primary-500 bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => setSearchInput('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            )}
          </div>

          <button
            type="submit"
            className="btn-primary flex items-center justify-center gap-2 py-2.5 px-5 rounded-xl shrink-0 font-medium"
          >
            <span>Search</span>
            <ArrowRightIcon className="h-4 w-4" />
          </button>
        </form>

        {/* Live Search Results Dropdown Preview */}
        {debouncedSearch.length >= 2 && (
          <div className="mt-4 pt-3 border-t border-gray-200 dark:border-slate-700">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-slate-400">
                {searchLoading ? 'Searching tickets...' : `Found ${searchResults?.data?.length ?? 0} Matching Tickets`}
              </span>
              <button
                type="button"
                onClick={() => handleSearchSubmit()}
                className="text-xs text-primary-600 dark:text-primary-400 hover:underline font-semibold flex items-center gap-1"
              >
                <span>View all in My Assignments</span>
                <span>→</span>
              </button>
            </div>

            {searchResults?.data?.length === 0 && !searchLoading ? (
              <div className="text-sm text-gray-500 dark:text-slate-400 py-3 text-center bg-gray-50 dark:bg-slate-800/50 rounded-lg">
                No tickets match &quot;{debouncedSearch}&quot;. Try searching with another keyword or ticket number.
              </div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-slate-800 max-h-72 overflow-y-auto bg-white dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-slate-700">
                {searchResults?.data?.slice(0, 6).map((t: any) => (
                  <Link
                    key={t.id}
                    to={`/agent/tickets/${t.id}`}
                    className="p-3 hover:bg-gray-50 dark:hover:bg-slate-800/80 flex items-center justify-between gap-3 transition-colors group"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-primary-600 dark:text-primary-400 group-hover:underline">
                          {t.ticketNumber}
                        </span>
                        <span className="text-sm text-gray-900 dark:text-white font-medium truncate">
                          {t.title}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-slate-400 truncate mt-0.5">
                        {t.department?.name || 'Department'} • {t.subIssue || t.subCategory || t.category} • Raised by {t.raisedBy ? `${t.raisedBy.firstName} ${t.raisedBy.lastName || ''}`.trim() : 'Unknown'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <PriorityBadge priority={t.priority} />
                      <StatusBadge status={t.status} />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Performance Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        {/* 1. Open Tickets */}
        <Link to="/agent/my-assignments?status=OPEN" className="card p-5 sm:p-6 hover:shadow-card-hover transition-shadow group">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-slate-400">Open Tickets</p>
              <p className="mt-1 text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white">{openCount}</p>
              <span className="text-[11px] text-gray-400 dark:text-slate-500 mt-1 block">Active work in progress</span>
            </div>
            <div className="p-3 rounded-xl bg-blue-500 text-white shadow-xs group-hover:scale-105 transition-transform">
              <TicketIcon className="h-6 w-6" />
            </div>
          </div>
        </Link>

        {/* 2. Dependency on Client */}
        <Link to="/agent/my-assignments?status=DEPENDENCY_ON_CLIENT" className="card p-5 sm:p-6 hover:shadow-card-hover transition-shadow group">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-slate-400">Waiting on Client</p>
              <p className="mt-1 text-2xl sm:text-3xl font-extrabold text-amber-600 dark:text-amber-400">{dependencyCount}</p>
              <span className="text-[11px] text-gray-400 dark:text-slate-500 mt-1 block">Pending user response</span>
            </div>
            <div className="p-3 rounded-xl bg-amber-500 text-white shadow-xs group-hover:scale-105 transition-transform">
              <ArrowPathIcon className="h-6 w-6" />
            </div>
          </div>
        </Link>

        {/* 3. Reopened Tickets */}
        <Link to="/agent/my-assignments?status=REOPENED" className="card p-5 sm:p-6 hover:shadow-card-hover transition-shadow group">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-slate-400">Reopened</p>
              <p className="mt-1 text-2xl sm:text-3xl font-extrabold text-rose-600 dark:text-rose-400">{reopenedCount}</p>
              <span className="text-[11px] text-gray-400 dark:text-slate-500 mt-1 block">Needs attention</span>
            </div>
            <div className="p-3 rounded-xl bg-rose-500 text-white shadow-xs group-hover:scale-105 transition-transform">
              <ClockIcon className="h-6 w-6" />
            </div>
          </div>
        </Link>

        {/* 4. Resolved Tickets - Total Count & Today's Metric */}
        <Link to="/agent/my-assignments?status=RESOLVED" className="card p-5 sm:p-6 hover:shadow-card-hover transition-shadow group">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-slate-400">Resolved Tickets</p>
              <p className="mt-1 text-2xl sm:text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">{resolvedCount}</p>
              <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 mt-1 block">
                {resolvedToday > 0 ? `+${resolvedToday} resolved today` : 'All time resolved'}
              </span>
            </div>
            <div className="p-3 rounded-xl bg-emerald-500 text-white shadow-xs group-hover:scale-105 transition-transform">
              <CheckCircleIcon className="h-6 w-6" />
            </div>
          </div>
        </Link>
      </div>

      {/* My Assignments & Queue Side by Side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* My Assignments */}
        <div className="card">
          <div className="p-5 border-b border-gray-200 dark:border-slate-800 flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">My Active Assignments</h3>
              <p className="text-xs text-gray-500 dark:text-slate-400">Most recently updated tickets assigned to you</p>
            </div>
            <Link to="/agent/my-assignments" className="text-xs font-semibold text-primary-600 dark:text-primary-400 hover:underline">
              View all →
            </Link>
          </div>
          <div className="divide-y divide-gray-200 dark:divide-slate-800">
            {tickets.length === 0 ? (
              <div className="p-6 text-center text-gray-500 dark:text-slate-400 text-sm">No assigned tickets right now.</div>
            ) : (
              tickets.slice(0, 10).map((ticket: any) => (
                <Link
                  key={ticket.id}
                  to={`/agent/tickets/${ticket.id}`}
                  className="p-4 hover:bg-gray-50 dark:hover:bg-slate-800/70 transition-colors flex items-center gap-3 group"
                >
                  <div className={cn('p-2 rounded-lg shrink-0', getStatusColor(ticket.status))}>
                    <TicketIcon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white truncate group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                      {ticket.ticketNumber}: {ticket.title}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5 truncate">
                      {ticket.department?.name} • {ticket.subIssue || ticket.subCategory || ticket.category} • Updated {formatRelativeTime(ticket.updatedAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <PriorityBadge priority={ticket.priority} />
                    <StatusBadge status={ticket.status} />
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Unassigned Department Queue */}
        <div className="card">
          <div className="p-5 border-b border-gray-200 dark:border-slate-800 flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">Unassigned Queue</h3>
              <p className="text-xs text-gray-500 dark:text-slate-400">Open tickets waiting to be claimed in your department</p>
            </div>
            <Link to="/agent/queue" className="text-xs font-semibold text-primary-600 dark:text-primary-400 hover:underline">
              View all →
            </Link>
          </div>
          <div className="divide-y divide-gray-200 dark:divide-slate-800">
            {queueTickets?.data?.length === 0 ? (
              <div className="p-6 text-center text-gray-500 dark:text-slate-400 text-sm">The queue is clear! No unassigned tickets.</div>
            ) : (
              queueTickets?.data?.slice(0, 10).map((ticket: any) => (
                <div
                  key={ticket.id}
                  className="p-4 hover:bg-gray-50 dark:hover:bg-slate-800/70 transition-colors flex items-center justify-between gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <Link
                      to={`/agent/tickets/${ticket.id}`}
                      className="text-sm font-semibold text-gray-900 dark:text-white truncate block hover:text-primary-600 dark:group-hover:text-primary-400"
                    >
                      {ticket.ticketNumber}: {ticket.title}
                    </Link>
                    <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5 truncate">
                      {ticket.department?.name} • Created {formatRelativeTime(ticket.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <PriorityBadge priority={ticket.priority} />
                    <Link to={`/agent/tickets/${ticket.id}`} className="btn-primary btn-sm text-xs">
                      Take
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions Strip */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-slate-400 mb-3">Quick Navigation</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Link to="/agent/queue" className="btn-secondary text-center py-3 flex flex-col items-center justify-center gap-1 rounded-xl">
            <UserGroupIcon className="h-5 w-5 text-primary-600 dark:text-primary-400" />
            <span className="text-xs font-medium">Department Queue</span>
          </Link>
          <Link to="/agent/my-assignments" className="btn-secondary text-center py-3 flex flex-col items-center justify-center gap-1 rounded-xl">
            <TicketIcon className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            <span className="text-xs font-medium">My Assigned Tickets</span>
          </Link>
          <Link to="/agent/my-assignments?status=RESOLVED" className="btn-secondary text-center py-3 flex flex-col items-center justify-center gap-1 rounded-xl">
            <CheckCircleIcon className="h-5 w-5 text-green-600 dark:text-green-400" />
            <span className="text-xs font-medium">My Resolved Tickets ({resolvedCount})</span>
          </Link>
          <Link to="/agent/team-bucket" className="btn-secondary text-center py-3 flex flex-col items-center justify-center gap-1 rounded-xl">
            <ChartBarIcon className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            <span className="text-xs font-medium">Team Bucket</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
