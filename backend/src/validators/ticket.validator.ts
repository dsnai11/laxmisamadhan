import { z } from 'zod';
import { TicketPriority, TicketCategory, TicketStatus } from '@prisma/client';

export const ticketIdParamSchema = z.object({
  id: z.string().uuid('Invalid ticket ID'),
});

export const createTicketSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters').max(200),
  description: z.string().min(5, 'Description must be at least 5 characters').max(10000),
  category: z.nativeEnum(TicketCategory),
  subCategory: z.string().optional(),
  subIssue: z.string().optional(),
  item: z.string().optional(),
  group: z.string().optional(),
  site: z.string().optional(),
  teamId: z.string().uuid().optional(),
  priority: z.nativeEnum(TicketPriority).default(TicketPriority.MEDIUM),
  departmentId: z.string().uuid('Invalid department ID'),
  tags: z.array(z.string().max(50)).max(10).optional(),
  customFields: z.record(z.any()).optional(),
  assetIds: z.array(z.string().uuid()).optional(),
  watcherIds: z.array(z.string().uuid()).optional(),
  parentTicketId: z.string().uuid().optional(),
  relatedTicketIds: z.array(z.string().uuid()).optional(),
});

export const updateTicketSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters').max(200).optional(),
  description: z.string().min(5, 'Description must be at least 5 characters').max(10000).optional(),
  category: z.nativeEnum(TicketCategory).optional(),
  subCategory: z.string().optional(),
  subIssue: z.string().optional(),
  item: z.string().optional(),
  priority: z.nativeEnum(TicketPriority).optional(),
  status: z.nativeEnum(TicketStatus).optional(),
  assignedToId: z.string().uuid().nullable().optional(),
  teamId: z.string().uuid().nullable().optional(),
  tags: z.array(z.string().max(50)).max(10).optional(),
  customFields: z.record(z.any()).optional(),
  assetIds: z.array(z.string().uuid()).optional(),
  watcherIds: z.array(z.string().uuid()).optional(),
});

export const assignTicketSchema = z.object({
  assignedToId: z.string().uuid('Invalid assignee ID'),
  teamId: z.string().uuid().optional(),
  note: z.string().max(1000).optional(),
});

export const updateTicketStatusSchema = z.object({
  status: z.nativeEnum(TicketStatus),
  resolution: z.string().max(5000).optional(),
  resolutionSummary: z.string().max(500).optional(),
});

export const addCommentSchema = z.object({
  content: z.string().min(1, 'Comment cannot be empty').max(10000),
  isInternal: z.boolean().default(false),
  parentId: z.string().uuid().optional(),
  mentions: z.array(z.string().uuid()).optional(),
});

export const updateCommentSchema = z.object({
  content: z.string().min(1, 'Comment cannot be empty').max(10000),
  isInternal: z.boolean().optional(),
});

export const addWatcherSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
});

export const removeWatcherSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
});

export const ticketQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  sortBy: z.enum(['createdAt', 'updatedAt', 'priority', 'status', 'ticketNumber', 'title']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  status: z.nativeEnum(TicketStatus).optional(),
  priority: z.nativeEnum(TicketPriority).optional(),
  category: z.nativeEnum(TicketCategory).optional(),
  departmentId: z.string().uuid().optional(),
  assignedToId: z.string().uuid().optional(),
  raisedById: z.string().uuid().optional(),
  teamId: z.string().uuid().optional(),
  tags: z.array(z.string()).optional(),
  search: z.string().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  slaStatus: z.enum(['WITHIN_SLA', 'APPROACHING_BREACH', 'BREACHED', 'PAUSED']).optional(),
  hasAttachments: z.coerce.boolean().optional(),
  isWatching: z.coerce.boolean().optional(),
  unassigned: z.enum(['true', 'false']).optional(),
});

export const bulkActionSchema = z.object({
  ticketIds: z.array(z.string().uuid()).min(1, 'At least one ticket ID is required').max(100),
  action: z.enum(['assign', 'status', 'priority', 'department', 'tags', 'delete', 'export', 'merge', 'link']),
  data: z.record(z.any()),
});

export const slaPolicySchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().max(500).optional(),
  departmentId: z.string().uuid().optional(),
  category: z.nativeEnum(TicketCategory).optional(),
  priority: z.nativeEnum(TicketPriority),
  responseTimeMins: z.number().int().positive(),
  resolutionTimeMins: z.number().int().positive(),
  businessHoursOnly: z.boolean().default(true),
  excludesWeekends: z.boolean().default(true),
  holidays: z.array(z.string()).optional(),
  escalationRules: z.array(z.object({
    trigger: z.enum(['response', 'resolution']),
    timeBeforeMins: z.number().int().positive(),
    action: z.enum(['notify', 'escalate', 'reassign']),
    notifyUserIds: z.array(z.string().uuid()).optional(),
    escalateToUserId: z.string().uuid().optional(),
    reassignToUserId: z.string().uuid().optional(),
  })).optional(),
});

export const approvalSchema = z.object({
  ticketId: z.string().uuid('Invalid ticket ID'),
  approverId: z.string().uuid('Invalid approver ID'),
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().max(5000),
  expiresAt: z.string().datetime().optional(),
  level: z.number().int().positive().default(1),
  metadata: z.record(z.any()).optional(),
});

export const approvalResponseSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
  response: z.string().max(2000).optional(),
});

export type CreateTicketInput = z.infer<typeof createTicketSchema>;
export type UpdateTicketInput = z.infer<typeof updateTicketSchema>;
export type AssignTicketInput = z.infer<typeof assignTicketSchema>;
export type UpdateTicketStatusInput = z.infer<typeof updateTicketStatusSchema>;
export type AddCommentInput = z.infer<typeof addCommentSchema>;
export type UpdateCommentInput = z.infer<typeof updateCommentSchema>;
export type AddWatcherInput = z.infer<typeof addWatcherSchema>;
export type TicketQueryInput = z.infer<typeof ticketQuerySchema>;
export type BulkActionInput = z.infer<typeof bulkActionSchema>;
export type SLAPolicyInput = z.infer<typeof slaPolicySchema>;
export type ApprovalInput = z.infer<typeof approvalSchema>;
export type ApprovalResponseInput = z.infer<typeof approvalResponseSchema>;