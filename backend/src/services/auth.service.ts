import { prisma } from '@config/prisma';
import { hashPassword, verifyPassword, generateToken, encrypt, decrypt } from '@utils/encryption';
import { generateTokenPair, verifyRefreshToken, JWTPayload } from '@utils/jwt';
import { createLogger } from '@utils/logger';
import config from '@config/index';
import emailService from './email.service';
import { authenticator } from 'otplib';
import { UserRole, UserStatus, Prisma } from '@prisma/client';
import { AppError } from '@middleware/error.middleware';

const logger = createLogger('auth-service');

export interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  departmentId?: string;
  role?: UserRole;
}

export interface LoginResult {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    employeeId?: string | null;
    role: UserRole;
    roles?: UserRole[];
    status: UserStatus;
    departmentId: string | null;
    mfaEnabled: boolean;
    avatar: string | null;
  };
  tokens: {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  };
}

export interface TokenPayload {
  userId: string;
  sessionId: string;
}

class AuthService {
  async register(data: RegisterData, createdById?: string): Promise<LoginResult> {
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email.toLowerCase() },
    });

    if (existingUser) {
      throw new Error('Email already registered');
    }

    const passwordHash = await hashPassword(data.password);
    
    const user = await prisma.user.create({
      data: {
        email: data.email.toLowerCase(),
        passwordHash,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        role: data.role || UserRole.RAISER,
        status: UserStatus.ACTIVE,
        departmentId: data.departmentId,
        createdById,
        lastPasswordChange: new Date(),
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
        departmentId: true,
        mfaEnabled: true,
        avatar: true,
      },
    });

    const session = await this.createSession(user.id, 'registration');
    const tokens = generateTokenPair({
      userId: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
      departmentId: user.departmentId || undefined,
      permissions: this.getPermissions(user.role),
      sessionId: session.id,
    });

    emailService.sendWelcomeEmail(user.email, user.firstName, config.frontendUrl).catch(() => undefined);

    logger.info('User registered', { userId: user.id, email: user.email });

    return { user, tokens };
  }

  async login(identifier: string, password: string, mfaCode?: string, rememberMe = false): Promise<LoginResult> {
    const trimmed = (identifier || '').trim();
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { employeeId: { equals: trimmed, mode: 'insensitive' } },
          { email: { equals: trimmed.toLowerCase(), mode: 'insensitive' } },
        ],
      },
    });

    if (!user) {
      await this.handleFailedLogin(trimmed);
      throw new AppError('Your Employee ID has not been created yet. Please contact your IT administrator or HR team to create your account.', 404, 'ACCOUNT_NOT_FOUND');
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new AppError('Your account is currently inactive. Please contact your IT administrator.', 403, 'ACCOUNT_INACTIVE');
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new AppError('Account temporarily locked due to failed attempts. Please try again later or contact your administrator.', 423, 'ACCOUNT_LOCKED');
    }

    const isValidPassword = await verifyPassword(password, user.passwordHash);
    
    if (!isValidPassword) {
      await this.handleFailedLogin(trimmed, user.id);
      throw new AppError('Incorrect password. Please verify your password and try again.', 401, 'INVALID_PASSWORD');
    }

    if (user.mfaEnabled) {
      if (!mfaCode) {
        throw new Error('MFA_REQUIRED');
      }
      
      const isValidMFA = authenticator.check(mfaCode, user.mfaSecret!);
      if (!isValidMFA) {
        await this.handleFailedLogin(trimmed, user.id);
        throw new Error('Invalid MFA code');
      }
    }

    await this.resetFailedAttempts(user.id);

    const userRoles = user.roles && user.roles.length > 0 ? user.roles : [user.role];
    const permissions = Array.from(new Set(userRoles.flatMap((r) => this.getPermissions(r))));

    const session = await this.createSession(user.id, 'login', rememberMe);
    const tokens = generateTokenPair({
      userId: user.id,
      email: user.email,
      role: user.role,
      roles: userRoles,
      status: user.status,
      departmentId: user.departmentId || undefined,
      canViewTeamBucket: user.canViewTeamBucket || false,
      permissions,
      sessionId: session.id,
    });

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    logger.info('User logged in', { userId: user.id, email: user.email });

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        employeeId: user.employeeId,
        role: user.role,
        roles: userRoles,
        status: user.status,
        departmentId: user.departmentId,
        canViewTeamBucket: user.canViewTeamBucket || false,
        mfaEnabled: user.mfaEnabled,
        avatar: user.avatar,
      },
      tokens,
    };
  }

  async updateUser(userId: string, data: { firstName?: string; lastName?: string; phone?: string; avatar?: string }, _actorId?: string) {
    const update: Prisma.UserUpdateInput = {};
    if (data.firstName?.trim()) update.firstName = data.firstName.trim();
    if (data.lastName?.trim()) update.lastName = data.lastName.trim();
    if (data.phone !== undefined) update.phone = data.phone?.trim() || null;
    if (data.avatar !== undefined) update.avatar = data.avatar || null;

    await prisma.user.update({ where: { id: userId }, data: update });
    return this.getUserById(userId);
  }

  async getUserById(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      throw new Error('User not found');
    }

    const userRoles = user.roles && user.roles.length > 0 ? user.roles : [user.role];
    const permissions = Array.from(new Set(userRoles.flatMap((r) => this.getPermissions(r))));

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      employeeId: user.employeeId,
      phone: user.phone,
      role: user.role,
      roles: userRoles,
      status: user.status,
      departmentId: user.departmentId,
      canViewTeamBucket: user.canViewTeamBucket || false,
      mfaEnabled: user.mfaEnabled,
      avatar: user.avatar,
      permissions,
    };
  }

  async refreshTokens(refreshToken: string): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
    const payload = verifyRefreshToken(refreshToken);
    
    if (!payload) {
      throw new Error('Invalid refresh token');
    }

    const session = await prisma.session.findUnique({
      where: { id: payload.sessionId },
      include: { user: true },
    });

    if (!session || session.revokedAt || session.expiresAt < new Date()) {
      throw new Error('Session expired or revoked');
    }

    if (session.user.status !== UserStatus.ACTIVE) {
      throw new Error('Account is not active');
    }

    const newSession = await this.createSession(session.userId, 'refresh');
    
    await prisma.session.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });

    const userRoles = session.user.roles && session.user.roles.length > 0 ? session.user.roles : [session.user.role];
    const permissions = Array.from(new Set(userRoles.flatMap((r) => this.getPermissions(r))));

    const tokens = generateTokenPair({
      userId: session.userId,
      email: session.user.email,
      role: session.user.role,
      roles: userRoles,
      status: session.user.status,
      departmentId: session.user.departmentId || undefined,
      permissions,
      sessionId: newSession.id,
    });

    return tokens;
  }

  async logout(sessionId: string, revokeAll = false, userId?: string): Promise<void> {
    if (revokeAll && userId) {
      await prisma.session.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    } else {
      await prisma.session.update({
        where: { id: sessionId },
        data: { revokedAt: new Date() },
      });
    }
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error('User not found');
    }

    const isValid = await verifyPassword(currentPassword, user.passwordHash);
    if (!isValid) {
      throw new Error('Current password is incorrect');
    }

    const newPasswordHash = await hashPassword(newPassword);

    await prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: newPasswordHash,
        lastPasswordChange: new Date(),
      },
    });

    await this.logout(userId, true, userId);

    if (user.email) {
      emailService.sendPasswordChangedEmail(user.email, user.firstName).catch((err) => {
        logger.error('Failed to send password changed confirmation email', { error: err instanceof Error ? err.message : String(err), email: user.email });
      });
    }

    logger.info('Password changed', { userId });
  }

  async forgotPassword(identifierOrEmail: string): Promise<void> {
    const normalized = (identifierOrEmail || '').trim();
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { employeeId: { equals: normalized, mode: 'insensitive' } },
          { email: { equals: normalized.toLowerCase(), mode: 'insensitive' } },
        ],
      },
    });

    if (!user) {
      logger.warn('Password reset requested for non-existent account', { identifier: normalized });
      return;
    }

    const resetToken = generateToken(32);
    const resetTokenHash = await hashPassword(resetToken);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: resetTokenHash,
        passwordResetExpires: expiresAt,
      },
    });

    const resetLink = `${config.frontendUrl}/reset-password?token=${resetToken}&email=${encodeURIComponent(user.email)}`;

    // Background the email sending so the user receives a prompt response and is not blocked by SMTP connection latency
    emailService.sendPasswordResetEmail(user.email, resetLink).catch((err) => {
      logger.error('Failed to send password reset email', { error: err instanceof Error ? err.message : String(err), email: user.email });
    });

    logger.info('Password reset initiated and email dispatched', { userId: user.id, email: user.email });
  }

  async resetPassword(token: string, email: string, newPassword: string): Promise<void> {
    const normalizedEmail = (email || '').trim().toLowerCase();
    const user = await prisma.user.findFirst({
      where: {
        email: {
          equals: normalizedEmail,
          mode: 'insensitive',
        },
      },
    });

    if (!user || !user.passwordResetToken || !user.passwordResetExpires) {
      throw new Error('Invalid or expired reset token');
    }

    if (user.passwordResetExpires < new Date()) {
      throw new Error('Reset token has expired');
    }

    const isValid = await verifyPassword(token, user.passwordResetToken);
    if (!isValid) {
      throw new Error('Invalid reset token');
    }

    const newPasswordHash = await hashPassword(newPassword);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: newPasswordHash,
        passwordResetToken: null,
        passwordResetExpires: null,
        lastPasswordChange: new Date(),
      },
    });

    await this.logout(user.id, true, user.id);

    if (user.email) {
      emailService.sendPasswordChangedEmail(user.email, user.firstName).catch((err) => {
        logger.error('Failed to send password changed confirmation email', { error: err instanceof Error ? err.message : String(err), email: user.email });
      });
    }

    logger.info('Password reset completed', { userId: user.id });
  }

  async verifyEmail(token: string): Promise<void> {
    const user = await prisma.user.findFirst({
      where: { emailVerifyToken: token },
    });

    if (!user) {
      throw new Error('Invalid verification token');
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        emailVerifyToken: null,
        status: UserStatus.ACTIVE,
      },
    });

    logger.info('Email verified', { userId: user.id });
  }

  async setupMFA(userId: string): Promise<{ secret: string; qrCodeUrl: string; backupCodes: string[] }> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error('User not found');
    }

    if (user.mfaEnabled) {
      throw new Error('MFA already enabled');
    }

    const secret = authenticator.generateSecret();
    const qrCodeUrl = authenticator.keyuri(user.email, config.mfa.issuer, secret);
    const backupCodes = Array.from({ length: 10 }, () => generateToken(4).toUpperCase());

    await prisma.user.update({
      where: { id: userId },
      data: {
        mfaSecret: encrypt(secret),
        backupCodes: backupCodes.map(c => encrypt(c)),
      },
    });

    logger.info('MFA setup initiated', { userId });

    return { secret, qrCodeUrl, backupCodes };
  }

  async verifyMFA(userId: string, code: string): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.mfaSecret) {
      throw new Error('MFA not set up');
    }

    const secret = decrypt(user.mfaSecret);
    const isValid = authenticator.check(code, secret);

    if (isValid) {
      await prisma.user.update({
        where: { id: userId },
        data: { mfaEnabled: true },
      });
      logger.info('MFA enabled', { userId });
    }

    return isValid;
  }

  async disableMFA(userId: string, code: string): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.mfaEnabled) {
      throw new Error('MFA not enabled');
    }

    const secret = decrypt(user.mfaSecret!);
    const isValid = authenticator.check(code, secret);

    if (!isValid) {
      throw new Error('Invalid MFA code');
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        mfaEnabled: false,
        mfaSecret: null,
        backupCodes: [],
      },
    });

    logger.info('MFA disabled', { userId });
  }

  async verifyBackupCode(userId: string, code: string): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.mfaEnabled) {
      return false;
    }

    for (let i = 0; i < user.backupCodes.length; i++) {
      const decrypted = decrypt(user.backupCodes[i]);
      if (decrypted === code.toUpperCase()) {
        const updatedCodes = [...user.backupCodes];
        updatedCodes.splice(i, 1);
        
        await prisma.user.update({
          where: { id: userId },
          data: { backupCodes: updatedCodes },
        });
        
        logger.info('Backup code used', { userId });
        return true;
      }
    }

    return false;
  }

  private async createSession(userId: string, type: string, rememberMe = false): Promise<{ id: string; token: string; refreshToken: string; expiresAt: Date }> {
    const token = generateToken(32);
    const refreshToken = generateToken(32);
    const expiresAt = new Date(Date.now() + (rememberMe ? 30 * 24 * 60 * 60 * 1000 : config.security.sessionTimeout));

    const session = await prisma.session.create({
      data: {
        userId,
        token,
        refreshToken,
        expiresAt,
      },
    });

    return session;
  }

  private async handleFailedLogin(identifier: string, userId?: string): Promise<void> {
    if (userId) {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (user) {
        const attempts = user.failedLoginAttempts + 1;
        const updateData: Prisma.UserUpdateInput = { failedLoginAttempts: attempts };
        
        if (attempts >= config.security.maxLoginAttempts) {
          updateData.lockedUntil = new Date(Date.now() + config.security.lockoutDuration);
        }
        
        await prisma.user.update({
          where: { id: userId },
          data: updateData,
        });
      }
    }
    logger.warn('Failed login attempt', { identifier, userId });
  }

  private async resetFailedAttempts(userId: string): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    });
  }

  private getPermissions(role: UserRole): string[] {
    const permissions: Record<UserRole, string[]> = {
      SUPER_ADMIN: ['*'],
      ADMIN: [
        'users:read', 'users:write', 'users:delete',
        'tickets:read', 'tickets:write', 'tickets:delete',
        'departments:read', 'departments:write', 'departments:delete',
        'teams:read', 'teams:write', 'teams:delete',
        'sla:read', 'sla:write', 'sla:delete',
        'assets:read', 'assets:write', 'assets:delete',
        'knowledge:read', 'knowledge:write', 'knowledge:delete',
        'reports:read', 'reports:write',
        'settings:read', 'settings:write',
        'audit:read',
      ],
      DEPARTMENT_HEAD: [
        'users:read', 'users:write',
        'tickets:read', 'tickets:write',
        'departments:read',
        'teams:read', 'teams:write',
        'sla:read', 'sla:write',
        'assets:read', 'assets:write',
        'knowledge:read', 'knowledge:write',
        'reports:read',
      ],
      TEAM_LEAD: [
        'users:read',
        'tickets:read', 'tickets:write',
        'teams:read',
        'sla:read',
        'assets:read',
        'knowledge:read', 'knowledge:write',
        'reports:read',
      ],
      AGENT: [
        'tickets:read', 'tickets:write',
        'assets:read',
        'knowledge:read', 'knowledge:write',
      ],
      RAISER: [
        'tickets:read', 'tickets:write',
        'knowledge:read',
      ],
      VIEWER: [
        'tickets:read',
        'knowledge:read',
      ],
    };

    return permissions[role] || [];
  }
}

export const authService = new AuthService();
export default authService;