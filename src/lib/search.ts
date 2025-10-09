import Fuse from 'fuse.js';

type RecordIndex = {
  id: string;
  title: string;
  creators: string[];
  subjects: string[];
  collection: string;
  year: number;
  lang: string;
  quality: string;
};

const options: Fuse.IFuseOptions<RecordIndex> = {
  keys: [
    { name: 'title', weight: 0.5 },
    { name: 'creators', weight: 0.3 },
    { name: 'subjects', weight: 0.2 }
  ],
  includeScore: true,
  threshold: 0.35
};

export const createSearch = async () => {
  const data: RecordIndex[] = await fetch('/search/index.json').then((response) => response.json());
  return new Fuse(data, options);
};

export type { RecordIndex };
