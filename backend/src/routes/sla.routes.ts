import { Router } from 'express';
import { authenticate, requireRole } from '@middleware/auth.middleware';
import { validateBody, validateQuery, validateParams } from '@middleware/validation.middleware';
import * as slaController from '@controllers/sla.controller';
import * as validators from '@validators/ticket.validator';

const router = Router();

router.use(authenticate);
router.use(requireRole('SUPER_ADMIN', 'ADMIN', 'DEPARTMENT_HEAD'));

router.get('/', slaController.getPolicies);
router.get('/compliance', slaController.getSLACompliance);
router.get('/report', slaController.getSLAReport);
router.post('/check-timers', slaController.checkSLATimers);

router.post('/', requireRole('SUPER_ADMIN', 'ADMIN', 'DEPARTMENT_HEAD'), validateBody(validators.slaPolicySchema), slaController.createPolicy);

router.get('/:id', slaController.getPolicyById);
router.patch('/:id', requireRole('SUPER_ADMIN', 'ADMIN', 'DEPARTMENT_HEAD'), validateBody(validators.slaPolicySchema.partial()), slaController.updatePolicy);
router.delete('/:id', requireRole('SUPER_ADMIN', 'ADMIN', 'DEPARTMENT_HEAD'), slaController.deletePolicy);

export default router;