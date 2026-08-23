export type FrequencyType = 'times_per_day' | 'interval_hours';

export type PillColor = 'blue' | 'emerald' | 'purple' | 'amber' | 'rose' | 'indigo' | 'cyan';

export type DoseStatus = 'pending' | 'taken' | 'snoozed' | 'missed';

export interface DoseSchedule {
  id: string;
  medicationId: string;
  medicationName: string;
  dosage: string;
  time: string; // "HH:mm" format (24h)
  scheduledTimestamp: number;
  status: DoseStatus;
  takenAt?: number;
  snoozedUntil?: number;
  color: PillColor;
  instructions?: string;
}

export interface Medication {
  id: string;
  name: string;
  dosage: string;
  timesPerDay: number;
  startTime: string; // "HH:mm"
  frequencyType: FrequencyType;
  intervalHours?: number;
  color: PillColor;
  stockCount?: number;
  stockWarningThreshold?: number;
  instructions?: string;
  createdAt: number;
  active: boolean;
}

export interface DoseLogEntry {
  id: string;
  medicationId: string;
  medicationName: string;
  dosage: string;
  scheduledTime: string;
  action: 'taken' | 'snoozed' | 'dismissed';
  timestamp: number;
}
