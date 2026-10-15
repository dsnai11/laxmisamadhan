import { Router } from 'express';
import { authenticate } from '@middleware/auth.middleware';
import { validateQuery } from '@middleware/validation.middleware';
import * as notificationController from '@controllers/notification.controller';
import { NotificationType } from '@prisma/client';
import { z } from 'zod';

const router = Router();

router.use(authenticate);

router.get('/', validateQuery(z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  isRead: z.coerce.boolean().optional(),
  type: z.nativeEnum(NotificationType).optional(),
})), notificationController.getNotifications);

router.get('/unread-count', notificationController.getUnreadCount);
router.patch('/read', notificationController.markAsRead);
router.patch('/read-all', notificationController.markAllAsRead);
router.delete('/:id', notificationController.deleteNotification);

export default router;