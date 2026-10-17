import { Routes, Route, Navigate, useParams } from 'react-router-dom';
import { useAuth } from '@context/AuthContext';
import { useEffect } from 'react';
import Layout from '@components/layout/Layout';
import LoginPage from '@pages/auth/LoginPage';
import RegisterPage from '@pages/auth/RegisterPage';
import ForgotPasswordPage from '@pages/auth/ForgotPasswordPage';
import ResetPasswordPage from '@pages/auth/ResetPasswordPage';
import MFASetupPage from '@pages/auth/MFASetupPage';
import VerifyEmailPage from '@pages/auth/VerifyEmailPage';

// Admin pages
import AdminDashboard from '@pages/admin/Dashboard';
import ManagementDashboard from '@pages/admin/ManagementDashboard';
import AdminAllTickets from '@pages/admin/AllTickets';
import AdminTicketDetail from '@pages/admin/TicketDetail';
import ApprovalsPage from '@pages/common/Approvals';
import AdminUsers from '@pages/admin/Users';
import AdminUserDetail from '@pages/admin/UserDetail';
import AdminDepartments from '@pages/admin/Departments';
import AdminDepartmentDetail from '@pages/admin/DepartmentDetail';
import AdminTeams from '@pages/admin/Teams';
import AdminSLAPolicies from '@pages/admin/SLAPolicies';
import AdminAssets from '@pages/admin/Assets';
import AdminKnowledgeBases from '@pages/admin/KnowledgeBases';
import AdminReports from '@pages/admin/Reports';
import AdminSettings from '@pages/admin/Settings';
import AdminAuditLogs from '@pages/admin/AuditLogs';
import AdminRolePermissions from '@pages/admin/RolePermissions';

// Raiser pages
import RaiserDashboard from '@pages/raiser/Dashboard';
import RaiserCreateTicket from '@pages/raiser/CreateTicket';
import RaiserMyTickets from '@pages/raiser/MyTickets';
import RaiserTicketDetail from '@pages/raiser/TicketDetail';
import RaiserKnowledgeBase from '@pages/raiser/KnowledgeBase';
import RaiserProfile from '@pages/raiser/Profile';

// Agent pages
import AgentDashboard from '@pages/agent/Dashboard';
import AgentTicketQueue from '@pages/agent/TicketQueue';
import AgentTicketDetail from '@pages/agent/TicketDetail';
import AgentMyAssignments from '@pages/agent/MyAssignments';
import AgentKnowledgeBase from '@pages/agent/KnowledgeBase';
import AgentTeamBucket from '@pages/agent/TeamBucket';

function ProtectedRoute({ children, allowedRoles }: { children: React.ReactNode; allowedRoles?: string[] }) {
  const { isAuthenticated, isLoading, user, hasRole } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-600 border-t-transparent"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !hasRole(allowedRoles)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-600 border-t-transparent"></div>
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function TicketRedirect() {
  const { id } = useParams();
  const { user } = useAuth();
  const userRoles = Array.from(new Set([
    ...(user?.role ? [user.role] : []),
    ...(user?.roles || [])
  ]));
  const isAdmin = userRoles.some((r) => ['SUPER_ADMIN', 'ADMIN', 'DEPARTMENT_HEAD'].includes(r));
  const isAgent = userRoles.some((r) => ['AGENT', 'TEAM_LEAD'].includes(r));

  if (isAdmin) {
    return <Navigate to={`/admin/tickets/${id}`} replace />;
  }
  if (isAgent) {
    return <Navigate to={`/agent/tickets/${id}`} replace />;
  }
  return <Navigate to={`/raiser/tickets/${id}`} replace />;
}

function AppRoutes() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN';
  const isDepartmentHead = user?.role === 'DEPARTMENT_HEAD';
  const isTeamLead = user?.role === 'TEAM_LEAD';
  const isAgent = user?.role === 'AGENT';
  const isRaiser = user?.role === 'RAISER' || user?.role === 'VIEWER';

  return (
    <Routes>
      {/* Universal Ticket Deep-Link (used in email notifications) */}
      <Route path="/tickets/:id" element={<ProtectedRoute><TicketRedirect /></ProtectedRoute>} />

      {/* Public routes */}
      <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
      <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />
      <Route path="/forgot-password" element={<PublicRoute><ForgotPasswordPage /></PublicRoute>} />
      <Route path="/reset-password" element={<PublicRoute><ResetPasswordPage /></PublicRoute>} />
      <Route path="/verify-email" element={<PublicRoute><VerifyEmailPage /></PublicRoute>} />
      <Route path="/mfa-setup" element={<ProtectedRoute><MFASetupPage /></ProtectedRoute>} />

      {/* Admin routes */}
      <Route path="/admin/*" element={
        <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'ADMIN', 'DEPARTMENT_HEAD']}>
          <Layout />
        </ProtectedRoute>
      }>
        <Route index element={<Navigate to="/admin/dashboard" replace />} />
        <Route path="dashboard" element={<AdminDashboard />} />
        <Route path="management-dashboard" element={<ManagementDashboard />} />
        <Route path="tickets" element={<AdminAllTickets />} />
        <Route path="tickets/:id" element={<AdminTicketDetail />} />
        <Route path="approvals" element={<ApprovalsPage ticketBase="/admin/tickets" />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="users/:id" element={<AdminUserDetail />} />
        <Route path="departments" element={<AdminDepartments />} />
        <Route path="departments/:id" element={<AdminDepartmentDetail />} />
        <Route path="teams" element={<AdminTeams />} />
        <Route path="sla" element={<AdminSLAPolicies />} />
        <Route path="assets" element={<AdminAssets />} />
        <Route path="knowledge" element={<AdminKnowledgeBases />} />
        <Route path="reports" element={<AdminReports />} />
        <Route path="settings" element={<AdminSettings />} />
        <Route path="audit-logs" element={<AdminAuditLogs />} />
        <Route path="role-permissions" element={<AdminRolePermissions />} />
      </Route>

      {/* Raiser routes */}
      <Route path="/raiser/*" element={
        <ProtectedRoute allowedRoles={['RAISER', 'VIEWER', 'AGENT', 'TEAM_LEAD', 'DEPARTMENT_HEAD', 'ADMIN', 'SUPER_ADMIN']}>
          <Layout />
        </ProtectedRoute>
      }>
        <Route index element={<Navigate to="/raiser/dashboard" replace />} />
        <Route path="dashboard" element={<RaiserDashboard />} />
        <Route path="create-ticket" element={<RaiserCreateTicket />} />
        <Route path="my-tickets" element={<RaiserMyTickets />} />
        <Route path="tickets/:id" element={<RaiserTicketDetail />} />
        <Route path="knowledge" element={<RaiserKnowledgeBase />} />
        <Route path="profile" element={<RaiserProfile />} />
      </Route>

      {/* Agent routes */}
      <Route path="/agent/*" element={
        <ProtectedRoute allowedRoles={['AGENT', 'TEAM_LEAD', 'DEPARTMENT_HEAD', 'ADMIN', 'SUPER_ADMIN']}>
          <Layout />
        </ProtectedRoute>
      }>
        <Route index element={<Navigate to="/agent/dashboard" replace />} />
        <Route path="dashboard" element={<AgentDashboard />} />
        <Route path="queue" element={<AgentTicketQueue />} />
        <Route path="tickets/:id" element={<AgentTicketDetail />} />
        <Route path="my-assignments" element={<AgentMyAssignments />} />
        <Route path="team-bucket" element={<AgentTeamBucket />} />
        <Route path="teams" element={<AdminTeams />} />
        <Route path="approvals" element={<ApprovalsPage ticketBase="/agent/tickets" />} />
        <Route path="sla" element={<AdminSLAPolicies />} />
        <Route path="knowledge" element={<AgentKnowledgeBase />} />
      </Route>

      {/* Main redirect based on role */}
      <Route path="/" element={
        <ProtectedRoute>
          {(() => {
            if (isAdmin || isDepartmentHead) return <Navigate to="/admin/dashboard" replace />;
            if (isAgent || isTeamLead) return <Navigate to="/agent/dashboard" replace />;
            return <Navigate to="/raiser/dashboard" replace />;
          })()}
        </ProtectedRoute>
      } />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

import ErrorBoundary from '@components/common/ErrorBoundary';
import { useTheme } from '@context/ThemeContext';
import { initNativeApp, updateNativeStatusBar } from '@utils/nativeApp';

export default function App() {
  const { initializeAuth } = useAuth();
  const { isDarkMode } = useTheme();

  useEffect(() => {
    initializeAuth();
    initNativeApp(isDarkMode);
  }, [initializeAuth]);

  useEffect(() => {
    updateNativeStatusBar(isDarkMode);
  }, [isDarkMode]);

  return (
    <ErrorBoundary>
      <AppRoutes />
    </ErrorBoundary>
  );
}