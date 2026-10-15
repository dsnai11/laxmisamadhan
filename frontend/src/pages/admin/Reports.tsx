import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import toast from 'react-hot-toast';
import api from '@services/api';
import { useAuth } from '@context/AuthContext';
import { downloadBlob, formatDuration, humanize } from '@utils/helpers';
import { ErrorState, getErrorMessage, PageHeader, PageLoader } from '@components/common/ui';

function Stat({ label, value, tone }: { label: string; value: string | number; tone?: 'danger' }) {
  return (
    <div className="card p-4">
      <p className="text-sm text-gray-500">{label}</p>
      <p className={`text-2xl font-bold ${tone === 'danger' ? 'text-danger-600' : 'text-gray-900'}`}>{value}</p>
    </div>
  );
}

export default function AdminReports() {
  const { user } = useAuth();
  const role = user?.role || '';
  const isAdmin = ['SUPER_ADMIN', 'ADMIN'].includes(role);
  const canExport = ['SUPER_ADMIN', 'ADMIN', 'DEPARTMENT_HEAD'].includes(role);
  const canSeeAgents = ['SUPER_ADMIN', 'ADMIN', 'DEPARTMENT_HEAD', 'TEAM_LEAD'].includes(role);
  const [days, setDays] = useState(30);
  const [exporting, setExporting] = useState(false);

  const { data: dash, isLoading, error, refetch } = useQuery<any>({ queryKey: ['report-dashboard'], queryFn: () => api.getDashboardStats() });
  const { data: trend } = useQuery<any[]>({ queryKey: ['report-trend', days], queryFn: () => api.getTicketTrend({ days }) });
  const { data: sla } = useQuery<any>({ queryKey: ['report-sla'], queryFn: () => api.getSLAReport() });
  const { data: agents } = useQuery<any[]>({ queryKey: ['report-agents'], queryFn: () => api.getAgentPerformance(), enabled: canSeeAgents });
  const { data: depts } = useQuery<any[]>({ queryKey: ['report-departments'], queryFn: () => api.getDepartmentReport(), enabled: isAdmin });

  const exportCsv = async () => {
    setExporting(true);
    try {
      const blob = await api.exportTickets({ format: 'csv' });
      downloadBlob(blob, `tickets-${new Date().toISOString().slice(0, 10)}.csv`);
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setExporting(false);
    }
  };

  if (isLoading) return <PageLoader />;
  if (error || !dash) return <ErrorState error={error || new Error('No data')} onRetry={() => refetch()} />;

  const o = dash.overview || {};
  const byStatus = (dash.charts?.byStatus || []).map((x: any) => ({ name: humanize(x.status), count: x.count }));
  const byPriority = (dash.charts?.byPriority || []).map((x: any) => ({ name: humanize(x.priority), count: x.count }));
  const byCategory = (dash.charts?.byCategory || []).map((x: any) => ({ name: humanize(x.category), count: x.count }));
  const trendData = (trend || []).map((x) => ({ ...x, label: x.date.slice(5) }));
  const summary = sla?.summary;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        subtitle="Volume, workload and service levels"
        actions={canExport ? <button className="btn-secondary" disabled={exporting} onClick={exportCsv}>{exporting ? 'Exporting...' : 'Export tickets (CSV)'}</button> : undefined}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Total tickets" value={o.totalTickets ?? 0} />
        <Stat label="Open" value={o.openTickets ?? 0} />
        <Stat label="In progress" value={o.inProgressTickets ?? 0} />
        <Stat label="Resolved" value={o.resolvedTickets ?? 0} />
        <Stat label="SLA breached" value={o.slaBreached ?? 0} tone={o.slaBreached ? 'danger' : undefined} />
        <Stat label="Avg resolution" value={formatDuration(o.avgResolutionTime)} />
        {summary && <Stat label="SLA compliance" value={`${Math.round(summary.complianceRate ?? 0)}%`} />}
        {summary && <Stat label="Avg first response" value={formatDuration(summary.avgResponseTime)} />}
      </div>

      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900">Tickets over time</h2>
          <select className="input w-auto" value={days} onChange={(e) => setDays(Number(e.target.value))} aria-label="Range">
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="total" name="Created" stroke="#2563eb" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="resolved" name="Resolved" stroke="#16a34a" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {[
          { title: 'By status', data: byStatus, color: '#2563eb' },
          { title: 'By priority', data: byPriority, color: '#f59e0b' },
          { title: 'By category', data: byCategory, color: '#8b5cf6' },
        ].map((chart) => (
          <div key={chart.title} className="card p-5">
            <h2 className="font-semibold text-gray-900 mb-4">{chart.title}</h2>
            {chart.data.length === 0 ? <p className="text-sm text-gray-500">No data yet.</p> : (
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chart.data} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
                    <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="count" name="Tickets" fill={chart.color} radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        ))}
      </div>

      {isAdmin && depts && (
        <div className="card">
          <div className="p-4 border-b border-gray-200"><h2 className="font-semibold text-gray-900">Departments</h2></div>
          <div className="table-container">
            <table className="table">
              <thead><tr><th>Department</th><th>Tickets</th><th>Avg resolution</th><th>SLA compliance</th><th>Assets</th></tr></thead>
              <tbody>
                {depts.map((d) => (
                  <tr key={d.department.id}>
                    <td className="font-medium">{d.department.name}</td>
                    <td>{d.totalTickets}</td>
                    <td>{formatDuration(d.avgResolutionTime)}</td>
                    <td>{Math.round(d.slaCompliance ?? 0)}%</td>
                    <td>{d.totalAssets}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {canSeeAgents && agents && (
        <div className="card">
          <div className="p-4 border-b border-gray-200"><h2 className="font-semibold text-gray-900">Agent performance</h2></div>
          <div className="table-container">
            <table className="table">
              <thead><tr><th>Agent</th><th>Assigned</th><th>Resolved</th><th>Resolution rate</th><th>Avg resolution</th><th>SLA compliance</th></tr></thead>
              <tbody>
                {agents.map((a) => (
                  <tr key={a.agent.id}>
                    <td className="font-medium">{a.agent.firstName} {a.agent.lastName}</td>
                    <td>{a.assigned}</td>
                    <td>{a.resolved}</td>
                    <td>{Math.round(a.resolutionRate ?? 0)}%</td>
                    <td>{formatDuration(a.avgResolutionTime)}</td>
                    <td>{Math.round(a.slaCompliance ?? 0)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
