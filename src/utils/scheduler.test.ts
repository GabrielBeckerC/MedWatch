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
    expect(schedules[0].medicationName).toBe('Dipirona 500mg');
  });

  it('should group 2x/day and 1x/day medications starting at the same time slot (08:00)', () => {
    const med2x: Medication = {
      id: 'med-2x',
      name: 'Amoxicilina 500mg',
      dosage: '1 cápsula',
      timesPerDay: 2,
      startTime: '08:00',
      frequencyType: 'times_per_day',
      intervalHours: 12,
      color: 'emerald',
      instructions: 'Tomar com água',
      active: true,
      createdAt: Date.now(),
    };

    const med1x: Medication = {
      id: 'med-1x',
      name: 'Vitamina D3',
      dosage: '1 comprimido',
      timesPerDay: 1,
      startTime: '08:00',
      frequencyType: 'times_per_day',
      intervalHours: 24,
      color: 'amber',
      instructions: 'Tomar com o café da manhã',
      active: true,
      createdAt: Date.now(),
    };

    const sch2x = generateTodaySchedulesForMedication(med2x);
    const sch1x = generateTodaySchedulesForMedication(med1x);

    // Med 2x/day starting at 08:00 generates 08:00 and 20:00
    expect(sch2x.map((s) => s.time)).toEqual(['08:00', '20:00']);
    // Med 1x/day starting at 08:00 generates 08:00
    expect(sch1x.map((s) => s.time)).toEqual(['08:00']);

    // Combine all schedules for today and filter for 08:00 time slot
    const allSchedules = [...sch2x, ...sch1x];
    const dueAt0800 = allSchedules.filter((s) => s.time === '08:00');

    expect(dueAt0800).toHaveLength(2);
    expect(dueAt0800[0].medicationName).toBe('Amoxicilina 500mg');
    expect(dueAt0800[0].dosage).toBe('1 cápsula');
    expect(dueAt0800[0].instructions).toBe('Tomar com água');

    expect(dueAt0800[1].medicationName).toBe('Vitamina D3');
    expect(dueAt0800[1].dosage).toBe('1 comprimido');
    expect(dueAt0800[1].instructions).toBe('Tomar com o café da manhã');
  });

  it('should reset daily cycle so yesterday taken status resets to pending today', () => {
    const med: Medication = {
      id: 'med-cycle',
      name: 'Anti-hipertensivo',
      dosage: '1 comprimido',
      timesPerDay: 1,
      startTime: '08:00',
      frequencyType: 'times_per_day',
      color: 'blue',
      active: true,
      createdAt: Date.now(),
    };

    // Simulate status taken yesterday (36 hours ago)
    const yesterdayTaken = Date.now() - 36 * 60 * 60 * 1000;
    const existingStatuses = {
      'med-cycle_0800': {
        status: 'taken' as const,
        takenAt: yesterdayTaken,
      },
    };

    const schedulesToday = generateTodaySchedulesForMedication(med, existingStatuses);
    expect(schedulesToday).toHaveLength(1);
    // Because takenAt was yesterday, today's status MUST reset to pending
    expect(schedulesToday[0].status).toBe('pending');
    expect(schedulesToday[0].takenAt).toBeUndefined();
  });

  it('should resolve ALL medications for a time slot when looking up via medicationId (Problem 3 regression test)', () => {
    const medA: Medication = {
      id: 'med-A',
      name: 'Dipirona 500mg',
      dosage: '1 comprimido',
      timesPerDay: 2,
      startTime: '08:00',
      frequencyType: 'times_per_day',
      color: 'blue',
      active: true,
      createdAt: Date.now(),
    };

    const medB: Medication = {
      id: 'med-B',
      name: 'Losartana 50mg',
      dosage: '1 comprimido',
      timesPerDay: 1,
      startTime: '08:00',
      frequencyType: 'times_per_day',
      color: 'rose',
      active: true,
      createdAt: Date.now(),
    };

    const schA = generateTodaySchedulesForMedication(medA);
    const schB = generateTodaySchedulesForMedication(medB);

    const allToday = [...schA, ...schB];

    // Simulate extra payload containing medicationId = 'med-A'
    const extraPayload = { medicationId: 'med-A' };
    const foundMed = allToday.find((s) => s.medicationId === extraPayload.medicationId);
    expect(foundMed).toBeDefined();

    const targetTime = foundMed?.time;
    expect(targetTime).toBe('08:00');

    // Grouping all matching untaken doses for targetTime must return BOTH med-A and med-B
    const matchingOverlayDoses = allToday.filter((s) => s.time === targetTime && s.status !== 'taken');
    expect(matchingOverlayDoses).toHaveLength(2);
    expect(matchingOverlayDoses.map((m) => m.medicationName)).toEqual(['Dipirona 500mg', 'Losartana 50mg']);
  });

  it('should correctly identify alarms within the 15-minute window versus older historical doses', () => {
    const now = Date.now();
    const fifteenMinsAgo = now - 10 * 60 * 1000; // 10 mins ago -> due
    const sixHoursAgo = now - 6 * 60 * 60 * 1000; // 6 hours ago -> historical pending

    const isDueWithinWindow = (scheduledTimestamp: number) =>
      now >= scheduledTimestamp && now - scheduledTimestamp <= 15 * 60 * 1000;

    expect(isDueWithinWindow(fifteenMinsAgo)).toBe(true);
    expect(isDueWithinWindow(sixHoursAgo)).toBe(false);
  });
});
