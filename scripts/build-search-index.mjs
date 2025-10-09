import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import matter from 'gray-matter';

const recordsDir = join(process.cwd(), '_records');
const files = await fs.readdir(recordsDir);
const entries = [];

for (const file of files) {
  if (!file.endsWith('.md')) continue;
  const filepath = join(recordsDir, file);
  const content = await fs.readFile(filepath, 'utf8');
  const { data } = matter(content);
  entries.push({
    id: data.record_id,
    title: data.title,
    creators: data.creators ?? [],
    subjects: data.subjects ?? [],
    collection: data.collection ?? null,
    year: data.date ?? null,
    lang: data.language ?? null,
    quality: data.quality_grade ?? null,
    permalink: data.identifiers?.permalink ?? `/record/${data.record_id}`
  });
}

const indexPath = join(process.cwd(), 'search', 'index.json');
await fs.writeFile(indexPath, JSON.stringify(entries, null, 2));
console.log(`Wrote ${entries.length} records to ${indexPath}`);
