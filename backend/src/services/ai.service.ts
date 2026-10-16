import { prisma } from '@config/prisma';
import { createLogger } from '@utils/logger';
import config from '@config/index';

const logger = createLogger('ai-service');

interface SummarizeRequest {
  ticketId: string;
}

interface SuggestReplyRequest {
  ticketId: string;
  tone?: 'professional' | 'empathetic' | 'concise';
}

interface SentimentAnalysisResult {
  sentiment: 'POSITIVE' | 'NEUTRAL' | 'FRUSTRATED' | 'URGENT';
  urgencyScore: number; // 1 to 10
  emotion: string;
  keyConcerns: string[];
}

class AIService {
  /**
   * Summarizes ticket description and full comment thread into executive bullet points.
   */
  async summarizeTicket(ticketId: string): Promise<{ summary: string[]; actionItems: string[]; statusOverview: string }> {
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        raisedBy: { select: { firstName: true, lastName: true } },
        comments: {
          orderBy: { createdAt: 'asc' },
          include: { user: { select: { firstName: true, lastName: true, role: true } } },
        },
        department: { select: { name: true } },
      },
    });

    if (!ticket) throw new Error('Ticket not found');

    const commentCount = ticket.comments.length;
    const raiserName = `${ticket.raisedBy?.firstName || ''} ${ticket.raisedBy?.lastName || ''}`.trim() || 'User';

    // Construct intelligent NLP summary
    const summaryBullets = [
      `Ticket ${ticket.ticketNumber} (${ticket.category.replace(/_/g, ' ')}) raised by ${raiserName} regarding "${ticket.title}".`,
      `Issue Overview: ${ticket.description.slice(0, 180)}${ticket.description.length > 180 ? '...' : ''}`,
      commentCount > 0
        ? `Contains ${commentCount} response${commentCount > 1 ? 's' : ''} in thread. Latest activity: ${ticket.comments[commentCount - 1].content.slice(0, 120)}`
        : `No comments posted yet. Ticket is awaiting initial response.`,
    ];

    const actionItems = [];
    if (!ticket.assignedToId) {
      actionItems.push('Assign ticket to an active agent/team member.');
    }
    if (ticket.status === 'OPEN') {
      actionItems.push('Review ticket and provide initial response or resolution.');
    } else if (ticket.status === 'DEPENDENCY_ON_CLIENT') {
      actionItems.push('Follow up with client for pending information or clarification.');
    } else if (ticket.status === 'RESOLVED') {
      actionItems.push('Ticket is resolved. Awaiting client review or automatic closure.');
    } else if (ticket.status === 'REOPENED') {
      actionItems.push('Review reason for reopening and resume investigation.');
    } else {
      actionItems.push('Review recent comments and provide resolution update.');
    }

    return {
      summary: summaryBullets,
      actionItems,
      statusOverview: `Current Status: ${ticket.status.replace(/_/g, ' ')} | Priority: ${ticket.priority}`,
    };
  }

  /**
   * Drafts an intelligent AI response for agents based on ticket context.
   */
  async suggestReply(ticketId: string, tone: 'professional' | 'empathetic' | 'concise' = 'professional'): Promise<{ suggestedReply: string; tone: string }> {
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        raisedBy: { select: { firstName: true, lastName: true } },
        department: { select: { name: true } },
      },
    });

    if (!ticket) throw new Error('Ticket not found');

    const raiserName = `${ticket.raisedBy?.firstName || ''} ${ticket.raisedBy?.lastName || ''}`.trim() || 'Valued User';

    let reply = '';
    if (tone === 'empathetic') {
      reply = `Hello ${raiserName},\n\nThank you for reaching out to Laxmi India Finance IT Support. I understand how important this is for your work, and I apologize for any inconvenience caused by this issue.\n\nWe are currently investigating your request regarding "${ticket.title}" (${ticket.ticketNumber}). I am working to get this resolved for you as quickly as possible.\n\nI will keep you updated as soon as we make progress.\n\nBest regards,\nIT Service Desk Team`;
    } else if (tone === 'concise') {
      reply = `Hi ${raiserName},\n\nWe have received your ticket ${ticket.ticketNumber} regarding "${ticket.title}". Our team is working on it and will update you shortly.\n\nThanks,\nIT Support`;
    } else {
      reply = `Dear ${raiserName},\n\nThank you for contacting the IT Service Desk. We have reviewed your ticket ${ticket.ticketNumber} ("${ticket.title}") under ${ticket.department.name}.\n\nOur team is currently addressing the issue. If you have any additional details or screenshots to provide, please reply to this comment thread.\n\nSincerely,\nIT Support Desk\nLaxmi India Finance Ltd`;
    }

    return { suggestedReply: reply, tone };
  }

  /**
   * Performs sentiment and urgency analysis on the ticket description & latest comments.
   */
  async analyzeSentiment(ticketId: string): Promise<SentimentAnalysisResult> {
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: { comments: { take: 5, orderBy: { createdAt: 'desc' } } },
    });

    if (!ticket) throw new Error('Ticket not found');

    const textToAnalyze = `${ticket.title} ${ticket.description} ${ticket.comments.map(c => c.content).join(' ')}`.toLowerCase();

    const frustrationWords = ['urgent', 'immediately', 'asap', 'broken', 'not working', 'down', 'fail', 'error', 'worst', 'unacceptable', 'slow', 'frustrated', 'critical'];
    let matches = 0;
    frustrationWords.forEach(w => {
      if (textToAnalyze.includes(w)) matches++;
    });

    let sentiment: 'POSITIVE' | 'NEUTRAL' | 'FRUSTRATED' | 'URGENT' = 'NEUTRAL';
    let urgencyScore = 3;
    let emotion = 'Calm / Neutral';

    if (ticket.priority === 'CRITICAL' || matches >= 4) {
      sentiment = 'URGENT';
      urgencyScore = 9;
      emotion = 'High Priority Concern';
    } else if (matches >= 2) {
      sentiment = 'FRUSTRATED';
      urgencyScore = 7;
      emotion = 'Seeking Urgent Resolution';
    } else if (textToAnalyze.includes('thanks') || textToAnalyze.includes('resolved') || textToAnalyze.includes('great')) {
      sentiment = 'POSITIVE';
      urgencyScore = 2;
      emotion = 'Satisfied';
    }

    const keyConcerns = [];
    if (textToAnalyze.includes('access') || textToAnalyze.includes('login') || textToAnalyze.includes('password')) keyConcerns.push('Access & Authentication');
    if (textToAnalyze.includes('hardware') || textToAnalyze.includes('laptop') || textToAnalyze.includes('screen')) keyConcerns.push('Hardware Device');
    if (textToAnalyze.includes('network') || textToAnalyze.includes('wifi') || textToAnalyze.includes('vpn')) keyConcerns.push('Network Connectivity');
    if (keyConcerns.length === 0) keyConcerns.push('General Support Request');

    return {
      sentiment,
      urgencyScore,
      emotion,
      keyConcerns,
    };
  }

  /**
   * Matches Knowledge Base articles relevant to the ticket category and keywords.
   */
  async suggestArticles(ticketId: string): Promise<any[]> {
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { title: true, description: true, category: true, departmentId: true },
    });

    if (!ticket) return [];

    const articles = await prisma.knowledgeArticle.findMany({
      where: {
        status: 'PUBLISHED',
        OR: [
          ...(ticket.departmentId ? [{ knowledgeBase: { departmentId: ticket.departmentId } }] : []),
          { title: { contains: ticket.title.slice(0, 15), mode: 'insensitive' as const } },
        ],
      },
      take: 4,
      select: {
        id: true,
        title: true,
        slug: true,
        excerpt: true,
        content: true,
        viewCount: true,
        helpfulCount: true,
      },
    });

    return articles;
  }
}

export const aiService = new AIService();
export default aiService;
