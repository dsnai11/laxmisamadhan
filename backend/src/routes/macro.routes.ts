import { Router } from 'express';
import { authenticate } from '@middleware/auth.middleware';
import * as macroController from '@controllers/macro.controller';

const router = Router();

router.use(authenticate);

router.get('/', macroController.getMacros);
router.post('/apply', macroController.applyMacro);

export default router;
