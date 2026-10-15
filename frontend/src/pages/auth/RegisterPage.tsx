import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { useAuth } from '@context/AuthContext';
import AuthShell from '@components/auth/AuthShell';
import { Field, getErrorMessage } from '@components/common/ui';
import { PASSWORD_HINT, passwordSchema } from '@utils/validation';

const schema = z
  .object({
    firstName: z.string().trim().min(1, 'Required').max(50),
    lastName: z.string().trim().min(1, 'Required').max(50),
    email: z.string().trim().email('Enter a valid email address'),
    phone: z.string().trim().optional(),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, { message: 'Passwords do not match', path: ['confirmPassword'] });

type Values = z.infer<typeof schema>;

export default function RegisterPage() {
  const { register: registerUser } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<Values>({ resolver: zodResolver(schema) });

  const onSubmit = async (v: Values) => {
    setBusy(true);
    try {
      await registerUser({ firstName: v.firstName, lastName: v.lastName, email: v.email, password: v.password, ...(v.phone ? { phone: v.phone } : {}) });
      toast.success('Welcome! Your account is ready.');
      navigate('/');
    } catch (e) {
      toast.error(getErrorMessage(e));
      setBusy(false);
    }
  };

  return (
    <AuthShell title="Create your account" subtitle="Raise tickets and track them in one place" footer={<>Already have an account? <Link to="/login" className="font-medium text-primary-600 hover:text-primary-500">Sign in</Link></>}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div className="grid grid-cols-2 gap-3">
          <Field label="First name" error={errors.firstName?.message}><input className="input" autoComplete="given-name" {...register('firstName')} /></Field>
          <Field label="Last name" error={errors.lastName?.message}><input className="input" autoComplete="family-name" {...register('lastName')} /></Field>
        </div>
        <Field label="Work email" error={errors.email?.message}><input type="email" className="input" autoComplete="email" {...register('email')} /></Field>
        <Field label="Phone (optional)"><input className="input" autoComplete="tel" {...register('phone')} /></Field>
        <Field label="Password" error={errors.password?.message} hint={PASSWORD_HINT}><input type="password" className="input" autoComplete="new-password" {...register('password')} /></Field>
        <Field label="Confirm password" error={errors.confirmPassword?.message}><input type="password" className="input" autoComplete="new-password" {...register('confirmPassword')} /></Field>
        <button type="submit" className="btn-primary w-full btn-lg" disabled={busy}>{busy ? 'Creating account...' : 'Create account'}</button>
      </form>
    </AuthShell>
  );
}
