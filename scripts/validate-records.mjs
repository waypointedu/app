import { promises as fs } from 'node:fs';
import { join, extname } from 'node:path';

const recordsDir = join(process.cwd(), '_records');
const files = await fs.readdir(recordsDir);
let hasErrors = false;

for (const file of files) {
  if (extname(file) !== '.json') continue;
  const data = JSON.parse(await fs.readFile(join(recordsDir, file), 'utf8'));
  const required = ['record_id', 'title', 'date', 'rights'];

  for (const key of required) {
    if (data[key] === undefined || data[key] === null || data[key] === '') {
      console.error(`ERROR ${file}: Missing ${key}`);
      hasErrors = true;
    }
  }

  if (!Array.isArray(data.subjects) || data.subjects.length === 0) {
    console.warn(`WARN  ${file}: No subjects listed`);
  }
}

if (hasErrors) {
  process.exitCode = 1;
}
