import dotenv from 'dotenv';
dotenv.config();

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  apiPrefix: process.env.API_PREFIX || '/api/v1',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',

  jwt: {
    secret: process.env.JWT_SECRET || 'default-secret-change-me',
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'default-refresh-secret-change-me',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },

  encryption: {
    key: process.env.ENCRYPTION_KEY || 'default-32-char-encryption-key!!',
  },

  email: {
    host: (process.env.SMTP_HOST || 'smtp.gmail.com').replace(/^["']|["']$/g, '').trim(),
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    user: (process.env.SMTP_USER || '').replace(/^["']|["']$/g, '').trim(),
    pass: (process.env.SMTP_PASS || '').replace(/^["']|["']$/g, '').trim(),
    from: (process.env.EMAIL_FROM || 'IT Service Desk <laxmisamadhan@lifc.in>').replace(/^["']|["']$/g, '').trim(),
  },

  mfa: {
    issuer: process.env.MFA_ISSUER || 'TicketPortal',
  },

  upload: {
    dir: process.env.UPLOAD_DIR || './uploads',
    maxSize: parseInt(process.env.MAX_FILE_SIZE || '52428800', 10),
    allowedTypes: (process.env.ALLOWED_MIME_TYPES || '').split(','),
  },

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  },

  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },

  logging: {
    level: process.env.LOG_LEVEL || 'info',
    dir: process.env.LOG_DIR || './logs',
  },

  websocket: {
    port: parseInt(process.env.WS_PORT || '3001', 10),
  },

  cors: {
    origin: (process.env.CORS_ORIGINS || process.env.FRONTEND_URL || 'http://localhost:5173').split(',').map((o) => o.trim()).filter(Boolean),
    credentials: true,
  },

  security: {
    bcryptRounds: 12,
    maxLoginAttempts: 5,
    lockoutDuration: 15 * 60 * 1000, // 15 minutes
    passwordMinLength: 12,
    passwordRequireUppercase: true,
    passwordRequireLowercase: true,
    passwordRequireNumbers: true,
    passwordRequireSpecialChars: true,
    sessionTimeout: 24 * 60 * 60 * 1000, // 24 hours
  },
};

export default config;