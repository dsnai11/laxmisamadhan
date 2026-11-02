import { ReactNode, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import api from '@services/api';
import { formatRelativeTime, humanize } from '@utils/helpers';
import KanbanView from './KanbanView';
import {
  CATEGORY_OPTIONS,
  EmptyState,
  ErrorState,
  PageHeader,
  PageLoader,
  Pagination,
  PriorityBadge,
  PRIORITY_OPTIONS,
  SLABadge,
  STATUS_OPTIONS,
  StatusBadge,
} from '@components/common/ui';

interface Props {
  title: string;
  subtitle?: string;
  queryKey: string;
  fetcher: (params: Record<string, any>) => Promise<any>;
  basePath: string;
  showRaiser?: boolean;
  showAssignee?: boolean;
  extraParams?: Record<string, any>;
  actions?: ReactNode;
  renderRowAction?: (ticket: any, refetch: () => void) => ReactNode;
  emptyMessage?: string;
  initialStatus?: string;
}

export default function TicketListPage({
  title,
  subtitle,
  queryKey,
  fetcher,
  basePath,
  showRaiser,
  showAssignee,
  extraParams,
  actions,
  renderRowAction,
  emptyMessage = 'No tickets match your filters.',
  initialStatus = '',
}: Props) {
  const navigate = useNavigate();
  const [urlParams] = useSearchParams();
  const urlStatus = urlParams.get('status') || '';
  const [page, setPage] = useState(1);
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState(STATUS_OPTIONS.includes(urlStatus) ? urlStatus : initialStatus);
  const urlPriority = urlParams.get('priority') || '';
  const urlSla = urlParams.get('slaStatus') || '';
  const [priority, setPriority] = useState(PRIORITY_OPTIONS.includes(urlPriority) ? urlPriority : '');
  const [slaStatus, setSlaStatus] = useState(['WITHIN_SLA', 'APPROACHING_BREACH', 'BREACHED', 'PAUSED'].includes(urlSla) ? urlSla : '');
  const [category, setCategory] = useState('');

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    const s = urlParams.get('status') || initialStatus;
    if (STATUS_OPTIONS.includes(s) || s === '') {
      setStatus(s);
      setPage(1);
    }
  }, [urlParams, initialStatus]);

  const params = {
    page,
    limit: viewMode === 'kanban' ? 50 : 15,
    sortBy: 'updatedAt',
    sortOrder: 'desc',
    ...(search && { search }),
    ...(status && { status }),
    ...(priority && { priority }),
    ...(category && { category }),
    ...(slaStatus && { slaStatus }),
    ...extraParams,
  };

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: [queryKey, params],
    queryFn: () => fetcher(params),
    placeholderData: keepPreviousData,
  });

  const tickets: any[] = data?.data || [];
  const hasFilters = !!(search || status || priority || category || slaStatus);

  const resetFilters = () => {
    setSearchInput('');
    setSearch('');
    setStatus(initialStatus);
    setPriority('');
    setCategory('');
    setSlaStatus('');
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <PageHeader title={title} subtitle={subtitle} />
        
        {/* Zoho Desk Mode & Actions Bar */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="bg-gray-100 dark:bg-slate-800 p-1 rounded-lg flex items-center gap-1 border border-gray-200 dark:border-slate-700">
            <button
              onClick={() => setViewMode('list')}
              className={`px-2.5 sm:px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                viewMode === 'list' ? 'bg-white dark:bg-slate-900 text-primary-700 dark:text-primary-400 shadow-sm' : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              ☰ List View
            </button>
            <button
              onClick={() => setViewMode('kanban')}
              className={`px-2.5 sm:px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                viewMode === 'kanban' ? 'bg-white dark:bg-slate-900 text-primary-700 dark:text-primary-400 shadow-sm' : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              ☷ Kanban Board
            </button>
          </div>
          {actions}
        </div>
      </div>

      <div className="card">
        {/* Search & Filters */}
        <div className="p-4 border-b border-gray-200 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-3">
          <input
            className="input sm:col-span-2"
            placeholder="Search by number, title or description..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            aria-label="Search tickets"
          />
          <select className="input" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} aria-label="Filter by status">
            <option value="">All Statuses</option>
            {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
          </select>
          <select className="input" value={priority} onChange={(e) => { setPriority(e.target.value); setPage(1); }} aria-label="Filter by priority">
            <option value="">All Priorities</option>
            {PRIORITY_OPTIONS.map((p) => <option key={p} value={p}>{humanize(p)}</option>)}
          </select>
          <select className="input" value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }} aria-label="Filter by category">
            <option value="">All Categories</option>
            {CATEGORY_OPTIONS.map((c) => <option key={c} value={c}>{humanize(c)}</option>)}
          </select>
          <select className="input font-medium" value={slaStatus} onChange={(e) => { setSlaStatus(e.target.value); setPage(1); }} aria-label="Filter by SLA status">
            <option value="">All SLAs</option>
            <option value="BREACHED">⚠️ Overdue (Breached)</option>
            <option value="APPROACHING_BREACH">⏳ Approaching Breach</option>
            <option value="WITHIN_SLA">✅ Within SLA</option>
            <option value="PAUSED">⏸️ Paused</option>
          </select>
        </div>

        {slaStatus && (
          <div className="px-4 py-2 border-b border-gray-100 dark:border-slate-800 text-sm flex items-center gap-2">
            <span className="badge badge-primary">SLA: {humanize(slaStatus)}</span>
            <button className="text-xs text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 underline" onClick={() => { setSlaStatus(''); setPage(1); }}>Clear</button>
          </div>
        )}

        {isLoading ? (
          <PageLoader label="Loading tickets..." />
        ) : error ? (
          <div className="p-4"><ErrorState error={error} onRetry={() => refetch()} /></div>
        ) : tickets.length === 0 ? (
          <EmptyState
            title="No tickets found"
            message={hasFilters ? 'Try adjusting or clearing your filters.' : emptyMessage}
            action={hasFilters ? <button className="btn-secondary btn-sm" onClick={resetFilters}>Clear filters</button> : undefined}
          />
        ) : viewMode === 'kanban' ? (
          <div className="p-4">
            <KanbanView tickets={tickets} basePath={basePath} />
          </div>
        ) : (
          <div className={isFetching ? 'opacity-70 transition-opacity' : ''}>
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Ticket</th>
                    <th>Title</th>
                    <th>Priority</th>
                    <th>Status</th>
                    <th>SLA</th>
                    {showRaiser && <th>Raised by</th>}
                    {showAssignee && <th>Assigned to</th>}
                    <th>Updated</th>
                    {renderRowAction && <th />}
                  </tr>
                </thead>
                <tbody>
                  {tickets.map((t) => {
                    const isOverdue =
                      t.slaStatus === 'BREACHED' ||
                      (t.resolutionDueAt &&
                        !t.resolvedAt &&
                        new Date(t.resolutionDueAt).getTime() < Date.now());

                    return (
                    <tr key={t.id} className="cursor-pointer hover:bg-primary-50/30 dark:hover:bg-slate-800/60 transition-colors" onClick={() => navigate(`${basePath}/${t.id}`)}>
                      <td>
                        <Link to={`${basePath}/${t.id}`} onClick={(e) => e.stopPropagation()} className="font-mono text-sm font-semibold text-primary-600 dark:text-primary-400 hover:underline">
                          {t.ticketNumber}
                        </Link>
                      </td>
                      <td className="max-w-xs">
                        <p className="font-medium text-gray-900 dark:text-white truncate">{t.title}</p>
                        <p className="text-xs text-gray-500 dark:text-slate-400 truncate">
                          {t.department?.name} · {humanize(t.category)}
                          {t._count?.comments ? ` · ${t._count.comments} comment${t._count.comments === 1 ? '' : 's'}` : ''}
                        </p>
                      </td>
                      <td><PriorityBadge priority={t.priority} /></td>
                      <td><StatusBadge status={t.status} /></td>
                      <td><SLABadge status={t.slaStatus} isOverdue={isOverdue} /></td>
                      {showRaiser && <td className="text-sm text-gray-700 dark:text-slate-300">{t.raisedBy ? `${t.raisedBy.firstName} ${t.raisedBy.lastName}` : '-'}</td>}
                      {showAssignee && (
                        <td className="text-sm text-gray-700 dark:text-slate-300">
                          {t.assignedTo ? `${t.assignedTo.firstName} ${t.assignedTo.lastName}` : <span className="text-gray-400 dark:text-slate-500 italic">Unassigned</span>}
                        </td>
                      )}
                      <td className="text-sm text-gray-500 dark:text-slate-400 whitespace-nowrap">{formatRelativeTime(t.updatedAt)}</td>
                      {renderRowAction && (
                        <td onClick={(e) => e.stopPropagation()}>{renderRowAction(t, () => refetch())}</td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
              </table>
            </div>
            <Pagination page={data?.page || page} totalPages={data?.totalPages || 1} total={data?.total || 0} onPageChange={setPage} />
          </div>
        )}
      </div>
    </div>
  );
}
