import { useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '@services/api';
import AuthShell from '@components/auth/AuthShell';
import { Field, getErrorMessage } from '@components/common/ui';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return toast.error('Enter a valid email address');
    setBusy(true);
    try {
      await api.forgotPassword(email.trim());
      setSent(true);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell title="Reset your password" subtitle="We will email you a link to choose a new one" footer={<Link to="/login" className="font-medium text-primary-600 hover:text-primary-500">Back to sign in</Link>}>
      {sent ? (
        <div className="space-y-3 text-sm text-gray-700">
          <p className="font-medium text-gray-900">Check your inbox</p>
          <p>If an account exists for {email}, a reset link is on its way. It expires in one hour.</p>
          <p className="text-gray-500">No email after a few minutes? Ask your IT administrator to reset your password for you.</p>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4" noValidate>
          <Field label="Email address"><input type="email" className="input" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          <button type="submit" className="btn-primary w-full btn-lg" disabled={busy}>{busy ? 'Sending...' : 'Send reset link'}</button>
        </form>
      )}
    </AuthShell>
  );
}
