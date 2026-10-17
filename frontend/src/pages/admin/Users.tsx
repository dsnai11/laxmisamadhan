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
  employeeId: string;
  firstName: string;
  departmentName: string;
  departmentRaiserName: string;
  designations: string;
  branch: string;
  state: string;
  phone: string;
  email: string;
  role: string;
  temporaryPassword: string;
}

export default function AdminUsers() {
  const { user: me } = useAuth();
  const qc = useQueryClient();
  const myRoles = Array.from(new Set([
    ...(me?.role ? [me.role] : []),
    ...((me as any)?.roles || []),
  ]));
  const isSuperAdmin = myRoles.includes('SUPER_ADMIN');
  const isOrgWide = isSuperAdmin || myRoles.includes('ADMIN');
  const roles = isSuperAdmin ? ROLE_OPTIONS : assignableRoles(me?.role);

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
  const [importProgress, setImportProgress] = useState<{ current: number; total: number } | null>(null);

  // Delete user state
  const [deletingUser, setDeletingUser] = useState<any | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Bulk modal state & ID generator
  const [bulkRows, setBulkRows] = useState<BulkUserRow[]>([]);
  const [bulkDefaultRole, setBulkDefaultRole] = useState('RAISER');
  const [bulkDefaultDept, setBulkDefaultDept] = useState('');
  const [idPrefix, setIdPrefix] = useState('100');
  const [idStartNum, setIdStartNum] = useState(1);
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
    const defDeptName = departments && departments.length > 0 ? departments[0].name : '';
    setBulkDefaultRole(defRole);
    setBulkDefaultDept(defDeptName);
    setBulkRows([
      {
        id: '1',
        employeeId: '1001',
        firstName: 'PUSHPENDRA PRATAP SINGH',
        departmentName: '',
        departmentRaiserName: 'COLLECTION',
        designations: 'MANAGER',
        branch: 'ROSHAN TOWER JAIPUR HO',
        state: 'RAJASTHAN',
        phone: '9799954635',
        email: 'pushpendra.gora@lifc.in',
        role: defRole,
        temporaryPassword: 'LaxmiUser@123',
      },
      {
        id: '2',
        employeeId: '1002',
        firstName: '',
        departmentName: defDeptName,
        departmentRaiserName: '',
        designations: '',
        branch: '',
        state: '',
        phone: '',
        email: '',
        role: defRole,
        temporaryPassword: 'LaxmiUser@123',
      },
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
        departmentName: bulkDefaultDept,
        departmentRaiserName: '',
        designations: '',
        branch: '',
        state: '',
        phone: '',
        email: '',
        role: bulkDefaultRole,
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

  const applyDeptToAll = (deptName: string) => {
    setBulkDefaultDept(deptName);
    setBulkRows((prev) => prev.map((r) => ({ ...r, departmentName: deptName })));
  };

  const applyRoleToAll = (r: string) => {
    setBulkDefaultRole(r);
    setBulkRows((prev) => prev.map((row) => ({ ...row, role: r })));
  };

  const downloadCSVTemplate = () => {
    const csvHeader = 'employeeId,firstName,department name,department raiser name,desginations,BRANCH,STATE,MOBILE NO,Mail Id\n';
    const sampleRows = `1001,PUSHPENDRA PRATAP SINGH,,COLLECTION,MANAGER,ROSHAN TOWER JAIPUR HO,RAJASTHAN,9799954635,pushpendra.gora@lifc.in\n1002,PRIYA VERMA,IT SUPPORT,VIKAS GUPTA,EXECUTIVE,MUMBAI HO,MAHARASHTRA,9876543211,priya.verma@lifc.in\n`;
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
        toast.error('File is empty or missing headers');
        return;
      }

      const delimiter = lines[0].includes('\t') ? '\t' : ',';
      const headers = lines[0].split(delimiter).map((h) => h.trim().toLowerCase().replace(/[\s_-]+/g, ''));

      const findCol = (...aliases: string[]) => {
        for (const alias of aliases) {
          const norm = alias.toLowerCase().replace(/[\s_-]+/g, '');
          const idx = headers.indexOf(norm);
          if (idx !== -1) return idx;
        }
        return -1;
      };

      const idIdx = findCol('employeeid', 'employee', 'empid', 'id', 'emplo', 'code');
      const fnIdx = findCol('firstname', 'name', 'fullname', 'first_name', 'employeename');
      const deptIdx = findCol('departmentname', 'department', 'deptname', 'dept');
      const raiserIdx = findCol('departmentraisername', 'departmentraiser', 'raisername', 'raiser');
      const desigIdx = findCol('desginations', 'designations', 'designation', 'jobtitle', 'title');
      const branchIdx = findCol('branch', 'branchname', 'site', 'location');
      const stateIdx = findCol('state', 'region');
      const phoneIdx = findCol('mobileno', 'mobile', 'phone', 'phonenumber');
      const emailIdx = findCol('mailid', 'mail_id', 'email', 'emailaddress', 'mail');
      const roleIdx = findCol('role', 'userrole');
      const passIdx = findCol('temporarypassword', 'temppassword', 'password', 'pass');

      const usePositional = emailIdx === -1 && fnIdx === -1;

      const parsedRows: BulkUserRow[] = [];
      for (let i = 1; i < lines.length; i++) {
        const rawLine = lines[i];
        const cols = rawLine.split(delimiter).map((c) => c.trim().replace(/^["']|["']$/g, ''));
        if (cols.length < 2) continue;

        const employeeId = (usePositional ? cols[0] : idIdx !== -1 ? cols[idIdx] : '') || `${idPrefix}${idStartNum + i - 1}`;
        const firstName = usePositional ? cols[1] : (fnIdx !== -1 ? cols[fnIdx] : '');
        const departmentName = (usePositional ? cols[2] : (deptIdx !== -1 ? cols[deptIdx] : '')) || bulkDefaultDept;
        const departmentRaiserName = usePositional ? cols[3] : (raiserIdx !== -1 ? cols[raiserIdx] : '');
        const designations = usePositional ? cols[4] : (desigIdx !== -1 ? cols[desigIdx] : '');
        const branch = usePositional ? cols[5] : (branchIdx !== -1 ? cols[branchIdx] : '');
        const state = usePositional ? cols[6] : (stateIdx !== -1 ? cols[stateIdx] : '');
        const phone = usePositional ? cols[7] : (phoneIdx !== -1 ? cols[phoneIdx] : '');
        const email = usePositional ? cols[8] : (emailIdx !== -1 ? cols[emailIdx] : '');
        const roleVal = roleIdx !== -1 && cols[roleIdx] ? cols[roleIdx] : bulkDefaultRole;
        const temporaryPassword = (passIdx !== -1 && cols[passIdx] ? cols[passIdx] : '') || 'LaxmiUser@123';

        if (!email && !firstName) continue;

        parsedRows.push({
          id: Math.random().toString(36).substring(2, 9),
          employeeId: employeeId || '',
          firstName: firstName || '',
          departmentName: departmentName || '',
          departmentRaiserName: departmentRaiserName || '',
          designations: designations || '',
          branch: branch || '',
          state: state || '',
          phone: phone || '',
          email: email || '',
          role: roleVal ? roleVal.toUpperCase().replace(/\s+/g, '_') : bulkDefaultRole,
          temporaryPassword,
        });
      }

      if (parsedRows.length === 0) {
        toast.error('No valid user data found in file');
        return;
      }

      setBulkRows(parsedRows);
      toast.success(`Loaded ${parsedRows.length} users successfully`);
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const executeBulkCreate = async () => {
    const validUsers = bulkRows.filter((r) => r.firstName.trim() && r.email.trim());
    if (validUsers.length === 0) {
      return toast.error('Please enter at least one valid user with First Name and Mail Id');
    }

    setBulkSaving(true);
    setImportProgress({ current: 0, total: validUsers.length });

    try {
      const payload = validUsers.map((r) => ({
        employeeId: r.employeeId?.trim() || undefined,
        firstName: r.firstName.trim(),
        departmentName: r.departmentName?.trim() || undefined,
        departmentRaiserName: r.departmentRaiserName?.trim() || undefined,
        designations: r.designations?.trim() || undefined,
        branch: r.branch?.trim() || undefined,
        state: r.state?.trim() || undefined,
        phone: r.phone?.trim() || undefined,
        mobile: r.phone?.trim() || undefined,
        email: r.email.trim(),
        role: r.role || 'RAISER',
        temporaryPassword: r.temporaryPassword?.trim() || 'LaxmiUser@123',
        sendWelcomeEmail: false,
      }));

      const BATCH_SIZE = 100;
      let totalSuccess = 0;
      let totalFailed = 0;
      const allErrors: any[] = [];

      for (let i = 0; i < payload.length; i += BATCH_SIZE) {
        const chunk = payload.slice(i, i + BATCH_SIZE);
        const res = await api.bulkCreateUsers(chunk);
        totalSuccess += res.success || 0;
        totalFailed += res.failed || 0;
        if (res.errors) allErrors.push(...res.errors);
        setImportProgress({ current: Math.min(i + BATCH_SIZE, payload.length), total: payload.length });
      }

      if (totalSuccess > 0) {
        toast.success(`Successfully imported ${totalSuccess} user(s)!`);
        setBulkOpen(false);
        setBulkRows([]);
        qc.invalidateQueries({ queryKey: ['admin-users'] });
      }
      if (totalFailed > 0) {
        const errorMsgs = allErrors.map((err: any) => `${err.name || err.email}: ${err.error}`).slice(0, 3).join('; ');
        toast.error(`${totalFailed} user(s) failed. ${errorMsgs}`);
      }
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setBulkSaving(false);
      setImportProgress(null);
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
          <input className="input" placeholder="Search name, email, or employee ID..." value={searchInput} onChange={(e) => setSearchInput(e.target.value)} aria-label="Search users" />
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
                            <span className="block text-xs text-gray-500 dark:text-slate-400">
                              {u.email}
                              {u.jobTitle && <span className="ml-1 text-primary-600 dark:text-primary-400 font-medium">({u.jobTitle})</span>}
                            </span>
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
                      <td className="text-sm text-gray-600 dark:text-slate-300">
                        <div>{u.department?.name || '-'}</div>
                        {u.departmentRaiserName && (
                          <div className="text-[11px] text-gray-400 dark:text-slate-500">Raiser: {u.departmentRaiserName}</div>
                        )}
                      </td>
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
        onClose={() => !bulkSaving && setBulkOpen(false)}
        title="Bulk User Creation & ID Management"
        wide
        footer={
          <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-3">
            {importProgress ? (
              <div className="w-full sm:w-auto flex-1 flex items-center gap-2">
                <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="bg-primary-600 h-2.5 rounded-full transition-all duration-200"
                    style={{ width: `${Math.round((importProgress.current / importProgress.total) * 100)}%` }}
                  />
                </div>
                <span className="text-xs font-semibold text-gray-700 dark:text-slate-300 whitespace-nowrap">
                  {importProgress.current} / {importProgress.total} ({Math.round((importProgress.current / importProgress.total) * 100)}%)
                </span>
              </div>
            ) : (
              <div className="text-xs text-gray-500">
                {bulkRows.length > 0 ? `${bulkRows.filter(r => r.firstName && r.email).length} users ready to import` : ''}
              </div>
            )}
            <div className="flex items-center gap-2 shrink-0">
              <button className="btn-secondary" disabled={bulkSaving} onClick={() => setBulkOpen(false)}>Cancel</button>
              <button className="btn-primary" disabled={bulkSaving || bulkRows.filter(r => r.firstName && r.email).length === 0} onClick={executeBulkCreate}>
                {bulkSaving ? (importProgress ? `Importing (${importProgress.current}/${importProgress.total})...` : 'Importing Users...') : `Import ${bulkRows.filter(r => r.firstName && r.email).length} Users`}
              </button>
            </div>
          </div>
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
              <div className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-slate-300">
                <span>Set All Dept:</span>
                <input
                  list="bulk-dept-options"
                  className="input text-xs py-1 px-2 w-32"
                  placeholder="Dept Name"
                  value={bulkDefaultDept}
                  onChange={(e) => applyDeptToAll(e.target.value)}
                />
                <datalist id="bulk-dept-options">
                  {(departments || []).map((d) => <option key={d.id} value={d.name} />)}
                </datalist>
              </div>

              <div className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-slate-300">
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

          {bulkRows.length > 50 && (
            <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 rounded-lg text-xs text-blue-800 dark:text-blue-300">
              <div className="flex items-center gap-1.5">
                <span className="font-bold">⚡ Fast Preview:</span>
                <span>Showing first 50 rows of {bulkRows.length} users to keep page scrolling fast.</span>
              </div>
              <span className="font-bold bg-blue-100 dark:bg-blue-900 px-2 py-0.5 rounded text-blue-900 dark:text-blue-100">
                All {bulkRows.length} users will be created
              </span>
            </div>
          )}

          {/* User Rows Table */}
          <div className="max-h-[380px] overflow-y-auto overflow-x-auto border border-gray-200 dark:border-slate-800 rounded-lg scrollbar-thin">
            <table className="w-full text-xs text-left text-gray-700 dark:text-slate-200 min-w-[1300px]">
              <thead className="bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 font-semibold uppercase sticky top-0 z-10 border-b border-gray-200 dark:border-slate-700 whitespace-nowrap">
                <tr>
                  <th className="p-2 w-8">#</th>
                  <th className="p-2 w-28">Employee ID</th>
                  <th className="p-2 w-36">First Name *</th>
                  <th className="p-2 w-32">Department Name</th>
                  <th className="p-2 w-36">Department Raiser Name</th>
                  <th className="p-2 w-28">Designations</th>
                  <th className="p-2 w-36">Branch</th>
                  <th className="p-2 w-28">State</th>
                  <th className="p-2 w-28">Mobile No</th>
                  <th className="p-2 w-44">Mail Id *</th>
                  <th className="p-2 w-28">Role</th>
                  <th className="p-2 w-28">Temp Pass</th>
                  <th className="p-2 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-slate-800 bg-white dark:bg-slate-900">
                {bulkRows.slice(0, 50).map((row, idx) => (
                  <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/50">
                    <td className="p-2 text-center text-gray-400 font-mono">{idx + 1}</td>
                    <td className="p-1">
                      <input
                        className="w-full input text-xs py-1 px-2 font-mono font-medium text-blue-700 bg-blue-50/40 dark:bg-blue-950/40 dark:text-blue-300"
                        placeholder="e.g. 1001"
                        value={row.employeeId || ''}
                        onChange={(e) => updateBulkRow(row.id, 'employeeId', e.target.value)}
                      />
                    </td>
                    <td className="p-1">
                      <input
                        className="w-full input text-xs py-1 px-2"
                        placeholder="First Name *"
                        value={row.firstName}
                        onChange={(e) => updateBulkRow(row.id, 'firstName', e.target.value)}
                      />
                    </td>
                    <td className="p-1">
                      <input
                        list="bulk-dept-options"
                        className="w-full input text-xs py-1 px-2"
                        placeholder="e.g. COLLECTION"
                        value={row.departmentName}
                        onChange={(e) => updateBulkRow(row.id, 'departmentName', e.target.value)}
                      />
                    </td>
                    <td className="p-1">
                      <input
                        className="w-full input text-xs py-1 px-2"
                        placeholder="e.g. COLLECTION"
                        value={row.departmentRaiserName}
                        onChange={(e) => updateBulkRow(row.id, 'departmentRaiserName', e.target.value)}
                      />
                    </td>
                    <td className="p-1">
                      <input
                        className="w-full input text-xs py-1 px-2"
                        placeholder="e.g. MANAGER"
                        value={row.designations}
                        onChange={(e) => updateBulkRow(row.id, 'designations', e.target.value)}
                      />
                    </td>
                    <td className="p-1">
                      <input
                        className="w-full input text-xs py-1 px-2"
                        placeholder="e.g. ROSHAN TOWER JAIPUR HO"
                        value={row.branch || ''}
                        onChange={(e) => updateBulkRow(row.id, 'branch', e.target.value)}
                      />
                    </td>
                    <td className="p-1">
                      <input
                        className="w-full input text-xs py-1 px-2"
                        placeholder="e.g. RAJASTHAN"
                        value={row.state || ''}
                        onChange={(e) => updateBulkRow(row.id, 'state', e.target.value)}
                      />
                    </td>
                    <td className="p-1">
                      <input
                        className="w-full input text-xs py-1 px-2"
                        placeholder="9799954635"
                        value={row.phone}
                        onChange={(e) => updateBulkRow(row.id, 'phone', e.target.value)}
                      />
                    </td>
                    <td className="p-1">
                      <input
                        type="email"
                        className="w-full input text-xs py-1 px-2"
                        placeholder="pushpendra.gora@lifc.in *"
                        value={row.email}
                        onChange={(e) => updateBulkRow(row.id, 'email', e.target.value)}
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
