import { Fragment } from 'react';
import { Menu, Transition } from '@headlessui/react';
import { UserCircleIcon, Cog6ToothIcon, ArrowRightOnRectangleIcon, ShieldCheckIcon, BellIcon, MoonIcon, SunIcon } from '@heroicons/react/24/outline';
import { User } from '@types';
import { useAuth } from '@context/AuthContext';
import { getInitials, cn } from '@utils/helpers';

interface UserMenuProps {
  user: User;
  onLogout: () => void;
}

export default function UserMenu({ user, onLogout }: UserMenuProps) {
  const { hasRole } = useAuth();

  if (!user) {
    return (
      <a href="/login" className="btn-primary btn-xs">
        Sign In
      </a>
    );
  }

  const userRoles = user.roles && user.roles.length > 0 ? user.roles : [user.role];
  const roleText = userRoles.map(r => (r || '').replace(/_/g, ' ').toLowerCase()).join(', ');
  const firstName = user.firstName || '';
  const lastName = user.lastName || '';

  return (
    <Menu as="div" className="relative">
      <Menu.Button className="flex items-center gap-3 p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors">
        <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-950/70 border border-transparent dark:border-primary-800/60 flex items-center justify-center">
          <span className="text-sm font-medium text-primary-700 dark:text-primary-300">
            {getInitials(firstName, lastName)}
          </span>
        </div>
        <div className="hidden sm:block text-left">
          <p className="text-sm font-medium text-gray-900 dark:text-white">{firstName} {lastName}</p>
          <p className="text-xs text-gray-500 dark:text-slate-400 capitalize">{roleText}</p>
        </div>
      </Menu.Button>

      <Transition
        as={Fragment}
        enter="transition ease-out duration-100"
        enterFrom="transform opacity-0 scale-95"
        enterTo="transform opacity-100 scale-100"
        leave="transition ease-in duration-75"
        leaveFrom="transform opacity-100 scale-100"
        leaveTo="transform opacity-0 scale-95"
      >
        <Menu.Items className="absolute right-0 z-50 mt-2 w-56 max-w-[calc(100vw-1.5rem)] origin-top-right rounded-lg bg-white dark:bg-slate-900 shadow-xl ring-1 ring-black/5 dark:ring-slate-800 border border-transparent dark:border-slate-800 focus:outline-none divide-y divide-gray-100 dark:divide-slate-800">
          <div className="p-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-950/70 border border-transparent dark:border-primary-800/60 flex items-center justify-center shrink-0">
                <span className="text-base font-medium text-primary-700 dark:text-primary-300">
                  {getInitials(user.firstName, user.lastName)}
                </span>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{user.firstName} {user.lastName}</p>
                <p className="text-xs text-gray-500 dark:text-slate-400 truncate">{user.email}</p>
              </div>
            </div>
          </div>

          <div className="py-1">
            <Menu.Item>
              {({ active }) => (
                <a
                  href="/raiser/profile"
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 text-sm text-gray-700 dark:text-slate-300',
                    active && 'bg-gray-50 dark:bg-slate-800 dark:text-white'
                  )}
                >
                  <UserCircleIcon className="h-5 w-5" />
                  Profile
                </a>
              )}
            </Menu.Item>

            <Menu.Item>
              {({ active }) => (
                <a
                  href="/raiser/profile?tab=notifications"
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 text-sm text-gray-700 dark:text-slate-300',
                    active && 'bg-gray-50 dark:bg-slate-800 dark:text-white'
                  )}
                >
                  <BellIcon className="h-5 w-5" />
                  Notifications
                </a>
              )}
            </Menu.Item>

            {hasRole(['SUPER_ADMIN', 'ADMIN', 'DEPARTMENT_HEAD', 'TEAM_LEAD']) && (
              <Menu.Item>
                {({ active }) => (
                  <a
                    href="/admin/settings"
                    className={cn(
                      'flex items-center gap-3 px-3 py-2 text-sm text-gray-700 dark:text-slate-300',
                      active && 'bg-gray-50 dark:bg-slate-800 dark:text-white'
                    )}
                  >
                    <Cog6ToothIcon className="h-5 w-5" />
                    Settings
                  </a>
                )}
              </Menu.Item>
            )}
          </div>

          <div className="py-1">
            <Menu.Item>
              {({ active }) => (
                <button
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-700 dark:text-slate-300 text-left',
                    active && 'bg-gray-50 dark:bg-slate-800 dark:text-white'
                  )}
                  onClick={onLogout}
                >
                  <ArrowRightOnRectangleIcon className="h-5 w-5" />
                  Sign out
                </button>
              )}
            </Menu.Item>
          </div>
        </Menu.Items>
      </Transition>
    </Menu>
  );
}