import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, extractTokenFromHeader, JWTPayload } from '@utils/jwt';
import { prisma } from '@config/prisma';
import logger from '@utils/logger';
import config from '@config/index';
import { getPermissionsForRole } from '@utils/permissions';

export interface AuthenticatedRequest extends Request {
  user?: JWTPayload;
  sessionId?: string;
}

export const authenticate = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = extractTokenFromHeader(req.headers.authorization);
    
    if (!token) {
      res.status(401).json({ 
        success: false, 
        error: 'Authentication required',
        code: 'UNAUTHORIZED',
      });
      return;
    }

    const payload = verifyAccessToken(token);
    
    if (!payload) {
      res.status(401).json({ 
        success: false, 
        error: 'Invalid or expired token',
        code: 'INVALID_TOKEN',
      });
      return;
    }

    const session = await prisma.session.findUnique({
      where: { id: payload.sessionId },
      select: { id: true, revokedAt: true, expiresAt: true },
    });

    if (!session || session.revokedAt || session.expiresAt < new Date()) {
      res.status(401).json({ 
        success: false, 
        error: 'Session expired or revoked',
        code: 'SESSION_EXPIRED',
      });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        email: true,
        role: true,
        roles: true,
        status: true,
        departmentId: true,
        mfaEnabled: true,
      },
    });

    if (!user) {
      res.status(401).json({ 
        success: false, 
        error: 'User not found',
        code: 'USER_NOT_FOUND',
      });
      return;
    }

    if (user.status !== 'ACTIVE') {
      res.status(403).json({ 
        success: false, 
        error: 'Account is not active',
        code: 'ACCOUNT_INACTIVE',
      });
      return;
    }

    const userRoles = Array.from(new Set([user.role, ...(user.roles || [])]));
    const permissions = Array.from(new Set(userRoles.flatMap((r) => getPermissionsForRole(r))));

    req.user = {
      ...payload,
      role: user.role,
      roles: userRoles,
      status: user.status,
      departmentId: user.departmentId || undefined,
      permissions,
    };
    req.sessionId = session.id;

    next();
  } catch (error) {
    logger.error('Authentication error', { error: error instanceof Error ? error.message : 'Unknown error' });
    res.status(500).json({ 
      success: false, 
      error: 'Authentication failed',
      code: 'AUTH_ERROR',
    });
  }
};

export const optionalAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = extractTokenFromHeader(req.headers.authorization);
    
    if (!token) {
      next();
      return;
    }

    const payload = verifyAccessToken(token);
    
    if (!payload) {
      next();
      return;
    }

    const session = await prisma.session.findUnique({
      where: { id: payload.sessionId },
      select: { id: true, revokedAt: true, expiresAt: true },
    });

    if (!session || session.revokedAt || session.expiresAt < new Date()) {
      next();
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        email: true,
        role: true,
        roles: true,
        status: true,
        departmentId: true,
      },
    });

    if (user && user.status === 'ACTIVE') {
      const userRoles = Array.from(new Set([user.role, ...(user.roles || [])]));
      const permissions = Array.from(new Set(userRoles.flatMap((r) => getPermissionsForRole(r))));

      req.user = {
        ...payload,
        role: user.role,
        roles: userRoles,
        status: user.status,
        departmentId: user.departmentId || undefined,
        permissions,
      };
      req.sessionId = session.id;
    }

    next();
  } catch (error) {
    logger.error('Optional authentication error', { error: error instanceof Error ? error.message : 'Unknown error' });
    next();
  }
};

export const requireRole = (...allowedRoles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ 
        success: false, 
        error: 'Authentication required',
        code: 'UNAUTHORIZED',
      });
      return;
    }

    const userRoles = req.user.roles && req.user.roles.length > 0 ? req.user.roles : [req.user.role];
    if (userRoles.includes('SUPER_ADMIN') || allowedRoles.some((r) => userRoles.includes(r))) {
      return next();
    }

    res.status(403).json({ 
      success: false, 
      error: 'Insufficient permissions',
      code: 'FORBIDDEN',
    });
  };
};

export const requirePermission = (...permissions: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ 
        success: false, 
        error: 'Authentication required',
        code: 'UNAUTHORIZED',
      });
      return;
    }

    const hasPermission = permissions.some(p => req.user!.permissions.includes(p));
    
    if (!hasPermission) {
      res.status(403).json({ 
        success: false, 
        error: 'Insufficient permissions',
        code: 'FORBIDDEN',
      });
      return;
    }

    next();
  };
};

export const requireDepartmentAccess = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  if (!req.user) {
    res.status(401).json({ 
      success: false, 
      error: 'Authentication required',
      code: 'UNAUTHORIZED',
    });
    return;
  }

  const userRoles = req.user.roles && req.user.roles.length > 0 ? req.user.roles : [req.user.role];
  if (userRoles.some((r) => ['SUPER_ADMIN', 'ADMIN'].includes(r))) {
    next();
    return;
  }

  const departmentId = req.params.departmentId || req.body.departmentId || req.query.departmentId;
  
  if (departmentId && req.user.departmentId !== departmentId) {
    res.status(403).json({ 
      success: false, 
      error: 'Access denied to this department',
      code: 'DEPARTMENT_ACCESS_DENIED',
    });
    return;
  }

  next();
};

export const requireOwnershipOrAdmin = (resourceUserIdField: string = 'userId') => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ 
        success: false, 
        error: 'Authentication required',
        code: 'UNAUTHORIZED',
      });
      return;
    }

    const userRoles = req.user.roles && req.user.roles.length > 0 ? req.user.roles : [req.user.role];
    if (userRoles.some((r) => ['SUPER_ADMIN', 'ADMIN'].includes(r))) {
      next();
      return;
    }

    const resourceUserId = req.params[resourceUserIdField] || req.body[resourceUserIdField] || req.query[resourceUserIdField];
    
    if (resourceUserId && req.user.userId !== resourceUserId) {
      res.status(403).json({ 
        success: false, 
        error: 'Access denied',
        code: 'OWNERSHIP_REQUIRED',
      });
      return;
    }

    next();
  };
};

export const apiKeyAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const apiKey = req.headers['x-api-key'] as string;
  
  if (!apiKey) {
    res.status(401).json({ 
      success: false, 
      error: 'API key required',
      code: 'API_KEY_REQUIRED',
    });
    return;
  }

  // Validate API key against database
  // Implementation depends on your API key storage strategy
  
  next();
};

export default {
  authenticate,
  optionalAuth,
  requireRole,
  requirePermission,
  requireDepartmentAccess,
  requireOwnershipOrAdmin,
  apiKeyAuth,
};