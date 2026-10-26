import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '@services/api';
import { formatDate, formatRelativeTime, humanize } from '@utils/helpers';
import {
  PageHeader, PageLoader, ErrorState, EmptyState, StatusBadge, PriorityBadge, SLABadge,
  Pagination, STATUS_OPTIONS, PRIORITY_OPTIONS, CATEGORY_OPTIONS, Modal, Field,
} from '@components/common/ui';
import RequesterHoverCard from '@components/tickets/RequesterHoverCard';
import InboundEmailSimulatorModal from '@components/email/InboundEmailSimulatorModal';
import {
  PencilIcon, EnvelopeIcon, PaperClipIcon, BoltIcon, FunnelIcon, AdjustmentsHorizontalIcon,
  UserPlusIcon, ArrowsRightLeftIcon, LinkIcon, CalendarIcon, ChevronDownIcon, LockClosedIcon, ArrowPathIcon,
} from '@heroicons/react/24/outline';

const TAB_FILTERS = [
  { label: 'My Open Requests', value: 'open' },
  { label: 'My Pending Requests', value: 'pending' },
  { label: 'Vendor Support-AMC', value: 'amc' },
  { label: 'Vendor Support-FMS', value: 'fms' },
];

export default function AdminAllTickets() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState('pending');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [category, setCategory] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [sort, setSort] = useState('createdAt:desc');
  const [selected, setSelected] = useState<string[]>([]);
  const [dateFilter, setDateFilter] = useState('30days');
  const [assigneeId, setAssigneeId] = useState('');
  const [syncingEmails, setSyncingEmails] = useState(false);

  const handleSyncEmails = async () => {
    setSyncingEmails(true);
    try {
      const res = await api.syncInboundEmails();
      if (res?.processed > 0) {
        toast.success(`Processed ${res.processed} new email ticket(s)!`);
        qc.invalidateQueries({ queryKey: ['admin-tickets'] });
      } else {
        toast.success('Inbound support inbox is up to date.');
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed to sync inbound emails');
    } finally {
      setSyncingEmails(false);
    }
  };

  const [sortBy, sortOrder] = sort.split(':') as [string, 'asc' | 'desc'];
  const { data: departments } = useQuery({ queryKey: ['departments'], queryFn: () => api.getDepartments() });
  const { data: rawUsers } = useQuery({ queryKey: ['users'], queryFn: () => api.getUsers() });
  const users: any[] = Array.isArray(rawUsers) ? rawUsers : Array.isArray((rawUsers as any)?.data) ? (rawUsers as any).data : Array.isArray((rawUsers as any)?.users) ? (rawUsers as any).users : [];

  const params: any = { page, limit: 20, sortBy, sortOrder };
  if (search) params.search = search;
  if (status) params.status = status;
  if (priority) params.priority = priority;
  if (category) params.category = category;
  if (departmentId) params.departmentId = departmentId;

  // Filter based on activeTab
  if (activeTab === 'open') params.status = 'OPEN';
  if (activeTab === 'pending') params.status = 'DEPENDENCY_ON_CLIENT';

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['admin-tickets', params],
    queryFn: () => api.getTickets(params),
  });

  const tickets = data?.data || [];
  const total = data?.total || 0;
  const totalPages = data?.totalPages || 1;

  const allSelected = tickets.length > 0 && tickets.every((t: any) => selected.includes(t.id));
  const toggleAll = () => setSelected(allSelected ? [] : tickets.map((t: any) => t.id));
  const toggleOne = (id: string) => setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const handlePickUp = async () => {
    if (selected.length === 0) return toast.error('Select at least 1 ticket to Pick Up');
    try {
      await Promise.all(selected.map((id) => api.assignTicket(id, users[0]?.id || '')));
      toast.success(`Picked up ${selected.length} ticket(s)`);
      setSelected([]);
      qc.invalidateQueries({ queryKey: ['admin-tickets'] });
    } catch {
      toast.error('Failed to pick up tickets');
    }
  };

  const handleQuickAssign = async (userId: string) => {
    if (!userId || selected.length === 0) return;
    try {
      await Promise.all(selected.map((id) => api.assignTicket(id, userId)));
      toast.success(`Assigned ${selected.length} ticket(s)`);
      setSelected([]);
      setAssigneeId('');
      qc.invalidateQueries({ queryKey: ['admin-tickets'] });
    } catch {
      toast.error('Assignment failed');
    }
  };

  const [showEmailSimulator, setShowEmailSimulator] = useState(false);
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [primaryTicketId, setPrimaryTicketId] = useState('');
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [parentTicketId, setParentTicketId] = useState('');
  const [showEditModal, setShowEditModal] = useState(false);
  const [bulkEditForm, setBulkEditForm] = useState({
    status: '',
    priority: '',
    departmentId: '',
    assigneeId: '',
    group: '',
  });

  const handleMergeConfirm = async () => {
    if (!primaryTicketId) return toast.error('Please select the Master/Primary Ticket');
    try {
      await api.bulkAction(selected, 'merge', { primaryTicketId });
      toast.success(`Merged ${selected.length - 1} ticket(s) into Master Incident`);
      setShowMergeModal(false);
      setSelected([]);
      setPrimaryTicketId('');
      qc.invalidateQueries({ queryKey: ['admin-tickets'] });
    } catch {
      toast.error('Failed to merge tickets');
    }
  };

  const handleLinkConfirm = async () => {
    if (!parentTicketId) return toast.error('Please select a Parent Incident to link to');
    try {
      await api.bulkAction(selected, 'link', { parentTicketId });
      toast.success(`Linked ${selected.length} ticket(s) to parent incident`);
      setShowLinkModal(false);
      setSelected([]);
      setParentTicketId('');
      qc.invalidateQueries({ queryKey: ['admin-tickets'] });
    } catch {
      toast.error('Failed to link tickets');
    }
  };

  const handleBulkEditConfirm = async () => {
    if (selected.length === 0) return;
    try {
      if (bulkEditForm.status) {
        await api.bulkAction(selected, 'status', { status: bulkEditForm.status });
      }
      if (bulkEditForm.priority) {
        await api.bulkAction(selected, 'priority', { priority: bulkEditForm.priority });
      }
      if (bulkEditForm.departmentId) {
        await api.bulkAction(selected, 'department', { departmentId: bulkEditForm.departmentId });
      }
      if (bulkEditForm.assigneeId) {
        await api.bulkAction(selected, 'assign', { assignedToId: bulkEditForm.assigneeId });
      }
      toast.success(`Updated ${selected.length} ticket(s)`);
      setShowEditModal(false);
      setSelected([]);
      setBulkEditForm({ status: '', priority: '', departmentId: '', assigneeId: '', group: '' });
      qc.invalidateQueries({ queryKey: ['admin-tickets'] });
    } catch {
      toast.error('Bulk edit failed');
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Header & Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-gray-900 tracking-tight">Aavas Support Service Desk</h1>
          <p className="text-xs text-gray-500">Manage, assign, and track IT support tickets</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleSyncEmails}
            disabled={syncingEmails}
            title="Check mail.lifc.in for new incoming support emails"
            className="btn-secondary text-xs py-1.5 px-2.5 sm:px-3 flex items-center gap-1.5"
          >
            <ArrowPathIcon className={`w-3.5 h-3.5 ${syncingEmails ? 'animate-spin text-primary-600' : 'text-emerald-600'}`} />
            <span className="hidden xs:inline">{syncingEmails ? 'Checking...' : 'Sync Emails'}</span>
          </button>
          <button
            onClick={() => setShowEmailSimulator(true)}
            className="btn-secondary text-xs py-1.5 px-2.5 sm:px-3 flex items-center gap-1 bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"
          >
            <EnvelopeIcon className="w-4 h-4 text-blue-600" />
            <span className="hidden xs:inline">Email-to-Ticket</span> Gateway
          </button>
          <Link to="/raiser/create-ticket" className="btn-primary text-xs py-1.5 px-3">
            + New Incident
          </Link>
        </div>
      </div>

      {/* Top Action Tabs Bar (Matching Photo 1 & 3) */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-2 sm:p-3 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 dark:border-slate-800 pb-2">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-thin max-w-full">
            {TAB_FILTERS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => { setActiveTab(tab.value); setPage(1); }}
                className={`whitespace-nowrap px-3 py-1.5 text-xs font-semibold rounded-lg transition-all shrink-0 ${
                  activeTab === tab.value
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 dark:hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
            <span className="text-xs text-gray-500 dark:text-slate-400 font-medium">
              1 - {tickets.length} of {total}
            </span>
            <div className="flex border border-gray-200 dark:border-slate-700 rounded-lg p-0.5 bg-gray-50 dark:bg-slate-800">
              <button
                onClick={() => setDateFilter('30days')}
                className="px-2 py-0.5 text-[11px] font-medium text-gray-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 rounded flex items-center gap-1"
              >
                <CalendarIcon className="w-3 h-3 text-gray-500 dark:text-slate-400" /> Last 30 days
              </button>
            </div>
          </div>
        </div>

        {/* Action Button Bar (Matching Photo 1 & 3) */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <Link to="/raiser/create-ticket" className="btn-secondary btn-xs bg-gray-50 dark:bg-slate-800 text-gray-800 dark:text-slate-200 border-gray-300 dark:border-slate-700">
              New Incident <ChevronDownIcon className="w-3 h-3 ml-1" />
            </Link>

            <button
              onClick={() => {
                if (selected.length === 0) return toast.error('Select at least 1 ticket to Edit');
                if (selected.length === 1) navigate(`/admin/tickets/${selected[0]}`);
                else setShowEditModal(true);
              }}
              className="btn-secondary btn-xs text-gray-700"
            >
              <PencilIcon className="w-3 h-3 mr-1 text-gray-500" /> Edit
            </button>

            <button onClick={handlePickUp} className="btn-secondary btn-xs text-gray-700">
              <UserPlusIcon className="w-3 h-3 mr-1 text-blue-600" /> Pick Up
            </button>

            <button
              onClick={() => {
                if (selected.length < 2) return toast.error('Select 2 or more tickets to Merge');
                setShowMergeModal(true);
              }}
              className="btn-secondary btn-xs text-gray-700"
            >
              <ArrowsRightLeftIcon className="w-3 h-3 mr-1 text-purple-600" /> Merge
            </button>

            <button
              onClick={() => {
                if (selected.length === 0) return toast.error('Select at least 1 ticket to Link');
                setShowLinkModal(true);
              }}
              className="btn-secondary btn-xs text-gray-700"
            >
              <LinkIcon className="w-3 h-3 mr-1 text-emerald-600" /> Link Requests
            </button>

            <select
              className="input input-xs w-28 sm:w-32 font-medium bg-gray-50"
              value={assigneeId}
              onChange={(e) => handleQuickAssign(e.target.value)}
            >
              <option value="">Assign ▾</option>
              {users.map((u: any, idx: number) => (
                <option key={u.id || `user-opt-${idx}`} value={u.id}>
                  {u.firstName} {u.lastName}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <input
              className="input input-xs w-full sm:w-56"
              placeholder="Search Subject, ID, Requester..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
        </div>
      </div>

      {/* Main Table Matching Photo 1 & 3 */}
      <div className="card overflow-hidden border border-gray-200 shadow-sm">
        {isLoading ? (
          <PageLoader />
        ) : error ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : tickets.length === 0 ? (
          <EmptyState title="No tickets found" message="No pending requests found for this filter." />
        ) : (
          <div className="table-container">
            <table className="table text-xs">
              <thead className="bg-blue-50/50 text-gray-700 font-bold border-b border-gray-200">
                <tr>
                  <th className="w-8">
                    <input type="checkbox" checked={allSelected} onChange={toggleAll} />
                  </th>
                  <th className="w-8"></th>
                  <th>Subject ↑</th>
                  <th>ID</th>
                  <th>Requester Name</th>
                  <th>Created Date</th>
                  <th>Department</th>
                  <th>Technician</th>
                  <th>Group</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {tickets.map((t: any) => (
                  <tr key={t.id} className={`hover:bg-blue-50/40 transition-colors ${selected.includes(t.id) ? 'bg-blue-50/70' : ''}`}>
                    <td>
                      <input type="checkbox" checked={selected.includes(t.id)} onChange={() => toggleOne(t.id)} />
                    </td>
                    <td>
                      <div className="flex items-center gap-1 text-gray-400">
                        <PencilIcon className="w-3 h-3 hover:text-blue-600 cursor-pointer" title="Edit" onClick={() => navigate(`/admin/tickets/${t.id}`)} />
                        <EnvelopeIcon className="w-3 h-3 hover:text-purple-600 cursor-pointer" title="Email" />
                        <PaperClipIcon className="w-3 h-3 text-gray-400" title="Attachments" />
                        <BoltIcon className="w-3 h-3 text-amber-500 fill-amber-500" title="Priority" />
                      </div>
                    </td>
                    <td className="font-semibold text-gray-900 max-w-[240px] truncate">
                      <Link to={`/admin/tickets/${t.id}`} className="hover:text-blue-700">
                        {t.title || 'Untitled Ticket'}
                      </Link>
                    </td>
                    <td className="font-mono text-gray-600">{t.ticketNumber || 'INC-0000'}</td>
                    <td className="font-medium text-gray-900 uppercase">
                      <RequesterHoverCard user={t.raisedBy} departmentName={t.department?.name} />
                    </td>
                    <td className="text-gray-600 whitespace-nowrap">
                      {formatDate(t.createdAt, 'datetime')}
                    </td>
                    <td className="font-semibold text-gray-700 uppercase">
                      {t.department?.name || 'CREDIT-1901'}
                    </td>
                    <td>
                      <div className="flex items-center gap-1.5 font-semibold text-gray-900 uppercase">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                        <span>{t.assignedTo ? `${t.assignedTo.firstName || ''} ${t.assignedTo.lastName || ''}`.trim() : 'JAI SINGH RAJAWAT'}</span>
                      </div>
                    </td>
                    <td className="text-gray-600 font-medium">
                      {t.group || 'Vendor Support-FMS'}
                    </td>
                    <td>
                      <div className="flex items-center gap-1">
                        <span className="badge badge-primary text-[10px] bg-blue-50 text-blue-800 border-blue-200">
                          {formatDate ? (t.status || 'OPEN').toString().replace(/_/g, ' ') : ''}
                        </span>
                        <LockClosedIcon className="w-3 h-3 text-gray-400" />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination page={page} totalPages={totalPages} total={total} onPageChange={setPage} />
      </div>

      {/* MERGE TICKETS MODAL */}
      <Modal
        open={showMergeModal}
        onClose={() => setShowMergeModal(false)}
        title="Merge Selected Tickets"
      >
        <div className="space-y-4 text-xs">
          <p className="text-gray-600">
            Select the <strong>Master (Primary) Incident</strong>. All other selected tickets will be closed and merged into this incident.
          </p>

          <div className="space-y-2 max-h-60 overflow-y-auto border border-gray-200 dark:border-slate-800 rounded-lg p-2 bg-gray-50 dark:bg-slate-950">
            {tickets.filter((t: any) => selected.includes(t.id)).map((t: any) => (
              <label key={t.id} className="flex items-start gap-2 p-2 bg-white dark:bg-slate-900 rounded border border-gray-200 dark:border-slate-800 cursor-pointer hover:border-purple-500">
                <input
                  type="radio"
                  name="primaryTicket"
                  checked={primaryTicketId === t.id}
                  onChange={() => setPrimaryTicketId(t.id)}
                  className="mt-0.5"
                />
                <div>
                  <div className="font-bold text-gray-900 dark:text-white">{t.ticketNumber} — {t.title}</div>
                  <div className="text-gray-500 dark:text-slate-400 text-[11px]">Requester: {t.raisedBy?.firstName} {t.raisedBy?.lastName} | Status: {t.status}</div>
                </div>
              </label>
            ))}
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
            <button className="btn-secondary text-xs" onClick={() => setShowMergeModal(false)}>Cancel</button>
            <button className="btn-primary bg-purple-600 hover:bg-purple-700 text-xs" onClick={handleMergeConfirm}>Confirm Merge</button>
          </div>
        </div>
      </Modal>

      {/* LINK REQUESTS MODAL */}
      <Modal
        open={showLinkModal}
        onClose={() => setShowLinkModal(false)}
        title="Link Requests to Parent Incident"
      >
        <div className="space-y-4 text-xs">
          <p className="text-gray-600">
            Select the Parent Incident to link the selected <strong>{selected.length}</strong> request(s) to.
          </p>

          <Field label="Choose Parent Incident">
            <select
              className="input input-sm w-full"
              value={parentTicketId}
              onChange={(e) => setParentTicketId(e.target.value)}
            >
              <option value="">-- Select Parent Incident --</option>
              {tickets.map((t: any, idx: number) => (
                <option key={t.id || `parent-${idx}`} value={t.id}>
                  {t.ticketNumber} — {t.title} ({t.status})
                </option>
              ))}
            </select>
          </Field>

          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
            <button className="btn-secondary text-xs" onClick={() => setShowLinkModal(false)}>Cancel</button>
            <button className="btn-primary bg-emerald-600 hover:bg-emerald-700 text-xs" onClick={handleLinkConfirm}>Confirm Link</button>
          </div>
        </div>
      </Modal>

      {/* BULK EDIT MODAL */}
      <Modal
        open={showEditModal}
        onClose={() => setShowEditModal(false)}
        title={`Bulk Edit ${selected.length} Selected Tickets`}
      >
        <div className="space-y-3 text-xs">
          <Field label="Status">
            <select
              className="input input-sm w-full"
              value={bulkEditForm.status}
              onChange={(e) => setBulkEditForm({ ...bulkEditForm, status: e.target.value })}
            >
              <option value="">-- Leave Unchanged --</option>
              {STATUS_OPTIONS.map((opt) => <option key={opt} value={opt}>{humanize(opt)}</option>)}
            </select>
          </Field>

          <Field label="Priority">
            <select
              className="input input-sm w-full"
              value={bulkEditForm.priority}
              onChange={(e) => setBulkEditForm({ ...bulkEditForm, priority: e.target.value })}
            >
              <option value="">-- Leave Unchanged --</option>
              {PRIORITY_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </Field>

          <Field label="Department">
            <select
              className="input input-sm w-full"
              value={bulkEditForm.departmentId}
              onChange={(e) => setBulkEditForm({ ...bulkEditForm, departmentId: e.target.value })}
            >
              <option value="">-- Leave Unchanged --</option>
              {(departments || []).map((d: any, idx: number) => <option key={d.id || `dept-${idx}`} value={d.id}>{d.name}</option>)}
            </select>
          </Field>

          <Field label="Assign Technician">
            <select
              className="input input-sm w-full"
              value={bulkEditForm.assigneeId}
              onChange={(e) => setBulkEditForm({ ...bulkEditForm, assigneeId: e.target.value })}
            >
              <option value="">-- Leave Unchanged --</option>
              {users.map((u: any, idx: number) => <option key={u.id || `assignee-${idx}`} value={u.id}>{u.firstName} {u.lastName} ({u.email})</option>)}
            </select>
          </Field>

          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
            <button className="btn-secondary text-xs" onClick={() => setShowEditModal(false)}>Cancel</button>
            <button className="btn-primary text-xs" onClick={handleBulkEditConfirm}>Apply Bulk Edits</button>
          </div>
        </div>
      </Modal>

      {/* INBOUND EMAIL-TO-TICKET GATEWAY SIMULATOR MODAL */}
      <InboundEmailSimulatorModal
        open={showEmailSimulator}
        onClose={() => setShowEmailSimulator(false)}
        departments={departments}
      />
    </div>
  );
}

