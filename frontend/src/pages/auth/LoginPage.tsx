import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { 
  IdentificationIcon,
  EnvelopeIcon, 
  LockClosedIcon, 
  EyeIcon, 
  EyeSlashIcon, 
  ShieldCheckIcon, 
  ExclamationTriangleIcon,
  InformationCircleIcon,
  UserPlusIcon,
  FingerPrintIcon,
  KeyIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '@context/AuthContext';
import toast from 'react-hot-toast';
import { cn } from '@utils/helpers';
import biometricService, { BiometricInfo, SavedUserProfile } from '@services/biometric.service';
import { QuickPinKeypad, BiometricSetupModal } from '@components/auth/BiometricQuickAuth';
import { Capacitor } from '@capacitor/core';

const loginSchema = z.object({
  employeeId: z.string().min(1, 'Employee ID is required'),
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
  const [accountNotCreated, setAccountNotCreated] = useState<boolean>(false);

  // Quick Biometric & PIN Login State
  const [savedProfile, setSavedProfile] = useState<SavedUserProfile | null>(null);
  const [bioInfo, setBioInfo] = useState<BiometricInfo | null>(null);
  const [loginMode, setLoginMode] = useState<'quick' | 'password'>('password');
  const [quickPin, setQuickPin] = useState('');
  const [setupModalOpen, setSetupModalOpen] = useState(false);
  const [tempCredentials, setTempCredentials] = useState<{ employeeId: string; password: string } | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { rememberMe: true },
  });

  // Check saved profile and biometrics on load
  useEffect(() => {
    const profile = biometricService.getSavedProfile();
    setSavedProfile(profile);
    biometricService.getBiometricInfo().then(setBioInfo);

    if (profile && (profile.biometricEnabled || profile.hasPin)) {
      setLoginMode('quick');
      // If biometric enabled on native phone, prompt automatically after a smooth delay
      if (profile.biometricEnabled && Capacitor.isNativePlatform()) {
        const timer = setTimeout(() => {
          handleBiometricUnlock();
        }, 400);
        return () => clearTimeout(timer);
      }
    }
  }, []);

  // Biometric Unlock (Face ID / Fingerprint)
  const handleBiometricUnlock = async () => {
    setIsLoading(true);
    setLoginError(null);
    try {
      const creds = await biometricService.loginWithBiometrics();
      if (!creds) {
        setIsLoading(false);
        return;
      }
      await login(creds.employeeId, creds.password, undefined, true);
      toast.success(`Welcome back, ${savedProfile?.userName || creds.employeeId}!`);
      navigate('/');
    } catch (err: any) {
      console.warn('Biometric login failed:', err);
      toast.error('Biometric authentication failed. Please enter your PIN or password.');
    } finally {
      setIsLoading(false);
    }
  };

  // Quick PIN Complete
  const handlePinComplete = async (enteredPin: string) => {
    setIsLoading(true);
    setLoginError(null);
    try {
      const creds = await biometricService.loginWithPin(enteredPin);
      if (!creds) {
        setQuickPin('');
        toast.error('Incorrect PIN. Please try again.');
        setIsLoading(false);
        return;
      }
      await login(creds.employeeId, creds.password, undefined, true);
      toast.success(`Welcome back, ${savedProfile?.userName || creds.employeeId}!`);
      navigate('/');
    } catch (err: any) {
      setQuickPin('');
      toast.error('PIN login failed. Please try again or use your password.');
    } finally {
      setIsLoading(false);
    }
  };

  const onSubmit = async (data: LoginForm) => {
    setIsLoading(true);
    setLoginError(null);
    setAccountNotCreated(false);
    try {
      await login(data.employeeId, data.password, data.mfaCode, data.rememberMe);
      toast.success('Welcome back to Laxmi India Finance IT Portal');

      // Check if user has biometric or PIN configured already
      const profile = biometricService.getSavedProfile();
      if (!profile || (!profile.biometricEnabled && !profile.hasPin)) {
        setTempCredentials({ employeeId: data.employeeId, password: data.password });
        setSetupModalOpen(true);
      } else {
        navigate('/');
      }
    } catch (error: any) {
      if (error.message === 'MFA_REQUIRED') {
        setShowMFA(true);
        setValue('mfaCode', '');
      } else {
        const errorData = error.response?.data;
        let errorMsg = errorData?.error || errorData?.message || error.message || 'Login failed. Please check your credentials.';
        
        // Sanitize raw technical JavaScript engine errors
        if (typeof errorMsg === 'string' && (errorMsg.includes('destructure') || errorMsg.includes('undefined') || errorMsg.includes('null'))) {
          errorMsg = 'Unable to establish user session. Please verify your credentials and network connection.';
        }

        const isNotCreated = 
          errorData?.code === 'ACCOUNT_NOT_FOUND' || 
          error.response?.status === 404 ||
          errorMsg.toLowerCase().includes('not been created') || 
          errorMsg.toLowerCase().includes('account not found') ||
          errorMsg.toLowerCase().includes('id has not');

        if (isNotCreated) {
          setAccountNotCreated(true);
          setLoginError('Your corporate account / ID has not been created in the system yet. Please contact your IT Administrator or HR Department to create your profile.');
          toast.error('Account ID not registered yet');
        } else {
          setAccountNotCreated(false);
          setLoginError(errorMsg);
          toast.error(errorMsg);
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  const biometryTitle = savedProfile?.biometryLabel || bioInfo?.biometryLabel || 'Face ID / Fingerprint';

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-900 via-red-800 to-rose-950 px-4 py-8 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-red-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-rose-600/20 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-md w-full space-y-5 relative z-10">
        {/* Brand Header */}
        <div className="text-center space-y-2.5">
          <div className="inline-flex p-1.5 bg-white/10 rounded-2xl backdrop-blur-md border border-white/20 shadow-xl">
            <img
              src="/logo.jpg"
              alt="Laxmi India Finance Ltd"
              className="h-14 w-14 sm:h-16 sm:w-16 rounded-xl object-cover border-2 border-white shadow-md"
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

        {/* ============================================================== */}
        {/* MODE 1: QUICK ACCESS (BIOMETRIC / FACE ID / FINGERPRINT / PIN) */}
        {/* ============================================================== */}
        {loginMode === 'quick' && savedProfile ? (
          <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl p-6 sm:p-8 rounded-3xl shadow-2xl border border-white/20 space-y-5 animate-fadeIn">
            <div className="text-center space-y-2 border-b border-gray-100 dark:border-slate-800 pb-4">
              <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-rose-600 to-red-500 text-white font-bold text-xl shadow-lg shadow-rose-600/30">
                {savedProfile.userName ? savedProfile.userName.charAt(0).toUpperCase() : '👤'}
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                  Welcome back{savedProfile.userName ? `, ${savedProfile.userName}` : ''}
                </h2>
                <p className="text-xs text-gray-500 dark:text-slate-400">
                  ID: <span className="font-semibold text-gray-700 dark:text-gray-300">{savedProfile.employeeId}</span>
                </p>
              </div>
            </div>

            {/* Biometric Instant Button */}
            {savedProfile.biometricEnabled && (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={handleBiometricUnlock}
                  disabled={isLoading}
                  className="w-full inline-flex items-center justify-center gap-2.5 py-3.5 px-4 rounded-2xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 text-white font-bold text-sm shadow-lg shadow-rose-600/30 active:scale-98 transition-all disabled:opacity-50"
                >
                  <FingerPrintIcon className="w-5 h-5 text-rose-200" />
                  <span>Unlock with {biometryTitle}</span>
                </button>
              </div>
            )}

            {/* Quick PIN Keypad */}
            {savedProfile.hasPin && (
              <div className="space-y-3 pt-2">
                <div className="text-center">
                  <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                    {savedProfile.biometricEnabled ? 'Or enter 4-digit Quick PIN' : 'Enter 4-digit Quick PIN'}
                  </span>
                </div>
                <div className="p-3 rounded-2xl bg-gray-900 text-white shadow-inner">
                  <QuickPinKeypad
                    pin={quickPin}
                    onChange={setQuickPin}
                    onComplete={handlePinComplete}
                    onBiometricClick={savedProfile.biometricEnabled ? handleBiometricUnlock : undefined}
                    biometryLabel={biometryTitle}
                    disabled={isLoading}
                  />
                </div>
              </div>
            )}

            {/* Switch to Password or Reset Options */}
            <div className="pt-2 border-t border-gray-100 dark:border-slate-800 flex flex-col items-center gap-2 text-xs">
              <button
                type="button"
                onClick={() => setLoginMode('password')}
                className="text-rose-600 dark:text-rose-400 font-semibold hover:underline inline-flex items-center gap-1.5 py-1"
              >
                <KeyIcon className="w-4 h-4" />
                <span>Log in with Corporate Password</span>
              </button>
              <button
                type="button"
                onClick={async () => {
                  await biometricService.clearBiometricsAndPin();
                  setSavedProfile(null);
                  setLoginMode('password');
                  toast.success('Quick login reset. Please log in with password.');
                }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-[11px]"
              >
                Reset PIN / Switch user
              </button>
            </div>
          </div>
        ) : (
          /* ============================================================== */
          /* MODE 2: STANDARD CORPORATE ID & PASSWORD LOGIN               */
          /* ============================================================== */
          <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl p-6 sm:p-8 rounded-3xl shadow-2xl border border-white/20 space-y-5 animate-fadeIn">
            <div className="border-b border-gray-100 dark:border-slate-800 pb-3 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Sign in to your account</h2>
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                  Enter your Employee ID and password to access the portal
                </p>
              </div>
              {savedProfile && (
                <button
                  type="button"
                  onClick={() => setLoginMode('quick')}
                  className="btn-secondary btn-xs text-xs text-rose-600 border-rose-200 dark:border-rose-900 shrink-0 inline-flex items-center gap-1"
                >
                  <FingerPrintIcon className="w-3.5 h-3.5" />
                  <span>Quick PIN</span>
                </button>
              )}
            </div>

            {accountNotCreated ? (
              <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-300 dark:border-amber-800/80 shadow-sm space-y-3">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 shrink-0 mt-0.5">
                    <UserPlusIcon className="w-5 h-5" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-amber-900 dark:text-amber-200">
                      Account ID Not Registered
                    </h3>
                    <p className="text-xs text-amber-800/90 dark:text-amber-300/90 leading-relaxed font-medium">
                      Your Employee ID has not been created on the Laxmi Samadhan portal yet.
                    </p>
                  </div>
                </div>
                <div className="bg-white/90 dark:bg-slate-900/90 rounded-xl p-3 border border-amber-200 dark:border-amber-900/50 text-xs space-y-2">
                  <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <InformationCircleIcon className="w-4 h-4 text-amber-600" />
                    <span>How to get your account created:</span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 pl-1 leading-relaxed">
                    Please reach out to your <strong>HR Department</strong> or <strong>IT Helpdesk Administrator</strong> with your official employee code to have your portal access provisioned.
                  </p>
                  <div className="pt-1">
                    <a
                      href="mailto:it@laxmi.com?subject=Account%20Creation%20Request%20-%20Laxmi%20Samadhan"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white font-semibold text-xs shadow-sm transition-all"
                    >
                      <EnvelopeIcon className="w-3.5 h-3.5" />
                      Contact IT Helpdesk
                    </a>
                  </div>
                </div>
              </div>
            ) : loginError ? (
              <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 flex items-start gap-3">
                <ExclamationTriangleIcon className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                <div className="text-xs text-red-700 dark:text-red-300 leading-relaxed font-medium">
                  {loginError}
                </div>
              </div>
            ) : null}

            <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
              <div>
                <label htmlFor="employeeId" className="block text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-slate-300 mb-1">
                  Employee ID
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <IdentificationIcon className="h-5 w-5 text-red-500" />
                  </div>
                  <input
                    {...register('employeeId')}
                    id="employeeId"
                    type="text"
                    autoComplete="username"
                    className={cn(
                      'input pl-10 bg-gray-50/50 dark:bg-slate-800/50 border-gray-200 dark:border-slate-700 focus:ring-red-500 focus:border-red-500',
                      errors.employeeId && 'border-red-500 focus:ring-red-500'
                    )}
                    placeholder="e.g. LIF10234"
                    disabled={isLoading}
                  />
                </div>
                {errors.employeeId && (
                  <p className="mt-1 text-xs text-red-600 font-medium">{errors.employeeId.message}</p>
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
                    <ArrowPathIcon className="w-5 h-5 animate-spin" />
                    Authenticating...
                  </span>
                ) : (
                  'Sign In to IT Portal'
                )}
              </button>
            </form>

            <div className="pt-2 border-t border-gray-100 dark:border-slate-800 text-center">
              <p className="text-xs text-gray-500 dark:text-slate-400">
                Don't have an ID yet? Accounts are provisioned by IT & HR Administration.{' '}
                <a
                  href="mailto:it@laxmi.com?subject=New%20User%20Access%20Request%20-%20Laxmi%20Samadhan"
                  className="font-semibold text-red-600 hover:text-red-700 dark:text-red-400 inline-flex items-center gap-1"
                >
                  Request Access
                </a>
              </p>
            </div>
          </div>
        )}

        {/* Footer info */}
        <p className="text-center text-xs text-red-200/80">
          © {new Date().getFullYear()} Laxmi India Finance Ltd. All rights reserved.
        </p>
      </div>

      {/* Biometric & Quick PIN Setup Modal */}
      {tempCredentials && (
        <BiometricSetupModal
          isOpen={setupModalOpen}
          onClose={() => {
            setSetupModalOpen(false);
            navigate('/');
          }}
          onSuccess={() => {
            setSetupModalOpen(false);
            navigate('/');
          }}
          employeeId={tempCredentials.employeeId}
          password={tempCredentials.password}
        />
      )}
    </div>
  );
}
