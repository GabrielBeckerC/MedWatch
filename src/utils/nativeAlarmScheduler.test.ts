import { describe, it, expect } from 'vitest';
import { scheduleNativeFutureAlarms, requestAllAlarmPermissions } from './nativeAlarmScheduler';
import type { Medication } from '../types/medication';

describe('Native Alarm Scheduler Utils', () => {
  it('should calculate future schedules for active medications without crashing', async () => {
    const mockMeds: Medication[] = [
      {
        id: 'med-1',
        name: 'Amoxicilina 500mg',
        dosage: '1 cápsula',
        timesPerDay: 2,
        startTime: '09:00',
        frequencyType: 'times_per_day',
        intervalHours: 12,
        color: 'emerald',
        active: true,
        createdAt: Date.now(),
      },
      {
        id: 'med-2',
        name: 'Paracetamol',
        dosage: '500mg',
        timesPerDay: 1,
        startTime: '20:00',
        frequencyType: 'times_per_day',
        intervalHours: 24,
        color: 'amber',
        active: false, // inactive medication
        createdAt: Date.now(),
      },
    ];

    const count = await scheduleNativeFutureAlarms(mockMeds);
    expect(count).toBeGreaterThanOrEqual(0);
  });

  it('should schedule alarms for 2x/day and 1x/day medications starting at the same time', async () => {
    const mockMeds: Medication[] = [
      {
        id: 'med-2x-sim',
        name: 'Remédio 2x ao Dia',
        dosage: '1 comprimido',
        timesPerDay: 2,
        startTime: '08:00',
        frequencyType: 'times_per_day',
        color: 'blue',
        active: true,
        createdAt: Date.now(),
      },
      {
        id: 'med-1x-sim',
        name: 'Remédio 1x ao Dia',
        dosage: '1 cápsula',
        timesPerDay: 1,
        startTime: '08:00',
        frequencyType: 'times_per_day',
        color: 'emerald',
        active: true,
        createdAt: Date.now(),
      },
    ];

    const count = await scheduleNativeFutureAlarms(mockMeds);
    // Should schedule 2 notifications for Med 2x and 1 notification for Med 1x = 3 notifications total
    expect(count).toBe(3);
  });
});
