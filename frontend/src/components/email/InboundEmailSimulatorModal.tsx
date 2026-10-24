import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '@services/api';
import { Modal, Field } from '@components/common/ui';
import { EnvelopeIcon, SparklesIcon, CheckCircleIcon, ArrowPathIcon } from '@heroicons/react/24/outline';

interface Props {
  open: boolean;
  onClose: () => void;
  departments?: any[];
}

export default function InboundEmailSimulatorModal({ open, onClose, departments = [] }: Props) {
  const navigate = useNavigate();
  const [sending, setSending] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<any | null>(null);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await api.syncInboundEmails();
      toast.success(res?.processed > 0 ? `Synced! Found and processed ${res.processed} new email(s).` : 'Mailbox is up to date. No new unread emails.');
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed to sync with mail server');
    } finally {
      setSyncing(false);
    }
  };

  const [form, setForm] = useState({
    fromEmail: 'sourabh.sharma@lifc.in',
    fromName: 'Sourabh Sharma (Branch Head)',
    toEmail: 'project.lifc.in',
    subject: 'Need system access for new branch project setup',
    body: 'Dear Team,\n\nPlease grant access for the new branch project setup under LIFC. Our team needs access to the support desk and project dashboards.\n\nThanks,\nSourabh Sharma',
  });

  const handleSend = async () => {
    if (!form.fromEmail || !form.toEmail || !form.subject) {
      return toast.error('Sender, Recipient, and Subject are required');
    }

    setSending(true);
    try {
      const res = await api.simulateInboundEmail(form);
      setResult(res);
      toast.success(res.action === 'TICKET_CREATED' ? 'Ticket created via email!' : 'Comment appended to existing ticket!');
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed to process email');
    } finally {
      setSending(false);
    }
  };

  const handleReset = () => {
    setResult(null);
  };

  return (
    <Modal open={open} onClose={onClose} title="📧 Inbound Email Support & Gateway">
      <div className="space-y-4 text-xs">
        {/* Live IMAP Server Status */}
        <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <div>
              <p className="font-semibold text-gray-900 dark:text-white">Active Inbound Mail Listener</p>
              <p className="text-[11px] text-gray-500 dark:text-slate-400">mail.lifc.in (Account: laxmisamadhan@lifc.in) • Auto-polling every 60s</p>
            </div>
          </div>
          <button
            type="button"
            disabled={syncing}
            onClick={handleSync}
            className="btn-secondary text-xs py-1 px-3 self-start sm:self-auto flex items-center gap-1.5 bg-white dark:bg-slate-700 hover:bg-gray-50"
          >
            <ArrowPathIcon className={`w-3.5 h-3.5 ${syncing ? 'animate-spin text-primary-600' : 'text-emerald-600'}`} />
            {syncing ? 'Checking...' : 'Sync Mailbox Now'}
          </button>
        </div>

        <p className="text-gray-600 dark:text-slate-300">
          Emails sent to <strong>laxmisamadhan@lifc.in</strong>, <strong>it.support@lifc.in</strong>, or team emails are automatically converted into tickets. You can also test with the simulator below:
        </p>

        {result ? (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm">
              <CheckCircleIcon className="w-5 h-5 text-emerald-600" />
              {result.action === 'TICKET_CREATED' ? 'Incident Ticket Created Successfully!' : 'Reply Appended to Existing Ticket!'}
            </div>

            <div className="bg-white rounded-lg p-3 border border-emerald-100 space-y-1 text-gray-800 font-mono text-[11px]">
              <div><strong>Ticket ID:</strong> {result.ticket?.ticketNumber}</div>
              <div><strong>Title:</strong> {result.ticket?.title}</div>
              <div><strong>Department:</strong> {result.ticket?.department?.name || 'Assigned'}</div>
              <div><strong>Group / Team:</strong> {result.ticket?.group || 'Vendor / Internal Queue'}</div>
              <div><strong>Raised By:</strong> {result.ticket?.raisedBy?.email || form.fromEmail}</div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button className="btn-secondary text-xs" onClick={handleReset}>Send Another Email</button>
              <button
                className="btn-primary text-xs"
                onClick={() => {
                  onClose();
                  navigate(`/admin/tickets/${result.ticket?.id}`);
                }}
              >
                View Ticket #{result.ticket?.ticketNumber}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Sender Email (From)">
                <input
                  className="input input-sm w-full"
                  value={form.fromEmail}
                  onChange={(e) => setForm({ ...form, fromEmail: e.target.value })}
                  placeholder="employee@lifc.in"
                />
              </Field>

              <Field label="Sender Name">
                <input
                  className="input input-sm w-full"
                  value={form.fromName}
                  onChange={(e) => setForm({ ...form, fromName: e.target.value })}
                  placeholder="Full Name"
                />
              </Field>
            </div>

            <Field label="Recipient Support Email (To)">
              <div className="flex gap-2">
                <input
                  className="input input-sm flex-1 font-semibold text-blue-700"
                  value={form.toEmail}
                  onChange={(e) => setForm({ ...form, toEmail: e.target.value })}
                  placeholder="project.lifc.in or support@lifc.in"
                />
                <select
                  className="input input-sm w-44 bg-gray-50"
                  onChange={(e) => e.target.value && setForm({ ...form, toEmail: e.target.value })}
                >
                  <option value="">Quick Presets ▾</option>
                  <option value="project.lifc.in">project.lifc.in (Project Team)</option>
                  <option value="it.support@lifc.in">it.support@lifc.in (IT Desk)</option>
                  <option value="hr.support@lifc.in">hr.support@lifc.in (HR Desk)</option>
                  <option value="credit.support@lifc.in">credit.support@lifc.in (Credit Desk)</option>
                  <option value="admin.support@lifc.in">admin.support@lifc.in (Admin Desk)</option>
                </select>
              </div>
            </Field>

            <Field label="Email Subject (Tip: Include [INC-XXXX] to test replies)">
              <input
                className="input input-sm w-full"
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                placeholder="e.g. Need access to project dashboard"
              />
            </Field>

            <Field label="Email Body / Description">
              <textarea
                className="input input-sm w-full h-24"
                value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
                placeholder="Details of the issue or request..."
              />
            </Field>

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
              <button className="btn-secondary text-xs" onClick={onClose}>Cancel</button>
              <button className="btn-primary text-xs flex items-center gap-1 bg-blue-600 hover:bg-blue-700" onClick={handleSend} disabled={sending}>
                <EnvelopeIcon className="w-4 h-4" />
                {sending ? 'Processing Email...' : 'Send Inbound Email'}
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
