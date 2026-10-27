import React, { useState, useEffect } from 'react';
import {
  FingerPrintIcon,
  ShieldCheckIcon,
  BackspaceIcon,
  KeyIcon,
  LockClosedIcon,
  CheckCircleIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Capacitor } from '@capacitor/core';
import biometricService, { BiometricInfo, SavedUserProfile } from '@services/biometric.service';
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
    <div className="w-full max-w-xs mx-auto space-y-6">
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
            className="h-16 rounded-2xl bg-white/10 hover:bg-white/20 active:bg-white/30 backdrop-blur-md text-white font-semibold text-2xl transition-all shadow-xs flex items-center justify-center border border-white/10 active:scale-95 disabled:opacity-50"
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
            className="h-16 rounded-2xl bg-rose-600/30 hover:bg-rose-600/40 active:bg-rose-600/50 backdrop-blur-md text-rose-300 transition-all flex flex-col items-center justify-center border border-rose-500/30 active:scale-95 disabled:opacity-50"
            title={`Unlock with ${biometryLabel}`}
          >
            <FingerPrintIcon className="w-7 h-7" />
            <span className="text-[10px] font-medium tracking-tight mt-0.5">
              {biometryLabel.includes('Face') ? 'Face ID' : 'Biometric'}
            </span>
          </button>
        ) : (
          <div className="h-16" />
        )}

        {/* 0 Button */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => handleDigit('0')}
          className="h-16 rounded-2xl bg-white/10 hover:bg-white/20 active:bg-white/30 backdrop-blur-md text-white font-semibold text-2xl transition-all shadow-xs flex items-center justify-center border border-white/10 active:scale-95 disabled:opacity-50"
        >
          0
        </button>

        {/* Backspace Button */}
        <button
          type="button"
          disabled={disabled || pin.length === 0}
          onClick={handleBackspace}
          className="h-16 rounded-2xl bg-white/5 hover:bg-white/15 active:bg-white/25 backdrop-blur-md text-white/70 hover:text-white transition-all flex items-center justify-center border border-white/5 active:scale-95 disabled:opacity-30"
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
  const [step, setStep] = useState<'create' | 'confirm'>('create');
  const [enableBiometric, setEnableBiometric] = useState(true);
  const [bioInfo, setBioInfo] = useState<BiometricInfo | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      biometricService.getBiometricInfo().then(setBioInfo);
      setPin('');
      setConfirmPin('');
      setStep('create');
      setEnableBiometric(true);
    }
  }, [isOpen]);

  if (!isOpen) return null;

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
      // Test biometric verification if enabled and native
      if (enableBiometric && bioInfo?.isAvailable && Capacitor.isNativePlatform()) {
        const verified = await biometricService.verifyBiometric('Verify biometrics to link to your account');
        if (!verified) {
          toast('Biometric test cancelled, saving PIN only', { icon: 'ℹ️' });
        }
      }

      await biometricService.enableBiometricAndPin({
        employeeId,
        password,
        userName,
        enableBiometric,
        pin: entered,
      });

      toast.success('Quick PIN & Biometrics configured successfully!');
      onSuccess();
    } catch (err) {
      toast.error('Failed to configure quick access.');
    } finally {
      setSaving(false);
    }
  };

  const biometryText = bioInfo?.biometryLabel || 'Face ID / Fingerprint';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-sm rounded-3xl bg-gradient-to-b from-gray-900 via-gray-900 to-slate-950 p-6 text-white shadow-2xl border border-white/10 space-y-5">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-white/50 hover:text-white p-1 rounded-full hover:bg-white/10"
        >
          <XMarkIcon className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="text-center space-y-2">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-600/20 text-rose-400 border border-rose-500/30 shadow-inner">
            <FingerPrintIcon className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-white">
            {step === 'create' ? 'Set 4-Digit Quick PIN' : 'Confirm Your 4-Digit PIN'}
          </h3>
          <p className="text-xs text-gray-300">
            {step === 'create'
              ? `Log in quickly next time with your PIN or ${biometryText}.`
              : 'Re-enter your 4 digits to confirm.'}
          </p>
        </div>

        {/* Biometric Toggle (only on first step) */}
        {step === 'create' && bioInfo?.isAvailable && (
          <label className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10 cursor-pointer select-none">
            <div className="flex items-center gap-2.5">
              <span className="text-lg">
                {bioInfo.biometryLabel.includes('Face') ? '👤' : '👆'}
              </span>
              <div>
                <div className="text-xs font-semibold text-white">
                  Enable {bioInfo.biometryLabel}
                </div>
                <div className="text-[11px] text-gray-400">
                  Instant 1-tap unlock with face or finger
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
        )}

        {/* Keypad */}
        {step === 'create' ? (
          <QuickPinKeypad
            pin={pin}
            onChange={setPin}
            onComplete={handleCreateComplete}
            disabled={saving}
          />
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
                ← Back to set new PIN
              </button>
            </div>
          </div>
        )}

        {/* Skip Button */}
        <div className="pt-2 text-center">
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-gray-400 hover:text-white py-1.5 transition-colors"
          >
            Skip for now (I will use password)
          </button>
        </div>
      </div>
    </div>
  );
}
