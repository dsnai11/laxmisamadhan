import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '@services/api';
import AuthShell from '@components/auth/AuthShell';
import { Field, getErrorMessage } from '@components/common/ui';
import { PASSWORD_HINT, passwordSchema } from '@utils/validation';

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') || '';
  const email = params.get('email') || '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const check = passwordSchema.safeParse(password);
    if (!check.success) return toast.error(check.error.issues[0].message);
    if (password !== confirm) return toast.error('Passwords do not match');
    setBusy(true);
    try {
      await api.resetPassword(token, email, password);
      toast.success('Password updated. Please sign in.');
      navigate('/login');
    } catch (err) {
      toast.error(getErrorMessage(err));
      setBusy(false);
    }
  };

  if (!token || !email) {
    return (
      <AuthShell title="Link not valid" footer={<Link to="/forgot-password" className="font-medium text-primary-600 hover:text-primary-500">Request a new link</Link>}>
        <p className="text-sm text-gray-700">This reset link is incomplete or has expired.</p>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Choose a new password" subtitle={email}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="New password" hint={PASSWORD_HINT}><input type="password" className="input" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
        <Field label="Confirm new password"><input type="password" className="input" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} /></Field>
        <button type="submit" className="btn-primary w-full btn-lg" disabled={busy}>{busy ? 'Saving...' : 'Update password'}</button>
      </form>
    </AuthShell>
  );
}
