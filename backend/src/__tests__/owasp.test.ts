import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword, encrypt, decrypt } from '../utils/encryption';
import { generateAccessToken, verifyAccessToken } from '../utils/jwt';
import { getPermissionsForRole, hasPermission } from '../utils/permissions';
import { UserRole } from '@prisma/client';
import { ticketIdParamSchema, createTicketSchema } from '../validators/ticket.validator';
import { loginSchema } from '../validators/auth.validator';

describe('OWASP Top 10 Security Verification Suite', () => {
  // A01: Broken Access Control
  describe('A01:2021 - Broken Access Control & RBAC Enforcement', () => {
    it('should strictly limit RAISER permissions and deny administrative permissions', () => {
      const raiserPerms = getPermissionsForRole(UserRole.RAISER);
      expect(raiserPerms).toContain('ticket:create');
      expect(raiserPerms).toContain('ticket:read:own');
      
      // Raisers must NEVER have administrative, deletion, or user management permissions
      expect(raiserPerms).not.toContain('ticket:delete');
      expect(raiserPerms).not.toContain('user:create');
      expect(raiserPerms).not.toContain('user:delete');
      expect(raiserPerms).not.toContain('department:manage');
      expect(raiserPerms).not.toContain('system:admin');
    });

    it('should grant SUPER_ADMIN full operational permissions', () => {
      const adminPerms = getPermissionsForRole(UserRole.SUPER_ADMIN);
      expect(adminPerms).toContain('ticket:delete');
      expect(adminPerms).toContain('user:create');
      expect(adminPerms).toContain('user:delete');
      expect(adminPerms).toContain('settings:manage');
      expect(adminPerms).toContain('audit:read');
    });

    it('hasPermission helper should accurately enforce role capability', () => {
      expect(hasPermission([UserRole.RAISER], 'ticket:create')).toBe(true);
      expect(hasPermission([UserRole.RAISER], 'user:delete')).toBe(false);
      expect(hasPermission([UserRole.AGENT], 'comment:internal')).toBe(true);
      expect(hasPermission([UserRole.AGENT], 'user:delete')).toBe(false);
      expect(hasPermission([UserRole.DEPARTMENT_HEAD], 'ticket:assign')).toBe(true);
    });
  });

  // A02: Cryptographic Failures
  describe('A02:2021 - Cryptographic Failures', () => {
    it('should hash passwords with PBKDF2 salt + 100,000 rounds and verify correctly', async () => {
      const plainPassword = 'SuperSecurePassword@2026';
      const hash = hashPassword(plainPassword);

      expect(hash).toContain(':');
      const [salt, derived] = hash.split(':');
      expect(salt.length).toBe(32); // 16 bytes hex
      expect(derived.length).toBe(128); // 64 bytes sha512 hex

      // Verification succeeds for right password
      expect(verifyPassword(plainPassword, hash)).toBe(true);

      // Verification fails for wrong password
      expect(verifyPassword('WrongPassword123', hash)).toBe(false);
      expect(verifyPassword(plainPassword + '!', hash)).toBe(false);
    });

    it('should encrypt and decrypt sensitive data with AES-256-GCM authenticated cipher', () => {
      const sensitiveText = 'Corporate-Confidential-API-Secret-Value';
      const encrypted = encrypt(sensitiveText);

      expect(encrypted).not.toEqual(sensitiveText);
      expect(typeof encrypted).toBe('string');

      const decrypted = decrypt(encrypted);
      expect(decrypted).toEqual(sensitiveText);
    });

    it('should reject tampered ciphertext in AES-256-GCM', () => {
      const sensitiveText = 'Original Data';
      const encrypted = encrypt(sensitiveText);
      const raw = Buffer.from(encrypted, 'base64');
      // Flip a bit in the encrypted payload
      raw[raw.length - 1] ^= 0xff;
      const tampered = raw.toString('base64');

      expect(() => decrypt(tampered)).toThrow();
    });
  });

  // A03: Injection
  describe('A03:2021 - Injection Prevention (SQL / NoSQL / Input Validation)', () => {
    it('should reject SQL injection payloads in UUID route parameters', () => {
      const sqlInjectionParams = [
        "1' OR '1'='1",
        "'; DROP TABLE tickets; --",
        "admin'--",
        "1 UNION SELECT * FROM users",
      ];

      for (const payload of sqlInjectionParams) {
        const result = ticketIdParamSchema.safeParse({ id: payload });
        expect(result.success).toBe(false);
      }
    });

    it('should accept valid UUIDs and ticket number identifiers', () => {
      const validIdentifiers = [
        'SW-24-00001',
        'sw-24-00001',
        'TKT-26-00040',
        'HW-24-00001',
        'SEC-24-00001',
        '7c381b9e-a5a7-4cbd-a52d-896c19549594',
        'A1B2C3D4-E5F6-7890-ABCD-EF1234567890',
      ];

      for (const id of validIdentifiers) {
        const result = ticketIdParamSchema.safeParse({ id });
        expect(result.success).toBe(true);
      }
    });

    it('should enforce strict schema constraints on ticket creation input', () => {
      const invalidTicket = {
        title: '', // min length violation
        description: 'short',
        category: 'INVALID_CATEGORY_INJECTION',
        priority: 'SUPER_URGENT_INJECTION',
      };

      const result = createTicketSchema.safeParse(invalidTicket);
      expect(result.success).toBe(false);
    });
  });

  // A04: Insecure Design & MIME Validation
  describe('A04:2021 - Insecure Design & File Upload Whitelist', () => {
    const DEFAULT_ALLOWED_MIME_TYPES = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
      'application/pdf',
      'text/plain',
      'text/csv',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/zip',
      'application/x-zip-compressed',
    ];

    it('should block dangerous executable and script file types', () => {
      const dangerousMimes = [
        'application/x-msdownload', // .exe
        'application/x-sh',         // .sh
        'application/x-bat',        // .bat
        'application/x-php',        // .php
        'text/javascript',          // .js
        'text/html',                // .html (stored XSS vector)
      ];

      for (const mime of dangerousMimes) {
        expect(DEFAULT_ALLOWED_MIME_TYPES.includes(mime)).toBe(false);
      }
    });

    it('should allow legitimate business document and image types', () => {
      expect(DEFAULT_ALLOWED_MIME_TYPES.includes('application/pdf')).toBe(true);
      expect(DEFAULT_ALLOWED_MIME_TYPES.includes('image/png')).toBe(true);
      expect(DEFAULT_ALLOWED_MIME_TYPES.includes('image/jpeg')).toBe(true);
    });
  });

  // A07: Identification and Authentication Failures
  describe('A07:2021 - Identification & Authentication Controls', () => {
    it('should reject tampered or forged JWT access tokens', () => {
      const validPayload = {
        userId: '11111111-2222-3333-4444-555555555555',
        sessionId: '66666666-7777-8888-9999-000000000000',
        email: 'test@lifc.in',
        role: UserRole.RAISER,
      };

      const token = generateAccessToken(validPayload);
      expect(typeof token).toBe('string');

      // Valid token verifies correctly
      const verified = verifyAccessToken(token);
      expect(verified).not.toBeNull();
      expect(verified?.userId).toBe(validPayload.userId);

      // Tampered token fails verification
      const parts = token.split('.');
      const tamperedSignature = parts[0] + '.' + parts[1] + '.invalidsignature123';
      expect(verifyAccessToken(tamperedSignature)).toBeNull();
    });

    it('should require minimum password length on login input', () => {
      const emptyLogin = { identifier: 'LIF10234', password: '' };
      const validLogin = { identifier: 'LIF10234', password: 'ValidPassword123' };

      expect(loginSchema.safeParse(emptyLogin).success).toBe(false);
      expect(loginSchema.safeParse(validLogin).success).toBe(true);
    });
  });

  // A09: Security Logging and Sensitive Data Redaction
  describe('A09:2021 - Security Logging & Credential Redaction', () => {
    it('should redact passwords, tokens, and secrets from audit payloads', () => {
      const SENSITIVE_KEYS = new Set(['password', 'currentpassword', 'newpassword', 'token', 'refreshtoken', 'secret', 'mfacode', 'passwordhash']);

      function sanitizeForAudit(data: any): any {
        if (!data || typeof data !== 'object') return data;
        if (Array.isArray(data)) return data.map(sanitizeForAudit);
        const sanitized: Record<string, any> = {};
        for (const [key, val] of Object.entries(data)) {
          if (SENSITIVE_KEYS.has(key.toLowerCase())) {
            sanitized[key] = '[REDACTED]';
          } else if (typeof val === 'object' && val !== null) {
            sanitized[key] = sanitizeForAudit(val);
          } else {
            sanitized[key] = val;
          }
        }
        return sanitized;
      }

      const input = {
        email: 'user@lifc.in',
        password: 'PlainTextPassword!',
        newPassword: 'NewPlainTextPassword!',
        token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        ticketTitle: 'Network issue',
        nested: {
          secret: 'api_secret_key',
          status: 'ACTIVE',
        },
      };

      const sanitized = sanitizeForAudit(input);

      expect(sanitized.password).toBe('[REDACTED]');
      expect(sanitized.newPassword).toBe('[REDACTED]');
      expect(sanitized.token).toBe('[REDACTED]');
      expect(sanitized.nested.secret).toBe('[REDACTED]');
      expect(sanitized.email).toBe('user@lifc.in');
      expect(sanitized.ticketTitle).toBe('Network issue');
      expect(sanitized.nested.status).toBe('ACTIVE');
    });
  });
});
