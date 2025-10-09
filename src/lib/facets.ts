import type { RecordIndex } from './search';

export type FacetCounts = Record<string, Record<string, number>>;

export const computeFacetCounts = (records: RecordIndex[]): FacetCounts => {
  const counts: FacetCounts = {};
  const register = (facet: string, value: string) => {
    if (!counts[facet]) counts[facet] = {};
    counts[facet][value] = (counts[facet][value] ?? 0) + 1;
  };

  for (const record of records) {
    record.subjects.forEach((subject) => register('subjects', subject));
    register('collection', record.collection);
    register('language', record.lang);
    register('quality', record.quality);
  }

  return counts;
};
