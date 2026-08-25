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

    try {
      await LocalNotifications.removeAllListeners();
    } catch {
      // ignore
    }

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

    medications.forEach((med) => {
      if (!med.active) return;

      const todaySchedules = generateTodaySchedulesForMedication(med);
      
      todaySchedules.forEach((sch) => {
        const [hours, minutes] = sch.time.split(':').map(Number);
        
        // Calculate exact Date for today
        const scheduleDate = new Date();
        scheduleDate.setHours(hours, minutes, 0, 0);

        // If time passed today, schedule for tomorrow
        if (scheduleDate.getTime() <= now.getTime()) {
          scheduleDate.setDate(scheduleDate.getDate() + 1);
        }

        const notifId = hashStringToId(`${med.id}_${sch.time}`);
        notificationsToSchedule.push({
          id: notifId,
          title: `⏰ Hora do Remédio: ${med.name}`,
          body: `Tomar ${med.dosage} (${sch.time}) - ${med.instructions || 'Siga a recomendação médica'}`,
          schedule: {
            at: scheduleDate,
            allowWhileIdle: true, // Forces Android OS to trigger alarm even in doze state!
          },
          channelId: 'medwatch_alarm_channel_v3',
          sound: 'alarm_sound.wav',
          autoCancel: true,
          actionTypeId: '',
          extra: { medicationId: med.id, time: sch.time },
        });

        scheduledCount++;
      });
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

