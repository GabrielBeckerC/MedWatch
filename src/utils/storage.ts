import type { Medication, DoseLogEntry, DoseStatus } from '../types/medication';

const MEDS_KEY = 'medwatch_medications_v1';
const STATUSES_KEY = 'medwatch_dose_statuses_v1';
const LOGS_KEY = 'medwatch_dose_logs_v1';

const INITIAL_MEDICATIONS: Medication[] = [];

export function getStoredMedications(): Medication[] {
  try {
    const raw = localStorage.getItem(MEDS_KEY);
    if (!raw) {
      saveStoredMedications(INITIAL_MEDICATIONS);
      return INITIAL_MEDICATIONS;
    }
    return JSON.parse(raw);
  } catch (e) {
    console.error('Erro ao ler medicamentos do localStorage:', e);
    return INITIAL_MEDICATIONS;
  }
}

export function saveStoredMedications(meds: Medication[]): void {
  try {
    localStorage.setItem(MEDS_KEY, JSON.stringify(meds));
  } catch (e) {
    console.error('Erro ao salvar medicamentos no localStorage:', e);
  }
}

export function getStoredDoseStatuses(): Record<string, { status: DoseStatus; takenAt?: number; snoozedUntil?: number }> {
  try {
    const raw = localStorage.getItem(STATUSES_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveStoredDoseStatuses(statuses: Record<string, { status: DoseStatus; takenAt?: number; snoozedUntil?: number }>): void {
  try {
    localStorage.setItem(STATUSES_KEY, JSON.stringify(statuses));
  } catch (e) {
    console.error('Erro ao salvar status de doses:', e);
  }
}

export function getStoredDoseLogs(): DoseLogEntry[] {
  try {
    const raw = localStorage.getItem(LOGS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveStoredDoseLogs(logs: DoseLogEntry[]): void {
  try {
    localStorage.setItem(LOGS_KEY, JSON.stringify(logs));
  } catch (e) {
    console.error('Erro ao salvar histórico de doses:', e);
  }
}

export function addDoseLogEntry(entry: DoseLogEntry): void {
  const current = getStoredDoseLogs();
  const updated = [entry, ...current];
  saveStoredDoseLogs(updated);
}
