import { z } from 'zod';

export const knowledgeBaseSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().max(1000).optional(),
  departmentId: z.string().uuid('Invalid department ID'),
  isPublic: z.boolean().default(false),
});

export const updateKnowledgeBaseSchema = knowledgeBaseSchema.partial();

export const articleSchema = z.object({
  knowledgeBaseId: z.string().uuid('Invalid knowledge base ID'),
  title: z.string().min(1, 'Title is required').max(200),
  content: z.string().min(1, 'Content is required'),
  excerpt: z.string().max(500).optional(),
  category: z.string().max(100).optional(),
  tags: z.array(z.string().max(50)).max(10).optional(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).default('DRAFT'),
});

export const updateArticleSchema = articleSchema.partial();

export const articleQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  sortBy: z.enum(['createdAt', 'updatedAt', 'title', 'viewCount', 'helpfulCount']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  search: z.string().optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).optional(),
  knowledgeBaseId: z.string().uuid().optional(),
  authorId: z.string().uuid().optional(),
});

export const articleReviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  feedback: z.string().max(2000).optional(),
});

export const customFieldSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100).regex(/^[a-zA-Z][a-zA-Z0-9_]*$/),
  label: z.string().min(1, 'Label is required').max(200),
  type: z.enum(['TEXT', 'TEXTAREA', 'NUMBER', 'SELECT', 'MULTISELECT', 'BOOLEAN', 'DATE', 'DATETIME', 'EMAIL', 'URL', 'FILE']),
  departmentId: z.string().uuid().optional(),
  category: z.enum(['INCIDENT', 'SERVICE_REQUEST', 'CHANGE_REQUEST', 'PROBLEM', 'ACCESS_REQUEST', 'HARDWARE_REQUEST', 'SOFTWARE_REQUEST', 'SECURITY_INCIDENT', 'AI_MODEL_REQUEST', 'DATA_REQUEST']).optional(),
  isRequired: z.boolean().default(false),
  options: z.array(z.object({
    value: z.string(),
    label: z.string(),
  })).optional(),
  validation: z.object({
    minLength: z.number().int().optional(),
    maxLength: z.number().int().optional(),
    min: z.number().optional(),
    max: z.number().optional(),
    pattern: z.string().optional(),
  }).optional(),
  defaultValue: z.any().optional(),
  order: z.number().int().default(0),
});

export const updateCustomFieldSchema = customFieldSchema.partial();

export type KnowledgeBaseInput = z.infer<typeof knowledgeBaseSchema>;
export type UpdateKnowledgeBaseInput = z.infer<typeof updateKnowledgeBaseSchema>;
export type ArticleInput = z.infer<typeof articleSchema>;
export type UpdateArticleInput = z.infer<typeof updateArticleSchema>;
export type ArticleQueryInput = z.infer<typeof articleQuerySchema>;
export type ArticleReviewInput = z.infer<typeof articleReviewSchema>;
export type CustomFieldInput = z.infer<typeof customFieldSchema>;
export type UpdateCustomFieldInput = z.infer<typeof updateCustomFieldSchema>;