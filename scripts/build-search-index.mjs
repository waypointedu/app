import { promises as fs } from 'node:fs';
import { join, extname } from 'node:path';

const recordsDir = join(process.cwd(), '_records');
const files = await fs.readdir(recordsDir);
const entries = [];

for (const file of files) {
  if (extname(file) !== '.json') continue;
  const filepath = join(recordsDir, file);
  const data = JSON.parse(await fs.readFile(filepath, 'utf8'));
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

entries.sort((a, b) => a.title.localeCompare(b.title));

const indexPath = join(process.cwd(), 'search', 'index.json');
const docsIndexPath = join(process.cwd(), 'docs', 'search', 'index.json');
const payload = JSON.stringify(entries, null, 2) + '\n';
await fs.writeFile(indexPath, payload);
await fs.mkdir(join(process.cwd(), 'docs', 'search'), { recursive: true });
await fs.writeFile(docsIndexPath, payload);
console.log(`Wrote ${entries.length} records to ${indexPath} and ${docsIndexPath}`);
