import type { DoseLogEntry } from '../types/medication';
import { formatFullDateTime } from '../utils/scheduler';
import { History, CheckCircle2, Clock, Trash2, Award } from 'lucide-react';
import { alarmAudio } from '../utils/audioAlarm';

interface HistoryLogProps {
  logs: DoseLogEntry[];
  onClearLogs: () => void;
}

export const HistoryLog: React.FC<HistoryLogProps> = ({ logs, onClearLogs }) => {
  const takenCount = logs.filter((l) => l.action === 'taken').length;

  return (
    <div className="history-container">
      <div className="history-summary-grid">
        <div className="stat-card">
          <div className="stat-icon-bg bg-emerald-glow">
            <Award className="icon-md text-emerald" />
          </div>
          <div>
            <div className="stat-value">{takenCount}</div>
            <div className="stat-label">Doses Confirmadas</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon-bg bg-sky-glow">
            <History className="icon-md text-sky" />
          </div>
          <div>
            <div className="stat-value">{logs.length}</div>
            <div className="stat-label">Registros no Histórico</div>
          </div>
        </div>
      </div>

      <div className="history-header-row">
        <h3 className="section-heading">Histórico de Atividades</h3>
        {logs.length > 0 && (
          <button
            onClick={() => {
              alarmAudio.playClickBeep();
              if (window.confirm('Deseja limpar todo o histórico de doses?')) {
                onClearLogs();
              }
            }}
            className="btn btn-secondary text-rose"
          >
            <Trash2 className="icon-xs" />
            <span>Limpar Histórico</span>
          </button>
        )}
      </div>

      {logs.length === 0 ? (
        <div className="empty-state-card">
          <History className="empty-icon text-sky" />
          <h4 className="empty-title">Nenhum registro ainda</h4>
          <p className="empty-desc">Quando você tomar ou adiar um medicamento, os registros aparecerão aqui.</p>
        </div>
      ) : (
        <div className="history-list">
          {logs.map((entry) => (
            <div key={entry.id} className="history-item-row">
              <div className="history-status-icon">
                {entry.action === 'taken' && <CheckCircle2 className="icon-md text-emerald" />}
                {entry.action === 'snoozed' && <Clock className="icon-md text-amber" />}
                {entry.action === 'dismissed' && <History className="icon-md text-sky" />}
              </div>

              <div className="history-details">
                <div className="history-med-name">{entry.medicationName}</div>
                <div className="history-meta">
                  <span>{entry.dosage}</span> • <span>Horário agendado: {entry.scheduledTime}</span>
                </div>
              </div>

              <div className="history-timestamp">{formatFullDateTime(entry.timestamp)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
