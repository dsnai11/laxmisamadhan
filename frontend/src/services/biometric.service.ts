import { NativeBiometric, BiometryType } from '@capgo/capacitor-native-biometric';
import { Capacitor } from '@capacitor/core';

const SERVER_NAME = 'in.lifc.laxmisamadhan';
const STORAGE_PREFIX = 'laxmi_biometric_';
const KEY_BIOMETRIC_ENABLED = `${STORAGE_PREFIX}enabled`;
const KEY_PIN_HASH = `${STORAGE_PREFIX}pin_hash`;
const KEY_SAVED_USER = `${STORAGE_PREFIX}saved_user`;
const KEY_SECURE_PAYLOAD = `${STORAGE_PREFIX}payload`;

export interface BiometricInfo {
  isAvailable: boolean;
  biometryType: BiometryType;
  biometryLabel: string;
  hasFaceRecognition: boolean;
  hasFingerprint: boolean;
}

export interface SavedUserProfile {
  employeeId: string;
  userName?: string;
  biometricEnabled: boolean;
  hasPin: boolean;
  biometryLabel: string;
}

export interface UnlockedCredentials {
  employeeId: string;
  password?: string;
  accessToken?: string;
  refreshToken?: string;
}

// Fast SHA-256 hash
async function sha256(message: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const msgUint8 = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  let hash = 0;
  for (let i = 0; i < message.length; i++) {
    const char = message.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return String(hash);
}

// Obfuscate / encrypt local fallback payload
function encryptPayload(data: string, secret: string): string {
  try {
    const textChars = Array.from(data);
    const secretChars = Array.from(secret);
    const result = textChars.map((c, i) =>
      String.fromCharCode(c.charCodeAt(0) ^ secretChars[i % secretChars.length].charCodeAt(0))
    );
    return btoa(unescape(encodeURIComponent(result.join(''))));
  } catch {
    return btoa(data);
  }
}

function decryptPayload(data: string, secret: string): string {
  try {
    const decoded = decodeURIComponent(escape(atob(data)));
    const textChars = Array.from(decoded);
    const secretChars = Array.from(secret);
    const result = textChars.map((c, i) =>
      String.fromCharCode(c.charCodeAt(0) ^ secretChars[i % secretChars.length].charCodeAt(0))
    );
    return result.join('');
  } catch {
    try {
      return atob(data);
    } catch {
      return '';
    }
  }
}

class BiometricService {
  private cachedInfo: BiometricInfo | null = null;

  /**
   * Check if biometrics (Face ID, Fingerprint, Face Recognition) are supported
   */
  async getBiometricInfo(): Promise<BiometricInfo> {
    if (this.cachedInfo) return this.cachedInfo;

    const isNative = Capacitor.isNativePlatform();
    const platform = Capacitor.getPlatform();

    if (!isNative) {
      this.cachedInfo = {
        isAvailable: true,
        biometryType: BiometryType.MULTIPLE,
        biometryLabel: 'Face ID & Fingerprint',
        hasFaceRecognition: true,
        hasFingerprint: true,
      };
      return this.cachedInfo;
    }

    try {
      const res = await NativeBiometric.isAvailable({
        useFallback: platform === 'ios',
        preferMultipleBiometryType: true,
      });

      let label = platform === 'ios' ? 'Face ID' : 'Fingerprint & Face Lock';
      let hasFace = false;
      let hasFingerprint = false;

      switch (res.biometryType) {
        case BiometryType.FACE_ID:
          label = 'Face ID';
          hasFace = true;
          break;
        case BiometryType.TOUCH_ID:
          label = 'Touch ID';
          hasFingerprint = true;
          break;
        case BiometryType.FINGERPRINT:
          label = 'Fingerprint';
          hasFingerprint = true;
          break;
        case BiometryType.FACE_AUTHENTICATION:
          label = 'Face Recognition';
          hasFace = true;
          break;
        case BiometryType.MULTIPLE:
          label = platform === 'ios' ? 'Face ID' : 'Fingerprint & Face Lock';
          hasFace = true;
          hasFingerprint = true;
          break;
        default:
          label = platform === 'ios' ? 'Face ID / Touch ID' : 'Fingerprint / Face Lock';
          hasFace = true;
          hasFingerprint = true;
      }

      this.cachedInfo = {
        isAvailable: res.isAvailable !== false,
        biometryType: res.biometryType || BiometryType.MULTIPLE,
        biometryLabel: label,
        hasFaceRecognition: hasFace || label.includes('Face'),
        hasFingerprint: hasFingerprint || label.includes('Fingerprint') || label.includes('Touch'),
      };
      return this.cachedInfo;
    } catch (err) {
      console.warn('NativeBiometric check error:', err);
      return {
        isAvailable: true,
        biometryType: BiometryType.MULTIPLE,
        biometryLabel: platform === 'ios' ? 'Face ID / Touch ID' : 'Fingerprint / Face Lock',
        hasFaceRecognition: true,
        hasFingerprint: true,
      };
    }
  }

  /**
   * Prompts the native Face ID / Fingerprint / Biometric dialog
   */
  async verifyBiometric(customReason?: string): Promise<boolean> {
    const isNative = Capacitor.isNativePlatform();
    if (!isNative) return true;

    const isIOS = Capacitor.getPlatform() === 'ios';
    const info = await this.getBiometricInfo();

    try {
      await NativeBiometric.verifyIdentity({
        reason: customReason || `Scan your ${info.biometryLabel} to log in to Laxmi Samadhan`,
        title: 'Laxmi Samadhan Quick Login',
        subtitle: `Authenticate with ${info.biometryLabel}`,
        description: 'Please scan your face or finger to continue',
        negativeButtonText: 'Use PIN or Password',
        maxAttempts: 3,
        useFallback: isIOS,
      });
      return true;
    } catch (err: any) {
      console.warn('Biometric verification error:', err);
      return false;
    }
  }

  /**
   * Saves credentials and tokens for Biometric and/or PIN login
   */
  async enableBiometricAndPin(params: {
    employeeId: string;
    password?: string;
    userName?: string;
    enableBiometric: boolean;
    pin?: string;
  }): Promise<void> {
    const { employeeId, password, userName, enableBiometric, pin } = params;
    const isNative = Capacitor.isNativePlatform();

    // 1. Save user profile info (preserve existing PIN/settings if not overriding)
    const existing = this.getSavedProfile();
    const info = await this.getBiometricInfo();
    const hasPin = (!!pin && pin.length >= 4) || (existing?.hasPin && !!localStorage.getItem(KEY_PIN_HASH));
    const profile: SavedUserProfile = {
      employeeId,
      userName: userName || existing?.userName || employeeId,
      biometricEnabled: enableBiometric,
      hasPin: !!hasPin,
      biometryLabel: info.biometryLabel,
    };
    localStorage.setItem(KEY_SAVED_USER, JSON.stringify(profile));
    localStorage.setItem(KEY_BIOMETRIC_ENABLED, enableBiometric ? 'true' : 'false');

    // 2. Save PIN hash if provided
    if (pin && pin.length >= 4) {
      const pinHash = await sha256(`laxmi_pin_${pin}`);
      localStorage.setItem(KEY_PIN_HASH, pinHash);
    }

    // 3. Save accessToken & refreshToken so unlock doesn't depend only on raw password
    const accessToken = localStorage.getItem('accessToken') || '';
    const refreshToken = localStorage.getItem('refreshToken') || '';

    // If password provided, save credentials in KeyStore / Keychain
    if (password && password.trim().length > 0) {
      if (isNative) {
        try {
          await NativeBiometric.setCredentials({
            server: SERVER_NAME,
            username: employeeId,
            password: password.trim(),
          });
        } catch (err) {
          console.warn('NativeBiometric setCredentials warning:', err);
        }
      }
    }

    // 4. Secure local encrypted payload (preserve existing stored password if new one is empty)
    const deviceSecret = `lifc_${employeeId}_secure_key`;
    let effectivePassword = (password || '').trim();
    if (!effectivePassword) {
      const existingEncrypted = localStorage.getItem(KEY_SECURE_PAYLOAD);
      if (existingEncrypted) {
        try {
          const dec = decryptPayload(existingEncrypted, deviceSecret);
          const parsed = JSON.parse(dec);
          if (parsed && parsed.password) {
            effectivePassword = parsed.password;
          }
        } catch {
          // ignore
        }
      }
    }

    const payloadJson = JSON.stringify({
      employeeId,
      password: effectivePassword,
      accessToken,
      refreshToken,
      userName: userName || existing?.userName || employeeId,
      ts: Date.now(),
    });
    const encrypted = encryptPayload(payloadJson, deviceSecret);
    localStorage.setItem(KEY_SECURE_PAYLOAD, encrypted);
  }

  /**
   * Retrieves saved credentials using Biometric verification
   */
  async loginWithBiometrics(): Promise<UnlockedCredentials | null> {
    const profile = this.getSavedProfile();
    if (!profile || !profile.biometricEnabled) return null;

    const verified = await this.verifyBiometric();
    if (!verified) return null;

    return this.getStoredCredentials(profile.employeeId);
  }

  /**
   * Verifies PIN and returns credentials if correct
   */
  async loginWithPin(enteredPin: string): Promise<UnlockedCredentials | null> {
    const savedPinHash = localStorage.getItem(KEY_PIN_HASH);
    if (!savedPinHash) return null;

    const enteredHash = await sha256(`laxmi_pin_${enteredPin}`);
    if (enteredHash !== savedPinHash) {
      return null;
    }

    const profile = this.getSavedProfile();
    if (!profile) return null;

    return this.getStoredCredentials(profile.employeeId);
  }

  /**
   * Helper to retrieve stored credentials (Keychain/KeyStore or encrypted payload)
   */
  private async getStoredCredentials(employeeId: string): Promise<UnlockedCredentials | null> {
    const isNative = Capacitor.isNativePlatform();

    let nativePassword = '';
    if (isNative) {
      try {
        const creds = await NativeBiometric.getCredentials({ server: SERVER_NAME });
        if (creds && creds.password) {
          nativePassword = creds.password;
        }
      } catch {
        // ignore
      }
    }

    const encrypted = localStorage.getItem(KEY_SECURE_PAYLOAD);
    if (!encrypted) {
      if (nativePassword) {
        return { employeeId, password: nativePassword };
      }
      return null;
    }

    const deviceSecret = `lifc_${employeeId}_secure_key`;
    const decrypted = decryptPayload(encrypted, deviceSecret);
    try {
      const parsed = JSON.parse(decrypted);
      return {
        employeeId: parsed.employeeId || employeeId,
        password: nativePassword || parsed.password || '',
        accessToken: parsed.accessToken,
        refreshToken: parsed.refreshToken,
      };
    } catch {
      if (nativePassword) {
        return { employeeId, password: nativePassword };
      }
      return null;
    }
  }

  getSavedProfile(): SavedUserProfile | null {
    try {
      const raw = localStorage.getItem(KEY_SAVED_USER);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  isBiometricEnabled(): boolean {
    const profile = this.getSavedProfile();
    return !!profile && profile.biometricEnabled;
  }

  isPinConfigured(): boolean {
    const profile = this.getSavedProfile();
    return !!profile && profile.hasPin && !!localStorage.getItem(KEY_PIN_HASH);
  }

  async clearBiometricsAndPin(): Promise<void> {
    if (Capacitor.isNativePlatform()) {
      try {
        await NativeBiometric.deleteCredentials({ server: SERVER_NAME });
      } catch {
        // ignore
      }
    }
    localStorage.removeItem(KEY_BIOMETRIC_ENABLED);
    localStorage.removeItem(KEY_PIN_HASH);
    localStorage.removeItem(KEY_SAVED_USER);
    localStorage.removeItem(KEY_SECURE_PAYLOAD);
  }
}

export const biometricService = new BiometricService();
export default biometricService;
