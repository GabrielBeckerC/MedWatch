import type { Medication } from '../types/medication';
import { generateDailyDoseTimes } from '../utils/scheduler';
import { Pill, Clock, Edit3, Trash2, Bell, AlertTriangle, Package, FileText } from 'lucide-react';
import { alarmAudio } from '../utils/audioAlarm';

interface MedicationCardProps {
  medication: Medication;
  onEdit: (med: Medication) => void;
  onDelete: (id: string) => void;
  onTriggerAlarm: (med: Medication) => void;
  onToggleActive: (id: string) => void;
}

export const MedicationCard: React.FC<MedicationCardProps> = ({
  medication,
  onEdit,
  onDelete,
  onTriggerAlarm,
  onToggleActive,
}) => {
  const times = generateDailyDoseTimes(medication.startTime, medication.timesPerDay, medication.intervalHours);

  const isLowStock =
    medication.stockCount !== undefined &&
    medication.stockWarningThreshold !== undefined &&
    medication.stockCount <= medication.stockWarningThreshold;

  return (
    <div className={`med-card color-${medication.color} ${!medication.active ? 'med-card-disabled' : ''}`}>
      <div className="med-card-header">
        <div className="med-card-title-group">
          <div className={`med-card-icon-avatar color-${medication.color}`}>
            <Pill className="icon-md" />
          </div>
          <div>
            <h3 className="med-card-name">{medication.name}</h3>
            <div className="med-card-dosage-row">
              <span className="med-dosage-text">{medication.dosage}</span>
              <span className="med-freq-tag">
                {medication.timesPerDay}x por dia ({medication.intervalHours ? `de ${medication.intervalHours} em ${medication.intervalHours}h` : ''})
              </span>
            </div>
          </div>
        </div>

        <div className="med-card-toggle">
          <button
            onClick={() => {
              alarmAudio.playClickBeep();
              onToggleActive(medication.id);
            }}
            className={`status-switch ${medication.active ? 'active' : ''}`}
            title={medication.active ? 'Alarme ativo - Clique para pausar' : 'Alarme pausado - Clique para ativar'}
          >
            <span className="switch-slider"></span>
          </button>
        </div>
      </div>

      <div className="med-card-schedules">
        <div className="schedule-header-label">
          <Clock className="icon-xs text-sky" />
          <span>Horários das Doses:</span>
        </div>
        <div className="med-schedule-badges">
          {times.map((t: string, idx: number) => (
            <span key={idx} className={`time-badge-item color-${medication.color}`}>
              {t}
            </span>
          ))}
        </div>
      </div>

      <div className="med-card-extra">
        {medication.instructions && (
          <div className="med-instructions-card">
            <FileText className="icon-xs text-amber" />
            <span><strong>Observação:</strong> {medication.instructions}</span>
          </div>
        )}

        {medication.stockCount !== undefined && (
          <div className={`stock-level-badge ${isLowStock ? 'stock-warning' : 'stock-ok'}`}>
            <Package className="icon-xs" />
            <span>Estoque: {medication.stockCount} unidades</span>
            {isLowStock && (
              <span className="stock-alert-text">
                <AlertTriangle className="icon-xs" /> Repor estoque!
              </span>
            )}
          </div>
        )}
      </div>

      <div className="med-card-footer">
        <button
          onClick={() => {
            alarmAudio.playClickBeep();
            onTriggerAlarm(medication);
          }}
          className="btn-card-action action-alarm"
          title="Disparar alarme deste remédio agora na tela para testar"
        >
          <Bell className="icon-xs text-amber" />
          <span>Disparar Alarme</span>
        </button>

        <div className="med-card-right-actions">
          <button
            onClick={() => {
              alarmAudio.playClickBeep();
              onEdit(medication);
            }}
            className="btn-card-action action-edit"
            title="Editar remédio"
          >
            <Edit3 className="icon-xs" />
            <span>Editar</span>
          </button>

          <button
            onClick={() => {
              alarmAudio.playClickBeep();
              if (window.confirm(`Deseja realmente remover ${medication.name}?`)) {
                onDelete(medication.id);
              }
            }}
            className="btn-card-action action-delete"
            title="Excluir remédio"
          >
            <Trash2 className="icon-xs" />
          </button>
        </div>
      </div>
    </div>
  );
};
