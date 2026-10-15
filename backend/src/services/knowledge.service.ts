import { prisma } from '@config/prisma';
import { createLogger } from '@utils/logger';
import { logActivity } from '@middleware/audit.middleware';
import { Prisma } from '@prisma/client';

const logger = createLogger('knowledge-service');

interface KnowledgeBaseData {
  name: string;
  description?: string;
  departmentId: string;
  isPublic?: boolean;
}

interface ArticleData {
  knowledgeBaseId: string;
  title: string;
  content: string;
  excerpt?: string;
  category?: string;
  tags?: string[];
  status?: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
}

interface UpdateArticleData extends Partial<ArticleData> {}

class KnowledgeService {
  async createKnowledgeBase(data: KnowledgeBaseData, createdById: string): Promise<any> {
    const kb = await prisma.knowledgeBase.create({
      data: {
        name: data.name,
        description: data.description,
        departmentId: data.departmentId,
        isPublic: data.isPublic ?? false,
      },
      include: {
        department: { select: { id: true, name: true, type: true } },
      },
    });

    await logActivity(createdById, 'KNOWLEDGE_BASE_CREATED', `Created knowledge base ${kb.name}`, undefined, { kbId: kb.id });

    return kb;
  }

  async getKnowledgeBases(departmentId?: string): Promise<any[]> {
    return prisma.knowledgeBase.findMany({
      where: departmentId ? { departmentId } : {},
      include: {
        department: { select: { id: true, name: true, type: true } },
        _count: { select: { articles: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async getKnowledgeBaseById(id: string): Promise<any> {
    const kb = await prisma.knowledgeBase.findUnique({
      where: { id },
      include: {
        department: { select: { id: true, name: true, type: true } },
        articles: {
          where: { status: 'PUBLISHED' },
          orderBy: { createdAt: 'desc' },
          include: {
            author: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
    });

    if (!kb) throw new Error('Knowledge base not found');
    return kb;
  }

  async updateKnowledgeBase(id: string, data: Partial<KnowledgeBaseData>, updatedById: string): Promise<any> {
    const kb = await prisma.knowledgeBase.update({
      where: { id },
      data,
      include: { department: { select: { id: true, name: true } } },
    });

    await logActivity(updatedById, 'KNOWLEDGE_BASE_UPDATED', `Updated knowledge base`, undefined, { kbId: id, changes: data });

    return kb;
  }

  async deleteKnowledgeBase(id: string, deletedById: string): Promise<void> {
    await prisma.knowledgeBase.delete({ where: { id } });
    await logActivity(deletedById, 'KNOWLEDGE_BASE_DELETED', `Deleted knowledge base`, undefined, { kbId: id });
  }

  async createArticle(data: ArticleData, authorId: string): Promise<any> {
    const slug = this.generateSlug(data.title);
    const existingSlug = await prisma.knowledgeArticle.findFirst({
      where: { knowledgeBaseId: data.knowledgeBaseId, slug },
    });
    const finalSlug = existingSlug ? `${slug}-${Date.now()}` : slug;

    const article = await prisma.knowledgeArticle.create({
      data: {
        knowledgeBaseId: data.knowledgeBaseId,
        title: data.title,
        slug: finalSlug,
        content: data.content,
        excerpt: data.excerpt,
        category: data.category,
        tags: data.tags || [],
        status: data.status || 'DRAFT',
        authorId,
        publishedAt: data.status === 'PUBLISHED' ? new Date() : null,
      },
      include: {
        author: { select: { id: true, firstName: true, lastName: true } },
        knowledgeBase: { select: { id: true, name: true } },
      },
    });

    await logActivity(authorId, 'ARTICLE_CREATED', `Created article ${article.title}`, undefined, { articleId: article.id });

    return article;
  }

  async getArticles(params: {
    page: number;
    limit: number;
    sortBy: string;
    sortOrder: 'asc' | 'desc';
    search?: string;
    category?: string;
    tags?: string[];
    status?: string;
    knowledgeBaseId?: string;
    authorId?: string;
  }): Promise<any> {
    const where: Prisma.KnowledgeArticleWhereInput = {};

    if (params.search) {
      where.OR = [
        { title: { contains: params.search, mode: 'insensitive' } },
        { content: { contains: params.search, mode: 'insensitive' } },
        { excerpt: { contains: params.search, mode: 'insensitive' } },
      ];
    }
    if (params.category) where.category = params.category;
    if (params.tags?.length) where.tags = { hasSome: params.tags };
    if (params.status) where.status = params.status as any;
    if (params.knowledgeBaseId) where.knowledgeBaseId = params.knowledgeBaseId;
    if (params.authorId) where.authorId = params.authorId;

    const orderBy: Prisma.KnowledgeArticleOrderByWithRelationInput = { [params.sortBy]: params.sortOrder };

    const [articles, total] = await Promise.all([
      prisma.knowledgeArticle.findMany({
        where,
        orderBy,
        skip: (params.page - 1) * params.limit,
        take: params.limit,
        include: {
          author: { select: { id: true, firstName: true, lastName: true, avatar: true } },
          knowledgeBase: { select: { id: true, name: true } },
        },
      }),
      prisma.knowledgeArticle.count({ where }),
    ]);

    return { articles, total, page: params.page, totalPages: Math.ceil(total / params.limit) };
  }

  async getArticleById(id: string): Promise<any> {
    const article = await prisma.knowledgeArticle.findUnique({
      where: { id },
      include: {
        author: { select: { id: true, firstName: true, lastName: true, email: true, avatar: true } },
        knowledgeBase: { select: { id: true, name: true, departmentId: true } },
        attachments: { select: { id: true, fileName: true, originalName: true, mimeType: true, size: true, url: true } },
        reviews: {
          include: { user: { select: { id: true, firstName: true, lastName: true } } },
        },
      },
    });

    if (!article) throw new Error('Article not found');
    return article;
  }

  async getArticleBySlug(knowledgeBaseId: string, slug: string): Promise<any> {
    const article = await prisma.knowledgeArticle.findUnique({
      where: { knowledgeBaseId_slug: { knowledgeBaseId, slug } },
      include: {
        author: { select: { id: true, firstName: true, lastName: true, avatar: true } },
        knowledgeBase: { select: { id: true, name: true } },
        attachments: { select: { id: true, fileName: true, originalName: true, mimeType: true, size: true, url: true } },
      },
    });

    if (!article) throw new Error('Article not found');

    await prisma.knowledgeArticle.update({
      where: { id: article.id },
      data: { viewCount: { increment: 1 } },
    });

    return article;
  }

  async updateArticle(id: string, data: UpdateArticleData, updatedById: string): Promise<any> {
    const article = await prisma.knowledgeArticle.findUnique({ where: { id } });
    if (!article) throw new Error('Article not found');

    const updates: Prisma.KnowledgeArticleUpdateInput = { ...data };
    if (data.status === 'PUBLISHED' && article.status !== 'PUBLISHED') {
      updates.publishedAt = new Date();
    }

    const updatedArticle = await prisma.knowledgeArticle.update({
      where: { id },
      data: updates,
      include: {
        author: { select: { id: true, firstName: true, lastName: true } },
        knowledgeBase: { select: { id: true, name: true } },
      },
    });

    await logActivity(updatedById, 'ARTICLE_UPDATED', `Updated article`, undefined, { articleId: id, changes: data });

    return updatedArticle;
  }

  async deleteArticle(id: string, deletedById: string): Promise<void> {
    await prisma.knowledgeArticle.delete({ where: { id } });
    await logActivity(deletedById, 'ARTICLE_DELETED', `Deleted article`, undefined, { articleId: id });
  }

  async reviewArticle(articleId: string, userId: string, rating: number, feedback?: string): Promise<any> {
    const review = await prisma.knowledgeArticleReview.upsert({
      where: { articleId_userId: { articleId, userId } },
      create: { articleId, userId, rating, feedback },
      update: { rating, feedback },
      include: { user: { select: { id: true, firstName: true, lastName: true } } },
    });

    const stats = await prisma.knowledgeArticleReview.aggregate({
      where: { articleId },
      _avg: { rating: true },
      _count: true,
    });

    await prisma.knowledgeArticle.update({
      where: { id: articleId },
      data: {
        helpfulCount: stats._count,
        // Not helpful count would need separate tracking
      },
    });

    return review;
  }

  async getCategories(knowledgeBaseId?: string): Promise<string[]> {
    const articles = await prisma.knowledgeArticle.findMany({
      where: { knowledgeBaseId, status: 'PUBLISHED', category: { not: null } },
      select: { category: true },
      distinct: ['category'],
    });
    return articles.map(a => a.category!).filter(Boolean);
  }

  private generateSlug(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .substring(0, 100);
  }
}

export const knowledgeService = new KnowledgeService();
export default knowledgeService;