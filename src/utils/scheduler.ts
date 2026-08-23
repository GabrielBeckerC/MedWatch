import type { Medication, DoseSchedule, DoseStatus } from '../types/medication';

export function getTodayTimestampForTime(timeStr: string): number {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date.getTime();
}

export function generateDailyDoseTimes(startTimeStr: string, timesPerDay: number, intervalHours?: number): string[] {
  const times: string[] = [];
  const [startH, startM] = startTimeStr.split(':').map(Number);

  let stepHours = 24 / Math.max(1, timesPerDay);
  if (intervalHours && intervalHours > 0) {
    stepHours = intervalHours;
  }

  for (let i = 0; i < timesPerDay; i++) {
    const totalMinutes = (startH * 60 + startM + Math.round(i * stepHours * 60)) % (24 * 60);
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    const formattedH = String(h).padStart(2, '0');
    const formattedM = String(m).padStart(2, '0');
    times.push(`${formattedH}:${formattedM}`);
  }

  return times.sort((a, b) => a.localeCompare(b));
}

export function generateTodaySchedulesForMedication(
  med: Medication,
  existingStatuses: Record<string, { status: DoseStatus; takenAt?: number; snoozedUntil?: number }> = {}
): DoseSchedule[] {
  const timeStrings = generateDailyDoseTimes(med.startTime, med.timesPerDay, med.intervalHours);

  return timeStrings.map((time) => {
    const id = `${med.id}_${time.replace(':', '')}`;
    const scheduledTimestamp = getTodayTimestampForTime(time);
    const existing = existingStatuses[id];

    return {
      id,
      medicationId: med.id,
      medicationName: med.name,
      dosage: med.dosage,
      time,
      scheduledTimestamp,
      status: existing ? existing.status : 'pending',
      takenAt: existing?.takenAt,
      snoozedUntil: existing?.snoozedUntil,
      color: med.color,
      instructions: med.instructions,
    };
  });
}

export function formatTimeRemaining(targetTimestamp: number): string {
  const now = Date.now();
  const diffMs = targetTimestamp - now;

  if (diffMs <= 0) return 'Agora!';

  const diffMins = Math.floor(diffMs / (1000 * 60));
  const hours = Math.floor(diffMins / 60);
  const mins = diffMins % 60;

  if (hours > 0) {
    return `em ${hours}h ${mins}min`;
  }
  return `em ${mins} min`;
}

export function formatTimestampToTime(ts: number): string {
  const d = new Date(ts);
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

export function formatFullDateTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
