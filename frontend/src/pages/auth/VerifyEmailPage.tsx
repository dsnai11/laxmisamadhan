import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '@services/api';
import AuthShell from '@components/auth/AuthShell';
import { getErrorMessage, Spinner } from '@components/common/ui';

export default function VerifyEmailPage() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [state, setState] = useState<'working' | 'done' | 'failed'>(token ? 'working' : 'failed');
  const [message, setMessage] = useState(token ? '' : 'This verification link is incomplete.');

  useEffect(() => {
    if (!token) return;
    api.verifyEmail(token).then(() => setState('done')).catch((e) => { setMessage(getErrorMessage(e)); setState('failed'); });
  }, [token]);

  return (
    <AuthShell title="Email verification" footer={<Link to="/login" className="font-medium text-primary-600 hover:text-primary-500">Go to sign in</Link>}>
      {state === 'working' && <div className="flex justify-center py-4"><Spinner /></div>}
      {state === 'done' && <p className="text-sm text-success-700">Your email address is verified. You can sign in now.</p>}
      {state === 'failed' && <p className="text-sm text-danger-700">{message || 'We could not verify this link.'}</p>}
    </AuthShell>
  );
}
