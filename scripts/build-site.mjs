import { promises as fs } from 'node:fs';
import { join, extname } from 'node:path';

const root = process.cwd();
const docsDir = join(root, 'docs');
const recordsDir = join(root, '_records');

await fs.mkdir(docsDir, { recursive: true });

function normalizePermalink(input, recordId) {
  if (!input) return `record/${recordId}/`;
  const clean = input.replace(/^\/+/, '');
  return clean.endsWith('/') ? clean : `${clean}/`;
}

function withBase(basePath, target) {
  if (!target) return target;
  if (/^[a-z]+:/i.test(target) || target.startsWith('//') || target.startsWith('#')) {
    return target;
  }
  return basePath ? `${basePath}${target}` : target;
}

function renderLayout({ title, description = '', basePath = '', content, extraHead = '' }) {
  const stylesheet = withBase(basePath, 'assets/css/style.css');
  const navLinks = [
    { href: 'index.html', label: 'Home' },
    { href: 'search/', label: 'Search' },
    { href: 'policies.html', label: 'Policies' }
  ]
    .map((link) => `<a href="${withBase(basePath, link.href)}">${link.label}</a>`)
    .join('\n            ');

  return `<!doctype html>
<html lang="en" data-base-path="${basePath}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <meta name="description" content="${description.replace(/"/g, '&quot;')}" />
    <link rel="stylesheet" href="${stylesheet}" />
    ${extraHead}
  </head>
  <body>
    <header>
      <div class="container">
        <nav>
          <h1><a href="${withBase(basePath, 'index.html')}" style="color: inherit; text-decoration: none;">Waypoint Digital Library</a></h1>
          <div class="links">
            ${navLinks}
          </div>
        </nav>
      </div>
    </header>
    <main>
      <div class="container">
        ${content}
      </div>
    </main>
    <footer>
      <div class="container">
        <p>&copy; ${new Date().getFullYear()} Waypoint Institute Library Editions · Built as a static GitHub Pages site.</p>
      </div>
    </footer>
  </body>
</html>`;
}

async function loadRecords() {
  const files = await fs.readdir(recordsDir);
  const records = [];

  for (const file of files) {
    if (extname(file) !== '.json') continue;
    const raw = await fs.readFile(join(recordsDir, file), 'utf8');
    const data = JSON.parse(raw);
    const permalink = normalizePermalink(data.identifiers?.permalink, data.record_id);
    records.push({
      ...data,
      permalink,
    });
  }

  records.sort((a, b) => {
    const dateA = Number(b.date ?? 0) - Number(a.date ?? 0);
    if (dateA !== 0) return dateA;
    return a.title.localeCompare(b.title);
  });

  return records;
}

function renderHome(records) {
  const hero = `
    <section class="hero">
      <div>
        <h2>Scholarly editions, ready for the web.</h2>
        <p>Waypoint Digital Library curates open-access texts with reliable metadata, downloadable formats, and clean reading experiences. Everything you see here is generated ahead of time and committed directly to this repository.</p>
      </div>
      <div class="notice">Browse recent arrivals below or jump straight to the <a href="search/">search interface</a> to filter by subject, collection, or year.</div>
    </section>
  `;

  const cards = records
    .slice(0, 6)
    .map((record) => {
      const subjects = (record.subjects ?? []).slice(0, 3).map((subject) => `<span>${subject}</span>`).join(' ');
      const meta = [record.creators?.join(', '), record.date].filter(Boolean).join(' · ');
      return `
        <article class="card">
          <h3><a href="${record.permalink}">${record.title}</a></h3>
          <p>${meta}</p>
          ${subjects ? `<p class="meta">${subjects}</p>` : ''}
          <a class="badge" href="${record.permalink}">View record</a>
        </article>
      `;
    })
    .join('\n');

  return `${hero}
    <section>
      <h2>Latest additions</h2>
      <div class="cards">
        ${cards}
      </div>
    </section>
  `;
}

function renderRecord(record) {
  const basePath = '../../';
  const downloads = record.downloads ?? {};
  const downloadLabels = { html: 'Read Online', epub: 'Download EPUB', pdf: 'Download PDF' };
  const downloadButtons = Object.entries(downloads)
    .filter(([, href]) => Boolean(href))
    .map(([key, href]) => `<a href="${withBase(basePath, href)}">${downloadLabels[key] ?? key.toUpperCase()}</a>`)
    .join('\n');

  const subjectBadges = (record.subjects ?? []).map((subject) => `<span>${subject}</span>`).join(' ');

  const metadataRows = [
    ['Year', record.date ?? '—'],
    ['Language', record.language ?? '—'],
    ['Collection', record.collection ?? '—'],
    ['Type', record.type ?? '—'],
    ['Rights', record.rights ?? '—'],
    ['Source', record.source_url ? `<a href="${record.source_url}">${record.source_url}</a>` : '—'],
  ]
    .map(([label, value]) => `<tr><th scope="row">${label}</th><td>${value}</td></tr>`)
    .join('\n');

  const citation = record.citation ?? {};
  const citationMarkup = Object.entries(citation)
    .map(([style, text]) => `<p><strong>${style.toUpperCase()}:</strong> ${text}</p>`)
    .join('\n');

  const contributors = (record.contributors ?? [])
    .map((person) => `${person.name} (${person.role})`)
    .join(', ');

  return renderLayout({
    title: `${record.title} — Waypoint Digital Library`,
    description: record.abstract ?? record.title,
    basePath,
    content: `
      <article class="record-hero">
        <div>
          <h2>${record.title}</h2>
          <p class="meta">${[record.creators?.join(', '), contributors, record.date].filter(Boolean).join(' · ')}</p>
          <div class="downloads">${downloadButtons || '<span>No downloads available.</span>'}</div>
          ${subjectBadges ? `<p class="meta">${subjectBadges}</p>` : ''}
          ${record.abstract ? `<p>${record.abstract}</p>` : ''}
        </div>
        <aside class="record-meta">
          <table>
            <tbody>
              ${metadataRows}
            </tbody>
          </table>
          ${record.quality_grade ? `<p class="badge">Quality grade: ${record.quality_grade}</p>` : ''}
        </aside>
      </article>
      ${citationMarkup ? `<section class="citation"><h3>Citation</h3>${citationMarkup}</section>` : ''}
    `,
  });
}

function renderSearchPage() {
  const basePath = '../';
  return renderLayout({
    title: 'Search — Waypoint Digital Library',
    description: 'Search open-access records across the Waypoint Digital Library.',
    basePath,
    extraHead: `<script type="module" src="${withBase(basePath, 'assets/js/search.js')}"></script>`,
    content: `
      <section class="grid-two">
        <div class="search-panel">
          <div>
            <label for="search-input">Keyword</label>
            <input id="search-input" name="q" type="search" placeholder="Search by title, author, or subject" />
          </div>
          <div>
            <label for="collection-select">Collection</label>
            <select id="collection-select" name="collection">
              <option value="">Any collection</option>
            </select>
          </div>
          <div>
            <label for="subject-select">Subject</label>
            <select id="subject-select" name="subject">
              <option value="">Any subject</option>
            </select>
          </div>
          <p class="meta" data-total>0 records</p>
        </div>
        <div>
          <ul class="results-list" data-results></ul>
          <p data-empty hidden>No records match your filters yet. Try widening your search.</p>
        </div>
      </section>
    `,
  });
}

function renderPoliciesPage() {
  return renderLayout({
    title: 'Policies — Waypoint Digital Library',
    description: 'Rights, preservation, and acquisition policies for the Waypoint Digital Library.',
    basePath: '',
    content: `
      <section class="hero">
        <div>
          <h2>Collection development &amp; rights</h2>
          <p>We focus on public-domain and openly licensed texts suitable for research and teaching. Every item is vetted for provenance, rights status, and editorial quality before publication.</p>
        </div>
      </section>
      <section>
        <h3>Acquisition principles</h3>
        <ul>
          <li>Preference for texts with established scholarly value or instructional demand.</li>
          <li>Source materials must be public domain or released under an open license compatible with redistribution.</li>
          <li>Digital assets over 25&nbsp;MB are mirrored to long-term repositories such as Zenodo or the Internet Archive.</li>
        </ul>
        <h3>Editorial guarantees</h3>
        <ul>
          <li>Each edition is proofed and assigned a quality grade (A–C).</li>
          <li>Downloads include EPUB, PDF, and an accessible HTML reading view.</li>
          <li>Metadata is checked for completeness and accuracy prior to deployment.</li>
        </ul>
        <h3>Takedowns</h3>
        <p>To request a takedown or raise a rights concern, open an issue using the <em>Takedown request</em> template or email <a href="mailto:library@waypoint.example">library@waypoint.example</a>. We respond within five business days.</p>
      </section>
    `,
  });
}

function buildSearchIndex(records) {
  return records.map((record) => ({
    id: record.record_id,
    title: record.title,
    creators: record.creators ?? [],
    subjects: record.subjects ?? [],
    collection: record.collection ?? null,
    year: record.date ?? null,
    lang: record.language ?? null,
    quality: record.quality_grade ?? null,
    permalink: record.permalink,
  }));
}

(async () => {
  const records = await loadRecords();

  // Home page
  const homeHtml = renderLayout({
    title: 'Waypoint Digital Library',
    description: 'A pre-built static library site with dependable metadata and multi-format downloads.',
    basePath: '',
    content: renderHome(records),
  });
  await fs.writeFile(join(docsDir, 'index.html'), homeHtml);

  // Record pages
  for (const record of records) {
    const filepath = join(docsDir, record.permalink);
    await fs.mkdir(filepath, { recursive: true });
    const html = renderRecord(record);
    await fs.writeFile(join(filepath, 'index.html'), html);
  }

  // Search index
  const searchIndex = buildSearchIndex(records);
  const searchPayload = JSON.stringify(searchIndex, null, 2) + '\n';
  await fs.mkdir(join(docsDir, 'search'), { recursive: true });
  await fs.writeFile(join(docsDir, 'search', 'index.json'), searchPayload);
  await fs.writeFile(join(root, 'search', 'index.json'), searchPayload);

  // Search page
  const searchHtml = renderSearchPage();
  await fs.writeFile(join(docsDir, 'search', 'index.html'), searchHtml);

  // Policies page
  const policiesHtml = renderPoliciesPage();
  await fs.writeFile(join(docsDir, 'policies.html'), policiesHtml);

  console.log(`Built site with ${records.length} record${records.length === 1 ? '' : 's'}.`);
})();
