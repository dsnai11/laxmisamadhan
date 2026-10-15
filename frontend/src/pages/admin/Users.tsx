import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '@services/api';
import { useAuth } from '@context/AuthContext';
import { formatRelativeTime, humanize } from '@utils/helpers';
import {
  assignableRoles,
  Avatar,
  ConfirmModal,
  EmptyState,
  ErrorState,
  Field,
  getErrorMessage,
  Modal,
  PageHeader,
  PageLoader,
  Pagination,
  ROLE_OPTIONS,
  USER_STATUS_OPTIONS,
} from '@components/common/ui';

const statusBadge: Record<string, string> = {
  ACTIVE: 'badge-success',
  INACTIVE: 'badge-gray',
  SUSPENDED: 'badge-danger',
  PENDING_VERIFICATION: 'badge-warning',
};

const emptyForm = { firstName: '', lastName: '', email: '', phone: '', employeeId: '', role: 'RAISER', roles: ['RAISER'], departmentId: '', temporaryPassword: '' };

interface BulkUserRow {
  id: string;
  employeeId?: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: string;
  departmentId: string;
  temporaryPassword?: string;
}

export default function AdminUsers() {
  const { user: me } = useAuth();
  const qc = useQueryClient();
  const isOrgWide = ['SUPER_ADMIN', 'ADMIN'].includes(me?.role || '');
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [bulkSaving, setBulkSaving] = useState(false);

  // Delete user state
  const [deletingUser, setDeletingUser] = useState<any | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Bulk modal state & ID generator
  const [bulkRows, setBulkRows] = useState<BulkUserRow[]>([]);
  const [bulkDefaultRole, setBulkDefaultRole] = useState('RAISER');
  const [bulkDefaultDept, setBulkDefaultDept] = useState('');
  const [idPrefix, setIdPrefix] = useState('LIFC-');
  const [idStartNum, setIdStartNum] = useState(1001);
  const [showIdGen, setShowIdGen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput.trim()); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const { data: departments } = useQuery({ queryKey: ['departments'], queryFn: () => api.getDepartments() });
  const params = { page, limit: 15, ...(search && { search }), ...(role && { role }), ...(status && { status }), ...(departmentId && { departmentId }) };
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['admin-users', params],
    queryFn: () => api.getUsers(params),
    placeholderData: keepPreviousData,
  });
  const users: any[] = data?.data || [];
  const myRoles = Array.from(new Set([
    ...(me?.role ? [me.role] : []),
    ...((me as any)?.roles || []),
  ]));
  const isSuperAdmin = myRoles.includes('SUPER_ADMIN');
  const roles = isSuperAdmin ? ROLE_OPTIONS : assignableRoles(me?.role);

  const openCreate = () => {
    const initialRole = roles.includes('RAISER') ? 'RAISER' : roles[0] || 'RAISER';
    setForm({
      ...emptyForm,
      role: initialRole,
      roles: [initialRole],
      departmentId: isOrgWide ? '' : me?.departmentId || '',
    });
    setCreateOpen(true);
  };

  const openBulk = () => {
    const defRole = roles.includes('RAISER') ? 'RAISER' : roles[0] || 'RAISER';
    const defDept = isOrgWide ? '' : me?.departmentId || '';
    setBulkDefaultRole(defRole);
    setBulkDefaultDept(defDept);
    setBulkRows([
      { id: '1', employeeId: `${idPrefix}${idStartNum}`, firstName: '', lastName: '', email: '', phone: '', role: defRole, departmentId: defDept, temporaryPassword: 'LaxmiUser@123' },
      { id: '2', employeeId: `${idPrefix}${idStartNum + 1}`, firstName: '', lastName: '', email: '', phone: '', role: defRole, departmentId: defDept, temporaryPassword: 'LaxmiUser@123' },
    ]);
    setBulkOpen(true);
  };

  const create = async () => {
    if (!form.firstName.trim() || !form.lastName.trim() || !form.email.trim()) return toast.error('Name and email are required');
    if (form.temporaryPassword.length < 8) return toast.error('The temporary password must be at least 8 characters');
    if (!form.roles || form.roles.length === 0) return toast.error('User must have at least one assigned role');
    setSaving(true);
    try {
      await api.createUser({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        ...(form.employeeId.trim() && { employeeId: form.employeeId.trim() }),
        ...(form.phone.trim() && { phone: form.phone.trim() }),
        role: (form.roles[0] || form.role) as any,
        roles: form.roles as any,
        ...(form.departmentId && { departmentId: form.departmentId }),
        temporaryPassword: form.temporaryPassword,
        sendWelcomeEmail: false,
      } as any);
      toast.success('User created successfully');
      setCreateOpen(false);
      qc.invalidateQueries({ queryKey: ['admin-users'] });
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!deletingUser) return;
    setDeleting(true);
    try {
      await api.deleteUser(deletingUser.id);
      toast.success(`User ${deletingUser.firstName} ${deletingUser.lastName} deleted`);
      setDeletingUser(null);
      qc.invalidateQueries({ queryKey: ['admin-users'] });
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setDeleting(false);
    }
  };

  // Bulk handlers
  const addBulkRow = () => {
    const nextIdx = bulkRows.length;
    const nextId = `${idPrefix}${idStartNum + nextIdx}`;
    setBulkRows((prev) => [
      ...prev,
      {
        id: Math.random().toString(36).substring(2, 9),
        employeeId: nextId,
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        role: bulkDefaultRole,
        departmentId: bulkDefaultDept,
        temporaryPassword: 'LaxmiUser@123',
      },
    ]);
  };

  const autoGenerateUserIds = () => {
    const start = parseInt(String(idStartNum), 10) || 1001;
    const prefix = idPrefix.trim();
    setBulkRows((prev) =>
      prev.map((row, idx) => ({
        ...row,
        employeeId: `${prefix}${start + idx}`,
      }))
    );
    toast.success(`Generated ${bulkRows.length} user IDs (${prefix}${start} to ${prefix}${start + bulkRows.length - 1})`);
    setShowIdGen(false);
  };

  const updateBulkRow = (id: string, field: keyof BulkUserRow, val: string) => {
    setBulkRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: val } : r)));
  };

  const removeBulkRow = (id: string) => {
    setBulkRows((prev) => prev.filter((r) => r.id !== id));
  };

  const applyDeptToAll = (deptId: string) => {
    setBulkDefaultDept(deptId);
    setBulkRows((prev) => prev.map((r) => ({ ...r, departmentId: deptId })));
  };

  const applyRoleToAll = (r: string) => {
    setBulkDefaultRole(r);
    setBulkRows((prev) => prev.map((row) => ({ ...row, role: r })));
  };

  const downloadCSVTemplate = () => {
    const csvHeader = 'employeeId,firstName,lastName,email,phone,role,departmentId,temporaryPassword\n';
    const sampleRows = `LIFC-1001,Rahul,Sharma,rahul.sharma@laxmi.com,9876543210,RAISER,,LaxmiUser@123\nLIFC-1002,Priya,Verma,priya.verma@laxmi.com,9876543211,AGENT,,LaxmiUser@123\n`;
    const blob = new Blob([csvHeader + sampleRows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'laxmi_bulk_users_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) return;

      const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
      if (lines.length < 2) {
        toast.error('CSV file is empty or missing headers');
        return;
      }

      const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
      const idIdx = headers.indexOf('employeeid') !== -1 ? headers.indexOf('employeeid') : headers.indexOf('id');
      const fnIdx = headers.indexOf('firstname');
      const lnIdx = headers.indexOf('lastname');
      const emailIdx = headers.indexOf('email');
      const phoneIdx = headers.indexOf('phone');
      const roleIdx = headers.indexOf('role');
      const deptIdx = headers.indexOf('departmentid');
      const passIdx = headers.indexOf('temporarypassword');

      if (fnIdx === -1 || lnIdx === -1 || emailIdx === -1) {
        toast.error('CSV must contain columns: firstName, lastName, email');
        return;
      }

      const parsedRows: BulkUserRow[] = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',').map((c) => c.trim());
        if (cols.length < 3 || !cols[emailIdx]) continue;

        parsedRows.push({
          id: Math.random().toString(36).substring(2, 9),
          employeeId: idIdx !== -1 && cols[idIdx] ? cols[idIdx] : `${idPrefix}${idStartNum + i - 1}`,
          firstName: cols[fnIdx] || '',
          lastName: cols[lnIdx] || '',
          email: cols[emailIdx] || '',
          phone: phoneIdx !== -1 ? cols[phoneIdx] : '',
          role: roleIdx !== -1 && cols[roleIdx] ? cols[roleIdx].toUpperCase() : bulkDefaultRole,
          departmentId: deptIdx !== -1 && cols[deptIdx] ? cols[deptIdx] : bulkDefaultDept,
          temporaryPassword: passIdx !== -1 && cols[passIdx] ? cols[passIdx] : 'LaxmiUser@123',
        });
      }

      if (parsedRows.length === 0) {
        toast.error('No valid user data found in CSV');
        return;
      }

      setBulkRows(parsedRows);
      toast.success(`Loaded ${parsedRows.length} users from CSV with User IDs`);
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const executeBulkCreate = async () => {
    const validUsers = bulkRows.filter((r) => r.firstName.trim() && r.lastName.trim() && r.email.trim());
    if (validUsers.length === 0) {
      return toast.error('Please enter at least one valid user with first name, last name, and email');
    }

    setBulkSaving(true);
    try {
      const payload = validUsers.map((r) => ({
        firstName: r.firstName.trim(),
        lastName: r.lastName.trim(),
        email: r.email.trim(),
        ...(r.employeeId?.trim() && { employeeId: r.employeeId.trim() }),
        ...(r.phone.trim() && { phone: r.phone.trim() }),
        role: r.role,
        ...(r.departmentId && { departmentId: r.departmentId }),
        temporaryPassword: r.temporaryPassword || 'LaxmiUser@123',
        sendWelcomeEmail: false,
      }));

      const res = await api.bulkCreateUsers(payload);
      if (res.success > 0) {
        toast.success(`Successfully created ${res.success} user(s)!`);
      }
      if (res.failed > 0) {
        toast.error(`${res.failed} user(s) failed. Check details in logs/toast.`);
      }

      setBulkOpen(false);
      qc.invalidateQueries({ queryKey: ['admin-users'] });
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setBulkSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users"
        subtitle={isOrgWide ? 'Manage accounts, roles and access' : 'Manage people in your department'}
        actions={
          <div className="flex gap-2">
            <button className="btn-secondary" onClick={openBulk}>
              <span className="flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Bulk Import Users
              </span>
            </button>
            <button className="btn-primary" onClick={openCreate}>Add user</button>
          </div>
        }
      />

      <div className="card">
        <div className="p-4 border-b border-gray-200 grid grid-cols-1 md:grid-cols-4 gap-3">
          <input className="input" placeholder="Search name or email" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} aria-label="Search users" />
          <select className="input" value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }} aria-label="Filter by role">
            <option value="">All roles</option>
            {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{humanize(r)}</option>)}
          </select>
          <select className="input" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} aria-label="Filter by status">
            <option value="">All statuses</option>
            {USER_STATUS_OPTIONS.map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
          </select>
          {isOrgWide && (
            <select className="input" value={departmentId} onChange={(e) => { setDepartmentId(e.target.value); setPage(1); }} aria-label="Filter by department">
              <option value="">All departments</option>
              {(departments || []).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          )}
        </div>

        {isLoading ? <PageLoader /> : error ? <div className="p-4"><ErrorState error={error} onRetry={() => refetch()} /></div> : users.length === 0 ? (
          <EmptyState title="No users found" message="Try changing your filters." />
        ) : (
          <>
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Role</th>
                    <th>Department</th>
                    <th>Status</th>
                    <th>Last login</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-gray-50/80 transition-colors">
                      <td>
                        <Link to={`/admin/users/${u.id}`} className="flex items-center gap-3 hover:text-primary-700">
                          <Avatar firstName={u.firstName} lastName={u.lastName} />
                          <span>
                            <span className="flex items-center gap-2 font-medium text-gray-900">
                              {u.firstName} {u.lastName}
                              {u.employeeId && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-blue-50 text-blue-700 border border-blue-200" title="User / Employee ID">
                                  {u.employeeId}
                                </span>
                              )}
                            </span>
                            <span className="block text-xs text-gray-500">{u.email}</span>
                          </span>
                        </Link>
                      </td>
                      <td className="text-sm">
                        <div className="flex flex-wrap gap-1">
                          {(u.roles && u.roles.length > 0 ? u.roles : [u.role]).map((r: string) => (
                            <span
                              key={r}
                              className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800"
                            >
                              {humanize(r)}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="text-sm text-gray-600">{u.department?.name || '-'}</td>
                      <td><span className={`badge ${statusBadge[u.status] || 'badge-gray'}`}>{humanize(u.status)}</span></td>
                      <td className="text-sm text-gray-500">{u.lastLoginAt ? formatRelativeTime(u.lastLoginAt) : 'Never'}</td>
                      <td className="text-right whitespace-nowrap">
                        {u.id !== me?.id ? (
                          <button
                            type="button"
                            onClick={() => setDeletingUser(u)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-red-600 hover:text-red-800 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-all shadow-xs"
                            title={`Delete ${u.firstName} ${u.lastName}`}
                          >
                            <svg className="w-3.5 h-3.5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            Delete
                          </button>
                        ) : (
                          <span className="text-xs text-gray-400 italic">Current User</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={data?.page || page} totalPages={data?.totalPages || 1} total={data?.total || 0} onPageChange={setPage} />
          </>
        )}
      </div>

      {/* Single User Modal */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Add user"
        wide
        footer={
          <>
            <button className="btn-secondary" onClick={() => setCreateOpen(false)}>Cancel</button>
            <button className="btn-primary" disabled={saving} onClick={create}>{saving ? 'Creating...' : 'Create user'}</button>
          </>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="First name"><input className="input" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} /></Field>
          <Field label="Last name"><input className="input" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} /></Field>
          <Field label="Email"><input type="email" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          <Field label="Employee / User ID (optional)">
            <input className="input" placeholder="e.g. LIFC-1001" value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })} />
          </Field>
          <div className="md:col-span-2">
            <Field label="Assign Roles" hint="Select one or more roles for this user.">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-1">
                {roles.map((r) => {
                  const checked = (form.roles || []).includes(r);
                  return (
                    <label
                      key={r}
                      className={`flex items-center gap-2 p-2 rounded-lg border text-sm font-medium cursor-pointer transition-all ${
                        checked
                          ? 'bg-primary-50/90 border-primary-400 text-primary-900 shadow-xs dark:bg-primary-950/40 dark:border-primary-600'
                          : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          const current = form.roles || [];
                          if (e.target.checked) {
                            setForm({ ...form, roles: [...current, r] });
                          } else {
                            if (current.length <= 1) {
                              toast.error('User must have at least one assigned role');
                              return;
                            }
                            setForm({ ...form, roles: current.filter((x) => x !== r) });
                          }
                        }}
                        className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                      <span>{humanize(r)}</span>
                    </label>
                  );
                })}
              </div>
            </Field>
          </div>
          <Field label="Department">
            <select className="input" value={form.departmentId} disabled={!isOrgWide} onChange={(e) => setForm({ ...form, departmentId: e.target.value })}>
              <option value="">None</option>
              {(departments || []).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </Field>
          <div className="md:col-span-2">
            <Field label="Temporary password" hint="At least 8 characters. Share it with the user securely; they can change it after signing in.">
              <input type="text" className="input" autoComplete="off" value={form.temporaryPassword} onChange={(e) => setForm({ ...form, temporaryPassword: e.target.value })} />
            </Field>
          </div>
        </div>
      </Modal>

      {/* Bulk User Modal */}
      <Modal
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        title="Bulk User Creation & ID Management"
        wide
        footer={
          <>
            <button className="btn-secondary" onClick={() => setBulkOpen(false)}>Cancel</button>
            <button className="btn-primary" disabled={bulkSaving} onClick={executeBulkCreate}>
              {bulkSaving ? 'Importing Users...' : `Import ${bulkRows.filter(r => r.firstName && r.lastName && r.email).length} Users`}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {/* Header toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex items-center gap-2">
              <button type="button" className="btn-secondary text-xs" onClick={downloadCSVTemplate}>
                📥 Download CSV Template
              </button>
              <input
                type="file"
                ref={fileInputRef}
                accept=".csv"
                className="hidden"
                onChange={handleFileUpload}
              />
              <button
                type="button"
                className="btn-secondary text-xs"
                onClick={() => fileInputRef.current?.click()}
              >
                📤 Upload CSV
              </button>
              <div className="relative">
                <button
                  type="button"
                  className="btn-secondary text-xs flex items-center gap-1 font-semibold text-primary-700 bg-primary-50 border-primary-200 hover:bg-primary-100"
                  onClick={() => setShowIdGen(!showIdGen)}
                >
                  ⚡ Auto-Generate IDs
                </button>
                {showIdGen && (
                  <div className="absolute left-0 top-full mt-1.5 z-30 bg-white dark:bg-slate-900 p-3 rounded-xl shadow-2xl border border-gray-200 dark:border-slate-800 w-64 space-y-2.5 animate-fadeIn">
                    <p className="text-xs font-bold text-gray-900 dark:text-white">Auto-Generate User IDs</p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <label className="text-[10px] text-gray-500 font-medium block mb-0.5">Prefix</label>
                        <input
                          className="input text-xs py-1 px-2 font-mono"
                          value={idPrefix}
                          onChange={(e) => setIdPrefix(e.target.value)}
                          placeholder="LIFC-"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-500 font-medium block mb-0.5">Start No.</label>
                        <input
                          type="number"
                          className="input text-xs py-1 px-2 font-mono"
                          value={idStartNum}
                          onChange={(e) => setIdStartNum(parseInt(e.target.value, 10) || 1)}
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-1.5 pt-1">
                      <button type="button" className="btn-secondary text-[11px] py-1 px-2" onClick={() => setShowIdGen(false)}>Cancel</button>
                      <button type="button" className="btn-primary text-[11px] py-1 px-2" onClick={autoGenerateUserIds}>Apply IDs</button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-xs text-gray-600">
                <span>Set All Dept:</span>
                <select
                  className="input text-xs py-1 px-2"
                  value={bulkDefaultDept}
                  disabled={!isOrgWide}
                  onChange={(e) => applyDeptToAll(e.target.value)}
                >
                  <option value="">None</option>
                  {(departments || []).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>

              <div className="flex items-center gap-1.5 text-xs text-gray-600">
                <span>Set All Role:</span>
                <select
                  className="input text-xs py-1 px-2"
                  value={bulkDefaultRole}
                  onChange={(e) => applyRoleToAll(e.target.value)}
                >
                  {roles.map((r) => <option key={r} value={r}>{humanize(r)}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* User Rows Table */}
          <div className="max-h-[380px] overflow-y-auto overflow-x-auto border border-gray-200 rounded-lg scrollbar-thin">
            <table className="w-full text-xs text-left text-gray-700 min-w-[780px]">
              <thead className="bg-gray-100 text-gray-600 font-semibold uppercase sticky top-0 z-10 border-b border-gray-200">
                <tr>
                  <th className="p-2 w-8">#</th>
                  <th className="p-2 w-28">User / Emp ID</th>
                  <th className="p-2">First Name *</th>
                  <th className="p-2">Last Name *</th>
                  <th className="p-2">Email *</th>
                  <th className="p-2">Phone</th>
                  <th className="p-2">Role</th>
                  <th className="p-2">Department</th>
                  <th className="p-2">Temp Pass</th>
                  <th className="p-2 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-slate-800 bg-white dark:bg-slate-900">
                {bulkRows.map((row, idx) => (
                  <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/50">
                    <td className="p-2 text-center text-gray-400 font-mono">{idx + 1}</td>
                    <td className="p-1">
                      <input
                        className="w-full input text-xs py-1 px-2 font-mono font-medium text-blue-700 bg-blue-50/40"
                        placeholder="e.g. LIFC-1001"
                        value={row.employeeId || ''}
                        onChange={(e) => updateBulkRow(row.id, 'employeeId', e.target.value)}
                      />
                    </td>
                    <td className="p-1">
                      <input
                        className="w-full input text-xs py-1 px-2"
                        placeholder="First Name"
                        value={row.firstName}
                        onChange={(e) => updateBulkRow(row.id, 'firstName', e.target.value)}
                      />
                    </td>
                    <td className="p-1">
                      <input
                        className="w-full input text-xs py-1 px-2"
                        placeholder="Last Name"
                        value={row.lastName}
                        onChange={(e) => updateBulkRow(row.id, 'lastName', e.target.value)}
                      />
                    </td>
                    <td className="p-1">
                      <input
                        type="email"
                        className="w-full input text-xs py-1 px-2"
                        placeholder="email@laxmi.com"
                        value={row.email}
                        onChange={(e) => updateBulkRow(row.id, 'email', e.target.value)}
                      />
                    </td>
                    <td className="p-1">
                      <input
                        className="w-full input text-xs py-1 px-2"
                        placeholder="Phone"
                        value={row.phone}
                        onChange={(e) => updateBulkRow(row.id, 'phone', e.target.value)}
                      />
                    </td>
                    <td className="p-1">
                      <select
                        className="w-full input text-xs py-1 px-2"
                        value={row.role}
                        onChange={(e) => updateBulkRow(row.id, 'role', e.target.value)}
                      >
                        {roles.map((r) => <option key={r} value={r}>{humanize(r)}</option>)}
                      </select>
                    </td>
                    <td className="p-1">
                      <select
                        className="w-full input text-xs py-1 px-2"
                        value={row.departmentId}
                        disabled={!isOrgWide}
                        onChange={(e) => updateBulkRow(row.id, 'departmentId', e.target.value)}
                      >
                        <option value="">None</option>
                        {(departments || []).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                      </select>
                    </td>
                    <td className="p-1">
                      <input
                        className="w-full input text-xs py-1 px-2"
                        placeholder="Temp Pass"
                        value={row.temporaryPassword || ''}
                        onChange={(e) => updateBulkRow(row.id, 'temporaryPassword', e.target.value)}
                      />
                    </td>
                    <td className="p-1 text-center">
                      <button
                        type="button"
                        className="text-red-500 hover:text-red-700 p-1"
                        onClick={() => removeBulkRow(row.id)}
                        title="Remove Row"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-between items-center text-xs text-gray-500 pt-1">
            <button
              type="button"
              className="text-primary-600 font-semibold hover:underline flex items-center gap-1"
              onClick={addBulkRow}
            >
              + Add another row
            </button>
            <span>Total rows: {bulkRows.length}</span>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        open={!!deletingUser}
        onClose={() => setDeletingUser(null)}
        onConfirm={handleDeleteUser}
        title="Delete User Account"
        message={`Are you sure you want to delete ${deletingUser?.firstName} ${deletingUser?.lastName} (${deletingUser?.email})? This user will be permanently removed.`}
        confirmLabel="Delete User"
        danger
        busy={deleting}
      />
    </div>
  );
}
