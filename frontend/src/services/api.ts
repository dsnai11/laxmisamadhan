import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { TokenPair, ApiResponse, LoginCredentials, RegisterData, User, Ticket, Department, Team, SLAPolicy, Asset, KnowledgeBase, KnowledgeArticle, CustomField, Approval, Notification, PaginatedResponse } from '@types';
import { Capacitor } from '@capacitor/core';

function toPage<T>(raw: any, key: string): PaginatedResponse<T> & Record<string, any> {
  const items = (raw && (raw[key] ?? raw.data)) || [];
  return { ...raw, data: items, total: raw?.total ?? items.length, page: raw?.page ?? 1, totalPages: raw?.totalPages ?? 1 };
}

export const PRODUCTION_ORIGIN = 'https://laxmisamadhan.lifc.in';
export const PRODUCTION_API_URL = `${PRODUCTION_ORIGIN}/api/v1`;

export function getApiBaseUrl(): string {
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl && (envUrl.startsWith('http://') || envUrl.startsWith('https://'))) {
    return envUrl;
  }
  
  if (
    Capacitor.isNativePlatform() ||
    (typeof window !== 'undefined' && (
      window.location.protocol === 'capacitor:' ||
      window.location.protocol === 'ionic:' ||
      (window.location.hostname === 'localhost' && ((window as any).Capacitor || window.location.origin.includes('capacitor')))
    ))
  ) {
    return PRODUCTION_API_URL;
  }

  return envUrl || '/api/v1';
}

export const isNativeEnvironment = (): boolean => {
  return (
    Capacitor.isNativePlatform() ||
    (typeof window !== 'undefined' && (
      window.location.protocol === 'capacitor:' ||
      window.location.protocol === 'ionic:' ||
      (window.location.hostname === 'localhost' && ((window as any).Capacitor || window.location.origin.includes('capacitor')))
    ))
  );
};

const API_URL = getApiBaseUrl();

class ApiService {
  private client: AxiosInstance;
  private refreshPromise: Promise<TokenPair> | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: API_URL,
      headers: {
        'Content-Type': 'application/json',
      },
      withCredentials: !isNativeEnvironment(),
    });

    this.client.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        const accessToken = localStorage.getItem('accessToken');
        if (accessToken && config.headers) {
          config.headers.Authorization = `Bearer ${accessToken}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const originalRequest = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;
        const requestUrl = originalRequest?.url || '';
        const isAuthEndpoint = requestUrl.includes('/auth/login') || requestUrl.includes('/auth/refresh') || requestUrl.includes('/auth/register');
        
        if (error.response?.status === 401 && originalRequest && !originalRequest._retry && !isAuthEndpoint) {
          originalRequest._retry = true;
          
          try {
            const tokens = await this.refreshToken();
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${tokens.accessToken}`;
            }
            return this.client(originalRequest);
          } catch (refreshError) {
            this.clearAuth();
            window.location.href = '/login';
            return Promise.reject(refreshError);
          }
        }
        
        return Promise.reject(error);
      }
    );
  }

  clearAuth(): void {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
  }

  private setAuth(tokens: TokenPair, user: User): void {
    if (tokens?.accessToken) {
      localStorage.setItem('accessToken', tokens.accessToken);
    }
    if (tokens?.refreshToken) {
      localStorage.setItem('refreshToken', tokens.refreshToken);
    }
    if (user) {
      localStorage.setItem('user', JSON.stringify(user));
    }
  }

  getAccessToken(): string | null {
    return localStorage.getItem('accessToken');
  }

  getUser(): User | null {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  }

  isAuthenticated(): boolean {
    return !!this.getAccessToken();
  }

  async login(credentials: LoginCredentials): Promise<{ user: User; tokens: TokenPair }> {
    try {
      const response = await this.client.post<ApiResponse<{ user: User; tokens: TokenPair }>>('/auth/login', credentials);
      const resData = response?.data;
      if (!resData || typeof resData !== 'object') {
        throw new Error('Unable to connect to the authentication service. Please check your network connection.');
      }
      const sessionData = (resData as any)?.data || resData;
      if (!sessionData || typeof sessionData !== 'object' || !sessionData.user || !sessionData.tokens) {
        const errMsg = (resData as any)?.error || (resData as any)?.message || 'Authentication response did not contain valid user session data.';
        throw new Error(errMsg);
      }
      const { user, tokens } = sessionData;
      this.setAuth(tokens, user);
      return { user, tokens };
    } catch (err: any) {
      if (err.response?.data?.error || err.response?.data?.message) {
        throw err;
      }
      if (err.message && err.message.toLowerCase().includes('network error')) {
        throw new Error('Unable to reach server. Please check your internet connection.');
      }
      throw err;
    }
  }

  async register(data: RegisterData): Promise<{ user: User; tokens: TokenPair }> {
    try {
      const response = await this.client.post<ApiResponse<{ user: User; tokens: TokenPair }>>('/auth/register', data);
      const resData = response?.data;
      if (!resData || typeof resData !== 'object') {
        throw new Error('Registration failed. Invalid response from server.');
      }
      const sessionData = (resData as any)?.data || resData;
      if (!sessionData || typeof sessionData !== 'object' || !sessionData.user || !sessionData.tokens) {
        const errMsg = (resData as any)?.error || (resData as any)?.message || 'Registration response did not contain user session data.';
        throw new Error(errMsg);
      }
      const { user, tokens } = sessionData;
      this.setAuth(tokens, user);
      return { user, tokens };
    } catch (err: any) {
      if (err.response?.data?.error || err.response?.data?.message) {
        throw err;
      }
      throw err;
    }
  }

  async logout(revokeAll = false): Promise<void> {
    try {
      await this.client.post('/auth/logout', { revokeAll });
    } finally {
      this.clearAuth();
    }
  }

  async refreshToken(): Promise<TokenPair> {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = (async () => {
      const storedRefreshToken = localStorage.getItem('refreshToken');
      const response = await this.client.post<ApiResponse<TokenPair>>('/auth/refresh', {
        refreshToken: storedRefreshToken || undefined,
      });
      const tokens = response.data?.data;
      if (!tokens?.accessToken) {
        throw new Error('Failed to refresh authentication session');
      }
      localStorage.setItem('accessToken', tokens.accessToken);
      if (tokens.refreshToken) {
        localStorage.setItem('refreshToken', tokens.refreshToken);
      }
      return tokens;
    })();

    try {
      return await this.refreshPromise;
    } finally {
      this.refreshPromise = null;
    }
  }

  async getMe(): Promise<User> {
    const response = await this.client.get<ApiResponse<User>>('/auth/me');
    const user = response.data.data!;
    localStorage.setItem('user', JSON.stringify(user));
    return user;
  }

  async updateProfile(data: Partial<User>): Promise<User> {
    const response = await this.client.patch<ApiResponse<User>>('/auth/profile', data);
    const user = response.data.data!;
    localStorage.setItem('user', JSON.stringify(user));
    return user;
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    await this.client.post('/auth/change-password', { currentPassword, newPassword, confirmPassword: newPassword });
  }

  async forgotPassword(identifierOrEmail: string): Promise<void> {
    const trimmed = (identifierOrEmail || '').trim();
    const isEmail = trimmed.includes('@');
    await this.client.post('/auth/forgot-password', {
      employeeId: !isEmail ? trimmed : undefined,
      email: isEmail ? trimmed : undefined,
      identifier: trimmed,
    });
  }

  async resetPassword(token: string, email: string, password: string): Promise<void> {
    await this.client.post('/auth/reset-password', { token, email, password, confirmPassword: password });
  }

  async verifyEmail(token: string): Promise<void> {
    await this.client.post('/auth/verify-email', { token });
  }

  async setupMFA(): Promise<{ secret: string; qrCodeUrl: string; backupCodes: string[] }> {
    const response = await this.client.post<ApiResponse<{ secret: string; qrCodeUrl: string; backupCodes: string[] }>>('/auth/mfa/setup');
    return response.data.data!;
  }

  async verifyMFA(code: string): Promise<void> {
    await this.client.post('/auth/mfa/verify', { code });
  }

  async disableMFA(code: string): Promise<void> {
    await this.client.post('/auth/mfa/disable', { code });
  }

  async verifyBackupCode(code: string): Promise<void> {
    await this.client.post('/auth/mfa/backup', { code });
  }

  async getTickets(params?: Record<string, any>): Promise<PaginatedResponse<Ticket>> {
    const response = await this.client.get<ApiResponse<PaginatedResponse<Ticket>>>('/tickets', { params });
    return toPage<any>(response.data.data, 'tickets') as any;
  }

  async getMyTickets(params?: Record<string, any>): Promise<PaginatedResponse<Ticket>> {
    const response = await this.client.get<ApiResponse<PaginatedResponse<Ticket>>>('/tickets/my', { params });
    return toPage<any>(response.data.data, 'tickets') as any;
  }

  async getAssignedTickets(params?: Record<string, any>): Promise<PaginatedResponse<Ticket>> {
    const response = await this.client.get<ApiResponse<PaginatedResponse<Ticket>>>('/tickets/assigned', { params });
    return toPage<any>(response.data.data, 'tickets') as any;
  }

  async getTicketStats(params?: Record<string, any>): Promise<any> {
    const response = await this.client.get<ApiResponse<any>>('/tickets/stats', { params });
    return response.data.data!;
  }

  async getTicketById(id: string): Promise<Ticket> {
    const response = await this.client.get<ApiResponse<Ticket>>(`/tickets/${id}`);
    return response.data.data!;
  }

  async createTicket(data: Partial<Ticket>): Promise<Ticket> {
    const response = await this.client.post<ApiResponse<Ticket>>('/tickets', data);
    return response.data.data!;
  }

  async updateTicket(id: string, data: Partial<Ticket> & { transferReason?: string }): Promise<Ticket> {
    const response = await this.client.patch<ApiResponse<Ticket>>(`/tickets/${id}`, data);
    return response.data.data!;
  }

  async assignTicket(id: string, assignedToId: string, teamId?: string, note?: string): Promise<Ticket> {
    const response = await this.client.post<ApiResponse<Ticket>>(`/tickets/${id}/assign`, { assignedToId, teamId, note });
    return response.data.data!;
  }

  async updateTicketStatus(id: string, status: string, resolution?: string, resolutionSummary?: string): Promise<Ticket> {
    const response = await this.client.patch<ApiResponse<Ticket>>(`/tickets/${id}/status`, { status, resolution, resolutionSummary });
    return response.data.data!;
  }

  async addComment(ticketId: string, content: string, isInternal = false, parentId?: string, mentions?: string[]): Promise<any> {
    const response = await this.client.post<ApiResponse<any>>(`/tickets/${ticketId}/comments`, { content, isInternal, parentId, mentions });
    return response.data.data!;
  }

  async updateComment(ticketId: string, commentId: string, content: string, isInternal?: boolean): Promise<any> {
    const response = await this.client.patch<ApiResponse<any>>(`/tickets/${ticketId}/comments/${commentId}`, { content, isInternal });
    return response.data.data!;
  }

  async deleteComment(ticketId: string, commentId: string): Promise<void> {
    await this.client.delete(`/tickets/${ticketId}/comments/${commentId}`);
  }

  async addWatcher(ticketId: string, userId: string): Promise<void> {
    await this.client.post(`/tickets/${ticketId}/watchers`, { userId });
  }

  async removeWatcher(ticketId: string, userId: string): Promise<void> {
    await this.client.request({ method: 'DELETE', url: `/tickets/${ticketId}/watchers`, data: { userId } });
  }

  async bulkAction(ticketIds: string[], action: string, data: Record<string, any>): Promise<any> {
    const response = await this.client.post<ApiResponse<any>>('/tickets/bulk', { ticketIds, action, data });
    return response.data.data!;
  }

  async deleteTicket(id: string): Promise<void> {
    await this.client.delete(`/tickets/${id}`);
  }

  async uploadAttachment(ticketId: string, file: File): Promise<any> {
    const formData = new FormData();
    formData.append('file', file);
    const response = await this.client.post<ApiResponse<any>>(`/tickets/${ticketId}/attachments`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data.data!;
  }

  async downloadAttachment(ticketId: string, attachmentId: string): Promise<Blob> {
    const response = await this.client.get(`/tickets/${ticketId}/attachments/${attachmentId}/download`, { responseType: 'blob' });
    return response.data as Blob;
  }

  async deleteAttachment(ticketId: string, attachmentId: string): Promise<void> {
    await this.client.delete(`/tickets/${ticketId}/attachments/${attachmentId}`);
  }

  async getUsers(params?: Record<string, any>): Promise<PaginatedResponse<User>> {
    const response = await this.client.get<ApiResponse<PaginatedResponse<User>>>('/users', { params });
    return toPage<any>(response.data.data, 'users') as any;
  }

  async getUserById(id: string): Promise<User> {
    const response = await this.client.get<ApiResponse<User>>(`/users/${id}`);
    return response.data.data!;
  }

  async createUser(data: Partial<User> & { temporaryPassword?: string }): Promise<User> {
    const response = await this.client.post<ApiResponse<User>>('/users', data);
    return response.data.data!;
  }

  async bulkCreateUsers(users: any[]): Promise<{ success: number; failed: number; users: any[]; errors: any[] }> {
    const response = await this.client.post<ApiResponse<any>>('/users/bulk-create', { users });
    return response.data.data!;
  }

  async updateUser(id: string, data: Partial<User>): Promise<User> {
    const response = await this.client.patch<ApiResponse<User>>(`/users/${id}`, data);
    return response.data.data!;
  }

  async updateUserRole(id: string, roleOrRoles: string | string[]): Promise<User> {
    const payload = Array.isArray(roleOrRoles) ? { roles: roleOrRoles } : { role: roleOrRoles, roles: [roleOrRoles] };
    const response = await this.client.patch<ApiResponse<User>>(`/users/${id}/role`, payload);
    return response.data.data!;
  }

  async updateUserStatus(id: string, status: string, reason?: string): Promise<User> {
    const response = await this.client.patch<ApiResponse<User>>(`/users/${id}/status`, { status, reason });
    return response.data.data!;
  }

  async deleteUser(id: string): Promise<void> {
    await this.client.delete(`/users/${id}`);
  }

  async resetUserPassword(id: string, password: string): Promise<void> {
    await this.client.post(`/users/${id}/reset-password`, { password });
  }

  async bulkUserAction(userIds: string[], action: string, data?: Record<string, any>): Promise<any> {
    const response = await this.client.post<ApiResponse<any>>('/users/bulk', { userIds, action, data });
    return response.data.data!;
  }

  async getUserStats(): Promise<any> {
    const response = await this.client.get<ApiResponse<any>>('/users/stats');
    return response.data.data!;
  }

  async searchUsers(query: string, limit = 10): Promise<User[]> {
    const response = await this.client.get<ApiResponse<User[]>>('/users/search', { params: { q: query, limit } });
    return response.data.data!;
  }

  async getDepartments(): Promise<Department[]> {
    const response = await this.client.get<ApiResponse<Department[]>>('/departments');
    return response.data.data!;
  }

  async getDepartmentTree(): Promise<Department[]> {
    const response = await this.client.get<ApiResponse<Department[]>>('/departments/tree');
    return response.data.data!;
  }

  async getDepartmentById(id: string): Promise<Department> {
    const response = await this.client.get<ApiResponse<Department>>(`/departments/${id}`);
    return response.data.data!;
  }

  async createDepartment(data: Partial<Department>): Promise<Department> {
    const response = await this.client.post<ApiResponse<Department>>('/departments', data);
    return response.data.data!;
  }

  async updateDepartment(id: string, data: Partial<Department>): Promise<Department> {
    const response = await this.client.patch<ApiResponse<Department>>(`/departments/${id}`, data);
    return response.data.data!;
  }

  async deleteDepartment(id: string): Promise<void> {
    await this.client.delete(`/departments/${id}`);
  }

  async simulateInboundEmail(payload: { fromEmail: string; fromName?: string; toEmail: string; subject: string; body: string }): Promise<any> {
    const response = await this.client.post<ApiResponse<any>>('/email/inbound', payload);
    return response.data.data!;
  }

  async assignDepartmentHead(departmentId: string, headId: string | null): Promise<Department> {
    const response = await this.client.patch<ApiResponse<Department>>(`/departments/${departmentId}/head`, { headId });
    return response.data.data!;
  }

  async getDepartmentStats(departmentId: string): Promise<any> {
    const response = await this.client.get<ApiResponse<any>>(`/departments/${departmentId}/stats`);
    return response.data.data!;
  }

  async getCategoryConfigs(departmentId: string): Promise<any[]> {
    const response = await this.client.get<ApiResponse<any[]>>(`/departments/${departmentId}/categories`);
    return response.data.data!;
  }

  async createCategoryConfig(departmentId: string, category: string, data: any): Promise<any> {
    const response = await this.client.post<ApiResponse<any>>(`/departments/${departmentId}/categories`, { category, ...data });
    return response.data.data!;
  }

  async updateCategoryConfig(departmentId: string, category: string, data: any): Promise<any> {
    const response = await this.client.patch<ApiResponse<any>>(`/departments/${departmentId}/categories/${category}`, data);
    return response.data.data!;
  }

  async deleteCategoryConfig(departmentId: string, category: string): Promise<void> {
    await this.client.delete(`/departments/${departmentId}/categories/${category}`);
  }

  async getTeams(departmentId: string): Promise<Team[]> {
    const response = await this.client.get<ApiResponse<Team[]>>(`/departments/${departmentId}/teams`);
    return response.data.data!;
  }

  async createTeam(departmentId: string, data: Partial<Team>): Promise<Team> {
    const response = await this.client.post<ApiResponse<Team>>(`/departments/${departmentId}/teams`, { departmentId, ...data });
    return response.data.data!;
  }

  async updateTeam(departmentId: string, teamId: string, data: Partial<Team>): Promise<Team> {
    const response = await this.client.patch<ApiResponse<Team>>(`/departments/${departmentId}/teams/${teamId}`, data);
    return response.data.data!;
  }

  async deleteTeam(departmentId: string, teamId: string): Promise<void> {
    await this.client.delete(`/departments/${departmentId}/teams/${teamId}`);
  }

  async getSLAPolicies(departmentId?: string): Promise<SLAPolicy[]> {
    const response = await this.client.get<ApiResponse<SLAPolicy[]>>('/sla', { params: { departmentId } });
    return response.data.data!;
  }

  async getSLAPolicyById(id: string): Promise<SLAPolicy> {
    const response = await this.client.get<ApiResponse<SLAPolicy>>(`/sla/${id}`);
    return response.data.data!;
  }

  async createSLAPolicy(data: Partial<SLAPolicy>): Promise<SLAPolicy> {
    const response = await this.client.post<ApiResponse<SLAPolicy>>('/sla', data);
    return response.data.data!;
  }

  async updateSLAPolicy(id: string, data: Partial<SLAPolicy>): Promise<SLAPolicy> {
    const response = await this.client.patch<ApiResponse<SLAPolicy>>(`/sla/${id}`, data);
    return response.data.data!;
  }

  async deleteSLAPolicy(id: string): Promise<void> {
    await this.client.delete(`/sla/${id}`);
  }

  async getSLACompliance(params?: Record<string, any>): Promise<any> {
    const response = await this.client.get<ApiResponse<any>>('/sla/compliance', { params });
    return response.data.data!;
  }

  async getSLAPolicyReport(params?: Record<string, any>): Promise<any> {
    const response = await this.client.get<ApiResponse<any>>('/sla/report', { params });
    return response.data.data!;
  }

  async checkSLATimers(): Promise<void> {
    await this.client.post('/sla/check-timers');
  }

  async getAssets(params?: Record<string, any>): Promise<PaginatedResponse<Asset>> {
    const response = await this.client.get<ApiResponse<PaginatedResponse<Asset>>>('/assets', { params });
    return toPage<any>(response.data.data, 'assets') as any;
  }

  async getAssetById(id: string): Promise<Asset> {
    const response = await this.client.get<ApiResponse<Asset>>(`/assets/${id}`);
    return response.data.data!;
  }

  async createAsset(data: Partial<Asset>): Promise<Asset> {
    const response = await this.client.post<ApiResponse<Asset>>('/assets', data);
    return response.data.data!;
  }

  async updateAsset(id: string, data: Partial<Asset>): Promise<Asset> {
    const response = await this.client.patch<ApiResponse<Asset>>(`/assets/${id}`, data);
    return response.data.data!;
  }

  async deleteAsset(id: string): Promise<void> {
    await this.client.delete(`/assets/${id}`);
  }

  async assignAsset(assetId: string, userId: string | null): Promise<Asset> {
    const response = await this.client.post<ApiResponse<Asset>>(`/assets/${assetId}/assign`, { userId });
    return response.data.data!;
  }

  async getAssetStats(departmentId?: string): Promise<any> {
    const response = await this.client.get<ApiResponse<any>>('/assets/stats', { params: { departmentId } });
    return response.data.data!;
  }

  async searchAssets(query: string, limit = 10): Promise<Asset[]> {
    const response = await this.client.get<ApiResponse<Asset[]>>('/assets/search', { params: { q: query, limit } });
    return response.data.data!;
  }

  async getNotifications(params?: Record<string, any>): Promise<PaginatedResponse<Notification> & { unreadCount: number }> {
    const response = await this.client.get<ApiResponse<PaginatedResponse<Notification> & { unreadCount: number }>>('/notifications', { params });
    return toPage<any>(response.data.data, 'notifications') as any;
  }

  async markNotificationsRead(notificationIds: string[]): Promise<void> {
    await this.client.patch('/notifications/read', { notificationIds });
  }

  async markAllNotificationsRead(): Promise<void> {
    await this.client.patch('/notifications/read-all');
  }

  async deleteNotification(notificationId: string): Promise<void> {
    await this.client.delete(`/notifications/${notificationId}`);
  }

  async getKnowledgeBases(departmentId?: string): Promise<KnowledgeBase[]> {
    const response = await this.client.get<ApiResponse<KnowledgeBase[]>>('/knowledge/bases', { params: { departmentId } });
    return response.data.data!;
  }

  async getKnowledgeBaseById(id: string): Promise<KnowledgeBase> {
    const response = await this.client.get<ApiResponse<KnowledgeBase>>(`/knowledge/bases/${id}`);
    return response.data.data!;
  }

  async createKnowledgeBase(data: Partial<KnowledgeBase>): Promise<KnowledgeBase> {
    const response = await this.client.post<ApiResponse<KnowledgeBase>>('/knowledge/bases', data);
    return response.data.data!;
  }

  async updateKnowledgeBase(id: string, data: Partial<KnowledgeBase>): Promise<KnowledgeBase> {
    const response = await this.client.patch<ApiResponse<KnowledgeBase>>(`/knowledge/bases/${id}`, data);
    return response.data.data!;
  }

  async deleteKnowledgeBase(id: string): Promise<void> {
    await this.client.delete(`/knowledge/bases/${id}`);
  }

  async getArticles(params?: Record<string, any>): Promise<PaginatedResponse<KnowledgeArticle>> {
    const response = await this.client.get<ApiResponse<PaginatedResponse<KnowledgeArticle>>>('/knowledge/articles', { params });
    return toPage<any>(response.data.data, 'articles') as any;
  }

  async getArticleById(id: string): Promise<KnowledgeArticle> {
    const response = await this.client.get<ApiResponse<KnowledgeArticle>>(`/knowledge/articles/${id}`);
    return response.data.data!;
  }

  async getArticleBySlug(knowledgeBaseId: string, slug: string): Promise<KnowledgeArticle> {
    const response = await this.client.get<ApiResponse<KnowledgeArticle>>(`/knowledge/bases/${knowledgeBaseId}/articles/${slug}`);
    return response.data.data!;
  }

  async createArticle(data: Partial<KnowledgeArticle>): Promise<KnowledgeArticle> {
    const response = await this.client.post<ApiResponse<KnowledgeArticle>>('/knowledge/articles', data);
    return response.data.data!;
  }

  async updateArticle(id: string, data: Partial<KnowledgeArticle>): Promise<KnowledgeArticle> {
    const response = await this.client.patch<ApiResponse<KnowledgeArticle>>(`/knowledge/articles/${id}`, data);
    return response.data.data!;
  }

  async deleteArticle(id: string): Promise<void> {
    await this.client.delete(`/knowledge/articles/${id}`);
  }

  async reviewArticle(articleId: string, rating: number, feedback?: string): Promise<any> {
    const response = await this.client.post<ApiResponse<any>>(`/knowledge/articles/${articleId}/review`, { rating, feedback });
    return response.data.data!;
  }

  async getCategories(knowledgeBaseId?: string): Promise<string[]> {
    const response = await this.client.get<ApiResponse<string[]>>('/knowledge/articles/categories', { params: { knowledgeBaseId } });
    return response.data.data!;
  }

  async getCustomFields(departmentId?: string, category?: string): Promise<CustomField[]> {
    const response = await this.client.get<ApiResponse<CustomField[]>>('/custom-fields', { params: { departmentId, category } });
    return response.data.data!;
  }

  async getCustomFieldById(id: string): Promise<CustomField> {
    const response = await this.client.get<ApiResponse<CustomField>>(`/custom-fields/${id}`);
    return response.data.data!;
  }

  async createCustomField(data: Partial<CustomField>): Promise<CustomField> {
    const response = await this.client.post<ApiResponse<CustomField>>('/custom-fields', data);
    return response.data.data!;
  }

  async updateCustomField(id: string, data: Partial<CustomField>): Promise<CustomField> {
    const response = await this.client.patch<ApiResponse<CustomField>>(`/custom-fields/${id}`, data);
    return response.data.data!;
  }

  async deleteCustomField(id: string): Promise<void> {
    await this.client.delete(`/custom-fields/${id}`);
  }

  async setFieldValue(fieldId: string, value: any, ticketId?: string): Promise<any> {
    const response = await this.client.post<ApiResponse<any>>(`/custom-fields/${fieldId}/value`, { value, ticketId });
    return response.data.data!;
  }

  async getTicketFieldValues(ticketId: string): Promise<any[]> {
    const response = await this.client.get<ApiResponse<any[]>>(`/custom-fields/ticket/${ticketId}`);
    return response.data.data!;
  }

  async getUserFieldValues(): Promise<any[]> {
    const response = await this.client.get<ApiResponse<any[]>>('/custom-fields/user/me');
    return response.data.data!;
  }

  async getApprovals(ticketId: string): Promise<Approval[]> {
    const response = await this.client.get<ApiResponse<Approval[]>>(`/approvals/ticket/${ticketId}`);
    return response.data.data!;
  }

  async getPendingApprovals(params?: Record<string, any>): Promise<PaginatedResponse<Approval>> {
    const response = await this.client.get<ApiResponse<PaginatedResponse<Approval>>>('/approvals/pending', { params });
    return toPage<any>(response.data.data, 'approvals') as any;
  }

  async createApproval(data: Partial<Approval>): Promise<Approval> {
    const response = await this.client.post<ApiResponse<Approval>>('/approvals', data);
    return response.data.data!;
  }

  async respondToApproval(id: string, status: 'APPROVED' | 'REJECTED', response?: string): Promise<Approval> {
    const res = await this.client.post<ApiResponse<Approval>>(`/approvals/${id}/respond`, { status, response });
    return res.data.data!;
  }

  async cancelApproval(id: string): Promise<void> {
    await this.client.post(`/approvals/${id}/cancel`);
  }

  async getDashboardStats(params?: Record<string, any>): Promise<any> {
    const response = await this.client.get<ApiResponse<any>>('/reports/dashboard', { params });
    return response.data.data!;
  }

  async getAgentPerformance(params?: Record<string, any>): Promise<any> {
    const response = await this.client.get<ApiResponse<any>>('/reports/agents/performance', { params });
    return response.data.data!;
  }

  async getDepartmentReport(params?: Record<string, any>): Promise<any> {
    const response = await this.client.get<ApiResponse<any>>('/reports/departments', { params });
    return response.data.data!;
  }

  async getSLAReport(params?: Record<string, any>): Promise<any> {
    const response = await this.client.get<ApiResponse<any>>('/reports/sla', { params });
    return response.data.data!;
  }

  async getTicketTrend(params?: Record<string, any>): Promise<any[]> {
    const response = await this.client.get<ApiResponse<any[]>>('/reports/tickets/trend', { params });
    return response.data.data!;
  }

  async getManagementDashboard(params?: Record<string, any>): Promise<any> {
    const response = await this.client.get<ApiResponse<any>>('/reports/management-dashboard', { params });
    return response.data.data!;
  }

  async getAuditLogs(params?: Record<string, any>): Promise<any> {
    const response = await this.client.get<ApiResponse<any>>('/audit-logs', { params });
    return toPage<any>(response.data.data, 'logs');
  }

  async exportTickets(params?: Record<string, any>): Promise<Blob> {
    const response = await this.client.get('/reports/export', { params, responseType: 'blob' });
    return response.data;
  }

  // ── Team Bucket ──────────────────────────────────────────────────────────────
  async getTeamBucket(departmentId: string, teamId: string, params?: Record<string, any>): Promise<any> {
    const response = await this.client.get<ApiResponse<any>>(`/departments/${departmentId}/teams/${teamId}/bucket`, { params });
    return response.data.data!;
  }

  /** Team lead reassigns a ticket to another team member */
  async reassignTicket(ticketId: string, assignedToId: string): Promise<any> {
    const response = await this.client.post<ApiResponse<any>>(`/tickets/${ticketId}/assign`, { assignedToId });
    return response.data.data!;
  }

  /** Get my team info (for a team lead) — finds the team where the current user is lead */
  async getMyTeam(departmentId: string): Promise<any[]> {
    const response = await this.client.get<ApiResponse<any[]>>(`/departments/${departmentId}/teams`);
    return response.data.data!;
  }

  // ── AI Copilot ───────────────────────────────────────────────────────────────
  async summarizeTicket(ticketId: string): Promise<{ summary: string[]; actionItems: string[]; statusOverview: string }> {
    const response = await this.client.post<ApiResponse<any>>('/ai/summarize', { ticketId });
    return response.data.data!;
  }

  async suggestReply(ticketId: string, tone: 'professional' | 'empathetic' | 'concise' = 'professional'): Promise<{ suggestedReply: string; tone: string }> {
    const response = await this.client.post<ApiResponse<any>>('/ai/suggest-reply', { ticketId, tone });
    return response.data.data!;
  }

  async analyzeSentiment(ticketId: string): Promise<{ sentiment: string; urgencyScore: number; emotion: string; keyConcerns: string[] }> {
    const response = await this.client.post<ApiResponse<any>>('/ai/analyze-sentiment', { ticketId });
    return response.data.data!;
  }

  async suggestArticles(ticketId: string): Promise<any[]> {
    const response = await this.client.post<ApiResponse<any[]>>('/ai/suggest-articles', { ticketId });
    return response.data.data!;
  }

  // ── Macros & Escalations ──────────────────────────────────────────────────
  async getMacros(): Promise<any[]> {
    const response = await this.client.get<ApiResponse<any[]>>('/macros');
    return response.data.data!;
  }

  async applyMacro(ticketId: string, macroId: string, resolutionText?: string): Promise<any> {
    const response = await this.client.post<ApiResponse<any>>('/macros/apply', { ticketId, macroId, resolutionText });
    return response.data.data!;
  }

  async runEscalationCheck(): Promise<any> {
    const response = await this.client.post<ApiResponse<any>>('/escalations/run');
    return response.data.data!;
  }
}

export const api = new ApiService();
export default api;