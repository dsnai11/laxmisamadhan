import { Router } from 'express';
import { authenticate } from '@middleware/auth.middleware';
import * as aiController from '@controllers/ai.controller';

const router = Router();

router.use(authenticate);

router.post('/summarize', aiController.summarizeTicket);
router.post('/suggest-reply', aiController.suggestReply);
router.post('/analyze-sentiment', aiController.analyzeSentiment);
router.post('/suggest-articles', aiController.suggestArticles);

export default router;
