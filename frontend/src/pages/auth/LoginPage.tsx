import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { EnvelopeIcon, LockClosedIcon, EyeIcon, EyeSlashIcon, ShieldCheckIcon, SparklesIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { useAuth } from '@context/AuthContext';
import toast from 'react-hot-toast';
import { cn } from '@utils/helpers';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
  mfaCode: z.string().length(6, 'MFA code must be 6 digits').optional(),
  rememberMe: z.boolean().optional(),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [showMFA, setShowMFA] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { rememberMe: true },
  });

  const onSubmit = async (data: LoginForm) => {
    setIsLoading(true);
    setLoginError(null);
    try {
      await login(data.email, data.password, data.mfaCode, data.rememberMe);
      toast.success('Welcome back to Laxmi India Finance IT Portal');
      navigate('/');
    } catch (error: any) {
      if (error.message === 'MFA_REQUIRED') {
        setShowMFA(true);
        setValue('mfaCode', '');
      } else {
        const errorMsg = error.response?.data?.error || error.message || 'Login failed. Please check your credentials.';
        setLoginError(errorMsg);
        toast.error(errorMsg);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-900 via-red-800 to-rose-950 px-4 py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-red-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-rose-600/20 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-md w-full space-y-6 relative z-10">
        {/* Brand Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex p-1.5 bg-white/10 rounded-2xl backdrop-blur-md border border-white/20 shadow-xl">
            <img
              src="/logo.jpg"
              alt="Laxmi India Finance Ltd"
              className="h-16 w-16 rounded-xl object-cover border-2 border-white shadow-md"
            />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Laxmi India Finance
            </h1>
            <p className="text-xs sm:text-sm font-medium text-red-100/90 mt-0.5 tracking-wide">
              Enterprise IT Service Desk & Ticketing Portal
            </p>
          </div>
        </div>

        {/* Login Card */}
        <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl p-8 rounded-2xl shadow-2xl border border-white/20 space-y-6">
          <div className="border-b border-gray-100 dark:border-slate-800 pb-4">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Sign in to your account</h2>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
              Enter your corporate credentials to access the ticketing platform
            </p>
          </div>

          {loginError && (
            <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 flex items-start gap-3">
              <ExclamationTriangleIcon className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
              <div className="text-xs text-red-700 dark:text-red-300 leading-relaxed font-medium">
                {loginError}
              </div>
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
            <div>
              <label htmlFor="email" className="block text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-slate-300 mb-1">
                Corporate Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <EnvelopeIcon className="h-5 w-5 text-red-500" />
                </div>
                <input
                  {...register('email')}
                  id="email"
                  type="email"
                  autoComplete="email"
                  className={cn(
                    'input pl-10 bg-gray-50/50 dark:bg-slate-800/50 border-gray-200 dark:border-slate-700 focus:ring-red-500 focus:border-red-500',
                    errors.email && 'border-red-500 focus:ring-red-500'
                  )}
                  placeholder="name@laxmi.com"
                  disabled={isLoading}
                />
              </div>
              {errors.email && (
                <p className="mt-1 text-xs text-red-600 font-medium">{errors.email.message}</p>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="password" className="block text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-slate-300">
                  Password
                </label>
                <Link
                  to="/forgot-password"
                  className="text-xs font-semibold text-red-600 hover:text-red-700 dark:text-red-400"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <LockClosedIcon className="h-5 w-5 text-red-500" />
                </div>
                <input
                  {...register('password')}
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  className={cn(
                    'input pl-10 pr-10 bg-gray-50/50 dark:bg-slate-800/50 border-gray-200 dark:border-slate-700 focus:ring-red-500 focus:border-red-500',
                    errors.password && 'border-red-500 focus:ring-red-500'
                  )}
                  placeholder="••••••••"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeSlashIcon className="h-5 w-5" />
                  ) : (
                    <EyeIcon className="h-5 w-5" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1 text-xs text-red-600 font-medium">{errors.password.message}</p>
              )}
            </div>

            {showMFA && (
              <div>
                <label htmlFor="mfaCode" className="block text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-slate-300 mb-1">
                  MFA Verification Code
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <ShieldCheckIcon className="h-5 w-5 text-red-500" />
                  </div>
                  <input
                    {...register('mfaCode')}
                    id="mfaCode"
                    type="text"
                    autoComplete="one-time-code"
                    className={cn(
                      'input pl-10 text-center tracking-widest font-mono text-base bg-gray-50/50 dark:bg-slate-800/50',
                      errors.mfaCode && 'border-red-500'
                    )}
                    placeholder="000000"
                    maxLength={6}
                    disabled={isLoading}
                  />
                </div>
                {errors.mfaCode && (
                  <p className="mt-1 text-xs text-red-600 font-medium">{errors.mfaCode.message}</p>
                )}
              </div>
            )}

            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center cursor-pointer select-none">
                <input
                  {...register('rememberMe')}
                  type="checkbox"
                  className="h-4 w-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
                />
                <span className="ml-2 text-xs font-medium text-gray-600 dark:text-slate-400">
                  Keep me signed in
                </span>
              </label>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-700 hover:to-rose-800 text-white font-bold py-3 px-4 rounded-xl shadow-lg shadow-red-600/30 transition-all duration-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Authenticating...
                </span>
              ) : (
                'Sign In to IT Portal'
              )}
            </button>
          </form>
        </div>

        {/* Footer info */}
        <p className="text-center text-xs text-red-200/80">
          © {new Date().getFullYear()} Laxmi India Finance Ltd. All rights reserved.
        </p>
      </div>
    </div>
  );
}