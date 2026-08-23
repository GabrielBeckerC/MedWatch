import { useState, useEffect } from 'react';
import { X, Pill, Clock, Check, AlertCircle, Info, Sparkles } from 'lucide-react';
import type { Medication, PillColor, FrequencyType } from '../types/medication';
import { generateDailyDoseTimes } from '../utils/scheduler';
import { alarmAudio } from '../utils/audioAlarm';

interface MedicationFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (med: Partial<Medication>) => void;
  initialData?: Medication | null;
}

const COLOR_OPTIONS: { key: PillColor; name: string; hex: string }[] = [
  { key: 'blue', name: 'Azul Celeste', hex: '#3b82f6' },
  { key: 'emerald', name: 'Esmeralda', hex: '#10b981' },
  { key: 'purple', name: 'Roxo Místico', hex: '#8b5cf6' },
  { key: 'amber', name: 'Âmbar Dourado', hex: '#f59e0b' },
  { key: 'rose', name: 'Rosa Coral', hex: '#f43f5e' },
  { key: 'indigo', name: 'Índigo Profundo', hex: '#6366f1' },
  { key: 'cyan', name: 'Ciano Neve', hex: '#06b6d4' },
];

export const MedicationFormModal: React.FC<MedicationFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
}) => {
  const [name, setName] = useState<string>('');
  const [dosage, setDosage] = useState<string>('');
  const [timesPerDay, setTimesPerDay] = useState<number>(2);
  const [startTime, setStartTime] = useState<string>('08:00');
  const [frequencyType, setFrequencyType] = useState<FrequencyType>('times_per_day');
  const [intervalHours, setIntervalHours] = useState<number>(12);
  const [color, setColor] = useState<PillColor>('blue');
  const [stockCount, setStockCount] = useState<string>('30');
  const [instructions, setInstructions] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');

  useEffect(() => {
    if (initialData) {
      setName(initialData.name);
      setDosage(initialData.dosage);
      setTimesPerDay(initialData.timesPerDay);
      setStartTime(initialData.startTime);
      setFrequencyType(initialData.frequencyType || 'times_per_day');
      setIntervalHours(initialData.intervalHours || 12);
      setColor(initialData.color || 'blue');
      setStockCount(initialData.stockCount !== undefined ? String(initialData.stockCount) : '');
      setInstructions(initialData.instructions || '');
    } else {
      setName('');
      setDosage('');
      setTimesPerDay(2);
      setStartTime('08:00');
      setFrequencyType('times_per_day');
      setIntervalHours(12);
      setColor('blue');
      setStockCount('30');
      setInstructions('');
    }
    setErrorMsg('');
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const calculatedTimes = generateDailyDoseTimes(
    startTime || '08:00',
    timesPerDay,
    frequencyType === 'interval_hours' ? intervalHours : undefined
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('Por favor, informe o nome do medicamento.');
      return;
    }
    if (!dosage.trim()) {
      setErrorMsg('Por favor, informe a dosagem (ex: 500mg ou 1 comprimido).');
      return;
    }
    if (!startTime) {
      setErrorMsg('Por favor, defina o horário de início.');
      return;
    }

    alarmAudio.playClickBeep();

    onSave({
      id: initialData?.id,
      name: name.trim(),
      dosage: dosage.trim(),
      timesPerDay: Number(timesPerDay),
      startTime,
      frequencyType,
      intervalHours: frequencyType === 'interval_hours' ? Number(intervalHours) : Math.round(24 / timesPerDay),
      color,
      stockCount: stockCount ? parseInt(stockCount, 10) : undefined,
      stockWarningThreshold: 5,
      instructions: instructions.trim(),
      active: true,
    });

    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <div className={`modal-icon-badge color-${color}`}>
              <Pill className="icon-md" />
            </div>
            <div>
              <h2 className="modal-title">{initialData ? 'Editar Medicamento' : 'Cadastrar Novo Remédio'}</h2>
              <p className="modal-subtitle">Configure a dosagem e horários automáticos</p>
            </div>
          </div>
          <button onClick={onClose} className="modal-close-btn" aria-label="Fechar">
            <X className="icon-sm" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          {errorMsg && (
            <div className="alert-banner alert-error">
              <AlertCircle className="icon-sm" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label">
                Nome do Remédio <span className="text-rose">*</span>
              </label>
              <input
                type="text"
                placeholder="Ex: Paracetamol, Amoxicilina"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="form-input"
                autoFocus
              />
            </div>

            <div className="form-group">
              <label className="form-label">
                Dosagem / Quantidade <span className="text-rose">*</span>
              </label>
              <input
                type="text"
                placeholder="Ex: 500 mg, 1 comprimido, 10 ml"
                value={dosage}
                onChange={(e) => setDosage(e.target.value)}
                className="form-input"
              />
            </div>
          </div>

          <div className="form-grid-3">
            <div className="form-group">
              <label className="form-label">
                Vezes por Dia <span className="text-rose">*</span>
              </label>
              <select
                value={timesPerDay}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setTimesPerDay(val);
                  setIntervalHours(Math.round(24 / val));
                }}
                className="form-select"
              >
                <option value={1}>1x ao dia (a cada 24h)</option>
                <option value={2}>2x ao dia (de 12 em 12h)</option>
                <option value={3}>3x ao dia (de 8 em 8h)</option>
                <option value={4}>4x ao dia (de 6 em 6h)</option>
                <option value={6}>6x ao dia (de 4 em 4h)</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">
                Horário de Início (1ª dose) <span className="text-rose">*</span>
              </label>
              <div className="input-with-icon">
                <Clock className="input-icon" />
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="form-input input-time"
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Qtd. em Estoque (Comprimidos)</label>
              <input
                type="number"
                min="0"
                placeholder="Ex: 30"
                value={stockCount}
                onChange={(e) => setStockCount(e.target.value)}
                className="form-input"
              />
            </div>
          </div>

          <div className="preview-schedule-box">
            <div className="preview-header">
              <Sparkles className="icon-sm text-sky" />
              <span className="preview-title">Horários do Alarme Gerados Automaticamente:</span>
            </div>
            <div className="schedule-pills-row">
              {calculatedTimes.map((time, idx) => (
                <div key={idx} className={`schedule-pill-badge color-${color}`}>
                  <Clock className="icon-xs" />
                  <span>{time}</span>
                  {idx === 0 && <span className="pill-tag-start">1ª dose</span>}
                </div>
              ))}
            </div>
            <p className="preview-note">
              <Info className="icon-xs" />
              O alarme soará e exibirá a notificação na tela em cada um destes horários todos os dias.
            </p>
          </div>

          <div className="form-group">
            <label className="form-label">Cor de Identificação Visual</label>
            <div className="color-picker-grid">
              {COLOR_OPTIONS.map((c) => (
                <button
                  type="button"
                  key={c.key}
                  onClick={() => setColor(c.key)}
                  className={`color-picker-btn color-${c.key} ${color === c.key ? 'selected' : ''}`}
                  title={c.name}
                >
                  {color === c.key && <Check className="icon-xs" />}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Instruções / Observações Importantes</label>
            <input
              type="text"
              placeholder="Ex: Tomar após o café da manhã, Tomar com bastante água"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              className="form-input"
            />
          </div>

          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary">
              <Check className="icon-sm" />
              <span>{initialData ? 'Salvar Alterações' : 'Cadastrar Medicamento'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
