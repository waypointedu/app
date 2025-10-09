import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import matter from 'gray-matter';

const recordsDir = join(process.cwd(), '_records');
const subjectsPath = join(process.cwd(), 'src', 'data', 'subjects.json');

const files = await fs.readdir(recordsDir);
const subjectList = JSON.parse(await fs.readFile(subjectsPath, 'utf8'));
let hasErrors = false;

for (const file of files) {
  if (!file.endsWith('.md')) continue;
  const content = await fs.readFile(join(recordsDir, file), 'utf8');
  const { data } = matter(content);

  const required = ['record_id', 'title', 'date', 'rights'];
  for (const key of required) {
    if (!data[key]) {
      console.error(`ERROR ${file}: Missing ${key}`);
      hasErrors = true;
    }
  }

  if (Array.isArray(data.subjects)) {
    for (const subject of data.subjects) {
      if (!subjectList.includes(subject)) {
        console.warn(`WARN  ${file}: Subject "${subject}" not in controlled vocabulary`);
      }
    }
  }
}

if (hasErrors) {
  process.exitCode = 1;
}
