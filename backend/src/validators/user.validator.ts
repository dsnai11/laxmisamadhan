import { z } from 'zod';
import { UserRole, UserStatus } from '@prisma/client';

export const createUserSchema = z.object({
  email: z.string().email('Invalid email address'),
  firstName: z.string().min(1, 'First name is required').max(50),
  lastName: z.string().min(1, 'Last name is required').max(50),
  phone: z.string().optional(),
  employeeId: z.string().max(100).optional(),
  role: z.nativeEnum(UserRole).default(UserRole.RAISER),
  roles: z.array(z.nativeEnum(UserRole)).optional(),
  status: z.nativeEnum(UserStatus).default(UserStatus.ACTIVE),
  departmentId: z.string().uuid().optional(),
  managerId: z.string().uuid().optional(),
  sendWelcomeEmail: z.boolean().default(true),
  temporaryPassword: z.string().optional(),
});

export const bulkCreateUserSchema = z.object({
  users: z.array(z.object({
    employeeId: z.string().max(100).optional().nullable(),
    firstName: z.string().min(1, 'First name is required').max(100),
    lastName: z.string().max(100).optional().nullable(),
    departmentName: z.string().max(150).optional().nullable(),
    departmentRaiserName: z.string().max(150).optional().nullable(),
    desginations: z.string().max(150).optional().nullable(),
    designations: z.string().max(150).optional().nullable(),
    jobTitle: z.string().max(150).optional().nullable(),
    branch: z.string().max(150).optional().nullable(),
    state: z.string().max(100).optional().nullable(),
    email: z.string().email('Invalid email address'),
    phone: z.string().max(50).optional().nullable(),
    mobile: z.string().max(50).optional().nullable(),
    role: z.string().optional().nullable(),
    roles: z.array(z.nativeEnum(UserRole)).optional(),
    status: z.nativeEnum(UserStatus).default(UserStatus.ACTIVE).optional(),
    departmentId: z.string().optional().nullable(),
    temporaryPassword: z.string().optional().nullable(),
    sendWelcomeEmail: z.boolean().default(false),
  })).min(1).max(10000),
});

export const updateUserSchema = z.object({
  email: z.string().email('Invalid email address').optional(),
  firstName: z.string().min(1, 'First name is required').max(50).optional(),
  lastName: z.string().min(1, 'Last name is required').max(50).optional(),
  phone: z.string().nullable().optional(),
  mobile: z.string().nullable().optional(),
  employeeId: z.string().max(100).nullable().optional(),
  jobTitle: z.string().max(100).nullable().optional(),
  site: z.string().max(100).nullable().optional(),
  branch: z.string().max(150).nullable().optional(),
  state: z.string().max(100).nullable().optional(),
  reportingManagerName: z.string().max(100).nullable().optional(),
  departmentRaiserName: z.string().max(150).nullable().optional(),
  role: z.nativeEnum(UserRole).optional(),
  roles: z.array(z.nativeEnum(UserRole)).optional(),
  status: z.nativeEnum(UserStatus).optional(),
  departmentId: z.string().uuid().nullable().optional(),
  managerId: z.string().uuid().nullable().optional(),
  avatar: z.string().url().nullable().optional(),
});

export const updateUserRoleSchema = z.object({
  role: z.nativeEnum(UserRole).optional(),
  roles: z.array(z.nativeEnum(UserRole)).optional(),
}).refine(data => data.role !== undefined || (data.roles !== undefined && data.roles.length > 0), {
  message: 'At least one role must be provided',
});

export const updateUserStatusSchema = z.object({
  status: z.nativeEnum(UserStatus),
  reason: z.string().max(500).optional(),
});

export const userQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  sortBy: z.enum(['createdAt', 'updatedAt', 'firstName', 'lastName', 'email', 'role', 'status']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  search: z.string().optional(),
  role: z.string().optional(),
  status: z.nativeEnum(UserStatus).optional(),
  departmentId: z.string().uuid().optional(),
  managerId: z.string().uuid().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
});

export const bulkUserActionSchema = z.object({
  userIds: z.array(z.string().uuid()).min(1).max(100),
  action: z.enum(['activate', 'deactivate', 'suspend', 'delete', 'changeRole', 'changeDepartment', 'export']),
  data: z.record(z.any()).optional(),
});

export const adminResetPasswordSchema = z.object({
  password: z
    .string()
    .min(12, 'Password must be at least 12 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
});

export const departmentSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  type: z.string().max(100).optional().default('GENERAL'),
  description: z.string().max(1000).optional().nullable().or(z.literal('')),
  color: z.string().regex(/^#[0-9A-Fa-f]{3,8}$/).optional(),
  icon: z.string().optional().nullable().or(z.literal('')),
  parentId: z.string().uuid().nullable().optional().or(z.literal('')),
  headId: z.string().uuid().nullable().optional().or(z.literal('')),
  slaPolicyId: z.string().uuid().nullable().optional().or(z.literal('')),
  supportEmail: z.string().max(150).nullable().optional().or(z.literal('')),
  autoAssign: z.boolean().optional(),
  assignStrategy: z.string().optional(),
  businessHours: z.object({
    timezone: z.string(),
    schedule: z.record(z.object({
      start: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
      end: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
    })),
    holidays: z.array(z.string()).optional(),
  }).optional(),
  escalationRules: z.array(z.object({
    trigger: z.enum(['response', 'resolution']),
    timeBeforeMins: z.number().int().positive(),
    action: z.enum(['notify', 'escalate', 'reassign']),
    notifyUserIds: z.array(z.string().uuid()).optional(),
    escalateToUserId: z.string().uuid().optional(),
    reassignToUserId: z.string().uuid().optional(),
  })).optional(),
});

export const updateDepartmentSchema = departmentSchema.partial();

export const teamSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().max(500).optional().nullable().or(z.literal('')),
  departmentId: z.string().uuid('Invalid department ID').optional(),
  leadId: z.string().uuid().nullable().optional().or(z.literal('')),
  memberIds: z.array(z.string().uuid()).optional(),
  supportEmail: z.string().max(150).nullable().optional().or(z.literal('')),
});

export const updateTeamSchema = teamSchema.partial();

export const assetSchema = z.object({
  assetTag: z.string().min(1, 'Asset tag is required').max(50),
  name: z.string().min(1, 'Name is required').max(200),
  type: z.enum(['LAPTOP', 'DESKTOP', 'MONITOR', 'PHONE', 'TABLET', 'SERVER', 'NETWORK_DEVICE', 'PERIPHERAL', 'SOFTWARE_LICENSE', 'AI_MODEL', 'OTHER']),
  serialNumber: z.string().max(100).optional(),
  model: z.string().max(100).optional(),
  manufacturer: z.string().max(100).optional(),
  departmentId: z.string().uuid('Invalid department ID'),
  assignedToId: z.string().uuid().nullable().optional(),
  location: z.string().max(200).optional(),
  purchaseDate: z.string().datetime().optional(),
  warrantyExpiry: z.string().datetime().optional(),
  value: z.number().positive().optional(),
  currency: z.string().length(3).default('USD'),
  specifications: z.record(z.any()).optional(),
});

export const updateAssetSchema = assetSchema.partial();

export const assetQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  sortBy: z.enum(['createdAt', 'updatedAt', 'name', 'assetTag', 'type']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  type: z.enum(['LAPTOP', 'DESKTOP', 'MONITOR', 'PHONE', 'TABLET', 'SERVER', 'NETWORK_DEVICE', 'PERIPHERAL', 'SOFTWARE_LICENSE', 'AI_MODEL', 'OTHER']).optional(),
  status: z.string().optional(),
  departmentId: z.string().uuid().optional(),
  assignedToId: z.string().uuid().optional(),
  search: z.string().optional(),
});

export const assignAssetSchema = z.object({
  userId: z.string().uuid().nullable(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type UpdateUserRoleInput = z.infer<typeof updateUserRoleSchema>;
export type UpdateUserStatusInput = z.infer<typeof updateUserStatusSchema>;
export type UserQueryInput = z.infer<typeof userQuerySchema>;
export type BulkUserActionInput = z.infer<typeof bulkUserActionSchema>;
export type DepartmentInput = z.infer<typeof departmentSchema>;
export type UpdateDepartmentInput = z.infer<typeof updateDepartmentSchema>;
export type TeamInput = z.infer<typeof teamSchema>;
export type UpdateTeamInput = z.infer<typeof updateTeamSchema>;
export type AssetInput = z.infer<typeof assetSchema>;
export type UpdateAssetInput = z.infer<typeof updateAssetSchema>;