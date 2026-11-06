import { describe, expect, it } from 'vitest';
import { validateBackup } from './db';

const validExercise = { id: 'e1', name: 'Bankdrücken KH', equipment: 'KH', muscles: ['brust'] };

describe('validateBackup', () => {
  it('akzeptiert ein minimales gültiges Backup', () => {
    expect(() => validateBackup({ version: 1, exercises: [validExercise], plans: [], sessions: [] })).not.toThrow();
  });
  it('akzeptiert Backups ohne version-Feld (ältere Stände)', () => {
    expect(() => validateBackup({ exercises: [], plans: [], sessions: [] })).not.toThrow();
  });
  it('lehnt fehlende Listen ab', () => {
    expect(() => validateBackup({ exercises: [], plans: [] })).toThrow();
  });
  it('lehnt unbekannte Geräte ab', () => {
    const bad = { ...validExercise, equipment: 'Hantel' };
    expect(() => validateBackup({ exercises: [bad], plans: [], sessions: [] })).toThrow('Ungültige Übung');
  });
  it('lehnt Muskeln, die keine Strings sind, ab', () => {
    const bad = { ...validExercise, muscles: ['brust', 3] };
    expect(() => validateBackup({ exercises: [bad], plans: [], sessions: [] })).toThrow('Ungültige Übung');
  });
  it('lehnt Backups aus einer neueren Version ab', () => {
    expect(() => validateBackup({ version: 99, exercises: [], plans: [], sessions: [] })).toThrow('neueren');
  });
  it('lehnt settings, die keine Liste sind, ab', () => {
    expect(() => validateBackup({ exercises: [], plans: [], sessions: [], settings: {} })).toThrow('settings');
  });
});
