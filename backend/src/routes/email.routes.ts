import { Router } from 'express';
import { handleInboundEmail, syncInboundEmails, getEmailStatus } from '@controllers/email.controller';

const router = Router();

// Route for inbound email parsing (Webhook or Gateway Simulator)
router.post('/inbound', handleInboundEmail);
router.post('/simulate-inbound', handleInboundEmail);

// On-demand sync & status check for IMAP mail poller
router.post('/sync', syncInboundEmails);
router.get('/status', getEmailStatus);

export default router;
