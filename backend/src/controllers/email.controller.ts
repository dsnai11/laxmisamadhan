import { Request, Response } from 'express';
import { asyncHandler } from '@middleware/error.middleware';
import inboundEmailService from '@services/inboundEmail.service';

/**
 * Public Webhook or Mail Gateway Endpoint for Inbound Email to Ticket
 */
export const handleInboundEmail = asyncHandler(async (req: Request, res: Response) => {
  const { fromEmail, fromName, toEmail, subject, body, attachments } = req.body;

  if (!fromEmail || !toEmail || !subject) {
    return res.status(400).json({
      success: false,
      error: 'Missing required email fields: fromEmail, toEmail, and subject are required.',
    });
  }

  const result = await inboundEmailService.processInboundEmail({
    fromEmail,
    fromName,
    toEmail,
    subject,
    body: body || '',
    attachments,
  });

  return res.status(200).json({
    success: true,
    message: result.action === 'TICKET_CREATED' ? 'Ticket created from inbound email' : 'Comment added from inbound email',
    data: result,
  });
});
