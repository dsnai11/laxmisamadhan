import { Fragment } from 'react';
import { Transition, Menu } from '@headlessui/react';
import { BellIcon, XMarkIcon, CheckIcon, EnvelopeIcon, TicketIcon, ExclamationTriangleIcon, ShieldCheckIcon, UserPlusIcon, Cog6ToothIcon } from '@heroicons/react/24/outline';
import { Notification } from '@types';
import { formatRelativeTime, cn } from '@utils/helpers';
import { showTrayNotification } from '@services/nativeNotification';

interface NotificationDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: Notification[];
  unreadCount: number;
  onMarkRead: (id: string) => void;
  onMarkAllRead?: () => void;
  onSelect?: (notification: Notification) => void;
}

const notificationIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  TICKET_CREATED: TicketIcon,
  TICKET_ASSIGNED: UserPlusIcon,
  TICKET_UPDATED: Cog6ToothIcon,
  TICKET_COMMENTED: EnvelopeIcon,
  TICKET_RESOLVED: CheckIcon,
  TICKET_CLOSED: XMarkIcon,
  TICKET_REOPENED: ExclamationTriangleIcon,
  TICKET_ESCALATED: ExclamationTriangleIcon,
  SLA_WARNING: ExclamationTriangleIcon,
  SLA_BREACHED: ExclamationTriangleIcon,
  APPROVAL_REQUESTED: ShieldCheckIcon,
  APPROVAL_GRANTED: CheckIcon,
  APPROVAL_DENIED: XMarkIcon,
  MENTION: UserPlusIcon,
  SYSTEM_ALERT: ExclamationTriangleIcon,
};

export default function NotificationDropdown({
  isOpen,
  onClose,
  notifications,
  unreadCount,
  onMarkRead,
  onMarkAllRead,
  onSelect,
}: NotificationDropdownProps) {
  const getIcon = (type: string) => {
    const Icon = notificationIcons[type] || BellIcon;
    return <Icon className="h-5 w-5 text-gray-400" />;
  };

  const getTypeLabel = (type: string) => {
    return type.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
  };

  return (
    <Menu as="div" className="relative">
      <Menu.Button
        type="button"
        className="relative p-2 text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
        aria-label="Notifications"
      >
        <BellIcon className="h-6 w-6" aria-hidden="true" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-danger-600 text-xs font-medium text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
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
        <Menu.Items className="absolute right-0 z-50 mt-2 w-[calc(100vw-1.5rem)] sm:w-96 max-w-sm origin-top-right rounded-lg bg-white dark:bg-slate-900 shadow-xl ring-1 ring-black/5 dark:ring-slate-800 border border-transparent dark:border-slate-800 focus:outline-none">
          <div className="p-3 border-b border-gray-200 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Notifications</h3>
              <button
                type="button"
                onClick={() => {
                  showTrayNotification({
                    title: 'Laxmi Samadhan Handset Alert',
                    message: 'Your Android handset notification tray is active and ready!',
                  });
                }}
                className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-semibold hover:bg-indigo-100"
                title="Send a test notification to your Android notification tray"
              >
                Test Tray
              </button>
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                className="text-xs text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
                onClick={() => {
                  if (onMarkAllRead) onMarkAllRead();
                  else notifications.filter(n => !n.isRead).forEach(n => onMarkRead(n.id));
                  onClose();
                }}
              >
                Mark all as read
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-6 text-center">
                <BellIcon className="h-12 w-12 mx-auto text-gray-300 dark:text-slate-600" />
                <p className="mt-2 text-sm text-gray-500 dark:text-slate-400">No notifications yet</p>
              </div>
            ) : (
              <ul className="py-1 divide-y divide-gray-100 dark:divide-slate-800/60" role="list" aria-label="Notifications">
                {notifications.slice(0, 20).map((notification) => (
                  <li key={notification.id}>
                    <Menu.Item>
                      {({ active }) => (
                        <button
                          type="button"
                          className={cn(
                            'w-full px-3 py-3 text-left flex items-start gap-3 transition-colors group cursor-pointer',
                            active && 'bg-gray-50 dark:bg-slate-800',
                            !notification.isRead ? 'bg-primary-50/50 dark:bg-primary-950/30' : 'hover:bg-gray-50 dark:hover:bg-slate-800/50'
                          )}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onMarkRead(notification.id);
                            onSelect?.(notification);
                            onClose();
                          }}
                        >
                          <div className="flex-shrink-0 mt-0.5 p-2 rounded-full bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400">
                            {getIcon(notification.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={cn('text-sm', !notification.isRead ? 'font-semibold text-gray-900 dark:text-white' : 'font-normal text-gray-800 dark:text-slate-200')}>
                              {notification.title}
                            </p>
                            <p className="mt-0.5 text-sm text-gray-500 dark:text-slate-400 line-clamp-2">{notification.message}</p>
                            <div className="mt-1 flex items-center justify-between text-xs">
                              <span className="text-gray-400 dark:text-slate-500">{formatRelativeTime(notification.createdAt)}</span>
                              <span className="text-primary-600 dark:text-primary-400 font-medium opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
                                View Ticket →
                              </span>
                            </div>
                          </div>
                          {!notification.isRead && (
                            <span className="flex-shrink-0 w-2 h-2 rounded-full bg-primary-600 mt-2" />
                          )}
                        </button>
                      )}
                    </Menu.Item>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {notifications.length > 20 && (
            <div className="p-3 border-t border-gray-200 dark:border-slate-800">
              <button
                type="button"
                className="w-full text-center text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400"
              >
                View all notifications
              </button>
            </div>
          )}
        </Menu.Items>
      </Transition>
    </Menu>
  );
}
