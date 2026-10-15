import { Response } from 'express';
import { asyncHandler } from '@middleware/error.middleware';
import macroService from '@services/macro.service';
import { AuthenticatedRequest } from '@middleware/auth.middleware';

export const getMacros = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const macros = await macroService.getMacros();

  res.json({
    success: true,
    data: macros,
  });
});

export const applyMacro = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { ticketId, macroId, resolutionText } = req.body;
  const result = await macroService.applyMacro(ticketId, macroId, req.user!.userId, req.user!.role, resolutionText);

  res.json({
    success: true,
    message: `Macro "${result.macroName}" applied successfully`,
    data: result,
  });
});
