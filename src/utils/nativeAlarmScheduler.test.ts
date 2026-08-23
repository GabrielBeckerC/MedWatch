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

  it('should handle requestAllAlarmPermissions safely', async () => {
    const granted = await requestAllAlarmPermissions();
    expect(typeof granted).toBe('boolean');
  });
});
