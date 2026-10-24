import jwt from 'jsonwebtoken';
import config from '@config/index';
import { UserRole, UserStatus } from '@prisma/client';

export interface JWTPayload {
  userId: string;
  email: string;
  role: UserRole;
  roles?: UserRole[];
  status: UserStatus;
  departmentId?: string;
  canViewTeamBucket?: boolean;
  permissions: string[];
  sessionId: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export function generateAccessToken(payload: JWTPayload): string {
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
    issuer: 'ticket-portal',
    audience: 'ticket-portal-api',
  });
}

export function generateRefreshToken(payload: Pick<JWTPayload, 'userId' | 'sessionId'>): string {
  return jwt.sign(payload, config.jwt.refreshSecret, {
    expiresIn: config.jwt.refreshExpiresIn,
    issuer: 'ticket-portal',
    audience: 'ticket-portal-api',
  });
}

export function generateTokenPair(payload: JWTPayload): TokenPair {
  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken({ userId: payload.userId, sessionId: payload.sessionId });
  
  const decoded = jwt.decode(accessToken) as { exp: number };
  const expiresIn = (decoded.exp - Math.floor(Date.now() / 1000)) * 1000;
  
  return { accessToken, refreshToken, expiresIn };
}

export function verifyAccessToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, config.jwt.secret, {
      issuer: 'ticket-portal',
      audience: 'ticket-portal-api',
    }) as JWTPayload;
  } catch {
    return null;
  }
}

export function verifyRefreshToken(token: string): Pick<JWTPayload, 'userId' | 'sessionId'> | null {
  try {
    return jwt.verify(token, config.jwt.refreshSecret, {
      issuer: 'ticket-portal',
      audience: 'ticket-portal-api',
    }) as Pick<JWTPayload, 'userId' | 'sessionId'>;
  } catch {
    return null;
  }
}

export function decodeToken(token: string): JWTPayload | null {
  try {
    return jwt.decode(token) as JWTPayload;
  } catch {
    return null;
  }
}

export function extractTokenFromHeader(authHeader: string | undefined): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.substring(7);
}