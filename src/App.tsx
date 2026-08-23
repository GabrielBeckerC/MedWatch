import { useState, useEffect, useMemo } from 'react';
import type { Medication, DoseSchedule, DoseStatus, DoseLogEntry } from './types/medication';
import {
  getStoredMedications,
  saveStoredMedications,
  getStoredDoseStatuses,
  saveStoredDoseStatuses,
  getStoredDoseLogs,
  addDoseLogEntry,
  saveStoredDoseLogs,
} from './utils/storage';
import { generateTodaySchedulesForMedication } from './utils/scheduler';
import { Navbar } from './components/Navbar';
import { DailyTimeline } from './components/DailyTimeline';
import { MedicationCard } from './components/MedicationCard';
import { MedicationFormModal } from './components/MedicationFormModal';
import { AlarmOverlay } from './components/AlarmOverlay';
import { HistoryLog } from './components/HistoryLog';
import { Pill, Plus } from 'lucide-react';
import { alarmAudio } from './utils/audioAlarm';
import { scheduleNativeFutureAlarms } from './utils/nativeAlarmScheduler';

export function App() {
  const [medications, setMedications] = useState<Medication[]>(getStoredMedications);
  const [doseStatuses, setDoseStatuses] = useState<Record<string, { status: DoseStatus; takenAt?: number; snoozedUntil?: number }>>(getStoredDoseStatuses);
  const [doseLogs, setDoseLogs] = useState<DoseLogEntry[]>(getStoredDoseLogs);

  const [activeTab, setActiveTab] = useState<'timeline' | 'medications' | 'history'>('timeline');
  const [isFormModalOpen, setIsFormModalOpen] = useState<boolean>(false);
  const [editingMedication, setEditingMedication] = useState<Medication | null>(null);

  const [activeAlarm, setActiveAlarm] = useState<DoseSchedule | null>(null);
  const [triggeredAlarmIds, setTriggeredAlarmIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    saveStoredMedications(medications);
    scheduleNativeFutureAlarms(medications);
  }, [medications]);

  useEffect(() => {
    saveStoredDoseStatuses(doseStatuses);
  }, [doseStatuses]);

  const todaySchedules: DoseSchedule[] = useMemo(() => {
    const allSchedules: DoseSchedule[] = [];
    medications.forEach((med) => {
      if (med.active) {
        const medSchedules = generateTodaySchedulesForMedication(med, doseStatuses);
        allSchedules.push(...medSchedules);
      }
    });
    return allSchedules.sort((a, b) => a.scheduledTimestamp - b.scheduledTimestamp);
  }, [medications, doseStatuses]);

  const pendingCount = todaySchedules.filter((s) => s.status === 'pending' || s.status === 'snoozed').length;

  useEffect(() => {
    const checkScheduleTick = () => {
      const now = Date.now();
      const currentMinuteStr = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

      for (const schedule of todaySchedules) {
        if (schedule.status === 'taken') continue;

        const isSnoozeExpired = schedule.snoozedUntil && now >= schedule.snoozedUntil;
        const isExactMinute = schedule.time === currentMinuteStr;

        if ((isExactMinute || isSnoozeExpired) && !triggeredAlarmIds.has(schedule.id)) {
          if (!activeAlarm) {
            setActiveAlarm(schedule);
            setTriggeredAlarmIds((prev) => new Set(prev).add(schedule.id));
            break;
          }
        }
      }
    };

    checkScheduleTick();
    const interval = setInterval(checkScheduleTick, 2000);
    return () => clearInterval(interval);
  }, [todaySchedules, triggeredAlarmIds, activeAlarm]);

  const handleSaveMedication = (medPartial: Partial<Medication>) => {
    if (medPartial.id) {
      setMedications((prev) =>
        prev.map((m) => (m.id === medPartial.id ? ({ ...m, ...medPartial } as Medication) : m))
      );
    } else {
      const newMed: Medication = {
        id: `med_${Date.now()}`,
        name: medPartial.name || '',
        dosage: medPartial.dosage || '',
        timesPerDay: medPartial.timesPerDay || 1,
        startTime: medPartial.startTime || '08:00',
        frequencyType: medPartial.frequencyType || 'times_per_day',
        intervalHours: medPartial.intervalHours,
        color: medPartial.color || 'blue',
        stockCount: medPartial.stockCount,
        stockWarningThreshold: medPartial.stockWarningThreshold || 5,
        instructions: medPartial.instructions,
        createdAt: Date.now(),
        active: true,
      };
      setMedications((prev) => [newMed, ...prev]);
    }
  };

  const handleDeleteMedication = (id: string) => {
    setMedications((prev) => prev.filter((m) => m.id !== id));
  };

  const handleToggleActive = (id: string) => {
    setMedications((prev) =>
      prev.map((m) => (m.id === id ? { ...m, active: !m.active } : m))
    );
  };

  const handleMarkTaken = (scheduleId: string) => {
    const targetSchedule = todaySchedules.find((s) => s.id === scheduleId) || activeAlarm;
    const now = Date.now();

    setDoseStatuses((prev) => ({
      ...prev,
      [scheduleId]: {
        status: 'taken',
        takenAt: now,
      },
    }));

    if (targetSchedule) {
      setMedications((prev) =>
        prev.map((m) => {
          if (m.id === targetSchedule.medicationId && m.stockCount !== undefined && m.stockCount > 0) {
            return { ...m, stockCount: m.stockCount - 1 };
          }
          return m;
        })
      );

      const logEntry: DoseLogEntry = {
        id: `log_${Date.now()}`,
        medicationId: targetSchedule.medicationId,
        medicationName: targetSchedule.medicationName,
        dosage: targetSchedule.dosage,
        scheduledTime: targetSchedule.time,
        action: 'taken',
        timestamp: now,
      };
      addDoseLogEntry(logEntry);
      setDoseLogs(getStoredDoseLogs());
    }

    if (activeAlarm?.id === scheduleId) {
      setActiveAlarm(null);
    }
  };

  const handleSnooze = (scheduleId: string) => {
    const snoozeUntil = Date.now() + 10 * 60 * 1000;
    setDoseStatuses((prev) => ({
      ...prev,
      [scheduleId]: {
        status: 'snoozed',
        snoozedUntil: snoozeUntil,
      },
    }));

    setTriggeredAlarmIds((prev) => {
      const copy = new Set(prev);
      copy.delete(scheduleId);
      return copy;
    });

    const targetSchedule = todaySchedules.find((s) => s.id === scheduleId) || activeAlarm;
    if (targetSchedule) {
      const logEntry: DoseLogEntry = {
        id: `log_${Date.now()}`,
        medicationId: targetSchedule.medicationId,
        medicationName: targetSchedule.medicationName,
        dosage: targetSchedule.dosage,
        scheduledTime: targetSchedule.time,
        action: 'snoozed',
        timestamp: Date.now(),
      };
      addDoseLogEntry(logEntry);
      setDoseLogs(getStoredDoseLogs());
    }

    if (activeAlarm?.id === scheduleId) {
      setActiveAlarm(null);
    }
  };

  const handleDismissAlarm = () => {
    setActiveAlarm(null);
  };

  const handleTestAlarmGeneral = () => {
    alarmAudio.playClickBeep();

    const dummySchedule: DoseSchedule = todaySchedules.length > 0
      ? todaySchedules[0]
      : {
          id: `test_${Date.now()}`,
          medicationId: 'test_med',
          medicationName: 'Dipirona Sódica',
          dosage: '500 mg - 1 comprimido',
          time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          scheduledTimestamp: Date.now(),
          status: 'pending',
          color: 'blue',
          instructions: 'Tomar com água após o teste do sistema de alerta.',
        };

    setActiveAlarm(dummySchedule);
  };

  const handleTestSpecificAlarm = (medOrSchedule: Medication | DoseSchedule) => {
    alarmAudio.playClickBeep();

    if ('medicationName' in medOrSchedule) {
      setActiveAlarm(medOrSchedule as DoseSchedule);
    } else {
      const med = medOrSchedule as Medication;
      const dummySchedule: DoseSchedule = {
        id: `test_${med.id}_${Date.now()}`,
        medicationId: med.id,
        medicationName: med.name,
        dosage: med.dosage,
        time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        scheduledTimestamp: Date.now(),
        status: 'pending',
        color: med.color,
        instructions: med.instructions,
      };
      setActiveAlarm(dummySchedule);
    }
  };

  return (
    <div className="app-container">
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenAddModal={() => {
          alarmAudio.playClickBeep();
          setEditingMedication(null);
          setIsFormModalOpen(true);
        }}
        onTestAlarm={handleTestAlarmGeneral}
        pendingCount={pendingCount}
      />

      <main>
        {activeTab === 'timeline' && (
          <DailyTimeline
            schedules={todaySchedules}
            onMarkTaken={handleMarkTaken}
            onSnooze={handleSnooze}
            onTestSpecificAlarm={handleTestSpecificAlarm}
          />
        )}

        {activeTab === 'medications' && (
          <div className="meds-tab-container">
            <div className="timeline-controls-row">
              <h3 className="section-heading">Medicamentos Cadastrados ({medications.length})</h3>
              <button
                onClick={() => {
                  alarmAudio.playClickBeep();
                  setEditingMedication(null);
                  setIsFormModalOpen(true);
                }}
                className="btn btn-primary"
              >
                <Plus className="icon-sm" />
                <span>Novo Remédio</span>
              </button>
            </div>

            {medications.length === 0 ? (
              <div className="empty-state-card">
                <Pill className="empty-icon text-sky" />
                <h4 className="empty-title">Nenhum remédio cadastrado</h4>
                <p className="empty-desc">Cadastre seu primeiro remédio para agendar os alarmes automáticos.</p>
              </div>
            ) : (
              <div className="meds-grid">
                {medications.map((med) => (
                  <MedicationCard
                    key={med.id}
                    medication={med}
                    onEdit={(m) => {
                      setEditingMedication(m);
                      setIsFormModalOpen(true);
                    }}
                    onDelete={handleDeleteMedication}
                    onTriggerAlarm={handleTestSpecificAlarm}
                    onToggleActive={handleToggleActive}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <HistoryLog logs={doseLogs} onClearLogs={() => {
            saveStoredDoseLogs([]);
            setDoseLogs([]);
          }} />
        )}
      </main>

      <MedicationFormModal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        onSave={handleSaveMedication}
        initialData={editingMedication}
      />

      <AlarmOverlay
        activeAlarm={activeAlarm}
        onTakeNow={handleMarkTaken}
        onSnooze={handleSnooze}
        onDismiss={handleDismissAlarm}
      />
    </div>
  );
}
export default App;
