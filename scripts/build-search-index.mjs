import { promises as fs } from 'node:fs';
import { join, extname } from 'node:path';

const recordsDir = join(process.cwd(), '_records');
const files = await fs.readdir(recordsDir);
const entries = [];

const computeEra = (input) => {
  const year = Number.parseInt(input, 10);
  if (!Number.isFinite(year)) return null;
  if (year <= 500) return 'Ancient';
  if (year <= 1500) return 'Medieval';
  if (year <= 1650) return 'Renaissance';
  if (year <= 1800) return 'Early Modern';
  if (year <= 1945) return 'Modern';
  return 'Contemporary';
};

for (const file of files) {
  if (extname(file) !== '.json') continue;
  const filepath = join(recordsDir, file);
  const data = JSON.parse(await fs.readFile(filepath, 'utf8'));
  const year = data.original_date ?? data.date ?? null;
  entries.push({
    id: data.record_id,
    title: data.title,
    authors: data.creators ?? [],
    creators: data.creators ?? [],
    subjects: data.subjects ?? [],
    collection: data.collection ?? null,
    year,
    era: computeEra(year),
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
