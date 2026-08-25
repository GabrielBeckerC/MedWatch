import type { Medication } from '../types/medication';
import { generateTodaySchedulesForMedication } from './scheduler';

export async function requestAllAlarmPermissions(): Promise<boolean> {
  let isGranted = false;

  // 1. Try Capacitor Native Android Notifications
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    const perm = await LocalNotifications.checkPermissions();
    if (perm.display === 'granted') {
      isGranted = true;
    } else {
      const req = await LocalNotifications.requestPermissions();
      isGranted = req.display === 'granted';
    }

    // Delete legacy channels so Android recreates with new sound settings
    try {
      await LocalNotifications.deleteChannel({ id: 'medwatch_alarm_channel' });
    } catch {
      // ignore
    }

    // Create high importance Android notification channel with sound
    try {
      await LocalNotifications.createChannel({
        id: 'medwatch_alarm_channel_v3',
        name: 'Alarmes de Medicamentos MedWatch',
        description: 'Canal de alta prioridade com som sonoro forte e vibração',
        importance: 5, // MAX importance
        visibility: 1,  // Public (lockscreen)
        vibration: true,
        sound: 'alarm_sound.wav',
      });
    } catch (e) {
      console.warn('Could not create notification channel:', e);
    }
  } catch {
    // 2. Fallback to standard Web Notification API
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if ((Notification.permission as string) === 'granted') {
        isGranted = true;
      } else {
        try {
          const res = await Notification.requestPermission();
          isGranted = res === 'granted';
        } catch {
          isGranted = Notification.permission === 'granted';
        }
      }
    }
  }

  return isGranted;
}

export async function clearAllNativeNotifications() {
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    await LocalNotifications.removeAllDeliveredNotifications();
  } catch {
    // ignore
  }
}

function hashStringToId(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return (Math.abs(hash) % 2000000000) + 1;
}

export async function setupNotificationActionListener(
  onNotificationClick: (extra?: { medicationId?: string; time?: string }) => void
) {
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');


    // 1. Listen for user tapping a notification
    await LocalNotifications.addListener('localNotificationActionPerformed', async (action) => {
      await clearAllNativeNotifications();
      const extra = action.notification.extra as { medicationId?: string; time?: string } | undefined;
      onNotificationClick(extra || {});
    });

    // 2. Listen for notification arriving while app is active
    await LocalNotifications.addListener('localNotificationReceived', async (notification) => {
      await clearAllNativeNotifications();
      const extra = notification.extra as { medicationId?: string; time?: string } | undefined;
      onNotificationClick(extra || {});
    });

    // 3. Check for notifications already delivered that launched the app from lockscreen / background
    try {
      const delivered = await LocalNotifications.getDeliveredNotifications();
      if (delivered.notifications.length > 0) {
        const lastNotif = delivered.notifications[delivered.notifications.length - 1];
        const extra = lastNotif.extra as { medicationId?: string; time?: string } | undefined;
        await clearAllNativeNotifications();
        onNotificationClick(extra || {});
      }
    } catch {
      // ignore
    }
  } catch {
    // Not running in Capacitor native mode or plugin unavailable
  }
}

export async function scheduleNativeFutureAlarms(medications: Medication[]): Promise<number> {
  let scheduledCount = 0;

  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    
    // Check permission
    const perm = await LocalNotifications.checkPermissions();
    if (perm.display !== 'granted') {
      const req = await LocalNotifications.requestPermissions();
      if (req.display !== 'granted') return 0;
    }

    // Cancel existing pending notifications to prevent duplicates
    try {
      const pending = await LocalNotifications.getPending();
      if (pending.notifications.length > 0) {
        await LocalNotifications.cancel(pending);
      }
    } catch {
      // ignore
    }

    const now = new Date();
    const notificationsToSchedule: Array<{
      id: number;
      title: string;
      body: string;
      schedule: { at: Date; allowWhileIdle: boolean };
      channelId: string;
      sound: string;
      autoCancel: boolean;
      actionTypeId: string;
      extra: Record<string, unknown>;
    }> = [];

    // Group active schedules by time slot so 1 notification is scheduled per time slot
    const schedulesByTime: Record<string, { time: string; names: string[]; count: number }> = {};

    medications.forEach((med) => {
      if (!med.active) return;
      const todaySchedules = generateTodaySchedulesForMedication(med);
      todaySchedules.forEach((sch) => {
        if (!schedulesByTime[sch.time]) {
          schedulesByTime[sch.time] = { time: sch.time, names: [], count: 0 };
        }
        schedulesByTime[sch.time].names.push(med.name);
        schedulesByTime[sch.time].count += 1;
      });
    });

    Object.values(schedulesByTime).forEach((slot) => {
      const [hours, minutes] = slot.time.split(':').map(Number);
      const scheduleDate = new Date();
      scheduleDate.setHours(hours, minutes, 0, 0);

      if (scheduleDate.getTime() <= now.getTime()) {
        scheduleDate.setDate(scheduleDate.getDate() + 1);
      }

      const notifId = hashStringToId(`time_slot_${slot.time}`);
      const title = slot.count > 1 ? `⏰ HORA DOS REMÉDIOS (${slot.time})` : `⏰ HORA DO REMÉDIO (${slot.time})`;
      const body = slot.count > 1 
        ? `Remédios: ${slot.names.join(', ')} • Toque para ver a lista`
        : `Tomar: ${slot.names[0]} • Toque para ver a lista`;

      notificationsToSchedule.push({
        id: notifId,
        title,
        body,
        schedule: {
          at: scheduleDate,
          allowWhileIdle: true,
        },
        channelId: 'medwatch_alarm_channel_v3',
        sound: 'alarm_sound.wav',
        autoCancel: true,
        actionTypeId: '',
        extra: { time: slot.time },
      });

      scheduledCount++;
    });

    if (notificationsToSchedule.length > 0) {
      await LocalNotifications.schedule({
        notifications: notificationsToSchedule,
      });
    }
  } catch (err) {
    console.warn('Native scheduling fallback (Web Mode):', err);
  }

  return scheduledCount;
}

