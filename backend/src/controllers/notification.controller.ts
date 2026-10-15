import { Request, Response } from 'express';
import { asyncHandler } from '@middleware/error.middleware';
import { AppError } from '@middleware/error.middleware';
import notificationService from '@services/notification.service';
import { AuthenticatedRequest } from '@middleware/auth.middleware';
import { NotificationType } from '@prisma/client';

export const getNotifications = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const params = {
    page: parseInt(req.query.page as string) || 1,
    limit: parseInt(req.query.limit as string) || 20,
    isRead: req.query.isRead === 'true' ? true : req.query.isRead === 'false' ? false : undefined,
    type: req.query.type as NotificationType,
  };

  const result = await notificationService.getNotifications(req.user!.userId, params);

  res.json({
    success: true,
    data: result,
  });
});

export const markAsRead = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { notificationIds } = req.body;
  
  if (!notificationIds || !Array.isArray(notificationIds)) {
    throw new AppError('Notification IDs array required', 400, 'INVALID_IDS');
  }

  const count = await notificationService.markAsRead(req.user!.userId, notificationIds);

  res.json({
    success: true,
    message: `${count} notifications marked as read`,
  });
});

export const markAllAsRead = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const count = await notificationService.markAllAsRead(req.user!.userId);

  res.json({
    success: true,
    message: `${count} notifications marked as read`,
  });
});

export const deleteNotification = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  await notificationService.deleteNotification(req.user!.userId, req.params.id);

  res.json({
    success: true,
    message: 'Notification deleted successfully',
  });
});

export const getUnreadCount = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const count = await notificationService.getUnreadCount(req.user!.userId);

  res.json({
    success: true,
    data: { count },
  });
});