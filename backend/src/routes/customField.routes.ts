import { Router } from 'express';
import { authenticate, requireRole } from '@middleware/auth.middleware';
import { validateBody, validateQuery, validateParams } from '@middleware/validation.middleware';
import * as customFieldController from '@controllers/customField.controller';
import * as validators from '@validators/knowledge.validator';

const router = Router();

router.use(authenticate);

router.get('/', validateQuery(validators.customFieldSchema.pick({ departmentId: true, category: true }).partial()), customFieldController.getFields);
router.post('/', requireRole('SUPER_ADMIN', 'ADMIN', 'DEPARTMENT_HEAD'), validateBody(validators.customFieldSchema), customFieldController.createField);

router.get('/:id', customFieldController.getFieldById);
router.patch('/:id', requireRole('SUPER_ADMIN', 'ADMIN', 'DEPARTMENT_HEAD'), validateBody(validators.updateCustomFieldSchema), customFieldController.updateField);
router.delete('/:id', requireRole('SUPER_ADMIN', 'ADMIN'), customFieldController.deleteField);

router.post('/:id/value', customFieldController.setFieldValue);
router.get('/ticket/:ticketId', customFieldController.getTicketFieldValues);
router.get('/user/me', customFieldController.getUserFieldValues);

export default router;