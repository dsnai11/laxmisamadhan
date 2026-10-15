import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import api from '@services/api';
import { formatDate, humanize } from '@utils/helpers';
import { EmptyState, ErrorState, PageHeader, PageLoader, Pagination } from '@components/common/ui';

export default function AdminAuditLogs() {
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [action, setAction] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput.trim()); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const params = {
    page,
    limit: 25,
    ...(search && { search }),
    ...(action && { action }),
    ...(dateFrom && { dateFrom: new Date(`${dateFrom}T00:00:00`).toISOString() }),
    ...(dateTo && { dateTo: new Date(`${dateTo}T23:59:59`).toISOString() }),
  };
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['audit-logs', params], queryFn: () => api.getAuditLogs(params), placeholderData: keepPreviousData });
  const logs: any[] = data?.data || [];
  const actions: string[] = data?.actions || [];

  return (
    <div className="space-y-6">
      <PageHeader title="Audit Logs" subtitle="A record of who did what, and when" />

      <div className="card">
        <div className="p-4 border-b border-gray-200 grid grid-cols-1 md:grid-cols-4 gap-3">
          <input className="input" placeholder="Search descriptions" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} aria-label="Search logs" />
          <select className="input" value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }} aria-label="Action">
            <option value="">All actions</option>
            {actions.map((a) => <option key={a} value={a}>{humanize(a)}</option>)}
          </select>
          <input type="date" className="input" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} aria-label="From date" />
          <input type="date" className="input" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} aria-label="To date" />
        </div>

        {isLoading ? <PageLoader /> : error ? <div className="p-4"><ErrorState error={error} onRetry={() => refetch()} /></div> : logs.length === 0 ? (
          <EmptyState title="No activity found" message="Try widening the date range or clearing filters." />
        ) : (
          <>
            <div className="table-container">
              <table className="table">
                <thead><tr><th>When</th><th>User</th><th>Action</th><th>Details</th><th>Ticket</th></tr></thead>
                <tbody>
                  {logs.map((l) => (
                    <tr key={l.id}>
                      <td className="text-sm text-gray-500 whitespace-nowrap">{formatDate(l.createdAt, 'datetime')}</td>
                      <td className="text-sm">{l.user ? `${l.user.firstName} ${l.user.lastName}` : 'System'}</td>
                      <td><span className="badge badge-gray">{humanize(l.action)}</span></td>
                      <td className="text-sm text-gray-700 max-w-md">{l.description}</td>
                      <td className="text-sm">{l.ticket ? <Link className="text-primary-600 hover:underline font-mono" to={`/admin/tickets/${l.ticket.id}`}>{l.ticket.ticketNumber}</Link> : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={data?.page || page} totalPages={data?.totalPages || 1} total={data?.total || 0} onPageChange={setPage} />
          </>
        )}
      </div>
    </div>
  );
}
