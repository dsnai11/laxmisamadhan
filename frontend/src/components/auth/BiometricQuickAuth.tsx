import React, { useState, useEffect } from 'react';
import {
  FingerPrintIcon,
  ShieldCheckIcon,
  BackspaceIcon,
  CheckCircleIcon,
  XMarkIcon,
  EyeIcon,
} from '@heroicons/react/24/outline';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Capacitor } from '@capacitor/core';
import biometricService, { BiometricInfo } from '@services/biometric.service';
import toast from 'react-hot-toast';

// Light haptic feedback helper
const triggerHaptic = async () => {
  if (Capacitor.isNativePlatform()) {
    try {
      await Haptics.impact({ style: ImpactStyle.Light });
    } catch {
      // ignore
    }
  }
};

// ==========================================
// 1. Quick PIN Keypad Component
// ==========================================
interface QuickPinKeypadProps {
  pin: string;
  pinLength?: number;
  onChange: (pin: string) => void;
  onComplete: (pin: string) => void;
  onBiometricClick?: () => void;
  biometryLabel?: string;
  disabled?: boolean;
}

export function QuickPinKeypad({
  pin,
  pinLength = 4,
  onChange,
  onComplete,
  onBiometricClick,
  biometryLabel = 'Face ID / Fingerprint',
  disabled = false,
}: QuickPinKeypadProps) {
  const handleDigit = (digit: string) => {
    if (disabled || pin.length >= pinLength) return;
    triggerHaptic();
    const newPin = pin + digit;
    onChange(newPin);
    if (newPin.length === pinLength) {
      onComplete(newPin);
    }
  };

  const handleBackspace = () => {
    if (disabled || pin.length === 0) return;
    triggerHaptic();
    onChange(pin.slice(0, -1));
  };

  return (
    <div className="w-full max-w-xs mx-auto space-y-5">
      {/* PIN Dots Indicator */}
      <div className="flex justify-center items-center gap-4 py-2">
        {Array.from({ length: pinLength }).map((_, i) => {
          const isFilled = i < pin.length;
          return (
            <div
              key={i}
              className={`w-4 h-4 rounded-full transition-all duration-200 ${
                isFilled
                  ? 'bg-rose-500 scale-110 shadow-sm shadow-rose-500/50'
                  : 'bg-white/20 border border-white/40'
              }`}
            />
          );
        })}
      </div>

      {/* 3x4 Numeric Keypad */}
      <div className="grid grid-cols-3 gap-3">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
          <button
            key={num}
            type="button"
            disabled={disabled}
            onClick={() => handleDigit(String(num))}
            className="h-15 sm:h-16 rounded-2xl bg-white/10 hover:bg-white/20 active:bg-white/30 backdrop-blur-md text-white font-semibold text-2xl transition-all shadow-xs flex items-center justify-center border border-white/10 active:scale-95 disabled:opacity-50"
          >
            {num}
          </button>
        ))}

        {/* Biometric Button */}
        {onBiometricClick ? (
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              triggerHaptic();
              onBiometricClick();
            }}
            className="h-15 sm:h-16 rounded-2xl bg-rose-600/30 hover:bg-rose-600/40 active:bg-rose-600/50 backdrop-blur-md text-rose-300 transition-all flex flex-col items-center justify-center border border-rose-500/30 active:scale-95 disabled:opacity-50"
            title={`Unlock with ${biometryLabel}`}
          >
            <FingerPrintIcon className="w-7 h-7" />
            <span className="text-[10px] font-medium tracking-tight mt-0.5">
              {biometryLabel.includes('Face') ? 'Face ID' : 'Biometric'}
            </span>
          </button>
        ) : (
          <div className="h-15 sm:h-16" />
        )}

        {/* 0 Button */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => handleDigit('0')}
          className="h-15 sm:h-16 rounded-2xl bg-white/10 hover:bg-white/20 active:bg-white/30 backdrop-blur-md text-white font-semibold text-2xl transition-all shadow-xs flex items-center justify-center border border-white/10 active:scale-95 disabled:opacity-50"
        >
          0
        </button>

        {/* Backspace Button */}
        <button
          type="button"
          disabled={disabled || pin.length === 0}
          onClick={handleBackspace}
          className="h-15 sm:h-16 rounded-2xl bg-white/5 hover:bg-white/15 active:bg-white/25 backdrop-blur-md text-white/70 hover:text-white transition-all flex items-center justify-center border border-white/5 active:scale-95 disabled:opacity-30"
          title="Delete"
        >
          <BackspaceIcon className="w-7 h-7" />
        </button>
      </div>
    </div>
  );
}

// ==========================================
// 2. Biometric & Quick PIN Setup Modal
// ==========================================
interface BiometricSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  employeeId: string;
  password?: string;
  userName?: string;
}

export function BiometricSetupModal({
  isOpen,
  onClose,
  onSuccess,
  employeeId,
  password = '',
  userName,
}: BiometricSetupModalProps) {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [accountPassword, setAccountPassword] = useState(password);
  const [showPassword, setShowPassword] = useState(false);
  const [step, setStep] = useState<'create' | 'confirm'>('create');
  const [enableBiometric, setEnableBiometric] = useState(true);
  const [bioInfo, setBioInfo] = useState<BiometricInfo>({
    isAvailable: true,
    biometryType: 6 as any,
    biometryLabel: Capacitor.getPlatform() === 'ios' ? 'Face ID / Touch ID' : 'Fingerprint & Face Recognition',
    hasFaceRecognition: true,
    hasFingerprint: true,
  });
  const [bioVerified, setBioVerified] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      biometricService.getBiometricInfo().then((info) => {
        setBioInfo(info);
      });
      setPin('');
      setConfirmPin('');
      setStep('create');
      setEnableBiometric(true);
      setBioVerified(false);
      setAccountPassword(password || '');
    }
  }, [isOpen, password]);

  if (!isOpen) return null;

  const handleTestBiometric = async () => {
    const verified = await biometricService.verifyBiometric('Verify biometrics to enable quick login');
    if (verified) {
      setBioVerified(true);
      setEnableBiometric(true);
      toast.success('Face ID / Fingerprint verified on this device!');
    } else {
      toast.error('Biometric verification cancelled or not recognized.');
    }
  };

  const handleCreateComplete = (entered: string) => {
    setPin(entered);
    setStep('confirm');
  };

  const handleConfirmComplete = async (entered: string) => {
    if (entered !== pin) {
      toast.error('PINs do not match. Please try again.');
      setConfirmPin('');
      setStep('create');
      setPin('');
      return;
    }

    setSaving(true);
    try {
      await biometricService.enableBiometricAndPin({
        employeeId,
        password: accountPassword || password,
        userName,
        enableBiometric,
        pin: entered,
      });

      toast.success(
        enableBiometric
          ? 'Face ID / Fingerprint & 4-Digit PIN configured successfully!'
          : '4-Digit Quick PIN configured successfully!'
      );
      onSuccess();
    } catch (err) {
      toast.error('Could not save quick access settings.');
    } finally {
      setSaving(false);
    }
  };

  const isIOS = Capacitor.getPlatform() === 'ios';
  const biometryText = isIOS ? 'Face ID / Touch ID' : 'Fingerprint & Face Recognition';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-sm rounded-3xl bg-gradient-to-b from-gray-900 via-gray-900 to-slate-950 p-6 text-white shadow-2xl border border-white/10 space-y-4">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-white/50 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors"
        >
          <XMarkIcon className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="text-center space-y-1.5">
          <div className="mx-auto flex h-13 w-13 items-center justify-center rounded-2xl bg-rose-600/20 text-rose-400 border border-rose-500/30 shadow-inner">
            <FingerPrintIcon className="w-7 h-7" />
          </div>
          <h3 className="text-base sm:text-lg font-bold text-white">
            {step === 'create' ? 'Set Up Quick Access' : 'Confirm Your 4-Digit PIN'}
          </h3>
          <p className="text-xs text-gray-300">
            {step === 'create'
              ? `Fast 1-second login using ${biometryText} or PIN.`
              : 'Re-enter your 4 digits to confirm.'}
          </p>
        </div>

        {/* Biometric Toggle Card (Always visible on first step) */}
        {step === 'create' && (
          <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-2.5">
            <label className="flex items-center justify-between cursor-pointer select-none">
              <div className="flex items-center gap-2.5">
                <span className="text-xl">{isIOS ? '👤' : '👆'}</span>
                <div>
                  <div className="text-xs font-semibold text-white">
                    Enable {biometryText}
                  </div>
                  <div className="text-[11px] text-gray-400">
                    Unlock instantly with your face or fingerprint
                  </div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={enableBiometric}
                onChange={(e) => setEnableBiometric(e.target.checked)}
                className="h-4 w-4 rounded border-gray-600 text-rose-600 focus:ring-rose-500 bg-gray-800"
              />
            </label>

            {enableBiometric && (
              <div className="pt-1 flex items-center justify-between border-t border-white/10 text-xs">
                {bioVerified ? (
                  <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold text-[11px]">
                    <CheckCircleIcon className="w-4 h-4" />
                    <span>Verified on this device</span>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={handleTestBiometric}
                    className="inline-flex items-center gap-1 text-rose-400 hover:text-rose-300 font-medium text-[11px] underline"
                  >
                    <span>Tap to test {isIOS ? 'Face ID' : 'Fingerprint/Face'} now</span>
                  </button>
                )}
                <span className="text-[10px] text-gray-400">Active on next launch</span>
              </div>
            )}
          </div>
        )}

        {/* Corporate Password (optional prompt when setting up from profile) */}
        {step === 'create' && !password && (
          <div className="p-3 rounded-2xl bg-white/5 border border-white/10 space-y-1.5">
            <label className="block text-xs font-semibold text-white">
              Corporate Password (optional)
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={accountPassword}
                onChange={(e) => setAccountPassword(e.target.value)}
                placeholder="Enter password to secure hardware keychain"
                className="w-full px-3 py-1.5 pr-9 text-xs rounded-xl bg-black/40 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-rose-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-2 flex items-center text-gray-400 hover:text-white"
              >
                <EyeIcon className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[10px] text-gray-400">
              Saves credentials in encrypted hardware storage for offline & 1-tap unlock.
            </p>
          </div>
        )}

        {/* Keypad */}
        {step === 'create' ? (
          <div className="space-y-2">
            <div className="text-center">
              <span className="text-xs font-semibold text-gray-300">
                Choose a 4-digit PIN
              </span>
            </div>
            <QuickPinKeypad
              pin={pin}
              onChange={setPin}
              onComplete={handleCreateComplete}
              disabled={saving}
            />
          </div>
        ) : (
          <div className="space-y-4">
            <QuickPinKeypad
              pin={confirmPin}
              onChange={setConfirmPin}
              onComplete={handleConfirmComplete}
              disabled={saving}
            />
            <div className="text-center">
              <button
                type="button"
                onClick={() => {
                  setStep('create');
                  setConfirmPin('');
                  setPin('');
                }}
                className="text-xs text-rose-400 hover:underline"
              >
                ← Back to change PIN
              </button>
            </div>
          </div>
        )}

        {/* Skip Button */}
        <div className="pt-1 text-center">
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-gray-400 hover:text-white py-1 transition-colors"
          >
            Skip for now (I will use password)
          </button>
        </div>
      </div>
    </div>
  );
}
