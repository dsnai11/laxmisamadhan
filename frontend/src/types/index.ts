export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  mobile?: string;
  employeeId?: string;
  jobTitle?: string;
  site?: string;
  branch?: string;
  state?: string;
  reportingManagerName?: string;
  departmentRaiserName?: string;
  avatar?: string;
  role: UserRole;
  roles?: UserRole[];
  status: UserStatus;
  departmentId?: string;
  department?: Department;
  canViewTeamBucket?: boolean;
  managerId?: string;
  mfaEnabled: boolean;
  emailVerified: boolean;
  permissions?: string[];
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}

export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN = 'ADMIN',
  DEPARTMENT_HEAD = 'DEPARTMENT_HEAD',
  TEAM_LEAD = 'TEAM_LEAD',
  AGENT = 'AGENT',
  RAISER = 'RAISER',
  VIEWER = 'VIEWER',
}

export enum UserStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  SUSPENDED = 'SUSPENDED',
  PENDING_VERIFICATION = 'PENDING_VERIFICATION',
}

export interface Department {
  id: string;
  name: string;
  type: DepartmentType;
  description?: string;
  color: string;
  icon?: string;
  parentId?: string;
  parent?: Department;
  children?: Department[];
  headId?: string;
  head?: User;
  slaPolicyId?: string;
  slaPolicy?: SLAPolicy;
  autoAssign: boolean;
  assignStrategy: string;
  _count?: {
    users: number;
    tickets: number;
    teams: number;
    assets: number;
  };
}

export enum DepartmentType {
  IT_HARDWARE = 'IT_HARDWARE',
  IT_SOFTWARE = 'IT_SOFTWARE',
  DIGITAL_SECURITY = 'DIGITAL_SECURITY',
  AI = 'AI',
}

export interface Ticket {
  id: string;
  ticketNumber: string;
  title: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  category: TicketCategory;
  departmentId: string;
  department: Department;
  raisedById: string;
  raisedBy: User;
  assignedToId?: string;
  assignedTo?: User;
  assignedById?: string;
  assignedBy?: User;
  assignedAt?: string;
  teamId?: string;
  team?: Team;
  parentTicketId?: string;
  parentTicket?: Ticket;
  childTickets?: Ticket[];
  relatedTickets?: Ticket[];
  slaPolicyId?: string;
  slaPolicy?: SLAPolicy;
  slaStatus: SLAStatus;
  responseDueAt?: string;
  resolutionDueAt?: string;
  respondedAt?: string;
  resolvedAt?: string;
  closedAt?: string;
  reopenedCount: number;
  tags: string[];
  customFields?: Record<string, any>;
  satisfactionRating?: number;
  satisfactionFeedback?: string;
  createdAt: string;
  updatedAt: string;
  _count?: {
    comments: number;
    attachments: number;
    approvals: number;
  };
}

export enum TicketStatus {
  OPEN = 'OPEN',
  RESOLVED = 'RESOLVED',
  REOPENED = 'REOPENED',
  DEPENDENCY_ON_CLIENT = 'DEPENDENCY_ON_CLIENT',
}

export enum TicketPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
  URGENT = 'URGENT',
}

export enum TicketCategory {
  INCIDENT = 'INCIDENT',
  SERVICE_REQUEST = 'SERVICE_REQUEST',
  CHANGE_REQUEST = 'CHANGE_REQUEST',
  PROBLEM = 'PROBLEM',
  ACCESS_REQUEST = 'ACCESS_REQUEST',
  HARDWARE_REQUEST = 'HARDWARE_REQUEST',
  SOFTWARE_REQUEST = 'SOFTWARE_REQUEST',
  SECURITY_INCIDENT = 'SECURITY_INCIDENT',
  AI_MODEL_REQUEST = 'AI_MODEL_REQUEST',
  DATA_REQUEST = 'DATA_REQUEST',
}

export enum SLAStatus {
  WITHIN_SLA = 'WITHIN_SLA',
  APPROACHING_BREACH = 'APPROACHING_BREACH',
  BREACHED = 'BREACHED',
  PAUSED = 'PAUSED',
}

export interface Team {
  id: string;
  name: string;
  description?: string;
  departmentId: string;
  department?: Department;
  leadId?: string;
  lead?: User;
  members?: User[];
  _count?: {
    members: number;
    tickets: number;
  };
}

export interface SLAPolicy {
  id: string;
  name: string;
  description?: string;
  departmentId?: string;
  department?: Department;
  canViewTeamBucket?: boolean;
  category?: TicketCategory;
  subCategory?: string;
  priority: TicketPriority;
  responseTimeMins: number;
  resolutionTimeMins: number;
  businessHoursOnly: boolean;
  excludesWeekends: boolean;
  isActive: boolean;
}

export interface Comment {
  id: string;
  ticketId: string;
  userId: string;
  user: User;
  content: string;
  isInternal: boolean;
  isSystem: boolean;
  parentId?: string;
  parent?: Comment;
  replies?: Comment[];
  mentions: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Attachment {
  id: string;
  ticketId?: string;
  commentId?: string;
  articleId?: string;
  userId: string;
  user: User;
  fileName: string;
  originalName: string;
  mimeType: string;
  size: number;
  path: string;
  url?: string;
  createdAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  referenceId?: string;
  referenceType?: string;
  isRead: boolean;
  readAt?: string;
  metadata?: Record<string, any>;
  createdAt: string;
}

export enum NotificationType {
  TICKET_CREATED = 'TICKET_CREATED',
  TICKET_ASSIGNED = 'TICKET_ASSIGNED',
  TICKET_UPDATED = 'TICKET_UPDATED',
  TICKET_COMMENTED = 'TICKET_COMMENTED',
  TICKET_RESOLVED = 'TICKET_RESOLVED',
  TICKET_CLOSED = 'TICKET_CLOSED',
  TICKET_REOPENED = 'TICKET_REOPENED',
  TICKET_ESCALATED = 'TICKET_ESCALATED',
  SLA_WARNING = 'SLA_WARNING',
  SLA_BREACHED = 'SLA_BREACHED',
  APPROVAL_REQUESTED = 'APPROVAL_REQUESTED',
  APPROVAL_GRANTED = 'APPROVAL_GRANTED',
  APPROVAL_DENIED = 'APPROVAL_DENIED',
  MENTION = 'MENTION',
  SYSTEM_ALERT = 'SYSTEM_ALERT',
}

export interface Approval {
  id: string;
  ticketId: string;
  ticket: Ticket;
  requesterId: string;
  requester: User;
  approverId: string;
  approver: User;
  title: string;
  description: string;
  status: ApprovalStatus;
  response?: string;
  respondedAt?: string;
  expiresAt?: string;
  level: number;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export enum ApprovalStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  EXPIRED = 'EXPIRED',
}

export interface Asset {
  id: string;
  assetTag: string;
  name: string;
  type: AssetType;
  serialNumber?: string;
  model?: string;
  manufacturer?: string;
  departmentId: string;
  department: Department;
  assignedToId?: string;
  assignedTo?: User;
  location?: string;
  purchaseDate?: string;
  warrantyExpiry?: string;
  status: string;
  value?: number;
  currency: string;
  specifications?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export enum AssetType {
  LAPTOP = 'LAPTOP',
  DESKTOP = 'DESKTOP',
  MONITOR = 'MONITOR',
  PHONE = 'PHONE',
  TABLET = 'TABLET',
  SERVER = 'SERVER',
  NETWORK_DEVICE = 'NETWORK_DEVICE',
  PERIPHERAL = 'PERIPHERAL',
  SOFTWARE_LICENSE = 'SOFTWARE_LICENSE',
  AI_MODEL = 'AI_MODEL',
  OTHER = 'OTHER',
}

export interface KnowledgeBase {
  id: string;
  name: string;
  description?: string;
  departmentId: string;
  department: Department;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: {
    articles: number;
  };
}

export interface KnowledgeArticle {
  id: string;
  knowledgeBaseId: string;
  knowledgeBase: KnowledgeBase;
  title: string;
  slug: string;
  content: string;
  excerpt?: string;
  category?: string;
  tags: string[];
  authorId: string;
  author: User;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  viewCount: number;
  helpfulCount: number;
  notHelpfulCount: number;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
  attachments?: Attachment[];
}

export interface CustomField {
  id: string;
  name: string;
  label: string;
  type: 'TEXT' | 'TEXTAREA' | 'NUMBER' | 'SELECT' | 'MULTISELECT' | 'BOOLEAN' | 'DATE' | 'DATETIME' | 'EMAIL' | 'URL' | 'FILE';
  departmentId?: string;
  category?: TicketCategory;
  isRequired: boolean;
  options?: Array<{ value: string; label: string }>;
  validation?: { minLength?: number; maxLength?: number; min?: number; max?: number; pattern?: string };
  defaultValue?: any;
  order: number;
  isActive: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  totalPages: number;
}

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
  code?: string;
  details?: any[];
}

export interface LoginCredentials {
  employeeId?: string;
  email?: string;
  identifier?: string;
  password: string;
  mfaCode?: string;
  rememberMe?: boolean;
}

export interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  departmentId?: string;
  role?: UserRole;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthState {
  user: User | null;
  tokens: TokenPair | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}