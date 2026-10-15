import { Router } from 'express';
import { handleInboundEmail } from '@controllers/email.controller';

const router = Router();

// Route for inbound email parsing (Webhook or Gateway Simulator)
router.post('/inbound', handleInboundEmail);
router.post('/simulate-inbound', handleInboundEmail);

export default router;
