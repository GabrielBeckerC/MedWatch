import { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Pill, Bell, CheckCircle2, Clock, XCircle, Volume2, ShieldAlert, Check } from 'lucide-react';
import type { DoseSchedule } from '../types/medication';
import { alarmAudio } from '../utils/audioAlarm';

interface AlarmOverlayProps {
  activeAlarms: DoseSchedule[];
  onTakeNow: (scheduleId: string) => void;
  onTakeAllNow: (scheduleIds: string[]) => void;
  onSnoozeAll: (scheduleIds: string[]) => void;
  onDismiss: () => void;
}

export const AlarmOverlay: React.FC<AlarmOverlayProps> = ({
  activeAlarms,
  onTakeNow,
  onTakeAllNow,
  onSnoozeAll,
  onDismiss,
}) => {
  const hasAlarms = activeAlarms.length > 0;

  useEffect(() => {
    if (hasAlarms) {
      alarmAudio.startAlarmSound();
      alarmAudio.vibrateMobile();
    } else {
      alarmAudio.stopAlarmSound();
    }

    return () => {
      alarmAudio.stopAlarmSound();
    };
  }, [hasAlarms]);

  if (!hasAlarms) return null;

  const triggerConfetti = () => {
    try {
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.55 },
        colors: ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b'],
      });
    } catch {
      // ignore
    }
  };

  const handleTakeAll = () => {
    alarmAudio.stopAlarmSound();
    alarmAudio.playSuccessChime();
    triggerConfetti();
    onTakeAllNow(activeAlarms.map((a) => a.id));
  };

  const handleTakeSingle = (id: string) => {
    alarmAudio.playSuccessChime();
    triggerConfetti();
    onTakeNow(id);
  };

  const handleSnooze = () => {
    alarmAudio.stopAlarmSound();
    alarmAudio.playClickBeep();
    onSnoozeAll(activeAlarms.map((a) => a.id));
  };

  const handleDismiss = () => {
    alarmAudio.stopAlarmSound();
    alarmAudio.playClickBeep();
    onDismiss();
  };

  const scheduledTime = activeAlarms[0]?.time || '';
  const totalCount = activeAlarms.length;

  return (
    <div className="alarm-fullscreen-backdrop">
      <div className="alarm-pulsing-rings">
        <div className="ring ring-1"></div>
        <div className="ring ring-2"></div>
        <div className="ring ring-3"></div>
      </div>

      <div className="alarm-modal-card">
        <div className="alarm-header-badge">
          <Bell className="alarm-bell-icon animate-bounce text-amber" />
          <span className="alarm-badge-text">
            {totalCount > 1
              ? `HORÁRIO DOS MEDICAMENTOS (${scheduledTime})`
              : `HORÁRIO DO MEDICAMENTO (${scheduledTime})`}
          </span>
        </div>

        <div className="alarm-time-tag">
          <Clock className="icon-sm" /> Horário Agendado: {scheduledTime}
        </div>

        <p className="alarm-subheading">
          {totalCount === 1
            ? 'Você tem 1 medicamento para tomar neste horário:'
            : `Você tem ${totalCount} medicamentos para tomar neste horário:`}
        </p>

        {/* List of Medications Scheduled for this Time */}
        <div className="alarm-meds-list">
          {activeAlarms.map((item) => (
            <div key={item.id} className={`alarm-med-item-card color-${item.color}`}>
              <div className="alarm-item-top-row">
                <div className="alarm-item-left">
                  <div className={`alarm-item-avatar color-${item.color}`}>
                    <Pill className="icon-md" />
                  </div>
                  <div className="alarm-item-info">
                    <h3 className="alarm-item-name">{item.medicationName}</h3>
                    <span className="alarm-item-dosage">{item.dosage}</span>
                  </div>
                </div>

                {totalCount > 1 && (
                  <button
                    onClick={() => handleTakeSingle(item.id)}
                    className="btn-take-single"
                    title="Tomar este medicamento"
                  >
                    <Check className="icon-sm" />
                    <span>Tomar</span>
                  </button>
                )}
              </div>

              {item.instructions && (
                <div className="alarm-item-instruction-card">
                  <ShieldAlert className="icon-xs text-amber-glow" />
                  <div className="instruction-text-block">
                    <span className="instruction-label">Observação / Instruções:</span>
                    <span className="instruction-body">{item.instructions}</span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="alarm-audio-status font-mono">
          <Volume2 className="icon-xs animate-pulse text-emerald" />
          <span>Alarme sonoro ativo • Música em reprodução</span>
        </div>

        <div className="alarm-actions-stack">
          <button onClick={handleTakeAll} className="btn-alarm-action btn-take-primary">
            <CheckCircle2 className="icon-lg" />
            <div className="action-btn-text">
              <span className="action-main-label">
                {totalCount > 1 ? `TOMAR TODOS (${totalCount})` : 'TOMAR AGORA'}
              </span>
              <span className="action-sub-label">Registrar como concluído no sistema</span>
            </div>
          </button>

          <div className="alarm-secondary-actions">
            <button onClick={handleSnooze} className="btn-alarm-action btn-snooze">
              <Clock className="icon-md" />
              <span>Adiar 10 Minutos</span>
            </button>

            <button onClick={handleDismiss} className="btn-alarm-action btn-dismiss">
              <XCircle className="icon-md" />
              <span>Fechar Alarme</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

