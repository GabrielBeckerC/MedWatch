import { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Pill, Bell, CheckCircle2, Clock, XCircle, Volume2, ShieldAlert } from 'lucide-react';
import type { DoseSchedule } from '../types/medication';
import { alarmAudio } from '../utils/audioAlarm';

interface AlarmOverlayProps {
  activeAlarm: DoseSchedule | null;
  onTakeNow: (scheduleId: string) => void;
  onSnooze: (scheduleId: string) => void;
  onDismiss: () => void;
}

export const AlarmOverlay: React.FC<AlarmOverlayProps> = ({
  activeAlarm,
  onTakeNow,
  onSnooze,
  onDismiss,
}) => {
  useEffect(() => {
    if (activeAlarm) {
      alarmAudio.startAlarmSound();
      alarmAudio.vibrateMobile();
      alarmAudio.sendNativeNotification(
        `🚨 HORA DE TOMAR: ${activeAlarm.medicationName}`,
        `Dosagem: ${activeAlarm.dosage}. Horário agendado: ${activeAlarm.time}`
      );
    } else {
      alarmAudio.stopAlarmSound();
    }

    return () => {
      alarmAudio.stopAlarmSound();
    };
  }, [activeAlarm]);

  if (!activeAlarm) return null;

  const triggerConfetti = () => {
    try {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b'],
      });
    } catch {
      // ignore
    }
  };

  const handleTakeNow = () => {
    alarmAudio.stopAlarmSound();
    alarmAudio.playSuccessChime();
    triggerConfetti();
    onTakeNow(activeAlarm.id);
  };

  const handleSnooze = () => {
    alarmAudio.stopAlarmSound();
    alarmAudio.playClickBeep();
    onSnooze(activeAlarm.id);
  };

  const handleDismiss = () => {
    alarmAudio.stopAlarmSound();
    alarmAudio.playClickBeep();
    onDismiss();
  };

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
          <span className="alarm-badge-text">HORÁRIO DO MEDICAMENTO!</span>
        </div>

        <div className={`alarm-pill-avatar color-${activeAlarm.color}`}>
          <Pill className="alarm-pill-icon" />
        </div>

        <div className="alarm-med-details">
          <span className="alarm-time-tag">
            <Clock className="icon-sm" /> Horário: {activeAlarm.time}
          </span>
          <h2 className="alarm-med-name">{activeAlarm.medicationName}</h2>
          <div className="alarm-dosage-badge">{activeAlarm.dosage}</div>

          {activeAlarm.instructions && (
            <div className="alarm-instructions-box">
              <ShieldAlert className="icon-sm text-sky" />
              <span>Instrução: {activeAlarm.instructions}</span>
            </div>
          )}
        </div>

        <div className="alarm-audio-status font-mono">
          <Volume2 className="icon-xs animate-pulse text-emerald" />
          <span>Alarme sonoro e vibração ativos</span>
        </div>

        <div className="alarm-actions-stack">
          <button onClick={handleTakeNow} className="btn-alarm-action btn-take-primary">
            <CheckCircle2 className="icon-lg" />
            <div className="action-btn-text">
              <span className="action-main-label">TOMAR AGORA</span>
              <span className="action-sub-label">Registrar dose como concluída</span>
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
