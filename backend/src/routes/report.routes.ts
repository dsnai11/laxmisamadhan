import { Router } from 'express';
import { authenticate, requireRole } from '@middleware/auth.middleware';
import { validateQuery } from '@middleware/validation.middleware';
import * as reportController from '@controllers/report.controller';
import { z } from 'zod';

const router = Router();

router.use(authenticate);

router.get('/dashboard', requireRole('SUPER_ADMIN', 'ADMIN', 'DEPARTMENT_HEAD', 'TEAM_LEAD', 'AGENT'), reportController.getDashboardStats);
router.get('/tickets/trend', requireRole('SUPER_ADMIN', 'ADMIN', 'DEPARTMENT_HEAD', 'TEAM_LEAD', 'AGENT'), validateQuery(z.object({
  departmentId: z.string().uuid().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  days: z.coerce.number().int().positive().max(365).default(30),
})), reportController.getTicketTrend);

router.get('/agents/performance', requireRole('SUPER_ADMIN', 'ADMIN', 'DEPARTMENT_HEAD', 'TEAM_LEAD'), reportController.getAgentPerformance);
router.get('/management-dashboard', requireRole('SUPER_ADMIN', 'ADMIN', 'DEPARTMENT_HEAD'), reportController.getManagementDashboard);
router.get('/departments', requireRole('SUPER_ADMIN', 'ADMIN'), reportController.getDepartmentReport);
router.get('/sla', requireRole('SUPER_ADMIN', 'ADMIN', 'DEPARTMENT_HEAD', 'TEAM_LEAD', 'AGENT'), reportController.getSLAReport);

router.get('/export', requireRole('SUPER_ADMIN', 'ADMIN', 'DEPARTMENT_HEAD'), validateQuery(z.object({
  departmentId: z.string().uuid().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  format: z.enum(['csv', 'json']).default('csv'),
})), reportController.exportTickets);

export default router;