import { Router } from 'express';
import { authenticate, requireRole } from '@middleware/auth.middleware';
import { validateBody, validateQuery, validateParams } from '@middleware/validation.middleware';
import * as knowledgeController from '@controllers/knowledge.controller';
import * as validators from '@validators/knowledge.validator';

const router = Router();

router.use(authenticate);

router.get('/bases', knowledgeController.getKnowledgeBases);
router.post('/bases', requireRole('SUPER_ADMIN', 'ADMIN', 'DEPARTMENT_HEAD'), validateBody(validators.knowledgeBaseSchema), knowledgeController.createKnowledgeBase);
router.get('/bases/:id', knowledgeController.getKnowledgeBaseById);
router.patch('/bases/:id', requireRole('SUPER_ADMIN', 'ADMIN', 'DEPARTMENT_HEAD'), validateBody(validators.updateKnowledgeBaseSchema), knowledgeController.updateKnowledgeBase);
router.delete('/bases/:id', requireRole('SUPER_ADMIN', 'ADMIN'), knowledgeController.deleteKnowledgeBase);

router.get('/articles', validateQuery(validators.articleQuerySchema), knowledgeController.getArticles);
router.post('/articles', validateBody(validators.articleSchema), knowledgeController.createArticle);
router.get('/articles/categories', knowledgeController.getCategories);
router.get('/articles/:id', knowledgeController.getArticleById);
router.patch('/articles/:id', validateBody(validators.updateArticleSchema), knowledgeController.updateArticle);
router.delete('/articles/:id', knowledgeController.deleteArticle);
router.post('/articles/:id/review', validateBody(validators.articleReviewSchema), knowledgeController.reviewArticle);

router.get('/bases/:knowledgeBaseId/articles/:slug', knowledgeController.getArticleBySlug);

export default router;