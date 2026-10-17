import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  ArrowTrendingUpIcon,
  ExclamationTriangleIcon,
  ArrowDownTrayIcon,
  MagnifyingGlassIcon,
  ArrowPathIcon,
  EyeIcon,
  XMarkIcon,
  BuildingOfficeIcon,
  ShieldCheckIcon,
  StarIcon,
  UserGroupIcon,
  BoltIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import api from '@services/api';
import { useAuth } from '@context/AuthContext';
import { formatDuration, getInitials, cn, downloadBlob } from '@utils/helpers';
import { PageLoader, ErrorState, getErrorMessage } from '@components/common/ui';

type DateFilterPreset = 'today' | '7d' | '30d' | '90d' | 'this_month' | 'all';
type TierFilter = 'ALL' | 'TOP_PERFORMER' | 'GOOD' | 'NEEDS_ATTENTION' | 'CRITICAL';
type SortField = 'slaComplianceRate' | 'resolvedCount' | 'assignedCount' | 'avgResolutionTimeMins';

interface RecentTicket {
  id: string;
  ticketNumber: string;
  title: string;
  priority: string;
  status: string;
  slaStatus: string;
  isBreached: boolean;
  createdAt: string;
  resolutionDueAt?: string;
  responseDueAt?: string;
  respondedAt?: string;
  resolvedAt?: string;
  durationMins: number | null;
  slaPolicyName: string;
  raisedBy: string;
  departmentName: string;
}

interface AgentPerformance {
  id: string;
  name: string;
  email: string;
  employeeId: string;
  jobTitle: string;
  role: string;
  avatar?: string | null;
  department: { id: string; name: string; color: string } | null;
  assignedCount: number;
  resolvedCount: number;
  openCount: number;
  resolutionRate: number;
  slaMetCount: number;
  slaBreachedCount: number;
  openBreachedCount: number;
  slaComplianceRate: number;
  avgResolutionTimeMins: number;
  avgResponseTimeMins: number;
  csatAverage: number | null;
  tier: 'TOP_PERFORMER' | 'GOOD' | 'NEEDS_ATTENTION' | 'CRITICAL';
  recentTickets: RecentTicket[];
}

interface DepartmentBreakdown {
  id: string;
  name: string;
  color: string;
  headName: string;
  agentCount: number;
  totalTickets: number;
  resolvedCount: number;
  openCount: number;
  slaMetCount: number;
  slaBreachedCount: number;
  slaComplianceRate: number;
  avgResolutionTimeMins: number;
}

interface SLAPolicyBreakdown {
  id: string;
  name: string;
  priority: string;
  targetResolutionMins: number;
  targetResponseMins: number;
  totalTickets: number;
  resolvedCount: number;
  slaMetCount: number;
  slaBreachedCount: number;
  slaComplianceRate: number;
  avgResolutionTimeMins: number;
}

interface DashboardKPIs {
  totalTickets: number;
  totalAssigned: number;
  totalResolved: number;
  totalOpen: number;
  overallResolutionRate: number;
  slaMetCount: number;
  slaBreachedCount: number;
  slaComplianceRate: number;
  avgResolutionTimeMins: number;
  avgResponseTimeMins: number;
  csatAverage: number | null;
  totalAgents: number;
  topPerformersCount: number;
  needsAttentionCount: number;
}

export default function ManagementDashboard() {
  const { user } = useAuth();
  const [datePreset, setDatePreset] = useState<DateFilterPreset>('30d');
  const [departmentId, setDepartmentId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedTier, setSelectedTier] = useState<TierFilter>('ALL');
  const [sortField, setSortField] = useState<SortField>('slaComplianceRate');
  const [sortAsc, setSortAsc] = useState<boolean>(false);
  const [selectedAgent, setSelectedAgent] = useState<AgentPerformance | null>(null);
  const [exporting, setExporting] = useState<boolean>(false);

  // Compute date range based on preset
  const dateRange = useMemo(() => {
    const now = new Date();
    if (datePreset === 'all') return { dateFrom: undefined, dateTo: undefined };

    let dateFrom: Date;
    if (datePreset === 'today') {
      dateFrom = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    } else if (datePreset === '7d') {
      dateFrom = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (datePreset === '30d') {
      dateFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    } else if (datePreset === '90d') {
      dateFrom = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    } else if (datePreset === 'this_month') {
      dateFrom = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
    } else {
      dateFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    return {
      dateFrom: dateFrom.toISOString(),
      dateTo: now.toISOString(),
    };
  }, [datePreset]);

  // Query Dashboard Data
  const {
    data: dashboardData,
    isLoading,
    isRefetching,
    error,
    refetch,
  } = useQuery({
    queryKey: ['management-dashboard', datePreset, departmentId],
    queryFn: () =>
      api.getManagementDashboard({
        dateFrom: dateRange.dateFrom,
        dateTo: dateRange.dateTo,
        departmentId: departmentId || undefined,
      }),
  });

  // Query Departments for filter dropdown
  const { data: deptList } = useQuery<any[]>({
    queryKey: ['departments-list'],
    queryFn: () => api.getDepartments(),
  });

  const kpis: DashboardKPIs = dashboardData?.kpis || {
    totalTickets: 0,
    totalAssigned: 0,
    totalResolved: 0,
    totalOpen: 0,
    overallResolutionRate: 0,
    slaMetCount: 0,
    slaBreachedCount: 0,
    slaComplianceRate: 100,
    avgResolutionTimeMins: 0,
    avgResponseTimeMins: 0,
    csatAverage: null,
    totalAgents: 0,
    topPerformersCount: 0,
    needsAttentionCount: 0,
  };

  const agents: AgentPerformance[] = dashboardData?.agents || [];
  const departments: DepartmentBreakdown[] = dashboardData?.departments || [];
  const slaPolicies: SLAPolicyBreakdown[] = dashboardData?.slaPolicies || [];

  // Filter & sort agents in memory
  const processedAgents = useMemo(() => {
    let list = [...agents];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.email.toLowerCase().includes(q) ||
          a.employeeId.toLowerCase().includes(q) ||
          (a.department?.name && a.department.name.toLowerCase().includes(q))
      );
    }

    if (selectedTier !== 'ALL') {
      list = list.filter((a) => a.tier === selectedTier);
    }

    list.sort((a, b) => {
      const valA = a[sortField] ?? 0;
      const valB = b[sortField] ?? 0;
      if (sortAsc) {
        return valA > valB ? 1 : -1;
      }
      return valA < valB ? 1 : -1;
    });

    return list;
  }, [agents, searchQuery, selectedTier, sortField, sortAsc]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const handleExportCSV = () => {
    setExporting(true);
    try {
      const cell = (val: unknown): string => {
        let text = String(val ?? '');
        if (/^[=+@\t\r-]/.test(text)) text = `'${text}`;
        return `"${text.replace(/"/g, '""')}"`;
      };

      const headers = [
        'Employee ID',
        'Agent Name',
        'Email',
        'Department',
        'Designation / Role',
        'Assigned Tickets',
        'Resolved Tickets',
        'Open / In-Progress',
        'Resolution Rate %',
        'SLA Met (Within SLA)',
        'SLA Breached',
        'Open Breached',
        'SLA Compliance Rate %',
        'Avg Resolution Time (Minutes)',
        'Avg Response Time (Minutes)',
        'CSAT Score',
        'Performance Tier',
      ];

      const rows = processedAgents.map((a) => [
        a.employeeId,
        a.name,
        a.email,
        a.department?.name || 'General',
        a.jobTitle,
        a.assignedCount,
        a.resolvedCount,
        a.openCount,
        `${a.resolutionRate}%`,
        a.slaMetCount,
        a.slaBreachedCount,
        a.openBreachedCount,
        `${a.slaComplianceRate}%`,
        a.avgResolutionTimeMins,
        a.avgResponseTimeMins,
        a.csatAverage != null ? a.csatAverage : 'N/A',
        a.tier,
      ]);

      const csvContent = [headers.map(cell).join(','), ...rows.map((r) => r.map(cell).join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const filename = `Executive-Agent-SLA-Performance-${new Date().toISOString().slice(0, 10)}.csv`;
      downloadBlob(blob, filename);
      toast.success('Agent SLA Performance report downloaded');
    } catch (err) {
      toast.error('Failed to export CSV: ' + getErrorMessage(err));
    } finally {
      setExporting(false);
    }
  };

  if (isLoading) return <PageLoader />;
  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Executive Header */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-6 sm:p-8 shadow-xl border border-indigo-900/50">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                <ShieldCheckIcon className="w-4 h-4" />
                Executive Leadership View
              </span>
              <span className="text-xs text-indigo-300 font-mono">MD & Board Direct Access</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
              Management Dashboard
            </h1>
            <p className="text-indigo-200/80 text-sm max-w-2xl">
              Real-time monitoring of agent ticket resolution performance, SLA compliance metrics, and operational velocity across all departments.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => refetch()}
              disabled={isRefetching}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs sm:text-sm font-medium border border-white/10 transition-all active:scale-95 disabled:opacity-50"
              title="Refresh data"
            >
              <ArrowPathIcon className={cn('w-4 h-4', isRefetching && 'animate-spin')} />
              <span>{isRefetching ? 'Refreshing...' : 'Refresh'}</span>
            </button>

            <button
              onClick={handleExportCSV}
              disabled={exporting || processedAgents.length === 0}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs sm:text-sm font-semibold shadow-lg shadow-indigo-600/30 transition-all active:scale-95 disabled:opacity-50"
            >
              <ArrowDownTrayIcon className="w-4 h-4" />
              <span>{exporting ? 'Exporting...' : 'Export SLA Report (CSV)'}</span>
            </button>
          </div>
        </div>

        {/* Filters Strip */}
        <div className="mt-6 pt-6 border-t border-indigo-900/60 flex flex-wrap items-center justify-between gap-4">
          {/* Preset Buttons */}
          <div className="flex flex-wrap items-center gap-1.5 bg-black/30 p-1 rounded-xl border border-white/10">
            {(
              [
                { id: 'today', label: 'Today' },
                { id: '7d', label: 'Last 7 Days' },
                { id: '30d', label: 'Last 30 Days' },
                { id: 'this_month', label: 'This Month' },
                { id: '90d', label: 'Last 90 Days' },
                { id: 'all', label: 'All Time' },
              ] as const
            ).map((p) => (
              <button
                key={p.id}
                onClick={() => setDatePreset(p.id)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                  datePreset === p.id
                    ? 'bg-indigo-600 text-white shadow-sm font-semibold'
                    : 'text-indigo-200 hover:text-white hover:bg-white/5'
                )}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Department Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-indigo-300 font-medium">Department:</span>
            <select
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              className="bg-slate-900/90 text-white text-xs sm:text-sm rounded-xl px-3 py-1.5 border border-indigo-800/80 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            >
              <option value="">All Resolving Departments</option>
              {deptList?.map((d: any) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Top Executive KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        {/* Card 1: SLA Compliance */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-gray-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
              Overall SLA Compliance
            </span>
            <div
              className={cn(
                'w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs',
                kpis.slaComplianceRate >= 90
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400'
                  : kpis.slaComplianceRate >= 80
                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400'
                  : 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400'
              )}
            >
              <BoltIcon className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-gray-900 dark:text-white">
              {kpis.slaComplianceRate}%
            </span>
            <span className="text-xs font-medium text-gray-500 dark:text-slate-400">Target: ≥95%</span>
          </div>
          {/* Progress Bar */}
          <div className="mt-3 w-full bg-gray-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full transition-all duration-500',
                kpis.slaComplianceRate >= 90
                  ? 'bg-emerald-500'
                  : kpis.slaComplianceRate >= 80
                  ? 'bg-amber-500'
                  : 'bg-rose-500'
              )}
              style={{ width: `${Math.min(100, Math.max(0, kpis.slaComplianceRate))}%` }}
            />
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-gray-500 dark:text-slate-400">
            <span className="text-emerald-600 dark:text-emerald-400 font-medium">
              {kpis.slaMetCount} within SLA
            </span>
            <span className="text-rose-600 dark:text-rose-400 font-medium">
              {kpis.slaBreachedCount} breached
            </span>
          </div>
        </div>

        {/* Card 2: Tickets Handled */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-gray-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
              Tickets Resolved
            </span>
            <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400 flex items-center justify-center font-bold text-xs">
              <CheckCircleIcon className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-gray-900 dark:text-white">{kpis.totalResolved}</span>
            <span className="text-xs font-medium text-gray-500 dark:text-slate-400">
              of {kpis.totalTickets} total
            </span>
          </div>
          <div className="mt-3 w-full bg-gray-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 transition-all duration-500"
              style={{ width: `${Math.min(100, Math.max(0, kpis.overallResolutionRate))}%` }}
            />
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-gray-500 dark:text-slate-400">
            <span>Resolution Rate: <strong className="text-gray-900 dark:text-white">{kpis.overallResolutionRate}%</strong></span>
            <span>{kpis.totalOpen} Pending</span>
          </div>
        </div>

        {/* Card 3: MTTR (Mean Time to Resolution) */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-gray-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
              Avg Resolution Time (MTTR)
            </span>
            <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-400 flex items-center justify-center font-bold text-xs">
              <ClockIcon className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-gray-900 dark:text-white">
              {formatDuration(kpis.avgResolutionTimeMins)}
            </span>
          </div>
          <div className="mt-3 text-xs text-gray-500 dark:text-slate-400 flex items-center gap-1.5">
            <ArrowTrendingUpIcon className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>Avg 1st response: <strong>{formatDuration(kpis.avgResponseTimeMins)}</strong></span>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-gray-500 dark:text-slate-400">
            <span>Total Agents Active</span>
            <strong className="text-gray-900 dark:text-white">{kpis.totalAgents}</strong>
          </div>
        </div>

        {/* Card 4: Top vs Critical Agents */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-gray-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
              Agent Performance Health
            </span>
            <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-400 flex items-center justify-center font-bold text-xs">
              <UserGroupIcon className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">
              {kpis.topPerformersCount}
            </span>
            <span className="text-xs text-gray-500 dark:text-slate-400">Top Performers (≥90%)</span>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-xs font-semibold bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400">
              {kpis.needsAttentionCount} Needs Attention (&lt;80%)
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-gray-500 dark:text-slate-400">
            <span>Customer CSAT</span>
            <span className="flex items-center gap-1 font-semibold text-amber-500">
              <StarIcon className="w-3.5 h-3.5 fill-amber-400" />
              {kpis.csatAverage ? `${kpis.csatAverage} / 5.0` : 'Not Rated'}
            </span>
          </div>
        </div>
      </div>

      {/* Department SLA Comparison Cards */}
      {departments.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-gray-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <BuildingOfficeIcon className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                Department SLA Compliance Breakdown
              </h2>
              <p className="text-xs text-gray-500 dark:text-slate-400">
                Compare resolution efficiency and SLA adherence across resolving units
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {departments.map((dept) => (
              <div
                key={dept.id}
                className="p-4 rounded-xl border border-gray-100 dark:border-slate-800/80 bg-gray-50/70 dark:bg-slate-800/40 space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white text-sm">{dept.name}</h3>
                    <p className="text-xs text-gray-500 dark:text-slate-400">Head: {dept.headName}</p>
                  </div>
                  <span
                    className={cn(
                      'px-2 py-0.5 rounded-full text-xs font-bold',
                      dept.slaComplianceRate >= 90
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                        : dept.slaComplianceRate >= 80
                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                        : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                    )}
                  >
                    {dept.slaComplianceRate}% SLA
                  </span>
                </div>

                <div className="w-full bg-gray-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      'h-full',
                      dept.slaComplianceRate >= 90
                        ? 'bg-emerald-500'
                        : dept.slaComplianceRate >= 80
                        ? 'bg-amber-500'
                        : 'bg-rose-500'
                    )}
                    style={{ width: `${Math.min(100, Math.max(0, dept.slaComplianceRate))}%` }}
                  />
                </div>

                <div className="grid grid-cols-3 gap-2 text-center text-xs pt-1 border-t border-gray-200/60 dark:border-slate-700/60">
                  <div>
                    <p className="text-gray-400 text-[10px] uppercase">Resolved</p>
                    <p className="font-bold text-gray-900 dark:text-white">
                      {dept.resolvedCount} / {dept.totalTickets}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-[10px] uppercase">Breached</p>
                    <p
                      className={cn(
                        'font-bold',
                        dept.slaBreachedCount > 0 ? 'text-rose-600' : 'text-gray-900 dark:text-white'
                      )}
                    >
                      {dept.slaBreachedCount}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-[10px] uppercase">MTTR</p>
                    <p className="font-bold text-gray-900 dark:text-white">
                      {formatDuration(dept.avgResolutionTimeMins)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Agent Performance Matrix Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm overflow-hidden">
        {/* Table Header & Controls */}
        <div className="p-5 border-b border-gray-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <UserGroupIcon className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              Agent Resolution & SLA Matrix
            </h2>
            <p className="text-xs text-gray-500 dark:text-slate-400">
              Showing {processedAgents.length} agents • Click on any row to drill down into ticket-by-ticket SLA logs
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Search Input */}
            <div className="relative min-w-[240px]">
              <MagnifyingGlassIcon className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search agent, emp ID, email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs sm:text-sm bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none text-gray-900 dark:text-white"
              />
            </div>

            {/* Performance Tier Filter */}
            <div className="flex items-center gap-1 bg-gray-100 dark:bg-slate-800 p-1 rounded-xl">
              {(
                [
                  { id: 'ALL', label: 'All' },
                  { id: 'TOP_PERFORMER', label: 'Top (≥90%)' },
                  { id: 'GOOD', label: 'Good (80-89%)' },
                  { id: 'NEEDS_ATTENTION', label: 'Attention (<80%)' },
                ] as const
              ).map((t) => (
                <button
                  key={t.id}
                  onClick={() => setSelectedTier(t.id)}
                  className={cn(
                    'px-2.5 py-1 rounded-lg text-xs font-medium transition-all',
                    selectedTier === t.id
                      ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm font-semibold'
                      : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="bg-gray-50/80 dark:bg-slate-800/60 border-b border-gray-200 dark:border-slate-800 text-gray-600 dark:text-slate-300 font-semibold uppercase text-[11px] tracking-wider">
                <th className="py-3 px-4">Agent Name & ID</th>
                <th className="py-3 px-4">Department</th>
                <th
                  className="py-3 px-4 cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400"
                  onClick={() => handleSort('assignedCount')}
                >
                  Assigned / Resolved {sortField === 'assignedCount' && (sortAsc ? '▲' : '▼')}
                </th>
                <th className="py-3 px-4">Open Backlog</th>
                <th className="py-3 px-4">SLA Met</th>
                <th className="py-3 px-4">SLA Breached</th>
                <th
                  className="py-3 px-4 cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400"
                  onClick={() => handleSort('slaComplianceRate')}
                >
                  SLA Compliance {sortField === 'slaComplianceRate' && (sortAsc ? '▲' : '▼')}
                </th>
                <th
                  className="py-3 px-4 cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400"
                  onClick={() => handleSort('avgResolutionTimeMins')}
                >
                  Avg MTTR {sortField === 'avgResolutionTimeMins' && (sortAsc ? '▲' : '▼')}
                </th>
                <th className="py-3 px-4">Performance Tier</th>
                <th className="py-3 px-4 text-right">Drill-Down</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-800/80 text-gray-700 dark:text-slate-300">
              {processedAgents.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-gray-400">
                    No agents matched the selected filters.
                  </td>
                </tr>
              ) : (
                processedAgents.map((agent) => (
                  <tr
                    key={agent.id}
                    onClick={() => setSelectedAgent(agent)}
                    className="hover:bg-indigo-50/40 dark:hover:bg-slate-800/50 cursor-pointer transition-colors"
                  >
                    {/* Agent Name */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 flex items-center justify-center font-bold text-xs shrink-0">
                          {getInitials(agent.name.split(' ')[0], agent.name.split(' ')[1] || '')}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-900 dark:text-white truncate">{agent.name}</p>
                          <p className="text-[11px] text-gray-400 font-mono">
                            ID: {agent.employeeId} • {agent.jobTitle}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Department */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300">
                        {agent.department?.name || 'General'}
                      </span>
                    </td>

                    {/* Assigned vs Resolved */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-gray-900 dark:text-white">{agent.resolvedCount}</span>
                          <span className="text-gray-400 text-xs">/ {agent.assignedCount}</span>
                          <span className="text-xs text-gray-500 font-medium">({agent.resolutionRate}%)</span>
                        </div>
                        <div className="w-24 bg-gray-100 dark:bg-slate-800 h-1 rounded-full overflow-hidden">
                          <div
                            className="bg-indigo-500 h-full"
                            style={{ width: `${Math.min(100, Math.max(0, agent.resolutionRate))}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    {/* Open Backlog */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold">{agent.openCount}</span>
                        {agent.openBreachedCount > 0 && (
                          <span
                            className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400"
                            title={`${agent.openBreachedCount} tickets overdue`}
                          >
                            {agent.openBreachedCount} Overdue
                          </span>
                        )}
                      </div>
                    </td>

                    {/* SLA Met */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <CheckCircleIcon className="w-4 h-4" />
                        {agent.slaMetCount}
                      </span>
                    </td>

                    {/* SLA Breached */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className={cn(
                          'font-semibold flex items-center gap-1',
                          agent.slaBreachedCount > 0
                            ? 'text-rose-600 dark:text-rose-400 font-bold'
                            : 'text-gray-400'
                        )}
                      >
                        {agent.slaBreachedCount > 0 && <XCircleIcon className="w-4 h-4" />}
                        {agent.slaBreachedCount}
                      </span>
                    </td>

                    {/* SLA Compliance % */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            'px-2.5 py-0.5 rounded-full text-xs font-bold inline-block',
                            agent.slaComplianceRate >= 90
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300'
                              : agent.slaComplianceRate >= 80
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300'
                              : 'bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300'
                          )}
                        >
                          {agent.slaComplianceRate}%
                        </span>
                      </div>
                    </td>

                    {/* MTTR */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="font-mono text-xs">{formatDuration(agent.avgResolutionTimeMins)}</span>
                    </td>

                    {/* Performance Tier */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      {agent.tier === 'TOP_PERFORMER' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                          ★ Top Performer
                        </span>
                      )}
                      {agent.tier === 'GOOD' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                          ✔ On Track
                        </span>
                      )}
                      {agent.tier === 'NEEDS_ATTENTION' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                          ⚠ Needs Attention
                        </span>
                      )}
                      {agent.tier === 'CRITICAL' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                          ✖ Critical Risk
                        </span>
                      )}
                    </td>

                    {/* Action */}
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedAgent(agent);
                        }}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                        title="View ticket SLA breakdown"
                      >
                        <EyeIcon className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* SLA Policy Breakdown Overview */}
      {slaPolicies.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-gray-200 dark:border-slate-800 shadow-sm">
          <div className="mb-4">
            <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <ClockIcon className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              SLA Policy Performance Overview
            </h2>
            <p className="text-xs text-gray-500 dark:text-slate-400">
              Audit SLA policy targets against actual operational resolution performance
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="bg-gray-50/80 dark:bg-slate-800/60 border-b border-gray-200 dark:border-slate-800 text-gray-500 uppercase text-[11px] font-semibold">
                  <th className="py-2.5 px-4">Policy Name</th>
                  <th className="py-2.5 px-4">Priority</th>
                  <th className="py-2.5 px-4">Target Resolution</th>
                  <th className="py-2.5 px-4">Actual MTTR</th>
                  <th className="py-2.5 px-4">Resolved</th>
                  <th className="py-2.5 px-4">Compliance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                {slaPolicies.map((pol) => (
                  <tr key={pol.id}>
                    <td className="py-2.5 px-4 font-semibold text-gray-900 dark:text-white">{pol.name}</td>
                    <td className="py-2.5 px-4">
                      <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-gray-100 dark:bg-slate-800">
                        {pol.priority}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 font-mono">{formatDuration(pol.targetResolutionMins)}</td>
                    <td className="py-2.5 px-4 font-mono">{formatDuration(pol.avgResolutionTimeMins)}</td>
                    <td className="py-2.5 px-4">
                      {pol.resolvedCount} / {pol.totalTickets}
                    </td>
                    <td className="py-2.5 px-4">
                      <span
                        className={cn(
                          'px-2 py-0.5 rounded-full text-xs font-bold',
                          pol.slaComplianceRate >= 90
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : pol.slaComplianceRate >= 80
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-rose-600 dark:text-rose-400'
                        )}
                      >
                        {pol.slaComplianceRate}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Agent Drill-Down Modal */}
      {selectedAgent && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-gray-200 dark:border-slate-800 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-6 border-b border-gray-200 dark:border-slate-800 flex items-start justify-between bg-gradient-to-r from-gray-50 to-indigo-50/30 dark:from-slate-800/50 dark:to-slate-900">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-bold text-base shadow-md">
                  {getInitials(selectedAgent.name.split(' ')[0], selectedAgent.name.split(' ')[1] || '')}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white">{selectedAgent.name}</h2>
                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-slate-300">
                      ID: {selectedAgent.employeeId}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-slate-400">
                    {selectedAgent.email} • {selectedAgent.jobTitle} • {selectedAgent.department?.name || 'General'}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedAgent(null)}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Stats Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-gray-50 dark:bg-slate-800/40 border-b border-gray-200 dark:border-slate-800 text-center">
              <div className="p-2 bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-800">
                <p className="text-[10px] text-gray-400 uppercase font-semibold">SLA Compliance</p>
                <p
                  className={cn(
                    'text-xl font-black',
                    selectedAgent.slaComplianceRate >= 90
                      ? 'text-emerald-600'
                      : selectedAgent.slaComplianceRate >= 80
                      ? 'text-amber-600'
                      : 'text-rose-600'
                  )}
                >
                  {selectedAgent.slaComplianceRate}%
                </p>
              </div>
              <div className="p-2 bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-800">
                <p className="text-[10px] text-gray-400 uppercase font-semibold">Resolved / Assigned</p>
                <p className="text-xl font-black text-gray-900 dark:text-white">
                  {selectedAgent.resolvedCount} <span className="text-xs text-gray-400 font-normal">/ {selectedAgent.assignedCount}</span>
                </p>
              </div>
              <div className="p-2 bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-800">
                <p className="text-[10px] text-gray-400 uppercase font-semibold">Avg MTTR</p>
                <p className="text-xl font-black text-gray-900 dark:text-white">
                  {formatDuration(selectedAgent.avgResolutionTimeMins)}
                </p>
              </div>
              <div className="p-2 bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-800">
                <p className="text-[10px] text-gray-400 uppercase font-semibold">SLA Breaches</p>
                <p className={cn('text-xl font-black', selectedAgent.slaBreachedCount > 0 ? 'text-rose-600' : 'text-emerald-600')}>
                  {selectedAgent.slaBreachedCount}
                </p>
              </div>
            </div>

            {/* Recent Ticket Resolution History List */}
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                  Ticket SLA Audit Log (Recent {selectedAgent.recentTickets.length} Tickets)
                </h3>
                <span className="text-xs text-gray-500">Green = Resolved within SLA • Red = Breached</span>
              </div>

              {selectedAgent.recentTickets.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-xs">
                  No tickets assigned or resolved in this period.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {selectedAgent.recentTickets.map((t) => (
                    <div
                      key={t.id}
                      className={cn(
                        'p-3.5 rounded-xl border text-xs transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3',
                        t.isBreached
                          ? 'border-rose-200 bg-rose-50/40 dark:border-rose-950 dark:bg-rose-950/20'
                          : 'border-emerald-200 bg-emerald-50/40 dark:border-emerald-950 dark:bg-emerald-950/20'
                      )}
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Link
                            to={`/admin/tickets/${t.id}`}
                            className="font-mono font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                            target="_blank"
                          >
                            {t.ticketNumber}
                          </Link>
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300">
                            {t.priority}
                          </span>
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300">
                            {t.status}
                          </span>
                        </div>
                        <p className="font-semibold text-gray-900 dark:text-white text-sm truncate">{t.title}</p>
                        <p className="text-gray-500 text-[11px]">
                          Raised by: {t.raisedBy} • SLA Policy: {t.slaPolicyName}
                        </p>
                      </div>

                      <div className="flex sm:flex-col items-center sm:items-end justify-between gap-1 shrink-0 text-right">
                        <span
                          className={cn(
                            'px-2.5 py-1 rounded-full font-bold text-xs flex items-center gap-1',
                            t.isBreached
                              ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                              : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          )}
                        >
                          {t.isBreached ? (
                            <>
                              <XCircleIcon className="w-4 h-4 text-rose-600" /> SLA Breached
                            </>
                          ) : (
                            <>
                              <CheckCircleIcon className="w-4 h-4 text-emerald-600" /> Met SLA
                            </>
                          )}
                        </span>
                        <span className="text-gray-500 text-[11px] font-mono">
                          {t.durationMins != null ? `Duration: ${formatDuration(t.durationMins)}` : 'In Progress'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-gray-50 dark:bg-slate-800/60 border-t border-gray-200 dark:border-slate-800 flex justify-end">
              <button
                onClick={() => setSelectedAgent(null)}
                className="px-4 py-2 rounded-xl bg-gray-200 dark:bg-slate-700 text-gray-800 dark:text-slate-200 text-xs sm:text-sm font-semibold hover:bg-gray-300 dark:hover:bg-slate-600 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
