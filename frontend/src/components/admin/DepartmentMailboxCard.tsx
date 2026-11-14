import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '@services/api';
import { Field, getErrorMessage } from '@components/common/ui';
import { formatRelativeTime } from '@utils/helpers';

interface Props {
  departmentId: string;
  supportEmail?: string | null;
}

/**
 * Email-to-ticket for one department: the server logs in to this department's own mailbox
 * (its Inbound Support Email) every minute and turns new mail into tickets for this department.
 * The password is write-only — it is encrypted on the server and never shown again.
 */
export default function DepartmentMailboxCard({ departmentId, supportEmail }: Props) {
  const { data: mb, refetch } = useQuery<any>({
    queryKey: ['department-mailbox', departmentId],
    queryFn: () => api.getDepartmentMailbox(departmentId),
    refetchInterval: 30_000,
  });

  const [enabled, setEnabled] = useState(false);
  const [password, setPassword] = useState('');
  const [host, setHost] = useState('mail.lifc.in');
  const [port, setPort] = useState(993);
  const [username, setUsername] = useState('');
  const [busy, setBusy] = useState<'' | 'save' | 'test' | 'check'>('');
  const [testResult, setTestResult] = useState<any>(null);

  useEffect(() => {
    if (!mb) return;
    setEnabled(!!mb.enabled);
    setHost(mb.host || 'mail.lifc.in');
    setPort(mb.port || 993);
    setUsername(mb.username || '');
  }, [mb]);

  const address = username.trim() || supportEmail || '';

  const save = async () => {
    setBusy('save');
    try {
      await api.updateDepartmentMailbox(departmentId, {
        enabled,
        host: host.trim(),
        port: Number(port),
        username: username.trim() || null,
        ...(password ? { password } : {}),
      });
      setPassword('');
      toast.success(enabled ? 'Email-to-ticket enabled. New mail will become tickets within a minute.' : 'Mailbox settings saved');
      refetch();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy('');
    }
  };

  const test = async () => {
    setBusy('test');
    setTestResult(null);
    try {
      const r = await api.testDepartmentMailbox(departmentId, {
        host: host.trim(),
        port: Number(port),
        username: username.trim() || null,
        ...(password ? { password } : {}),
      });
      setTestResult(r);
      r.ok ? toast.success('Connected to the mailbox') : toast.error('Could not connect to the mailbox');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy('');
    }
  };

  const checkNow = async () => {
    setBusy('check');
    try {
      const r = await api.checkDepartmentMailboxNow(departmentId);
      const res = r?.result;
      if (!res) toast('Email-to-ticket is not enabled for this department');
      else if (!res.ok) toast.error(`Mailbox error: ${res.error}`);
      else if (res.baseline) toast.success('Mailbox connected. Mail arriving from now on will become tickets.');
      else toast.success(`Checked: ${res.ticketsCreated} new ticket(s), ${res.comments} reply comment(s), ${res.skipped} skipped`);
      refetch();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy('');
    }
  };

  const status = !mb
    ? null
    : !mb.enabled
    ? { tone: 'text-gray-600', text: 'Off — mail to this address is not turned into tickets.' }
    : mb.lastError
    ? { tone: 'text-red-700', text: `Error: ${mb.lastError}` }
    : mb.lastCheckedAt
    ? { tone: 'text-emerald-700', text: `Active — last checked ${formatRelativeTime(mb.lastCheckedAt)} · ${mb.ticketsCreated} ticket(s) created from email` }
    : { tone: 'text-amber-700', text: 'Enabled — waiting for the first check (within a minute).' };

  return (
    <div className="card p-6 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-semibold text-gray-900">Email-to-ticket mailbox</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Emails sent to <span className="font-medium text-gray-700">{address || 'the Inbound Support Email above'}</span> become tickets in
            this department and are auto-assigned like any other ticket. Mail already in the inbox when you turn this on is not ticketed.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer">
          <input type="checkbox" className="h-4 w-4 rounded border-gray-300 text-primary-600" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          Enabled
        </label>
      </div>

      {!supportEmail && !username && (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Set the department's Inbound Support Email in Settings above first.
        </p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Mailbox password" hint={mb?.hasPassword ? 'A password is saved. Leave blank to keep it.' : 'Password of the mailbox above (stored encrypted, never shown again).'}>
          <input
            type="password"
            className="input"
            autoComplete="new-password"
            placeholder={mb?.hasPassword ? '•••••••• (saved)' : 'Enter mailbox password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        <Field label="Login (optional)" hint="Only if the mailbox login differs from the support email.">
          <input className="input" placeholder={supportEmail || 'mailbox@lifc.in'} value={username} onChange={(e) => setUsername(e.target.value)} />
        </Field>
        <Field label="IMAP server">
          <input className="input" value={host} onChange={(e) => setHost(e.target.value)} />
        </Field>
        <Field label="Port">
          <input type="number" className="input" value={port} onChange={(e) => setPort(Number(e.target.value))} />
        </Field>
      </div>

      {status && <p className={`text-sm ${status.tone}`}>{status.text}</p>}
      {testResult && (
        <p className={`text-sm ${testResult.ok ? 'text-emerald-700' : 'text-red-700'}`}>
          {testResult.ok
            ? `Login OK for ${testResult.address} — inbox has ${testResult.messages} message(s), ${testResult.unread} unread.`
            : `Login failed for ${testResult.address}: ${testResult.error}`}
        </p>
      )}

      <div className="flex flex-wrap justify-end gap-2">
        <button className="btn-secondary" disabled={!!busy} onClick={test}>{busy === 'test' ? 'Testing...' : 'Test connection'}</button>
        <button className="btn-secondary" disabled={!!busy || !mb?.enabled} onClick={checkNow}>{busy === 'check' ? 'Checking...' : 'Check now'}</button>
        <button className="btn-primary" disabled={!!busy} onClick={save}>{busy === 'save' ? 'Saving...' : 'Save mailbox'}</button>
      </div>
    </div>
  );
}
