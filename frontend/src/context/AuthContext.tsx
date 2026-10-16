import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { User, TokenPair, AuthState } from '@types';
import api from '@services/api';

interface AuthContextType extends AuthState {
  initializeAuth: () => Promise<void>;
  login: (email: string, password: string, mfaCode?: string, rememberMe?: boolean) => Promise<void>;
  register: (data: any) => Promise<void>;
  logout: (revokeAll?: boolean) => Promise<void>;
  updateProfile: (data: Partial<User>) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  resetPassword: (token: string, email: string, password: string) => Promise<void>;
  setupMFA: () => Promise<{ secret: string; qrCodeUrl: string; backupCodes: string[] }>;
  verifyMFA: (code: string) => Promise<void>;
  disableMFA: (code: string) => Promise<void>;
  verifyBackupCode: (code: string) => Promise<void>;
  refreshUser: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
  hasRole: (role: string | string[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    tokens: null,
    isAuthenticated: false,
    isLoading: true,
  });

  const initializeAuth = useCallback(async () => {
    if (api.isAuthenticated()) {
      try {
        const user = await api.getMe();
        setState({
          user,
          tokens: { accessToken: api.getAccessToken()!, refreshToken: '', expiresIn: 0 },
          isAuthenticated: true,
          isLoading: false,
        });
      } catch {
        api.clearAuth();
        setState({ user: null, tokens: null, isAuthenticated: false, isLoading: false });
      }
    } else {
      setState({ user: null, tokens: null, isAuthenticated: false, isLoading: false });
    }
  }, []);

  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  const login = async (email: string, password: string, mfaCode?: string, rememberMe?: boolean) => {
    const res = await api.login({ email, password, mfaCode, rememberMe });
    if (!res || !res.user) {
      throw new Error('Authentication failed. Unable to establish user session.');
    }
    const { user, tokens } = res;
    setState({ user, tokens, isAuthenticated: true, isLoading: false });
  };

  const register = async (data: any) => {
    const res = await api.register(data);
    if (!res || !res.user) {
      throw new Error('Registration failed. Unable to establish user session.');
    }
    const { user, tokens } = res;
    setState({ user, tokens, isAuthenticated: true, isLoading: false });
  };

  const logout = async (revokeAll = false) => {
    await api.logout(revokeAll);
    setState({ user: null, tokens: null, isAuthenticated: false, isLoading: false });
  };

  const updateProfile = async (data: Partial<User>) => {
    const user = await api.updateProfile(data);
    setState(prev => ({ ...prev, user }));
  };

  const changePassword = async (currentPassword: string, newPassword: string) => {
    await api.changePassword(currentPassword, newPassword);
    await logout(true);
  };

  const forgotPassword = async (email: string) => {
    await api.forgotPassword(email);
  };

  const resetPassword = async (token: string, email: string, password: string) => {
    await api.resetPassword(token, email, password);
  };

  const setupMFA = async () => {
    return api.setupMFA();
  };

  const verifyMFA = async (code: string) => {
    await api.verifyMFA(code);
    const user = await api.getMe();
    setState(prev => ({ ...prev, user }));
  };

  const disableMFA = async (code: string) => {
    await api.disableMFA(code);
    const user = await api.getMe();
    setState(prev => ({ ...prev, user }));
  };

  const verifyBackupCode = async (code: string) => {
    await api.verifyBackupCode(code);
  };

  const refreshUser = async () => {
    if (api.isAuthenticated()) {
      const user = await api.getMe();
      setState(prev => ({ ...prev, user }));
    }
  };

  const hasPermission = (permission: string): boolean => {
    if (!state.user) return false;
    const userRoles = state.user.roles && state.user.roles.length > 0 ? state.user.roles : [state.user.role];
    if (userRoles.includes('SUPER_ADMIN' as any)) return true;
    return state.user.permissions?.includes(permission) || false;
  };

  const hasRole = (role: string | string[]): boolean => {
    if (!state.user) return false;
    const requiredRoles = Array.isArray(role) ? role : [role];
    const userRoles = state.user.roles && state.user.roles.length > 0 ? state.user.roles : [state.user.role];
    if (userRoles.includes('SUPER_ADMIN' as any)) return true;
    return requiredRoles.some((r) => userRoles.includes(r as any));
  };

  return (
    <AuthContext.Provider value={{
      ...state,
      initializeAuth,
      login,
      register,
      logout,
      updateProfile,
      changePassword,
      forgotPassword,
      resetPassword,
      setupMFA,
      verifyMFA,
      disableMFA,
      verifyBackupCode,
      refreshUser,
      hasPermission,
      hasRole,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}