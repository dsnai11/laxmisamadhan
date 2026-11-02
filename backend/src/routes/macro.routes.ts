import { Router } from 'express';
import { authenticate, requireRole } from '@middleware/auth.middleware';
import * as macroController from '@controllers/macro.controller';

const router = Router();

router.use(authenticate);

router.get('/', macroController.getMacros);
router.post('/apply', requireRole('SUPER_ADMIN', 'ADMIN', 'DEPARTMENT_HEAD', 'TEAM_LEAD', 'AGENT'), macroController.applyMacro);

export default router;
