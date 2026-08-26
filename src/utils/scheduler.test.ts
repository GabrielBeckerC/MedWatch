import { describe, it, expect } from 'vitest';
import { generateDailyDoseTimes, generateTodaySchedulesForMedication } from './scheduler';
import type { Medication, DoseStatus, DoseSchedule } from '../types/medication';

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

  it('should correctly identify alarms within the 30-minute window versus older historical doses', () => {
    const now = Date.now();
    const fifteenMinsAgo = now - 10 * 60 * 1000; // 10 mins ago -> due
    const sixHoursAgo = now - 6 * 60 * 60 * 1000; // 6 hours ago -> historical pending

    const isDueWithinWindow = (scheduledTimestamp: number) =>
      now >= scheduledTimestamp && now - scheduledTimestamp <= 30 * 60 * 1000;

    expect(isDueWithinWindow(fifteenMinsAgo)).toBe(true);
    expect(isDueWithinWindow(sixHoursAgo)).toBe(false);
  });

  it('should force re-opening due alarms overlay when unlocking app if activeAlarms is currently empty', () => {
    const now = Date.now();
    const mockSchedules: DoseSchedule[] = [
      {
        id: 'med1_0800',
        medicationId: 'med1',
        medicationName: 'Remédio A',
        dosage: '1 cp',
        time: '08:00',
        scheduledTimestamp: now - 2 * 60 * 1000, // 2 mins ago
        status: 'pending' as DoseStatus,
        color: 'blue',
      },
    ];

    const triggeredSet = new Set<string>(['med1_0800']); // previously triggered by background ticker
    const forceIfEmpty = true;

    // Evaluate trigger condition
    const dueSchedules = mockSchedules.filter((s) => {
      if ((s.status as DoseStatus) === 'taken') return false;
      const isTimeDue = now >= s.scheduledTimestamp && now - s.scheduledTimestamp <= 30 * 60 * 1000;
      const isUntriggered = !triggeredSet.has(s.id);
      return isTimeDue && (isUntriggered || forceIfEmpty);
    });

    expect(dueSchedules).toHaveLength(1);
    expect(dueSchedules[0].medicationName).toBe('Remédio A');
  });

  it('should verify alarms work every day by resetting taken status on new day', () => {
    const med2x: Medication = {
      id: 'med-daily',
      name: 'Pressão Alta',
      dosage: '1 cp',
      timesPerDay: 2,
      startTime: '08:00',
      frequencyType: 'times_per_day',
      intervalHours: 12,
      color: 'indigo',
      active: true,
      createdAt: Date.now(),
    };

    // Day 1 (yesterday, 25 hours ago): User took dose
    const yesterdayTaken = Date.now() - 25 * 60 * 60 * 1000;

    const yesterdayStatuses = {
      'med-daily_0800': {
        status: 'taken' as const,
        takenAt: yesterdayTaken,
      },
    };

    // Today (Day 2): Status from yesterday must reset to 'pending'
    const day2Schedules = generateTodaySchedulesForMedication(med2x, yesterdayStatuses);

    expect(day2Schedules[0].time).toBe('08:00');
    expect(day2Schedules[0].status).toBe('pending');
    expect(day2Schedules[1].time).toBe('20:00');
    expect(day2Schedules[1].status).toBe('pending');
  });

  it('should combine multiple different medications scheduled at the exact same time slot (08:00)', () => {
    const med1: Medication = {
      id: 'm1',
      name: 'Vitamina C',
      dosage: '500mg',
      timesPerDay: 1,
      startTime: '08:00',
      frequencyType: 'times_per_day',
      color: 'amber',
      active: true,
      createdAt: Date.now(),
    };

    const med2: Medication = {
      id: 'm2',
      name: 'Omega 3',
      dosage: '1 cápsula',
      timesPerDay: 2,
      startTime: '08:00',
      frequencyType: 'times_per_day',
      intervalHours: 12,
      color: 'cyan',
      active: true,
      createdAt: Date.now(),
    };

    const med3: Medication = {
      id: 'm3',
      name: 'Probiótico',
      dosage: '1 sachê',
      timesPerDay: 3,
      startTime: '08:00',
      frequencyType: 'times_per_day',
      intervalHours: 8,
      color: 'emerald',
      active: true,
      createdAt: Date.now(),
    };

    const sch1 = generateTodaySchedulesForMedication(med1);
    const sch2 = generateTodaySchedulesForMedication(med2);
    const sch3 = generateTodaySchedulesForMedication(med3);

    const allSchedules = [...sch1, ...sch2, ...sch3];
    const combined0800 = allSchedules.filter((s) => s.time === '08:00');

    // All 3 medications have an 08:00 dose and must combine into 3 items in the same time slot
    expect(combined0800).toHaveLength(3);
    expect(combined0800.map((s) => s.medicationName)).toEqual(['Vitamina C', 'Omega 3', 'Probiótico']);
  });

  it('should correctly handle distinct close-interval alarms scheduled at 08:00 and 08:01', () => {
    const medA: Medication = {
      id: 'med-0800',
      name: 'Remédio 08:00',
      dosage: '1 cp',
      timesPerDay: 1,
      startTime: '08:00',
      frequencyType: 'times_per_day',
      color: 'blue',
      active: true,
      createdAt: Date.now(),
    };

    const medB: Medication = {
      id: 'med-0801',
      name: 'Remédio 08:01',
      dosage: '1 cp',
      timesPerDay: 1,
      startTime: '08:01',
      frequencyType: 'times_per_day',
      color: 'rose',
      active: true,
      createdAt: Date.now(),
    };

    const schA = generateTodaySchedulesForMedication(medA);
    const schB = generateTodaySchedulesForMedication(medB);

    expect(schA[0].time).toBe('08:00');
    expect(schB[0].time).toBe('08:01');

    // Verify scheduledTimestamps differ by exactly 1 minute (60,000 ms)
    expect(schB[0].scheduledTimestamp - schA[0].scheduledTimestamp).toBe(60 * 1000);

    // Simulate time at exactly 08:00:00
    const timeAt0800 = schA[0].scheduledTimestamp;
    
    // At 08:00, medA is due, but medB (08:01) is NOT due yet
    const isDueAt0800 = (ts: number) => timeAt0800 >= ts && timeAt0800 - ts <= 30 * 60 * 1000;
    expect(isDueAt0800(schA[0].scheduledTimestamp)).toBe(true);
    expect(isDueAt0800(schB[0].scheduledTimestamp)).toBe(false);

    // Simulate time advancing 1 minute to 08:01:00
    const timeAt0801 = schB[0].scheduledTimestamp;
    const isDueAt0801 = (ts: number) => timeAt0801 >= ts && timeAt0801 - ts <= 30 * 60 * 1000;

    // At 08:01, both medA (if still untaken) and medB are due
    expect(isDueAt0801(schA[0].scheduledTimestamp)).toBe(true);
    expect(isDueAt0801(schB[0].scheduledTimestamp)).toBe(true);

    // If medA was taken, only medB remains active
    schA[0].status = 'taken';
    const activeAt0801 = [schA[0], schB[0]].filter((s) => (s.status as DoseStatus) !== 'taken' && isDueAt0801(s.scheduledTimestamp));
    expect(activeAt0801).toHaveLength(1);
    expect(activeAt0801[0].medicationName).toBe('Remédio 08:01');
  });
});
