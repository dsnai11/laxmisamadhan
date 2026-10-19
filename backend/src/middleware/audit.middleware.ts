import { Request, Response, NextFunction } from 'express';
import { prisma } from '@config/prisma';
import { AuthenticatedRequest } from './auth.middleware';
import logger from '@utils/logger';

const SENSITIVE_KEYS = new Set([
  'password', 'currentpassword', 'newpassword', 'token', 'refreshtoken',
  'secret', 'mfacode', 'passwordhash', 'smtppass', 'smtp_pass', 'pass',
  'authorization', 'cookie', 'api_key', 'apikey', 'jwt_secret', 'encryption_key'
]);

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

export const auditLog = (action: string, resource: string) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    const startTime = Date.now();
    const originalSend = res.send;
    
    let responseBody: any;
    let statusCode: number;

    res.send = function (body: any): Response {
      responseBody = body;
      statusCode = res.statusCode;
      return originalSend.call(this, body);
    };

    res.on('finish', async () => {
      try {
        const duration = Date.now() - startTime;
        const userId = req.user?.userId;
        const success = statusCode >= 200 && statusCode < 400;

        await prisma.auditLog.create({
          data: {
            userId,
            action,
            resource,
            resourceId: req.params.id || req.body.id,
            oldValue: req.method !== 'POST' ? sanitizeForAudit(req.body) : undefined,
            newValue: success ? sanitizeForAudit(responseBody) : undefined,
            ipAddress: req.ip,
            userAgent: req.get('user-agent'),
            success,
            errorMessage: !success ? responseBody?.error : undefined,
          },
        }).catch((err) => {
          logger.error('Failed to create audit log', { error: err.message });
        });

        if (duration > 1000) {
          logger.warn('Slow request detected', {
            method: req.method,
            path: req.path,
            duration,
            userId,
          });
        }
      } catch (error) {
        logger.error('Audit log error', { error: error instanceof Error ? error.message : 'Unknown error' });
      }
    });

    next();
  };
};

export const logActivity = async (
  userId: string,
  action: string,
  description: string,
  ticketId?: string,
  metadata?: Record<string, any>,
  ipAddress?: string,
  userAgent?: string
): Promise<void> => {
  try {
    await prisma.activityLog.create({
      data: {
        userId,
        ticketId,
        action,
        description,
        metadata,
        ipAddress,
        userAgent,
      },
    });
  } catch (error) {
    logger.error('Failed to log activity', { error: error instanceof Error ? error.message : 'Unknown error' });
  }
};