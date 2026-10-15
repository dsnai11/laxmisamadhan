import { Response } from 'express';
import { asyncHandler } from '@middleware/error.middleware';
import escalationService from '@services/escalation.service';
import { AuthenticatedRequest } from '@middleware/auth.middleware';

export const runEscalationCheck = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const result = await escalationService.runEscalationCheck();

  res.json({
    success: true,
    message: 'Escalation check executed successfully',
    data: result,
  });
});
