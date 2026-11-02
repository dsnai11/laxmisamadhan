import { useLocation, useNavigate } from 'react-router-dom';
import {
  HomeIcon,
  TicketIcon,
  PlusIcon,
  CheckCircleIcon,
  Bars3Icon,
  UserGroupIcon,
  BookOpenIcon,
  UserIcon,
} from '@heroicons/react/24/outline';
import {
  HomeIcon as HomeIconSolid,
  TicketIcon as TicketIconSolid,
  CheckCircleIcon as CheckCircleIconSolid,
  UserGroupIcon as UserGroupIconSolid,
  BookOpenIcon as BookOpenIconSolid,
  UserIcon as UserIconSolid,
} from '@heroicons/react/24/solid';
import { useAuth } from '@context/AuthContext';
import { triggerHaptic } from '@utils/nativeApp';
import { cn } from '@utils/helpers';

interface MobileBottomNavProps {
  onOpenMore: () => void;
}

export default function MobileBottomNav({ onOpenMore }: MobileBottomNavProps) {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const userRoles = user?.roles && user.roles.length > 0 ? (user.roles as string[]) : [user?.role || ''];
  const isAdmin = userRoles.some((r) => ['SUPER_ADMIN', 'ADMIN', 'DEPARTMENT_HEAD'].includes(r));
  const isAgent = userRoles.some((r) => ['AGENT', 'TEAM_LEAD'].includes(r));

  const handleNav = (href: string) => {
    triggerHaptic();
    navigate(href);
  };

  const handleActionCenter = () => {
    triggerHaptic();
    navigate('/raiser/create-ticket');
  };

  const handleMore = () => {
    triggerHaptic();
    onOpenMore();
  };

  // Determine tabs based on role
  let tabs = [];

  if (isAdmin) {
    tabs = [
      {
        name: 'Home',
        href: '/admin/dashboard',
        icon: HomeIcon,
        iconActive: HomeIconSolid,
        isActive: location.pathname === '/admin/dashboard',
      },
      {
        name: 'Tickets',
        href: '/admin/tickets',
        icon: TicketIcon,
        iconActive: TicketIconSolid,
        isActive: location.pathname.startsWith('/admin/tickets'),
      },
      {
        isAction: true,
        name: 'Raise',
      },
      {
        name: 'Approvals',
        href: '/admin/approvals',
        icon: CheckCircleIcon,
        iconActive: CheckCircleIconSolid,
        isActive: location.pathname.startsWith('/admin/approvals'),
      },
      {
        isMore: true,
        name: 'More',
        icon: Bars3Icon,
        iconActive: Bars3Icon,
        isActive: false,
      },
    ];
  } else if (isAgent) {
    const canSeeBucket = userRoles.includes('SUPER_ADMIN') || Boolean(user?.canViewTeamBucket);
    tabs = [
      {
        name: 'Home',
        href: '/agent/dashboard',
        icon: HomeIcon,
        iconActive: HomeIconSolid,
        isActive: location.pathname === '/agent/dashboard',
      },
      {
        name: 'Queue',
        href: '/agent/queue',
        icon: TicketIcon,
        iconActive: TicketIconSolid,
        isActive: location.pathname.startsWith('/agent/queue') || location.pathname.startsWith('/agent/tickets'),
      },
      {
        isAction: true,
        name: 'Raise',
      },
      {
        name: canSeeBucket ? 'Team' : 'My Work',
        href: canSeeBucket ? '/agent/team-bucket' : '/agent/my-assignments',
        icon: UserGroupIcon,
        iconActive: UserGroupIconSolid,
        isActive: canSeeBucket
          ? location.pathname.startsWith('/agent/team-bucket')
          : location.pathname.startsWith('/agent/my-assignments'),
      },
      {
        isMore: true,
        name: 'More',
        icon: Bars3Icon,
        iconActive: Bars3Icon,
        isActive: false,
      },
    ];
  } else {
    // Raiser
    tabs = [
      {
        name: 'Home',
        href: '/raiser/dashboard',
        icon: HomeIcon,
        iconActive: HomeIconSolid,
        isActive: location.pathname === '/raiser/dashboard',
      },
      {
        name: 'My Tickets',
        href: '/raiser/my-tickets',
        icon: TicketIcon,
        iconActive: TicketIconSolid,
        isActive: location.pathname.startsWith('/raiser/my-tickets') || location.pathname.startsWith('/raiser/tickets'),
      },
      {
        isAction: true,
        name: 'Raise',
      },
      {
        name: 'Knowledge',
        href: '/raiser/knowledge',
        icon: BookOpenIcon,
        iconActive: BookOpenIconSolid,
        isActive: location.pathname.startsWith('/raiser/knowledge'),
      },
      {
        name: 'Profile',
        href: '/raiser/profile',
        icon: UserIcon,
        iconActive: UserIconSolid,
        isActive: location.pathname.startsWith('/raiser/profile'),
      },
    ];
  }

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-t border-gray-200/90 dark:border-slate-800/90 lg:hidden shadow-[0_-4px_25px_rgba(0,0,0,0.06)] dark:shadow-[0_-4px_25px_rgba(0,0,0,0.4)] pb-[env(safe-area-inset-bottom,0px)]"
      aria-label="Mobile Bottom Navigation"
    >
      <div className="flex items-center justify-around h-16 px-1">
        {tabs.map((tab, idx) => {
          if (tab.isAction) {
            const isRaiseActive = location.pathname === '/raiser/create-ticket';
            return (
              <button
                key="action-center-btn"
                type="button"
                onClick={handleActionCenter}
                className="relative -top-3.5 flex flex-col items-center justify-center group focus:outline-none"
                aria-label="Raise Ticket"
              >
                <div
                  className={cn(
                    'w-12 h-12 rounded-full flex items-center justify-center text-white shadow-lg transition-transform duration-150 active:scale-90',
                    isRaiseActive
                      ? 'bg-primary-700 ring-4 ring-primary-200 dark:ring-primary-900 shadow-primary-500/40'
                      : 'bg-gradient-to-tr from-primary-600 to-indigo-500 shadow-primary-600/30'
                  )}
                >
                  <PlusIcon className="w-6 h-6 stroke-[2.5]" />
                </div>
                <span className="text-[10px] font-semibold text-primary-600 dark:text-primary-400 mt-0.5 tracking-tight">
                  Raise
                </span>
              </button>
            );
          }

          if (tab.isMore) {
            const Icon = tab.icon!;
            return (
              <button
                key="more-menu-btn"
                type="button"
                onClick={handleMore}
                className="flex flex-col items-center justify-center flex-1 h-full py-1 text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white transition-colors duration-150 active:scale-95"
                aria-label="More Menu"
              >
                <Icon className="w-5 h-5 mb-0.5" />
                <span className="text-[11px] font-medium tracking-tight">Menu</span>
              </button>
            );
          }

          const isActive = tab.isActive;
          const Icon = isActive ? tab.iconActive! : tab.icon!;

          return (
            <button
              key={tab.name}
              type="button"
              onClick={() => handleNav(tab.href!)}
              className={cn(
                'flex flex-col items-center justify-center flex-1 h-full py-1 transition-all duration-150 active:scale-95 relative',
                isActive
                  ? 'text-primary-600 dark:text-primary-400 font-semibold'
                  : 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white font-medium'
              )}
              aria-label={tab.name}
            >
              {isActive && (
                <span className="absolute top-1 w-5 h-0.5 rounded-full bg-primary-600 dark:bg-primary-400" />
              )}
              <Icon className={cn('w-5 h-5 mb-0.5 transition-transform', isActive && 'scale-110')} />
              <span className="text-[11px] tracking-tight truncate max-w-[64px]">{tab.name}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
