import { prisma } from '@config/prisma';
import { createLogger } from '@utils/logger';
import { NotificationType, Prisma } from '@prisma/client';

const logger = createLogger('notification-service');

interface NotificationData {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  referenceId?: string;
  referenceType?: string;
  metadata?: Record<string, any>;
}

class NotificationService {
  async createNotification(data: NotificationData): Promise<any> {
    const notification = await prisma.notification.create({
      data,
      include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
    });

    return notification;
  }

  async createBulkNotifications(notifications: NotificationData[]): Promise<number> {
    const result = await prisma.notification.createMany({ data: notifications });
    return result.count;
  }

  async getNotifications(userId: string, params: { page: number; limit: number; isRead?: boolean; type?: NotificationType }): Promise<{ notifications: any[]; total: number; page: number; totalPages: number; unreadCount: number }> {
    const where: Prisma.NotificationWhereInput = { userId };
    if (params.isRead !== undefined) where.isRead = params.isRead;
    if (params.type) where.type = params.type;

    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (params.page - 1) * params.limit,
        take: params.limit,
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { userId, isRead: false } }),
    ]);

    return {
      notifications,
      total,
      page: params.page,
      totalPages: Math.ceil(total / params.limit),
      unreadCount,
    };
  }

  async markAsRead(userId: string, notificationIds: string[]): Promise<number> {
    const result = await prisma.notification.updateMany({
      where: { id: { in: notificationIds }, userId },
      data: { isRead: true, readAt: new Date() },
    });
    return result.count;
  }

  async markAllAsRead(userId: string): Promise<number> {
    const result = await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
    return result.count;
  }

  async deleteNotification(userId: string, notificationId: string): Promise<void> {
    await prisma.notification.deleteMany({ where: { id: notificationId, userId } });
  }

  async getUnreadCount(userId: string): Promise<number> {
    return prisma.notification.count({ where: { userId, isRead: false } });
  }

  async cleanupOldNotifications(daysToKeep: number = 90): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = await prisma.notification.deleteMany({
      where: { createdAt: { lt: cutoffDate }, isRead: true },
    });

    logger.info('Cleaned up old notifications', { deletedCount: result.count });
    return result.count;
  }

  async sendSystemNotification(userIds: string[], title: string, message: string, metadata?: Record<string, any>): Promise<number> {
    const notifications = userIds.map(userId => ({
      userId,
      type: 'SYSTEM_ALERT' as NotificationType,
      title,
      message,
      metadata,
    }));

    return this.createBulkNotifications(notifications);
  }

  async sendToDepartment(departmentId: string, title: string, message: string, metadata?: Record<string, any>): Promise<number> {
    const users = await prisma.user.findMany({
      where: { departmentId, status: 'ACTIVE' },
      select: { id: true },
    });

    return this.sendSystemNotification(users.map(u => u.id), title, message, metadata);
  }

  async sendToRole(role: string, title: string, message: string, metadata?: Record<string, any>): Promise<number> {
    const users = await prisma.user.findMany({
      where: { role: role as any, status: 'ACTIVE' },
      select: { id: true },
    });

    return this.sendSystemNotification(users.map(u => u.id), title, message, metadata);
  }
}

export const notificationService = new NotificationService();
export default notificationService;