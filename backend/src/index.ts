import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import config from '@config/index';
import logger from '@utils/logger';
import { errorHandler, notFoundHandler } from '@middleware/error.middleware';
import { globalRateLimiter } from '@middleware/rateLimit.middleware';
import { prisma } from '@config/prisma';
import wsService from '@services/websocket.service';
import slaService from '@services/sla.service';
import approvalService from '@services/approval.service';

import authRoutes from '@routes/auth.routes';
import ticketRoutes from '@routes/ticket.routes';
import userRoutes from '@routes/user.routes';
import departmentRoutes from '@routes/department.routes';
import slaRoutes from '@routes/sla.routes';
import assetRoutes from '@routes/asset.routes';
import notificationRoutes from '@routes/notification.routes';
import knowledgeRoutes from '@routes/knowledge.routes';
import approvalRoutes from '@routes/approval.routes';
import customFieldRoutes from '@routes/customField.routes';
import reportRoutes from '@routes/report.routes';
import auditRoutes from '@routes/audit.routes';
import aiRoutes from '@routes/ai.routes';
import escalationRoutes from '@routes/escalation.routes';
import macroRoutes from '@routes/macro.routes';
import emailRoutes from '@routes/email.routes';
import escalationService from '@services/escalation.service';
import mailPollerService from '@services/mailPoller.service';

const app = express();
app.set('trust proxy', 1);
const httpServer = createServer(app);

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false,
}));

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || config.env === 'development') {
      return callback(null, true);
    }
    if (config.cors.origin.includes(origin)) {
      return callback(null, true);
    }
    if (origin.startsWith('capacitor://') || origin.startsWith('http://localhost') || origin.startsWith('https://localhost')) {
      return callback(null, true);
    }
    logger.warn(`CORS blocked request from origin: ${origin}`);
    callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

if (config.env !== 'test') {
  app.use(morgan('combined', {
    stream: { write: (message) => logger.info(message.trim()) },
  }));
}

app.use(globalRateLimiter);

app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    env: config.env,
  });
});

app.get('/api/version', (req, res) => {
  res.json({ version: '1.0.0', name: 'Ticket Portal API' });
});

const apiPrefix = config.apiPrefix;

app.get(apiPrefix, (req, res) => {
  res.json({
    status: 'online',
    name: 'Laxmi India Finance Ltd — Service Desk API',
    version: '1.0.0',
    message: 'Backend API server is running smoothly. Open the web portal in your browser at http://10.10.1.117:8003/admin/tickets',
    webPortalUrl: 'http://10.10.1.117:8003/admin/tickets',
  });
});

app.use(`${apiPrefix}/auth`, authRoutes);
app.use(`${apiPrefix}/tickets`, ticketRoutes);
app.use(`${apiPrefix}/users`, userRoutes);
app.use(`${apiPrefix}/departments`, departmentRoutes);
app.use(`${apiPrefix}/sla`, slaRoutes);
app.use(`${apiPrefix}/assets`, assetRoutes);
app.use(`${apiPrefix}/notifications`, notificationRoutes);
app.use(`${apiPrefix}/knowledge`, knowledgeRoutes);
app.use(`${apiPrefix}/approvals`, approvalRoutes);
app.use(`${apiPrefix}/custom-fields`, customFieldRoutes);
app.use(`${apiPrefix}/reports`, reportRoutes);
app.use(`${apiPrefix}/audit-logs`, auditRoutes);
app.use(`${apiPrefix}/ai`, aiRoutes);
app.use(`${apiPrefix}/escalations`, escalationRoutes);
app.use(`${apiPrefix}/macros`, macroRoutes);
app.use(`${apiPrefix}/email`, emailRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

wsService.initialize(httpServer);

const startBackgroundJobs = () => {
  setInterval(() => {
    slaService.checkSLATimers().catch(err => logger.error('SLA check failed', { error: err.message }));
  }, 5 * 60 * 1000);

  setInterval(() => {
    escalationService.runEscalationCheck().catch(err => logger.error('Escalation check failed', { error: err.message }));
  }, 10 * 60 * 1000);

  setInterval(() => {
    approvalService.checkExpiredApprovals().catch(err => logger.error('Approval expiry check failed', { error: err.message }));
  }, 15 * 60 * 1000);

  setInterval(() => {
    prisma.session.deleteMany({
      where: { expiresAt: { lt: new Date() }, revokedAt: null },
    }).catch(err => logger.error('Session cleanup failed', { error: err.message }));
  }, 60 * 60 * 1000);

  // Inbound support email listener (polls IMAP inbox every 60 seconds)
  mailPollerService.start(60 * 1000);

  logger.info('Background jobs started');
};

const startServer = async () => {
  try {
    await prisma.$connect();
    logger.info('Database connected');

    httpServer.listen(config.port, '0.0.0.0', () => {
      logger.info(`Server running on port ${config.port} on 0.0.0.0 in ${config.env} mode`);
      logger.info(`API available at http://10.10.1.117:${config.port}${apiPrefix}`);
      logger.info(`WebSocket server running on port ${config.websocket.port}`);
      startBackgroundJobs();
    });
  } catch (error) {
    logger.error('Failed to start server', { error: error instanceof Error ? error.message : 'Unknown error' });
    process.exit(1);
  }
};

const shutdown = async () => {
  logger.info('Shutting down...');
  wsService.shutdown();
  await prisma.$disconnect();
  httpServer.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
  
  setTimeout(() => {
    logger.error('Forced shutdown');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', { error: error.message, stack: error.stack });
  shutdown();
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection', { reason: reason instanceof Error ? reason.message : reason });
});

startServer();

export { app, httpServer };