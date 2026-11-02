import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '@services/api';
import { useAuth } from '@context/AuthContext';
import { formatDate, humanize } from '@utils/helpers';
import { Avatar, Field, getErrorMessage, PageHeader } from '@components/common/ui';
import { PASSWORD_HINT, passwordSchema } from '@utils/validation';
import biometricService, { BiometricInfo, SavedUserProfile } from '@services/biometric.service';
import { BiometricSetupModal } from '@components/auth/BiometricQuickAuth';
import { FingerPrintIcon } from '@heroicons/react/24/outline';

export default function Profile() {
  const { user, updateProfile } = useAuth();
  const [form, setForm] = useState({ firstName: '', lastName: '', phone: '' });
  const [saving, setSaving] = useState(false);
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [changing, setChanging] = useState(false);

  // Biometric & Quick PIN states
  const [bioProfile, setBioProfile] = useState<SavedUserProfile | null>(null);
  const [bioInfo, setBioInfo] = useState<BiometricInfo | null>(null);
  const [setupModalOpen, setSetupModalOpen] = useState(false);

  useEffect(() => {
    if (user) {
      setForm({ firstName: user.firstName || '', lastName: user.lastName || '', phone: user.phone || '' });
    }
    setBioProfile(biometricService.getSavedProfile());
    biometricService.getBiometricInfo().then(setBioInfo);
  }, [user]);

  if (!user) return null;

  const save = async () => {
    if (!form.firstName.trim() || !form.lastName.trim()) return toast.error('First and last name are required');
    setSaving(true);
    try {
      await updateProfile({ firstName: form.firstName.trim(), lastName: form.lastName.trim(), phone: form.phone.trim() });
      toast.success('Profile updated');
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async () => {
    if (!pw.current) return toast.error('Enter your current password');
    const check = passwordSchema.safeParse(pw.next);
    if (!check.success) return toast.error(check.error.issues[0].message);
    if (pw.next !== pw.confirm) return toast.error('New passwords do not match');
    setChanging(true);
    try {
      await api.changePassword(pw.current, pw.next);
      toast.success('Password changed. Please sign in again.');
      api.clearAuth();
      window.location.href = '/login';
    } catch (e) {
      toast.error(getErrorMessage(e));
      setChanging(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader title="My profile" subtitle="Your details and security settings" />

      <div className="card p-6 space-y-5">
        <div className="flex items-center gap-4">
          <Avatar firstName={user.firstName} lastName={user.lastName} size={14} />
          <div>
            <p className="font-semibold text-gray-900">{user.firstName} {user.lastName}</p>
            <p className="text-sm text-gray-500">{user.email} · {humanize(user.role)}</p>
            {user.lastLoginAt && <p className="text-xs text-gray-400">Last sign-in {formatDate(user.lastLoginAt, 'datetime')}</p>}
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="First name"><input className="input" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} /></Field>
          <Field label="Last name"><input className="input" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} /></Field>
          <Field label="Phone"><input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
          <Field label="Email" hint="Ask an administrator to change your email address."><input className="input bg-gray-50" disabled value={user.email} /></Field>
        </div>
        <div className="flex justify-end"><button className="btn-primary" disabled={saving} onClick={save}>{saving ? 'Saving...' : 'Save changes'}</button></div>
      </div>

      {/* Biometric & Quick PIN Access */}
      <div className="card p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <FingerPrintIcon className="w-5 h-5 text-rose-600" />
              <span>Biometric & Quick PIN Login</span>
            </h2>
            <p className="text-sm text-gray-600">
              Unlock the mobile app instantly with Face ID, Fingerprint, or a 4-digit PIN.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setSetupModalOpen(true)}
            className="btn-primary btn-sm whitespace-nowrap self-start sm:self-auto"
          >
            {bioProfile?.hasPin ? 'Change PIN / Biometrics' : 'Set Up Quick Login'}
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs">
          <div className="p-3 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-between">
            <span className="text-gray-600">{bioInfo?.biometryLabel || 'Face ID / Fingerprint'}</span>
            <span className={`px-2 py-0.5 rounded font-semibold ${bioProfile?.biometricEnabled ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}`}>
              {bioProfile?.biometricEnabled ? 'Enabled' : 'Disabled'}
            </span>
          </div>
          <div className="p-3 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-between">
            <span className="text-gray-600">Quick PIN</span>
            <span className={`px-2 py-0.5 rounded font-semibold ${bioProfile?.hasPin ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}`}>
              {bioProfile?.hasPin ? 'Configured (4-digit)' : 'Not set'}
            </span>
          </div>
        </div>

        {bioProfile && (bioProfile.hasPin || bioProfile.biometricEnabled) && (
          <div className="pt-1 flex justify-end">
            <button
              type="button"
              onClick={async () => {
                await biometricService.clearBiometricsAndPin();
                setBioProfile(null);
                toast.success('Quick PIN & Biometrics removed from this device');
              }}
              className="text-xs text-danger-600 hover:underline font-medium"
            >
              Remove Quick Access from this device
            </button>
          </div>
        )}
      </div>

      <div className="card p-6 space-y-4">
        <h2 className="font-semibold text-gray-900">Change password</h2>
        <Field label="Current password"><input type="password" className="input" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} /></Field>
        <Field label="New password" hint={PASSWORD_HINT}><input type="password" className="input" autoComplete="new-password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} /></Field>
        <Field label="Confirm new password"><input type="password" className="input" autoComplete="new-password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} /></Field>
        <div className="flex justify-end"><button className="btn-secondary" disabled={changing} onClick={changePassword}>{changing ? 'Changing...' : 'Change password'}</button></div>
      </div>

      <div className="card p-6 flex items-center justify-between gap-4">
        <div>
          <h2 className="font-semibold text-gray-900">Two-factor authentication</h2>
          <p className="text-sm text-gray-600">{user.mfaEnabled ? 'On. Your sign-in needs a code from your authenticator app.' : 'Off. Add a second step to protect your account.'}</p>
        </div>
        <Link to="/mfa-setup" className="btn-secondary whitespace-nowrap">{user.mfaEnabled ? 'Manage' : 'Set up'}</Link>
      </div>

      {setupModalOpen && (
        <BiometricSetupModal
          isOpen={setupModalOpen}
          onClose={() => setSetupModalOpen(false)}
          onSuccess={() => {
            setSetupModalOpen(false);
            setBioProfile(biometricService.getSavedProfile());
          }}
          employeeId={user.employeeId || user.email}
          userName={`${user.firstName} ${user.lastName}`.trim()}
        />
      )}
    </div>
  );
}
