import { Response } from 'express';
import { asyncHandler } from '@middleware/error.middleware';
import aiService from '@services/ai.service';
import { AuthenticatedRequest } from '@middleware/auth.middleware';

export const summarizeTicket = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { ticketId } = req.body;
  const result = await aiService.summarizeTicket(ticketId);

  res.json({
    success: true,
    data: result,
  });
});

export const suggestReply = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { ticketId, tone } = req.body;
  const result = await aiService.suggestReply(ticketId, tone);

  res.json({
    success: true,
    data: result,
  });
});

export const analyzeSentiment = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { ticketId } = req.body;
  const result = await aiService.analyzeSentiment(ticketId);

  res.json({
    success: true,
    data: result,
  });
});

export const suggestArticles = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { ticketId } = req.body;
  const result = await aiService.suggestArticles(ticketId);

  res.json({
    success: true,
    data: result,
  });
});
