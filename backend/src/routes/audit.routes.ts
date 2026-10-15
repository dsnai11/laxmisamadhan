import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '@config/prisma';
import { asyncHandler } from '@middleware/error.middleware';
import { authenticate, requireRole } from '@middleware/auth.middleware';
import { validateQuery } from '@middleware/validation.middleware';

const router = Router();

router.use(authenticate);
router.use(requireRole('SUPER_ADMIN', 'ADMIN'));

const querySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(25),
  action: z.string().optional(),
  userId: z.string().uuid().optional(),
  search: z.string().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
});

router.get('/', validateQuery(querySchema), asyncHandler(async (req, res) => {
  const { page, limit, action, userId, search, dateFrom, dateTo } = req.query as any;

  const where: any = {};
  if (action) where.action = action;
  if (userId) where.userId = userId;
  if (search) where.description = { contains: search, mode: 'insensitive' };
  if (dateFrom || dateTo) {
    where.createdAt = {};
    if (dateFrom) where.createdAt.gte = new Date(dateFrom);
    if (dateTo) where.createdAt.lte = new Date(dateTo);
  }

  const [logs, total, actions] = await Promise.all([
    prisma.activityLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
        ticket: { select: { id: true, ticketNumber: true } },
      },
    }),
    prisma.activityLog.count({ where }),
    prisma.activityLog.findMany({ distinct: ['action'], select: { action: true }, orderBy: { action: 'asc' } }),
  ]);

  res.json({
    success: true,
    data: { logs, total, page, totalPages: Math.ceil(total / limit), actions: actions.map((a) => a.action) },
  });
}));

export default router;
