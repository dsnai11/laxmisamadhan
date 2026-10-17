import { Fragment, useState, useEffect } from 'react';
import { Outlet, NavLink, Link, useLocation, useNavigate } from 'react-router-dom';
import { Dialog, Transition, Menu } from '@headlessui/react';
import { XMarkIcon, Bars3Icon, BellIcon, UserCircleIcon, MoonIcon, SunIcon, Cog6ToothIcon, ArrowRightOnRectangleIcon, ChevronDownIcon, ChevronRightIcon, ChevronLeftIcon } from '@heroicons/react/24/outline';
import { useAuth } from '@context/AuthContext';
import { useSocket } from '@context/SocketContext';
import { useTheme } from '@context/ThemeContext';
import api from '@services/api';
import { Notification } from '@types';
import { formatRelativeTime, getInitials, cn } from '@utils/helpers';
import NotificationDropdown from '@components/common/NotificationDropdown';
import UserMenu from '@components/common/UserMenu';
import MobileBottomNav from '@components/layout/MobileBottomNav';
import { triggerHaptic } from '@utils/nativeApp';

const navigation = [
  { name: 'Dashboard', href: '/admin/dashboard', icon: 'home', roles: ['SUPER_ADMIN', 'ADMIN', 'DEPARTMENT_HEAD'] },
  { name: 'Raise Ticket', href: '/raiser/create-ticket', icon: 'plus', roles: ['SUPER_ADMIN', 'ADMIN', 'DEPARTMENT_HEAD'] },
  { name: 'All Tickets', href: '/admin/tickets', icon: 'ticket', roles: ['SUPER_ADMIN', 'ADMIN', 'DEPARTMENT_HEAD'] },
  { name: 'Team Bucket', href: '/agent/team-bucket', icon: 'team', roles: ['SUPER_ADMIN', 'ADMIN', 'DEPARTMENT_HEAD'] },
  { name: 'Approvals', href: '/admin/approvals', icon: 'check', roles: ['SUPER_ADMIN', 'ADMIN', 'DEPARTMENT_HEAD'] },
  { name: 'My Requests', href: '/raiser/my-tickets', icon: 'ticket', roles: ['SUPER_ADMIN', 'ADMIN', 'DEPARTMENT_HEAD'] },
  { name: 'Users', href: '/admin/users', icon: 'users', roles: ['SUPER_ADMIN', 'ADMIN', 'DEPARTMENT_HEAD'] },
  { name: 'Departments', href: '/admin/departments', icon: 'building', roles: ['SUPER_ADMIN', 'ADMIN', 'DEPARTMENT_HEAD'] },
  { name: 'Teams', href: '/admin/teams', icon: 'team', roles: ['SUPER_ADMIN', 'ADMIN', 'DEPARTMENT_HEAD'] },
  { name: 'SLA Policies', href: '/admin/sla', icon: 'clock', roles: ['SUPER_ADMIN', 'ADMIN', 'DEPARTMENT_HEAD', 'TEAM_LEAD'] },
  { name: 'Assets', href: '/admin/assets', icon: 'laptop', roles: ['SUPER_ADMIN', 'ADMIN', 'DEPARTMENT_HEAD'] },
  { name: 'Knowledge Base', href: '/admin/knowledge', icon: 'book', roles: ['SUPER_ADMIN', 'ADMIN', 'DEPARTMENT_HEAD'] },
  { name: 'Reports', href: '/admin/reports', icon: 'chart', roles: ['SUPER_ADMIN', 'ADMIN', 'DEPARTMENT_HEAD'] },
  { name: 'Settings', href: '/admin/settings', icon: 'cog', roles: ['SUPER_ADMIN', 'ADMIN'] },
  { name: 'Audit Logs', href: '/admin/audit-logs', icon: 'shield', roles: ['SUPER_ADMIN', 'ADMIN'] },
];

const raiserNavigation = [
  { name: 'Dashboard', href: '/raiser/dashboard', icon: 'home', roles: ['RAISER', 'VIEWER', 'AGENT', 'TEAM_LEAD', 'DEPARTMENT_HEAD', 'ADMIN', 'SUPER_ADMIN'] },
  { name: 'Raise Ticket', href: '/raiser/create-ticket', icon: 'plus', roles: ['RAISER', 'VIEWER', 'AGENT', 'TEAM_LEAD', 'DEPARTMENT_HEAD', 'ADMIN', 'SUPER_ADMIN'] },
  { name: 'My Tickets', href: '/raiser/my-tickets', icon: 'ticket', roles: ['RAISER', 'VIEWER', 'AGENT', 'TEAM_LEAD', 'DEPARTMENT_HEAD', 'ADMIN', 'SUPER_ADMIN'] },
  { name: 'Knowledge Base', href: '/raiser/knowledge', icon: 'book', roles: ['RAISER', 'VIEWER', 'AGENT', 'TEAM_LEAD', 'DEPARTMENT_HEAD', 'ADMIN', 'SUPER_ADMIN'] },
  { name: 'Profile', href: '/raiser/profile', icon: 'user', roles: ['RAISER', 'VIEWER', 'AGENT', 'TEAM_LEAD', 'DEPARTMENT_HEAD', 'ADMIN', 'SUPER_ADMIN'] },
];

const agentNavigation = [
  { name: 'Dashboard', href: '/agent/dashboard', icon: 'home', roles: ['AGENT', 'TEAM_LEAD', 'DEPARTMENT_HEAD', 'ADMIN', 'SUPER_ADMIN'] },
  { name: 'Raise Ticket', href: '/raiser/create-ticket', icon: 'plus', roles: ['AGENT', 'TEAM_LEAD', 'DEPARTMENT_HEAD', 'ADMIN', 'SUPER_ADMIN'] },
  { name: 'My Requests', href: '/raiser/my-tickets', icon: 'ticket', roles: ['AGENT', 'TEAM_LEAD', 'DEPARTMENT_HEAD', 'ADMIN', 'SUPER_ADMIN'] },
  { name: 'Ticket Queue', href: '/agent/queue', icon: 'queue', roles: ['AGENT', 'TEAM_LEAD', 'DEPARTMENT_HEAD', 'ADMIN', 'SUPER_ADMIN'] },
  { name: 'My Assignments', href: '/agent/my-assignments', icon: 'assignment', roles: ['AGENT', 'TEAM_LEAD', 'DEPARTMENT_HEAD', 'ADMIN', 'SUPER_ADMIN'] },
  { name: 'Team Bucket', href: '/agent/team-bucket', icon: 'team', roles: ['AGENT', 'TEAM_LEAD', 'DEPARTMENT_HEAD', 'ADMIN', 'SUPER_ADMIN'] },
  { name: 'Teams', href: '/agent/teams', icon: 'team', roles: ['TEAM_LEAD', 'DEPARTMENT_HEAD', 'ADMIN', 'SUPER_ADMIN'] },
  { name: 'Approvals', href: '/agent/approvals', icon: 'check', roles: ['TEAM_LEAD', 'DEPARTMENT_HEAD', 'ADMIN', 'SUPER_ADMIN'] },
  { name: 'SLA Policies', href: '/agent/sla', icon: 'clock', roles: ['TEAM_LEAD', 'DEPARTMENT_HEAD', 'ADMIN', 'SUPER_ADMIN'] },
  { name: 'Knowledge Base', href: '/agent/knowledge', icon: 'book', roles: ['AGENT', 'TEAM_LEAD', 'DEPARTMENT_HEAD', 'ADMIN', 'SUPER_ADMIN'] },
];


function getNavigation(userRoles: string[]) {
  const isAdmin = userRoles.some(r => ['SUPER_ADMIN', 'ADMIN', 'DEPARTMENT_HEAD'].includes(r));
  const isAgent = userRoles.some(r => ['AGENT', 'TEAM_LEAD'].includes(r));
  const list = isAdmin ? navigation : isAgent ? agentNavigation : raiserNavigation;
  return list.filter((item) => item.roles.some(r => userRoles.includes(r)));
}

function getPortalName(userRoles: string[]) {
  if (userRoles.some(r => ['SUPER_ADMIN', 'ADMIN', 'DEPARTMENT_HEAD'].includes(r))) return 'IT Service Desk — Admin';
  if (userRoles.some(r => ['AGENT', 'TEAM_LEAD'].includes(r))) return 'IT Service Desk — Agent';
  return 'IT Service Desk';
}

export default function Layout() {
  const { user, logout, hasRole } = useAuth();
  const { isConnected, onNotification } = useSocket();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationDropdownOpen, setNotificationDropdownOpen] = useState(false);
  const { isDarkMode, toggleTheme } = useTheme();

  const userRoles = user?.roles && user.roles.length > 0 ? (user.roles as string[]) : [user?.role || ''];
  const navItems = getNavigation(userRoles);
  const portalName = getPortalName(userRoles);

  const rootPaths = [
    '/admin/dashboard',
    '/admin/tickets',
    '/admin/approvals',
    '/agent/dashboard',
    '/agent/queue',
    '/agent/team-bucket',
    '/raiser/dashboard',
    '/raiser/my-tickets',
    '/raiser/knowledge',
    '/raiser/profile',
  ];
  const isChildRoute = !rootPaths.includes(location.pathname);

  useEffect(() => {
    if (!user) return;

    const unsubscribe = onNotification((notification) => {
      setNotifications(prev => [notification, ...prev.slice(0, 49)]);
      setUnreadCount(prev => prev + 1);
    });

    return unsubscribe;
  }, [user, onNotification]);

  const handleLogout = async () => {
    await logout(true);
    navigate('/login');
  };

  useEffect(() => {
    if (!user) return;
    api.getNotifications({ page: 1, limit: 20 })
      .then((res: any) => {
        setNotifications(res.data || []);
        setUnreadCount(res.unreadCount || 0);
      })
      .catch(() => undefined);
  }, [user?.id]);

  const markNotificationRead = (id: string) => {
    const target = notifications.find(n => n.id === id);
    if (!target || target.isRead) return;
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
    api.markNotificationsRead([id]).catch(() => undefined);
  };

  const markAllNotificationsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    setUnreadCount(0);
    api.markAllNotificationsRead().catch(() => undefined);
  };

  const openNotification = (n: Notification) => {
    if (n.referenceType !== 'TICKET' || !n.referenceId) return;
    const base = ['SUPER_ADMIN', 'ADMIN', 'DEPARTMENT_HEAD'].includes(role) ? '/admin/tickets/' : ['AGENT', 'TEAM_LEAD'].includes(role) ? '/agent/tickets/' : '/raiser/tickets/';
    navigate(base + n.referenceId);
  };

  // Auto close mobile drawer on route changes
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  return (
    <div className="page-container">
      {/* Mobile sidebar overlay */}
      <Transition.Root show={sidebarOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50 lg:hidden" onClose={setSidebarOpen}>
          <Transition.Child
            as={Fragment}
            enter="transition-opacity ease-linear duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="transition-opacity ease-linear duration-300"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-gray-900/80 backdrop-blur-sm" />
          </Transition.Child>

          <div className="fixed inset-0 flex">
            <Transition.Child
              as={Fragment}
              enter="transition ease-in-out duration-300 transform"
              enterFrom="-translate-x-full"
              enterTo="translate-x-0"
              leave="transition ease-in-out duration-300 transform"
              leaveFrom="translate-x-0"
              leaveTo="-translate-x-full"
            >
              <Dialog.Panel className="relative mr-14 sm:mr-16 flex w-full max-w-xs flex-1">
                <Transition.Child
                  as={Fragment}
                  enter="ease-in-out duration-300"
                  enterFrom="opacity-0"
                  enterTo="opacity-100"
                  leave="ease-in-out duration-300"
                  leaveFrom="opacity-100"
                  leaveTo="opacity-0"
                >
                  <div className="absolute left-full top-0 flex w-14 sm:w-16 justify-center pt-5">
                    <button type="button" className="-m-2.5 p-2.5" onClick={() => setSidebarOpen(false)}>
                      <span className="sr-only">Close sidebar</span>
                      <XMarkIcon className="h-6 w-6 text-white" aria-hidden="true" />
                    </button>
                  </div>
                </Transition.Child>
                <SidebarContent navItems={navItems} portalName={portalName} onNavigate={() => setSidebarOpen(false)} />
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition.Root>

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-64 lg:flex-col">
        <SidebarContent navItems={navItems} portalName={portalName} />
      </div>

      {/* Main content */}
      <div className="lg:pl-64 flex flex-col min-h-screen w-full min-w-0">
        {/* Top header */}
        <header className="sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-gray-200 dark:border-slate-800 transition-colors header-safe-top pt-[env(safe-area-inset-top,0px)]">
          <div className="flex items-center justify-between h-16 px-3 sm:px-6 gap-2">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              {isChildRoute ? (
                <button
                  type="button"
                  className="lg:hidden p-2 -ml-1 text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full shrink-0 transition-transform active:scale-90"
                  onClick={() => {
                    triggerHaptic();
                    navigate(-1);
                  }}
                  aria-label="Go Back"
                >
                  <ChevronLeftIcon className="h-6 w-6 stroke-[2.5]" />
                </button>
              ) : (
                <button
                  type="button"
                  className="lg:hidden p-2 -ml-1 text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg shrink-0 transition-colors active:scale-90"
                  onClick={() => {
                    triggerHaptic();
                    setSidebarOpen(true);
                  }}
                >
                  <span className="sr-only">Open sidebar</span>
                  <Bars3Icon className="h-6 w-6" aria-hidden="true" />
                </button>
              )}
              <img src="/logo.jpg" alt="Laxmi India Finance Ltd" className="h-8 w-8 rounded object-cover lg:hidden border border-gray-200 dark:border-slate-700 shrink-0" />
              <h1 className="text-sm sm:text-base md:text-lg font-semibold text-gray-900 dark:text-white truncate min-w-0">{portalName}</h1>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
              <Link
                to="/raiser/create-ticket"
                className="btn-primary btn-sm hidden sm:flex items-center gap-1.5 font-medium shadow-sm hover:shadow transition-all"
                title="Raise a new ticket"
              >
                <span className="text-base font-bold leading-none">+</span>
                <span>Raise Ticket</span>
              </Link>

              <button
                type="button"
                onClick={toggleTheme}
                className="p-1.5 sm:p-2 text-gray-500 hover:text-gray-700 dark:text-amber-400 dark:hover:text-amber-300 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                title={isDarkMode ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
                aria-label="Toggle theme"
              >
                {isDarkMode ? (
                  <SunIcon className="h-5 w-5 text-amber-400" />
                ) : (
                  <MoonIcon className="h-5 w-5 text-gray-600" />
                )}
              </button>

              <NotificationDropdown
                isOpen={notificationDropdownOpen}
                onClose={() => setNotificationDropdownOpen(false)}
                notifications={notifications}
                unreadCount={unreadCount}
                onMarkRead={markNotificationRead}
                onMarkAllRead={markAllNotificationsRead}
                onSelect={openNotification}
              />

              <UserMenu user={user!} onLogout={handleLogout} />
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-3 sm:p-5 md:p-6 lg:p-8 min-w-0 max-w-full overflow-x-hidden mobile-safe-bottom pb-[calc(5rem+env(safe-area-inset-bottom,0px))] lg:pb-8">
          <Outlet />
        </main>

        {/* Native Mobile Bottom Navigation */}
        <MobileBottomNav onOpenMore={() => setSidebarOpen(true)} />
      </div>
    </div>
  );
}

function SidebarContent({ navItems, portalName, onNavigate }: { navItems: any[]; portalName: string; onNavigate?: () => void }) {
  const { user } = useAuth();
  
  return (
    <div className="flex flex-col flex-1 h-full min-h-0 bg-white dark:bg-slate-900 border-r border-gray-200 dark:border-slate-800 transition-colors sidebar-safe-top pt-[env(safe-area-inset-top,0px)] mobile-safe-bottom pb-[env(safe-area-inset-bottom,0px)]">
      <div className="flex items-center gap-3 h-16 px-4 border-b border-gray-200 dark:border-slate-800 shrink-0">
        <img src="/logo.jpg" alt="Laxmi India Finance Ltd" className="h-10 w-10 rounded-lg object-cover shrink-0 border border-gray-200 dark:border-slate-700" />
        <div className="min-w-0">
          <p className="text-sm font-bold text-gray-900 dark:text-white truncate leading-tight">Laxmi India Finance</p>
          <p className="text-xs text-gray-500 dark:text-slate-400 truncate leading-tight">{portalName}</p>
        </div>
      </div>
      <nav className="flex-1 px-3 sm:px-4 py-4 space-y-1 overflow-y-auto min-h-0 scrollbar-thin" aria-label="Main navigation">
        {navItems.map((item) => (
          <NavLink
            key={item.name}
            to={item.href}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'sidebar-link',
                isActive && 'sidebar-link-active'
              )
            }
          >
            <span>{item.name}</span>
          </NavLink>
        ))}
      </nav>
      <div className="p-3 sm:p-4 border-t border-gray-200 dark:border-slate-800 shrink-0">
        <div className="flex items-center gap-3 px-2 sm:px-3 py-2">
          <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-950/70 border border-transparent dark:border-primary-800/60 flex items-center justify-center shrink-0">
            <span className="text-sm font-medium text-primary-700 dark:text-primary-300">
              {getInitials(user?.firstName || '', user?.lastName || '')}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{user?.firstName} {user?.lastName}</p>
            <p className="text-xs text-gray-500 dark:text-slate-400 truncate capitalize">{user?.role.replace('_', ' ').toLowerCase()}</p>
          </div>
        </div>
      </div>
    </div>
  );
}