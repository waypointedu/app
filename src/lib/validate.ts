import type { RecordIndex } from './search';

export interface ValidationIssue {
  id: string;
  message: string;
  level: 'error' | 'warning';
}

export const validateRecord = (record: RecordIndex): ValidationIssue[] => {
  const issues: ValidationIssue[] = [];
  if (!record.title) {
    issues.push({ id: record.id, level: 'error', message: 'Record is missing a title.' });
  }
  if (!record.creators?.length) {
    issues.push({ id: record.id, level: 'warning', message: 'Record is missing creators.' });
  }
  return issues;
};
