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
import { Pill, Plus, AlertTriangle, X } from 'lucide-react';
import { alarmAudio } from './utils/audioAlarm';
import { scheduleNativeFutureAlarms, setupNotificationActionListener, clearAllNativeNotifications } from './utils/nativeAlarmScheduler';

export function App() {
  const [medications, setMedications] = useState<Medication[]>(getStoredMedications);
  const [doseStatuses, setDoseStatuses] = useState<Record<string, { status: DoseStatus; takenAt?: number; snoozedUntil?: number }>>(getStoredDoseStatuses);
  const [doseLogs, setDoseLogs] = useState<DoseLogEntry[]>(getStoredDoseLogs);

  const [activeTab, setActiveTab] = useState<'timeline' | 'medications'>('timeline');
  const [isFormModalOpen, setIsFormModalOpen] = useState<boolean>(false);
  const [editingMedication, setEditingMedication] = useState<Medication | null>(null);

  const [activeAlarms, setActiveAlarms] = useState<DoseSchedule[]>([]);
  const [triggeredAlarmIds, setTriggeredAlarmIds] = useState<Set<string>>(new Set());
  const [dismissNotice, setDismissNotice] = useState<string | null>(null);

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

  // Helper function to check and present due medication alarms
  const checkAndTriggerDueAlarms = () => {
    const now = Date.now();
    const dueSchedules: DoseSchedule[] = [];
    let targetTime: string | null = null;

    for (const schedule of todaySchedules) {
      if (schedule.status === 'taken') continue;

      const isSnoozeExpired = schedule.snoozedUntil ? now >= schedule.snoozedUntil : false;
      // An alarm is due if scheduled time is reached and within 15 minutes window, or if snoozed
      const isTimeDue = now >= schedule.scheduledTimestamp && (now - schedule.scheduledTimestamp <= 15 * 60 * 1000);

      if ((isTimeDue || isSnoozeExpired) && !triggeredAlarmIds.has(schedule.id)) {
        if (!targetTime) {
          targetTime = schedule.time;
        }
        if (schedule.time === targetTime) {
          dueSchedules.push(schedule);
        }
      }
    }

    if (dueSchedules.length > 0 && activeAlarms.length === 0) {
      setActiveTab('timeline');
      setActiveAlarms(dueSchedules);
      alarmAudio.startAlarmSound();
      alarmAudio.vibrateMobile();
      setTriggeredAlarmIds((prev) => {
        const next = new Set(prev);
        dueSchedules.forEach((s) => next.add(s.id));
        return next;
      });
    }
  };

  // Listen for native notification clicks to go directly to screen showing medications due
  useEffect(() => {
    setupNotificationActionListener((extra) => {
      let matching: DoseSchedule[] = [];

      if (extra?.time) {
        matching = todaySchedules.filter((s) => s.time === extra.time && s.status !== 'taken');
      }
      if (matching.length === 0 && extra?.medicationId) {
        matching = todaySchedules.filter((s) => s.medicationId === extra.medicationId && s.status !== 'taken');
      }

      if (matching.length === 0) {
        const now = Date.now();
        const pending = todaySchedules.filter((s) => (s.status === 'pending' || s.status === 'snoozed') && s.scheduledTimestamp <= now);
        if (pending.length > 0) {
          const firstTime = pending[0].time;
          matching = pending.filter((s) => s.time === firstTime);
        }
      }

      if (matching.length > 0) {
        setActiveTab('timeline');
        setActiveAlarms(matching);
        alarmAudio.startAlarmSound();
        alarmAudio.vibrateMobile();
        setTriggeredAlarmIds((prev) => {
          const next = new Set(prev);
          matching.forEach((m) => next.add(m.id));
          return next;
        });
      } else {
        checkAndTriggerDueAlarms();
      }
    });
  }, [todaySchedules]);

  // Main alarm ticker checking scheduled time and snoozed timers
  useEffect(() => {
    checkAndTriggerDueAlarms();
    const interval = setInterval(checkAndTriggerDueAlarms, 1500);
    return () => clearInterval(interval);
  }, [todaySchedules, triggeredAlarmIds, activeAlarms]);

  // App resume & visibility change listener (triggers check automatically when unlocking phone)
  useEffect(() => {
    const handleAppResume = () => {
      clearAllNativeNotifications();
      checkAndTriggerDueAlarms();
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        handleAppResume();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleAppResume);
    document.addEventListener('resume', handleAppResume);

    try {
      const cap = (window as unknown as { Capacitor?: { Plugins?: { App?: { addListener: (event: string, cb: (state: { isActive: boolean }) => void) => void } } } }).Capacitor;
      if (cap?.Plugins?.App) {
        cap.Plugins.App.addListener('appStateChange', (state) => {
          if (state.isActive) {
            handleAppResume();
          }
        });
      }
    } catch {
      // ignore
    }

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleAppResume);
      document.removeEventListener('resume', handleAppResume);
    };
  }, [todaySchedules, triggeredAlarmIds, activeAlarms]);

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
    const targetSchedule = todaySchedules.find((s) => s.id === scheduleId) || activeAlarms.find((s) => s.id === scheduleId);
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

    setActiveAlarms((prev) => {
      const remaining = prev.filter((a) => a.id !== scheduleId);
      if (remaining.length === 0) {
        alarmAudio.stopAlarmSound();
        clearAllNativeNotifications();
      }
      return remaining;
    });
  };

  const handleTakeAllNow = (scheduleIds: string[]) => {
    alarmAudio.stopAlarmSound();
    clearAllNativeNotifications();
    const now = Date.now();

    scheduleIds.forEach((scheduleId) => {
      const targetSchedule = todaySchedules.find((s) => s.id === scheduleId) || activeAlarms.find((s) => s.id === scheduleId);

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
          id: `log_${Date.now()}_${scheduleId}`,
          medicationId: targetSchedule.medicationId,
          medicationName: targetSchedule.medicationName,
          dosage: targetSchedule.dosage,
          scheduledTime: targetSchedule.time,
          action: 'taken',
          timestamp: now,
        };
        addDoseLogEntry(logEntry);
      }
    });

    setDoseLogs(getStoredDoseLogs());
    setActiveAlarms([]);
  };

  const handleSnoozeAll = (scheduleIds: string[]) => {
    alarmAudio.stopAlarmSound();
    clearAllNativeNotifications();
    const snoozeUntil = Date.now() + 10 * 60 * 1000;
    
    scheduleIds.forEach((scheduleId) => {
      setDoseStatuses((prev) => ({
        ...prev,
        [scheduleId]: {
          status: 'snoozed',
          snoozedUntil: snoozeUntil,
        },
      }));

      const targetSchedule = todaySchedules.find((s) => s.id === scheduleId) || activeAlarms.find((s) => s.id === scheduleId);
      if (targetSchedule) {
        const logEntry: DoseLogEntry = {
          id: `log_${Date.now()}_${scheduleId}`,
          medicationId: targetSchedule.medicationId,
          medicationName: targetSchedule.medicationName,
          dosage: targetSchedule.dosage,
          scheduledTime: targetSchedule.time,
          action: 'snoozed',
          timestamp: Date.now(),
        };
        addDoseLogEntry(logEntry);
      }
    });

    setTriggeredAlarmIds((prev) => {
      const copy = new Set(prev);
      scheduleIds.forEach((id) => copy.delete(id));
      return copy;
    });

    setDoseLogs(getStoredDoseLogs());
    setActiveAlarms([]);
  };

  const handleDismissAlarm = () => {
    alarmAudio.stopAlarmSound();
    clearAllNativeNotifications();
    setActiveAlarms([]);
    setDismissNotice(
      '⚠️ Lembrete de Saúde: Você fechou a notificação sem confirmar se tomou o remédio. A dose continua registrada como PENDENTE no seu cronograma!'
    );
  };

  const handleTestAlarmGeneral = () => {
    alarmAudio.playClickBeep();

    const pendingSchedules = todaySchedules.filter((s) => s.status !== 'taken');
    let dummySchedules: DoseSchedule[] = [];

    if (pendingSchedules.length > 0) {
      const firstTime = pendingSchedules[0].time;
      dummySchedules = pendingSchedules.filter((s) => s.time === firstTime);
    } else {
      dummySchedules = [
        {
          id: `test_${Date.now()}_1`,
          medicationId: 'test_med_1',
          medicationName: 'Dipirona Sódica',
          dosage: '500 mg - 1 comprimido',
          time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          scheduledTimestamp: Date.now(),
          status: 'pending',
          color: 'blue',
          instructions: 'Tomar com água após o teste do sistema de alerta.',
        },
      ];
    }

    setActiveAlarms(dummySchedules);
  };

  const handleTestSpecificAlarm = (medOrSchedule: Medication | DoseSchedule) => {
    alarmAudio.playClickBeep();

    if ('medicationName' in medOrSchedule) {
      setActiveAlarms([medOrSchedule as DoseSchedule]);
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
      setActiveAlarms([dummySchedule]);
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

      {dismissNotice && (
        <div className="dismiss-warning-banner">
          <div className="dismiss-warning-content">
            <AlertTriangle className="icon-md text-amber" />
            <span>{dismissNotice}</span>
          </div>
          <button onClick={() => setDismissNotice(null)} className="dismiss-warning-close" title="Fechar aviso">
            <X className="icon-sm" />
          </button>
        </div>
      )}

      <main>
        {activeTab === 'timeline' && (
          <DailyTimeline
            schedules={todaySchedules}
            onMarkTaken={handleMarkTaken}
            onSnooze={(id) => handleSnoozeAll([id])}
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

        {/* Historico de Doses sempre posicionado abaixo do conteudo dos remedios e cronograma */}
        <div className="bottom-history-wrapper" style={{ marginTop: '2.5rem' }}>
          <HistoryLog logs={doseLogs} onClearLogs={() => {
            saveStoredDoseLogs([]);
            setDoseLogs([]);
          }} />
        </div>
      </main>

      <MedicationFormModal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        onSave={handleSaveMedication}
        initialData={editingMedication}
      />

      <AlarmOverlay
        activeAlarms={activeAlarms}
        onTakeNow={handleMarkTaken}
        onTakeAllNow={handleTakeAllNow}
        onSnoozeAll={handleSnoozeAll}
        onDismiss={handleDismissAlarm}
      />
    </div>
  );
}
export default App;

