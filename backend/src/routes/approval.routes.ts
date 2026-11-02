import { Router } from 'express';
import { authenticate } from '@middleware/auth.middleware';
import { validateBody, validateParams } from '@middleware/validation.middleware';
import * as approvalController from '@controllers/approval.controller';
import * as validators from '@validators/ticket.validator';

const router = Router();

router.use(authenticate);

router.get('/pending', approvalController.getPendingApprovals);
router.get('/eligible-approvers', approvalController.getEligibleApprovers);

router.post('/', validateBody(validators.approvalSchema), approvalController.createApproval);

router.get('/ticket/:ticketId', approvalController.getApprovals);
router.get('/:id', approvalController.getApprovalById);
router.post('/:id/respond', validateBody(validators.approvalResponseSchema), approvalController.respondToApproval);
router.post('/:id/cancel', approvalController.cancelApproval);

export default router;