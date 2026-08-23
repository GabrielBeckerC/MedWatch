import { describe, it, expect } from 'vitest';
import { generateDailyDoseTimes, generateTodaySchedulesForMedication } from './scheduler';
import type { Medication } from '../types/medication';

describe('Dose Scheduler Utils', () => {
  it('should generate correct daily dose times for 3x a day starting at 08:00', () => {
    const times = generateDailyDoseTimes('08:00', 3);
    expect(times).toEqual(['00:00', '08:00', '16:00']);
  });

  it('should generate correct daily dose times for 4x a day starting at 06:00', () => {
    const times = generateDailyDoseTimes('06:00', 4);
    expect(times).toEqual(['00:00', '06:00', '12:00', '18:00']);
  });

  it('should generate correct dose times for interval_hours (every 8 hours)', () => {
    const times = generateDailyDoseTimes('08:00', 3, 8);
    expect(times).toEqual(['00:00', '08:00', '16:00']);
  });

  it('should generate today schedules for a medication object', () => {
    const mockMed: Medication = {
      id: 'med-1',
      name: 'Dipirona 500mg',
      dosage: '1 comprimido',
      timesPerDay: 3,
      startTime: '08:00',
      frequencyType: 'times_per_day',
      intervalHours: 8,
      color: 'blue',
      active: true,
      createdAt: Date.now(),
    };

    const schedules = generateTodaySchedulesForMedication(mockMed);
    expect(schedules).toHaveLength(3);
    expect(schedules[0].time).toBe('00:00');
    expect(schedules[1].time).toBe('08:00');
    expect(schedules[2].time).toBe('16:00');
    expect(schedules[0].medicationName).toBe('Dipirona 500mg');
  });
});
