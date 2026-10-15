import { useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '@services/api';
import { useAuth } from '@context/AuthContext';
import { Field, getErrorMessage } from '@components/common/ui';

export default function MFASetupPage() {
  const { user, refreshUser } = useAuth();
  const [setup, setSetup] = useState<{ secret: string; qrCodeUrl: string; backupCodes: string[] } | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [disableCode, setDisableCode] = useState('');

  const begin = async () => {
    setBusy(true);
    try {
      setSetup(await api.setupMFA());
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    if (!/^\d{6}$/.test(code)) return toast.error('Enter the 6-digit code from your authenticator app');
    setBusy(true);
    try {
      await api.verifyMFA(code);
      setDone(true);
      toast.success('Two-factor authentication is on');
      await refreshUser();
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    if (!/^\d{6}$/.test(disableCode)) return toast.error('Enter a 6-digit code to confirm');
    setBusy(true);
    try {
      await api.disableMFA(disableCode);
      toast.success('Two-factor authentication turned off');
      setDisableCode('');
      await refreshUser();
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto p-6 space-y-6">
      <div>
        <Link to="/raiser/profile" className="text-sm text-primary-600 hover:underline">← Profile</Link>
        <h1 className="page-title mt-2">Two-factor authentication</h1>
        <p className="page-subtitle">Add a second step to sign-in using an authenticator app.</p>
      </div>

      {user?.mfaEnabled && !setup ? (
        <div className="card p-6 space-y-4">
          <p className="text-sm text-success-700 font-medium">Two-factor authentication is on for your account.</p>
          <Field label="To turn it off, enter a current 6-digit code">
            <div className="flex gap-2">
              <input className="input" inputMode="numeric" maxLength={6} value={disableCode} onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, ''))} />
              <button className="btn-danger whitespace-nowrap" disabled={busy} onClick={disable}>Turn off</button>
            </div>
          </Field>
        </div>
      ) : !setup ? (
        <div className="card p-6 space-y-4">
          <p className="text-sm text-gray-700">You will need an authenticator app such as Microsoft Authenticator, Google Authenticator or Authy.</p>
          <button className="btn-primary" disabled={busy} onClick={begin}>{busy ? 'Preparing...' : 'Begin setup'}</button>
        </div>
      ) : done ? (
        <div className="card p-6 space-y-4">
          <p className="text-sm text-success-700 font-medium">All set. Save these backup codes somewhere safe.</p>
          <p className="text-sm text-gray-600">Each code can be used once if you lose access to your authenticator app. They will not be shown again.</p>
          <div className="grid grid-cols-2 gap-2 font-mono text-sm bg-gray-50 rounded-lg p-4">
            {setup.backupCodes.map((c) => <span key={c}>{c}</span>)}
          </div>
          <Link to="/raiser/profile" className="btn-primary">Done</Link>
        </div>
      ) : (
        <div className="card p-6 space-y-5">
          <div>
            <p className="text-sm font-medium text-gray-900">1. Add the account to your authenticator app</p>
            <p className="text-sm text-gray-600 mt-1">Choose "enter a setup key" and paste this key:</p>
            <p className="mt-2 font-mono text-sm break-all bg-gray-50 rounded-lg p-3 select-all">{setup.secret}</p>
            <details className="mt-2 text-xs text-gray-500">
              <summary className="cursor-pointer">Show full setup link</summary>
              <p className="mt-1 break-all font-mono select-all">{setup.qrCodeUrl}</p>
            </details>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900">2. Enter the 6-digit code it shows</p>
            <div className="mt-2 flex gap-2">
              <input className="input tracking-widest text-center" inputMode="numeric" maxLength={6} placeholder="000000" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
              <button className="btn-primary whitespace-nowrap" disabled={busy} onClick={confirm}>{busy ? 'Checking...' : 'Turn on'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
