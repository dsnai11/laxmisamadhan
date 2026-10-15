import { Request, Response } from 'express';
import { asyncHandler } from '@middleware/error.middleware';
import { AppError } from '@middleware/error.middleware';
import customFieldService from '@services/customField.service';
import { AuthenticatedRequest } from '@middleware/auth.middleware';
import { TicketCategory } from '@prisma/client';

export const createField = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const field = await customFieldService.createField(req.body, req.user!.userId);

  res.status(201).json({
    success: true,
    message: 'Custom field created successfully',
    data: field,
  });
});

export const getFields = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { departmentId, category } = req.query;
  
  const fields = await customFieldService.getFields(departmentId as string, category as TicketCategory);

  res.json({
    success: true,
    data: fields,
  });
});

export const getFieldById = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const field = await customFieldService.getFieldById(req.params.id);

  res.json({
    success: true,
    data: field,
  });
});

export const updateField = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const field = await customFieldService.updateField(req.params.id, req.body, req.user!.userId);

  res.json({
    success: true,
    message: 'Custom field updated successfully',
    data: field,
  });
});

export const deleteField = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  await customFieldService.deleteField(req.params.id, req.user!.userId);

  res.json({
    success: true,
    message: 'Custom field deleted successfully',
  });
});

export const setFieldValue = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { ticketId, value } = req.body;
  
  const record = await customFieldService.setFieldValue(req.params.id, ticketId || null, req.user!.userId, value);

  res.json({
    success: true,
    message: 'Field value saved successfully',
    data: record,
  });
});

export const getTicketFieldValues = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const values = await customFieldService.getFieldValues(req.params.ticketId);

  res.json({
    success: true,
    data: values,
  });
});

export const getUserFieldValues = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const values = await customFieldService.getUserFieldValues(req.user!.userId);

  res.json({
    success: true,
    data: values,
  });
});