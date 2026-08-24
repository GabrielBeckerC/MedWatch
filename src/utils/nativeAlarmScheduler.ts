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

    // Create high importance Android notification channel with sound
    try {
      await LocalNotifications.createChannel({
        id: 'medwatch_alarm_channel',
        name: 'Alarmes de Medicamentos MedWatch',
        description: 'Canal de alta prioridade com som e vibração para lembretes de remédios',
        importance: 5, // MAX importance
        visibility: 1,  // Public (lockscreen)
        vibration: true,
        sound: 'alarm_sound.mp3',
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

export async function setupNotificationActionListener(
  onNotificationClick: (extra: { medicationId?: string; time?: string }) => void
) {
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    await LocalNotifications.addListener('localNotificationActionPerformed', (notification) => {
      const extra = notification.notification.extra as { medicationId?: string; time?: string } | undefined;
      if (extra) {
        onNotificationClick(extra);
      }
    });
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
      actionTypeId: string;
      extra: Record<string, unknown>;
    }> = [];

    let nextId = 1000;

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

        nextId += 1;
        notificationsToSchedule.push({
          id: nextId,
          title: `⏰ Hora do Remédio: ${med.name}`,
          body: `Tomar ${med.dosage} (${sch.time}) - ${med.instructions || 'Siga a recomendação médica'}`,
          schedule: {
            at: scheduleDate,
            allowWhileIdle: true, // Forces Android OS to trigger alarm even in doze state!
          },
          channelId: 'medwatch_alarm_channel',
          sound: 'alarm_sound.mp3',
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

