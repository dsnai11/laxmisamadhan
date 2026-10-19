import { Request, Response } from 'express';
import { asyncHandler } from '@middleware/error.middleware';
import { AppError } from '@middleware/error.middleware';
import ticketService from '@services/ticket.service';
import { createLogger } from '@utils/logger';
import { TicketStatus, TicketPriority, TicketCategory, UserRole } from '@prisma/client';
import { AuthenticatedRequest } from '@middleware/auth.middleware';

const logger = createLogger('ticket-controller');

export const createTicket = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const ticket = await ticketService.createTicket({
    ...req.body,
    raisedById: req.user!.userId,
  });

  res.status(201).json({
    success: true,
    message: 'Ticket created successfully',
    data: ticket,
  });
});

export const getTickets = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const params = {
    page: parseInt(req.query.page as string) || 1,
    limit: parseInt(req.query.limit as string) || 20,
    sortBy: req.query.sortBy as string || 'createdAt',
    sortOrder: (req.query.sortOrder as 'asc' | 'desc') || 'desc',
    status: req.query.status as TicketStatus,
    priority: req.query.priority as TicketPriority,
    category: req.query.category as TicketCategory,
    departmentId: req.query.departmentId as string,
    assignedToId: req.query.assignedToId as string,
    raisedById: req.query.raisedById as string,
    teamId: req.query.teamId as string,
    tags: req.query.tags ? (req.query.tags as string).split(',') : undefined,
    search: req.query.search as string,
    dateFrom: req.query.dateFrom ? new Date(req.query.dateFrom as string) : undefined,
    dateTo: req.query.dateTo ? new Date(req.query.dateTo as string) : undefined,
    slaStatus: req.query.slaStatus as any,
    hasAttachments: req.query.hasAttachments === undefined ? undefined : req.query.hasAttachments === 'true',
    isWatching: req.query.isWatching === 'true' ? true : undefined,
    unassigned: req.query.unassigned === 'true' ? true : undefined,
    userId: req.user!.userId,
    userRole: req.user!.role,
    userDepartmentId: req.user!.departmentId,
  };

  const result = await ticketService.getTickets(params);

  res.json({
    success: true,
    data: result,
  });
});

export const getTicketById = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const ticket = await ticketService.getTicketById(req.params.id, req.user!.userId, req.user!.role);

  res.json({
    success: true,
    data: ticket,
  });
});

export const updateTicket = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const ticket = await ticketService.updateTicket(
    req.params.id,
    req.body,
    req.user!.userId,
    req.user!.role,
    req.user?.roles
  );

  res.json({
    success: true,
    message: 'Ticket updated successfully',
    data: ticket,
  });
});

export const assignTicket = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { assignedToId, teamId, note } = req.body;

  const ticket = await ticketService.assignTicket(
    req.params.id,
    assignedToId,
    req.user!.userId,
    teamId,
    note,
    req.user!.role,
    req.user!.roles
  );

  res.json({
    success: true,
    message: 'Ticket assigned successfully',
    data: ticket,
  });
});

export const updateTicketStatus = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { status, resolution, resolutionSummary } = req.body;
  
  const ticket = await ticketService.updateStatus(
    req.params.id,
    status,
    req.user!.userId,
    req.user!.role,
    resolution,
    resolutionSummary
  );

  res.json({
    success: true,
    message: `Ticket status updated to ${status}`,
    data: ticket,
  });
});

export const addComment = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { content, isInternal, parentId, mentions } = req.body;
  
  const comment = await ticketService.addComment(
    req.params.id,
    req.user!.userId,
    content,
    isInternal,
    parentId,
    mentions,
    req.user!.role
  );

  res.status(201).json({
    success: true,
    message: 'Comment added successfully',
    data: comment,
  });
});

export const updateComment = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { content, isInternal } = req.body;
  
  const comment = await ticketService.updateComment(req.params.id, req.params.commentId, req.user!.userId, content, isInternal, req.user!.role);

  res.json({
    success: true,
    message: 'Comment updated successfully',
    data: comment,
  });
});

export const deleteComment = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  await ticketService.deleteComment(req.params.id, req.params.commentId, req.user!.userId, req.user!.role);

  res.json({
    success: true,
    message: 'Comment deleted successfully',
  });
});

export const addWatcher = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { userId } = req.body;
  
  await ticketService.addWatcher(req.params.id, userId, req.user!.userId);

  res.json({
    success: true,
    message: 'Watcher added successfully',
  });
});

export const removeWatcher = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { userId } = req.body;
  
  await ticketService.removeWatcher(req.params.id, userId, req.user!.userId);

  res.json({
    success: true,
    message: 'Watcher removed successfully',
  });
});

export const bulkAction = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { ticketIds, action, data } = req.body;
  
  const result = await ticketService.bulkAction(ticketIds, action, data, req.user!.userId, req.user!.role, req.user!.roles);

  res.json({
    success: true,
    message: `Bulk action completed: ${result.success} succeeded, ${result.failed} failed`,
    data: result,
  });
});

export const deleteTicket = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  await ticketService.deleteTicket(req.params.id, req.user!.userId, req.user!.role);

  res.json({
    success: true,
    message: 'Ticket deleted successfully',
  });
});

export const getTicketStats = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { departmentId } = req.query;
  
  const stats = await ticketService.getTicketStats(
    departmentId as string,
    req.user!.userId,
    req.user!.role,
    req.user!.departmentId
  );

  res.json({
    success: true,
    data: stats,
  });
});

export const getMyTickets = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const params = {
    page: parseInt(req.query.page as string) || 1,
    limit: parseInt(req.query.limit as string) || 20,
    sortBy: req.query.sortBy as string || 'createdAt',
    sortOrder: (req.query.sortOrder as 'asc' | 'desc') || 'desc',
    status: req.query.status as TicketStatus,
    priority: req.query.priority as TicketPriority,
    category: req.query.category as TicketCategory,
    slaStatus: req.query.slaStatus as any,
    search: req.query.search as string,
    raisedById: req.user!.userId,
    userId: req.user!.userId,
    userRole: req.user!.role,
    userDepartmentId: req.user!.departmentId,
  };

  const result = await ticketService.getTickets(params);

  res.json({
    success: true,
    data: result,
  });
});

export const getAssignedTickets = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const params = {
    page: parseInt(req.query.page as string) || 1,
    limit: parseInt(req.query.limit as string) || 20,
    sortBy: req.query.sortBy as string || 'createdAt',
    sortOrder: (req.query.sortOrder as 'asc' | 'desc') || 'desc',
    status: req.query.status as TicketStatus,
    priority: req.query.priority as TicketPriority,
    category: req.query.category as TicketCategory,
    search: req.query.search as string,
    assignedToId: req.user!.userId,
    userId: req.user!.userId,
    userRole: req.user!.role,
    userDepartmentId: req.user!.departmentId,
  };

  const result = await ticketService.getTickets(params);

  res.json({
    success: true,
    data: result,
  });
});

export const uploadAttachment = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.file) {
    throw new AppError('No file uploaded', 400, 'NO_FILE');
  }

  const attachment = await ticketService.addAttachment(
    req.params.id,
    req.user!.userId,
    req.user!.role,
    req.file
  );

  res.status(201).json({
    success: true,
    message: 'Attachment uploaded successfully',
    data: attachment,
  });
});

export const downloadAttachment = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const attachment = await ticketService.getAttachmentForDownload(
    req.params.id,
    req.params.attachmentId,
    req.user!.userId,
    req.user!.role
  );

  res.download(attachment.path, attachment.originalName);
});

export const deleteAttachment = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  await ticketService.deleteAttachment(req.params.id, req.params.attachmentId, req.user!.userId, req.user!.role);

  res.json({
    success: true,
    message: 'Attachment deleted successfully',
  });
});