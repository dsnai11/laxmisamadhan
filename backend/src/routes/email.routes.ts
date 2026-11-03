import { Router } from 'express';
import { authenticate, requireRole } from '@middleware/auth.middleware';
import { handleInboundEmail, syncInboundEmails, getEmailStatus } from '@controllers/email.controller';

const router = Router();

// Secure email routes: IMAP background poller handles automatic ingestion.
// Manual endpoints require admin authentication.
router.use(authenticate);
router.use(requireRole('SUPER_ADMIN', 'ADMIN'));

router.post('/inbound', handleInboundEmail);
router.post('/simulate-inbound', handleInboundEmail);
router.post('/sync', syncInboundEmails);
router.get('/status', getEmailStatus);

export default router;
