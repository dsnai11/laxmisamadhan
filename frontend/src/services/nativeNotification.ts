import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { triggerHaptic } from '@utils/nativeApp';

const CHANNEL_ID = 'ticket_alerts';
let isChannelCreated = false;
let notificationCounter = 1;

/**
 * Initializes notification permissions and Android high-priority channel
 */
export const initTrayNotifications = async (onNavigate?: (url: string) => void) => {
  if (Capacitor.isPluginAvailable('LocalNotifications')) {
    try {
      // 1. Request permission on Android 13+
      const status = await LocalNotifications.checkPermissions();
      if (status.display !== 'granted') {
        const req = await LocalNotifications.requestPermissions();
        if (req.display !== 'granted') {
          console.debug('Local notifications permission denied by user');
        }
      }

      // 2. Create high-priority notification channel for Android (Heads-Up tray banner)
      if (Capacitor.getPlatform() === 'android' && !isChannelCreated) {
        await LocalNotifications.createChannel({
          id: CHANNEL_ID,
          name: 'Ticket & SLA Alerts',
          description: 'High-priority notifications for assigned tickets, status changes, and SLA alerts',
          importance: 5, // MAX importance - heads up banner in Android notification tray
          visibility: 1, // PUBLIC on lock screen
          vibration: true,
          lights: true,
          lightColor: '#3B82F6',
        });
        isChannelCreated = true;
      }

      // 3. Listen for tray tap to open the ticket
      await LocalNotifications.removeAllListeners();
      await LocalNotifications.addListener('localNotificationActionPerformed', (action) => {
        const extra = action.notification.extra;
        if (extra?.url && onNavigate) {
          onNavigate(extra.url);
        } else if (extra?.ticketId && onNavigate) {
          onNavigate(`/tickets/${extra.ticketId}`);
        }
      });
    } catch (err) {
      console.warn('Error setting up native notifications:', err);
    }
  } else if (typeof window !== 'undefined' && 'Notification' in window) {
    // Web / PWA on Android Chrome
    try {
      if (Notification.permission === 'default') {
        Notification.requestPermission().catch(() => {});
      }
    } catch (err) {
      console.debug('Web Notification permission error:', err);
    }
  }
};

/**
 * Post a notification to the Android notification tray (and Web Notification API)
 */
export const showTrayNotification = async (payload: {
  id?: string | number;
  title: string;
  message: string;
  ticketId?: string;
  url?: string;
  referenceType?: string;
  referenceId?: string;
}) => {
  const { title, message, ticketId, url, referenceType, referenceId } = payload;
  const targetUrl = url || (ticketId ? `/tickets/${ticketId}` : (referenceId && referenceType === 'TICKET' ? `/tickets/${referenceId}` : undefined));

  // Trigger haptic vibration on native handset
  triggerHaptic();

  if (Capacitor.isPluginAvailable('LocalNotifications')) {
    try {
      const numericId = typeof payload.id === 'number'
        ? payload.id
        : (typeof payload.id === 'string' && /^\d+$/.test(payload.id) ? parseInt(payload.id, 10) : ++notificationCounter);

      await LocalNotifications.schedule({
        notifications: [
          {
            id: numericId,
            title,
            body: message,
            channelId: CHANNEL_ID,
            iconColor: '#3B82F6',
            extra: {
              ticketId,
              referenceType,
              referenceId,
              url: targetUrl,
            },
            schedule: { at: new Date(Date.now() + 100) },
          },
        ],
      });
    } catch (err) {
      console.warn('Failed to schedule local notification in tray:', err);
    }
  } else if (typeof window !== 'undefined' && 'Notification' in window) {
    try {
      if (Notification.permission === 'granted') {
        const notif = new Notification(title, {
          body: message,
          icon: '/logo.jpg',
          badge: '/logo.jpg',
          tag: String(payload.id || targetUrl || Date.now()),
        });
        notif.onclick = () => {
          window.focus();
          if (targetUrl) {
            window.location.href = targetUrl;
          }
          notif.close();
        };
      }
    } catch (err) {
      console.debug('Failed to show web notification:', err);
    }
  }
};
