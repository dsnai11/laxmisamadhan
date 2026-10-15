import { Router } from 'express';
import { authenticate, requireRole } from '@middleware/auth.middleware';
import * as escalationController from '@controllers/escalation.controller';

const router = Router();

router.use(authenticate);

router.post('/run', requireRole('SUPER_ADMIN', 'ADMIN', 'DEPARTMENT_HEAD', 'TEAM_LEAD'), escalationController.runEscalationCheck);

export default router;
