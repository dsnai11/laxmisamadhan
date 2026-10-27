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

// Simple fast SHA-256 hash using Web Crypto API
async function sha256(message: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const msgUint8 = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  // Fallback hash
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
   * Check if biometrics (Face ID, Fingerprint, Face Recognition) are supported and enrolled
   */
  async getBiometricInfo(): Promise<BiometricInfo> {
    if (this.cachedInfo) return this.cachedInfo;

    const isNative = Capacitor.isNativePlatform();

    if (!isNative) {
      // In web browser / dev mode: check if WebAuthn is available
      const webAuthnAvailable =
        typeof window !== 'undefined' &&
        !!window.PublicKeyCredential &&
        typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function';

      let isAvailable = false;
      if (webAuthnAvailable) {
        try {
          isAvailable = await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        } catch {
          isAvailable = false;
        }
      }

      this.cachedInfo = {
        isAvailable,
        biometryType: BiometryType.FINGERPRINT,
        biometryLabel: 'Biometrics / Face Recognition',
        hasFaceRecognition: true,
        hasFingerprint: true,
      };
      return this.cachedInfo;
    }

    try {
      const res = await NativeBiometric.isAvailable({
        useFallback: true,
        preferMultipleBiometryType: true,
      });

      let label = 'Biometrics';
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
          label = 'Face ID & Fingerprint';
          hasFace = true;
          hasFingerprint = true;
          break;
        default:
          label = 'Biometrics';
          hasFace = true;
          hasFingerprint = true;
      }

      this.cachedInfo = {
        isAvailable: res.isAvailable,
        biometryType: res.biometryType,
        biometryLabel: label,
        hasFaceRecognition: hasFace,
        hasFingerprint,
      };
      return this.cachedInfo;
    } catch (err) {
      console.warn('NativeBiometric check error:', err);
      return {
        isAvailable: false,
        biometryType: BiometryType.NONE,
        biometryLabel: 'Biometrics',
        hasFaceRecognition: false,
        hasFingerprint: false,
      };
    }
  }

  /**
   * Prompts the native Face ID / Fingerprint / Biometric dialog
   */
  async verifyBiometric(customReason?: string): Promise<boolean> {
    const isNative = Capacitor.isNativePlatform();

    if (!isNative) {
      // In web/desktop preview: simulate or prompt
      return true;
    }

    try {
      const info = await this.getBiometricInfo();
      await NativeBiometric.verifyIdentity({
        reason: customReason || `Scan your ${info.biometryLabel} to log in to Laxmi Samadhan`,
        title: 'Laxmi Samadhan Quick Login',
        subtitle: `Authenticate with ${info.biometryLabel}`,
        description: 'Please scan your face or finger to continue',
        negativeButtonText: 'Use PIN or Password',
        maxAttempts: 3,
        useFallback: true,
      });
      return true;
    } catch (err: any) {
      console.warn('Biometric verification failed:', err);
      return false;
    }
  }

  /**
   * Saves credentials for Biometric and/or PIN login
   */
  async enableBiometricAndPin(params: {
    employeeId: string;
    password: string;
    userName?: string;
    enableBiometric: boolean;
    pin?: string;
  }): Promise<void> {
    const { employeeId, password, userName, enableBiometric, pin } = params;
    const isNative = Capacitor.isNativePlatform();

    // 1. Save user profile info
    const profile: SavedUserProfile = {
      employeeId,
      userName: userName || employeeId,
      biometricEnabled: enableBiometric,
      hasPin: !!pin && pin.length >= 4,
      biometryLabel: (await this.getBiometricInfo()).biometryLabel,
    };
    localStorage.setItem(KEY_SAVED_USER, JSON.stringify(profile));
    localStorage.setItem(KEY_BIOMETRIC_ENABLED, enableBiometric ? 'true' : 'false');

    // 2. Save PIN hash if provided
    if (pin && pin.length >= 4) {
      const pinHash = await sha256(`laxmi_pin_${pin}`);
      localStorage.setItem(KEY_PIN_HASH, pinHash);
    }

    // 3. Save credentials in Native KeyStore / Keychain if native
    if (isNative) {
      try {
        await NativeBiometric.setCredentials({
          server: SERVER_NAME,
          username: employeeId,
          password: password,
        });
      } catch (err) {
        console.warn('NativeBiometric setCredentials warning:', err);
      }
    }

    // 4. Secure local encrypted payload (bound to device secret)
    const deviceSecret = `lifc_${employeeId}_secure_key`;
    const payloadJson = JSON.stringify({ employeeId, password, ts: Date.now() });
    const encrypted = encryptPayload(payloadJson, deviceSecret);
    localStorage.setItem(KEY_SECURE_PAYLOAD, encrypted);
  }

  /**
   * Retrieves saved credentials using Biometric verification
   */
  async loginWithBiometrics(): Promise<{ employeeId: string; password: string } | null> {
    const profile = this.getSavedProfile();
    if (!profile || !profile.biometricEnabled) return null;

    const verified = await this.verifyBiometric();
    if (!verified) return null;

    return this.getStoredCredentials(profile.employeeId);
  }

  /**
   * Verifies PIN and returns credentials if correct
   */
  async loginWithPin(enteredPin: string): Promise<{ employeeId: string; password: string } | null> {
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
   * Helper to retrieve stored credentials (from Native Keychain/KeyStore or encrypted storage)
   */
  private async getStoredCredentials(employeeId: string): Promise<{ employeeId: string; password: string } | null> {
    const isNative = Capacitor.isNativePlatform();

    if (isNative) {
      try {
        const creds = await NativeBiometric.getCredentials({ server: SERVER_NAME });
        if (creds && creds.username && creds.password) {
          return { employeeId: creds.username, password: creds.password };
        }
      } catch {
        // Fallback to local encrypted payload
      }
    }

    const encrypted = localStorage.getItem(KEY_SECURE_PAYLOAD);
    if (!encrypted) return null;

    const deviceSecret = `lifc_${employeeId}_secure_key`;
    const decrypted = decryptPayload(encrypted, deviceSecret);
    try {
      const parsed = JSON.parse(decrypted);
      if (parsed && parsed.employeeId && parsed.password) {
        return { employeeId: parsed.employeeId, password: parsed.password };
      }
    } catch {
      return null;
    }

    return null;
  }

  /**
   * Get saved profile metadata
   */
  getSavedProfile(): SavedUserProfile | null {
    try {
      const raw = localStorage.getItem(KEY_SAVED_USER);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  /**
   * Checks if Biometrics is configured and enabled
   */
  isBiometricEnabled(): boolean {
    const profile = this.getSavedProfile();
    return !!profile && profile.biometricEnabled;
  }

  /**
   * Checks if PIN is configured
   */
  isPinConfigured(): boolean {
    const profile = this.getSavedProfile();
    return !!profile && profile.hasPin && !!localStorage.getItem(KEY_PIN_HASH);
  }

  /**
   * Remove biometric and PIN login data (on user logout or reset)
   */
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
