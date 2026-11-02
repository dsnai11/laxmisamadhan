import { Request, Response } from 'express';
import { asyncHandler } from '@middleware/error.middleware';
import { AppError } from '@middleware/error.middleware';
import authService from '@services/auth.service';
import emailService from '@services/email.service';
import config from '@config/index';
import logger from '@utils/logger';

export const register = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.register(req.body, req.user?.userId);
  
  res.status(201).json({
    success: true,
    message: 'Registration successful',
    data: result,
  });
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { employeeId, identifier, email, password, mfaCode, rememberMe } = req.body;
  const loginIdentifier = (employeeId || identifier || email)?.trim();

  if (!loginIdentifier) {
    throw new AppError('Employee ID or email is required', 400, 'EMPLOYEE_ID_REQUIRED');
  }
  
  const result = await authService.login(loginIdentifier, password, mfaCode, rememberMe);
  
  res.cookie('refreshToken', result.tokens.refreshToken, {
    httpOnly: true,
    secure: config.env === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  res.json({
    success: true,
    message: 'Login successful',
    data: result,
  });
});

export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const refreshToken = req.cookies?.refreshToken || req.body.refreshToken;
  
  if (!refreshToken) {
    throw new AppError('Refresh token required', 401, 'REFRESH_TOKEN_REQUIRED');
  }

  const tokens = await authService.refreshTokens(refreshToken);
  
  res.cookie('refreshToken', tokens.refreshToken, {
    httpOnly: true,
    secure: config.env === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  res.json({
    success: true,
    data: tokens,
  });
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  const { revokeAll } = req.body;
  const sessionId = req.sessionId;
  const userId = req.user?.userId;

  await authService.logout(sessionId!, revokeAll, userId);

  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure: config.env === 'production',
    sameSite: 'lax',
  });

  res.json({
    success: true,
    message: 'Logged out successfully',
  });
});

export const changePassword = asyncHandler(async (req: Request, res: Response) => {
  const { currentPassword, newPassword } = req.body;
  const userId = req.user!.userId;

  await authService.changePassword(userId, currentPassword, newPassword);

  res.json({
    success: true,
    message: 'Password changed successfully. Please log in again.',
  });
});

export const forgotPassword = asyncHandler(async (req: Request, res: Response) => {
  const { employeeId, identifier, email } = req.body;
  const loginIdentifier = (employeeId || identifier || email)?.trim();
  
  if (loginIdentifier) {
    await authService.forgotPassword(loginIdentifier);
  }

  res.json({
    success: true,
    message: 'If an account exists, a password reset link has been sent to the registered email address',
  });
});

export const resetPassword = asyncHandler(async (req: Request, res: Response) => {
  const { token, email, password } = req.body;
  
  await authService.resetPassword(token, email, password);

  res.json({
    success: true,
    message: 'Password reset successful. Please log in with your new password.',
  });
});

export const verifyEmail = asyncHandler(async (req: Request, res: Response) => {
  const { token } = req.body;
  
  await authService.verifyEmail(token);

  res.json({
    success: true,
    message: 'Email verified successfully',
  });
});

export const setupMFA = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  
  const { secret, qrCodeUrl, backupCodes } = await authService.setupMFA(userId);

  res.json({
    success: true,
    data: { secret, qrCodeUrl, backupCodes },
  });
});

export const verifyMFA = asyncHandler(async (req: Request, res: Response) => {
  const { code } = req.body;
  const userId = req.user!.userId;

  const isValid = await authService.verifyMFA(userId, code);

  if (!isValid) {
    throw new AppError('Invalid MFA code', 400, 'INVALID_MFA_CODE');
  }

  res.json({
    success: true,
    message: 'MFA enabled successfully',
  });
});

export const disableMFA = asyncHandler(async (req: Request, res: Response) => {
  const { code } = req.body;
  const userId = req.user!.userId;

  await authService.disableMFA(userId, code);

  res.json({
    success: true,
    message: 'MFA disabled successfully',
  });
});

export const verifyBackupCode = asyncHandler(async (req: Request, res: Response) => {
  const { code } = req.body;
  const userId = req.user!.userId;

  const isValid = await authService.verifyBackupCode(userId, code);

  if (!isValid) {
    throw new AppError('Invalid backup code', 400, 'INVALID_BACKUP_CODE');
  }

  res.json({
    success: true,
    message: 'Backup code verified',
  });
});

export const getMe = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  
  const user = await authService.getUserById(userId);

  res.json({
    success: true,
    data: user,
  });
});

export const updateProfile = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const { firstName, lastName, phone, avatar } = req.body;

  const user = await authService.updateUser(userId, { firstName, lastName, phone, avatar }, userId);

  res.json({
    success: true,
    data: user,
  });
});