import { Request, Response } from 'express';
import { asyncHandler } from '@middleware/error.middleware';
import { AppError } from '@middleware/error.middleware';
import knowledgeService from '@services/knowledge.service';
import { AuthenticatedRequest } from '@middleware/auth.middleware';

export const createKnowledgeBase = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const kb = await knowledgeService.createKnowledgeBase(req.body, req.user!.userId);

  res.status(201).json({
    success: true,
    message: 'Knowledge base created successfully',
    data: kb,
  });
});

export const getKnowledgeBases = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { departmentId } = req.query;
  
  const kbs = await knowledgeService.getKnowledgeBases(departmentId as string);

  res.json({
    success: true,
    data: kbs,
  });
});

export const getKnowledgeBaseById = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const kb = await knowledgeService.getKnowledgeBaseById(req.params.id);

  res.json({
    success: true,
    data: kb,
  });
});

export const updateKnowledgeBase = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const kb = await knowledgeService.updateKnowledgeBase(req.params.id, req.body, req.user!.userId);

  res.json({
    success: true,
    message: 'Knowledge base updated successfully',
    data: kb,
  });
});

export const deleteKnowledgeBase = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  await knowledgeService.deleteKnowledgeBase(req.params.id, req.user!.userId);

  res.json({
    success: true,
    message: 'Knowledge base deleted successfully',
  });
});

export const createArticle = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const article = await knowledgeService.createArticle(req.body, req.user!.userId);

  res.status(201).json({
    success: true,
    message: 'Article created successfully',
    data: article,
  });
});

export const getArticles = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const params = {
    page: parseInt(req.query.page as string) || 1,
    limit: parseInt(req.query.limit as string) || 20,
    sortBy: req.query.sortBy as string || 'createdAt',
    sortOrder: (req.query.sortOrder as 'asc' | 'desc') || 'desc',
    search: req.query.search as string,
    category: req.query.category as string,
    tags: req.query.tags ? (req.query.tags as string).split(',') : undefined,
    status: req.query.status as string,
    knowledgeBaseId: req.query.knowledgeBaseId as string,
    authorId: req.query.authorId as string,
  };

  const result = await knowledgeService.getArticles(params);

  res.json({
    success: true,
    data: result,
  });
});

export const getArticleById = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const article = await knowledgeService.getArticleById(req.params.id);

  res.json({
    success: true,
    data: article,
  });
});

export const getArticleBySlug = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { knowledgeBaseId, slug } = req.params;
  
  const article = await knowledgeService.getArticleBySlug(knowledgeBaseId, slug);

  res.json({
    success: true,
    data: article,
  });
});

export const updateArticle = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const article = await knowledgeService.updateArticle(req.params.id, req.body, req.user!.userId);

  res.json({
    success: true,
    message: 'Article updated successfully',
    data: article,
  });
});

export const deleteArticle = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  await knowledgeService.deleteArticle(req.params.id, req.user!.userId);

  res.json({
    success: true,
    message: 'Article deleted successfully',
  });
});

export const reviewArticle = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { rating, feedback } = req.body;
  
  const review = await knowledgeService.reviewArticle(req.params.id, req.user!.userId, rating, feedback);

  res.json({
    success: true,
    message: 'Review submitted successfully',
    data: review,
  });
});

export const getCategories = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { knowledgeBaseId } = req.query;
  
  const categories = await knowledgeService.getCategories(knowledgeBaseId as string);

  res.json({
    success: true,
    data: categories,
  });
});