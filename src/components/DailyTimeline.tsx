import { useState } from 'react';
import confetti from 'canvas-confetti';
import type { DoseSchedule } from '../types/medication';
import { formatTimeRemaining } from '../utils/scheduler';
import { CheckCircle2, Clock, AlertTriangle, BellRing, Sparkles, Check, FileText } from 'lucide-react';
import { alarmAudio } from '../utils/audioAlarm';

interface DailyTimelineProps {
  schedules: DoseSchedule[];
  onMarkTaken: (scheduleId: string) => void;
  onSnooze: (scheduleId: string) => void;
  onTestSpecificAlarm: (schedule: DoseSchedule) => void;
}

export const DailyTimeline: React.FC<DailyTimelineProps> = ({
  schedules,
  onMarkTaken,
  onSnooze,
  onTestSpecificAlarm,
}) => {
  const [filter, setFilter] = useState<'all' | 'pending' | 'taken'>('all');

  const totalDoses = schedules.length;
  const takenDoses = schedules.filter((s) => s.status === 'taken').length;
  const progressPercent = totalDoses > 0 ? Math.round((takenDoses / totalDoses) * 100) : 0;

  const triggerConfetti = () => {
    try {
      confetti({
        particleCount: 70,
        spread: 60,
        origin: { y: 0.7 },
        colors: ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b'],
      });
    } catch {
      // ignore
    }
  };

  const handleTakeClick = (scheduleId: string) => {
    alarmAudio.playSuccessChime();
    triggerConfetti();
    onMarkTaken(scheduleId);
  };

  const filteredSchedules = schedules.filter((s) => {
    if (filter === 'pending') return s.status === 'pending' || s.status === 'snoozed';
    if (filter === 'taken') return s.status === 'taken';
    return true;
  });

  return (
    <div className="timeline-container">
      <div className="progress-banner-card">
        <div className="progress-info-row">
          <div>
            <div className="progress-title-group">
              <Sparkles className="icon-md text-emerald animate-pulse" />
              <h2 className="progress-title">Progresso de Hoje</h2>
            </div>
            <p className="progress-subtitle">
              {takenDoses} de {totalDoses} doses tomadas com sucesso
            </p>
          </div>
          <div className="progress-badge-percent">{progressPercent}%</div>
        </div>

        <div className="progress-bar-track">
          <div className="progress-bar-fill" style={{ width: `${progressPercent}%` }}></div>
        </div>
      </div>

      <div className="timeline-controls-row">
        <h3 className="section-heading">Cronograma de Doses ({schedules.length})</h3>
        <div className="filter-pills-group">
          <button
            onClick={() => {
              alarmAudio.playClickBeep();
              setFilter('all');
            }}
            className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
          >
            Todos ({totalDoses})
          </button>
          <button
            onClick={() => {
              alarmAudio.playClickBeep();
              setFilter('pending');
            }}
            className={`filter-btn ${filter === 'pending' ? 'active' : ''}`}
          >
            Pendentes ({totalDoses - takenDoses})
          </button>
          <button
            onClick={() => {
              alarmAudio.playClickBeep();
              setFilter('taken');
            }}
            className={`filter-btn ${filter === 'taken' ? 'active' : ''}`}
          >
            Tomados ({takenDoses})
          </button>
        </div>
      </div>

      {filteredSchedules.length === 0 ? (
        <div className="empty-state-card">
          <CheckCircle2 className="empty-icon text-emerald" />
          <h4 className="empty-title">Nenhum remédio nesta categoria</h4>
          <p className="empty-desc">Todos os remédios agendados estão em dia!</p>
        </div>
      ) : (
        <div className="timeline-list">
          {filteredSchedules.map((item) => {
            const isNowOrOverdue = Date.now() >= item.scheduledTimestamp && item.status !== 'taken';
            const timeRemainingText = formatTimeRemaining(item.scheduledTimestamp);

            return (
              <div
                key={item.id}
                className={`timeline-item-card color-${item.color} ${item.status === 'taken' ? 'status-taken' : ''} ${
                  isNowOrOverdue ? 'status-urgent' : ''
                }`}
              >
                <div className="timeline-time-col">
                  <div className="time-display">{item.time}</div>
                  <div className="time-status-pill">
                    {item.status === 'taken' && (
                      <span className="badge badge-success">
                        <Check className="icon-xs" /> Tomado
                      </span>
                    )}
                    {item.status === 'pending' && !isNowOrOverdue && (
                      <span className="badge badge-pending">
                        <Clock className="icon-xs" /> {timeRemainingText}
                      </span>
                    )}
                    {item.status === 'pending' && isNowOrOverdue && (
                      <span className="badge badge-danger animate-pulse">
                        <AlertTriangle className="icon-xs" /> ALARME AGORA!
                      </span>
                    )}
                    {item.status === 'snoozed' && (
                      <span className="badge badge-warning">
                        <Clock className="icon-xs" /> Adiado 10min
                      </span>
                    )}
                  </div>
                </div>

                <div className="timeline-content-col">
                  <div className="med-name-row">
                    <h4 className="timeline-med-name">{item.medicationName}</h4>
                    <span className={`pill-dosage-tag color-${item.color}`}>{item.dosage}</span>
                  </div>

                  {item.instructions && (
                    <div className="timeline-instructions-card">
                      <FileText className="icon-xs text-amber" />
                      <span><strong>Observação:</strong> {item.instructions}</span>
                    </div>
                  )}
                </div>

                <div className="timeline-actions-col">
                  {item.status !== 'taken' ? (
                    <>
                      <button onClick={() => handleTakeClick(item.id)} className="btn btn-take-now">
                        <Check className="icon-sm" />
                        <span>Tomar Agora</span>
                      </button>

                      <button
                        onClick={() => {
                          alarmAudio.playClickBeep();
                          onSnooze(item.id);
                        }}
                        className="btn-icon-only"
                        title="Adiar por 10 minutos"
                      >
                        <Clock className="icon-sm text-amber" />
                      </button>

                      <button
                        onClick={() => onTestSpecificAlarm(item)}
                        className="btn-icon-only"
                        title="Testar disparo do alarme para este remédio"
                      >
                        <BellRing className="icon-sm text-sky" />
                      </button>
                    </>
                  ) : (
                    <div className="taken-timestamp-note">
                      <CheckCircle2 className="icon-sm text-emerald" />
                      <span>Tomado às {item.takenAt ? new Date(item.takenAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : item.time}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
