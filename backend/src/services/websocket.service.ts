import { Server as HTTPServer } from 'http';
import { Server, Socket } from 'socket.io';
import { verifyAccessToken, JWTPayload } from '@utils/jwt';
import { prisma } from '@config/prisma';
import { createLogger } from '@utils/logger';
import config from '@config/index';

const logger = createLogger('websocket-service');

interface AuthenticatedSocket extends Socket {
  user?: JWTPayload;
  userId?: string;
}

class WebSocketService {
  private io: Server | null = null;
  private userSockets: Map<string, Set<string>> = new Map();

  initialize(httpServer: HTTPServer): void {
    this.io = new Server(httpServer, {
      cors: {
        origin: config.frontendUrl,
        methods: ['GET', 'POST'],
        credentials: true,
      },
      pingTimeout: 60000,
      pingInterval: 25000,
    });

    this.io.use(async (socket: AuthenticatedSocket, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
        
        if (!token) {
          return next(new Error('Authentication required'));
        }

        const payload = verifyAccessToken(token);
        if (!payload) {
          return next(new Error('Invalid token'));
        }

        const session = await prisma.session.findUnique({
          where: { id: payload.sessionId },
          select: { id: true, revokedAt: true, expiresAt: true },
        });

        if (!session || session.revokedAt || session.expiresAt < new Date()) {
          return next(new Error('Session expired'));
        }

        socket.user = payload;
        socket.userId = payload.userId;
        next();
      } catch (error) {
        next(new Error('Authentication failed'));
      }
    });

    this.io.on('connection', (socket: AuthenticatedSocket) => this.handleConnection(socket));

    logger.info('WebSocket server initialized');
  }

  private handleConnection(socket: AuthenticatedSocket): void {
    const userId = socket.userId!;
    
    if (!this.userSockets.has(userId)) {
      this.userSockets.set(userId, new Set());
    }
    this.userSockets.get(userId)!.add(socket.id);

    socket.join(`user:${userId}`);
    
    if (socket.user?.departmentId) {
      socket.join(`department:${socket.user.departmentId}`);
    }

    if (['SUPER_ADMIN', 'ADMIN'].includes(socket.user?.role || '')) {
      socket.join('admins');
    }

    logger.info('Client connected', { userId, socketId: socket.id, totalConnections: this.userSockets.size });

    socket.on('join:ticket', (ticketId: string) => {
      socket.join(`ticket:${ticketId}`);
      logger.debug('Client joined ticket room', { userId, ticketId, socketId: socket.id });
    });

    socket.on('leave:ticket', (ticketId: string) => {
      socket.leave(`ticket:${ticketId}`);
      logger.debug('Client left ticket room', { userId, ticketId, socketId: socket.id });
    });

    socket.on('subscribe:notifications', () => {
      socket.join(`notifications:${userId}`);
    });

    socket.on('unsubscribe:notifications', () => {
      socket.leave(`notifications:${userId}`);
    });

    socket.on('typing:start', (data: { ticketId: string; isInternal: boolean }) => {
      socket.to(`ticket:${data.ticketId}`).emit('user:typing', { userId, userName: `${socket.user?.firstName} ${socket.user?.lastName}`, isInternal: data.isInternal });
    });

    socket.on('typing:stop', (ticketId: string) => {
      socket.to(`ticket:${ticketId}`).emit('user:stopped-typing', { userId });
    });

    socket.on('disconnect', (reason) => {
      const userSockets = this.userSockets.get(userId);
      if (userSockets) {
        userSockets.delete(socket.id);
        if (userSockets.size === 0) {
          this.userSockets.delete(userId);
        }
      }
      logger.info('Client disconnected', { userId, socketId: socket.id, reason, remainingConnections: this.userSockets.size });
    });

    socket.on('error', (error) => {
      logger.error('Socket error', { userId, socketId: socket.id, error: error.message });
    });
  }

  sendToUser(userId: string, event: string, data: any): void {
    if (!this.io) return;
    this.io.to(`user:${userId}`).emit(event, data);
  }

  sendToDepartment(departmentId: string, event: string, data: any): void {
    if (!this.io) return;
    this.io.to(`department:${departmentId}`).emit(event, data);
  }

  sendToTicket(ticketId: string, event: string, data: any, excludeUserId?: string): void {
    if (!this.io) return;
    this.io.to(`ticket:${ticketId}`).emit(event, data);
  }

  sendToAdmins(event: string, data: any): void {
    if (!this.io) return;
    this.io.to('admins').emit(event, data);
  }

  sendNotification(userId: string, notification: any): void {
    this.sendToUser(userId, 'notification:new', notification);
  }

  broadcast(event: string, data: any): void {
    if (!this.io) return;
    this.io.emit(event, data);
  }

  getConnectedUsers(): string[] {
    return Array.from(this.userSockets.keys());
  }

  getUserSocketCount(userId: string): number {
    return this.userSockets.get(userId)?.size || 0;
  }

  getTotalConnections(): number {
    let count = 0;
    for (const sockets of this.userSockets.values()) {
      count += sockets.size;
    }
    return count;
  }

  isUserOnline(userId: string): boolean {
    return this.userSockets.has(userId);
  }

  async sendTicketUpdate(ticketId: string, update: any): Promise<void> {
    this.sendToTicket(ticketId, 'ticket:updated', update);
  }

  async sendTicketComment(ticketId: string, comment: any): Promise<void> {
    this.sendToTicket(ticketId, 'comment:new', comment);
  }

  async sendTicketStatusChange(ticketId: string, status: string, oldStatus: string): Promise<void> {
    this.sendToTicket(ticketId, 'ticket:status-changed', { ticketId, status, oldStatus });
  }

  async sendTicketAssignment(ticketId: string, assignee: any): Promise<void> {
    this.sendToTicket(ticketId, 'ticket:assigned', { ticketId, assignee });
  }

  async sendSLAWarning(ticketId: string, warning: any): Promise<void> {
    this.sendToTicket(ticketId, 'sla:warning', warning);
  }

  async sendSLABreach(ticketId: string, breach: any): Promise<void> {
    this.sendToTicket(ticketId, 'sla:breached', breach);
  }

  async sendApprovalRequest(approval: any): Promise<void> {
    this.sendToUser(approval.approverId, 'approval:requested', approval);
  }

  async sendApprovalResponse(approval: any): Promise<void> {
    this.sendToUser(approval.requesterId, 'approval:responded', approval);
  }

  shutdown(): void {
    if (this.io) {
      this.io.close();
      this.io = null;
      this.userSockets.clear();
      logger.info('WebSocket server shut down');
    }
  }
}

export const wsService = new WebSocketService();
export default wsService;