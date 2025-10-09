import { promises as fs } from 'node:fs';
import { join, extname, dirname } from 'node:path';

const root = process.cwd();
const docsDir = join(root, 'docs');
const recordsDir = join(root, '_records');
const siteName = 'Waypoint Digital Library';

await fs.mkdir(docsDir, { recursive: true });
await Promise.all([
  fs.writeFile(join(docsDir, '.nojekyll'), ''),
  fs.writeFile(join(root, '.nojekyll'), ''),
]);

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function toDataAttribute(payload) {
  return escapeHtml(JSON.stringify(payload));
}

function slugify(value = '') {
  return value
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'category';
}

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

function renderLayout({
  title,
  description = '',
  basePath = '',
  content,
  extraHead = '',
  footerScripts = [],
  bodyClass = '',
}) {
  const stylesheet = withBase(basePath, 'assets/css/style.css');
  const navLinks = [
    { href: 'index.html', label: 'Home' },
    { href: 'search/', label: 'Search' },
    { href: 'policies.html', label: 'Policies' },
  ]
    .map((link) => `<a href="${withBase(basePath, link.href)}">${link.label}</a>`)
    .join('\n            ');

  const scriptTags = footerScripts
    .map((src) => `<script type="module" src="${withBase(basePath, src)}"></script>`)
    .join('\n    ');

  return `<!doctype html>
<html lang="en" data-base-path="${basePath}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <link rel="stylesheet" href="${stylesheet}" />
    ${extraHead}
  </head>
  <body${bodyClass ? ` class="${bodyClass}"` : ''}>
    <header>
      <div class="container">
        <nav>
          <h1><a href="${withBase(basePath, 'index.html')}" class="brand">${siteName}</a></h1>
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
    ${scriptTags}
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
    const yearDiff = Number(b.date ?? 0) - Number(a.date ?? 0);
    if (yearDiff !== 0) return yearDiff;
    return a.title.localeCompare(b.title);
  });

  return records;
}

function deriveGenres(record) {
  const explicit = Array.isArray(record.genres) ? record.genres.filter(Boolean) : [];
  const subjects = Array.isArray(record.subjects) ? record.subjects : [];
  const derived = new Set(explicit.map((genre) => genre.trim()).filter(Boolean));

  const subjectHints = [
    'Fiction',
    'Novel',
    'Romance',
    'Drama',
    'Poetry',
    'Biography',
    'Memoir',
    'Theology',
    'History',
    'Philosophy',
    'Autobiography',
  ];

  for (const subject of subjects) {
    if (!subject) continue;
    for (const hint of subjectHints) {
      if (subject.toLowerCase().includes(hint.toLowerCase())) {
        derived.add(hint);
      }
    }
  }

  if (!derived.size && record.type) {
    derived.add(record.type.charAt(0).toUpperCase() + record.type.slice(1));
  }

  return Array.from(derived).map((label) => label.replace(/\b([a-z])/g, (match) => match.toUpperCase()));
}

function computeStats(records) {
  const subjectSet = new Set();
  const collectionSet = new Set();
  const years = [];

  for (const record of records) {
    (record.subjects ?? []).forEach((subject) => subjectSet.add(subject));
    if (record.collection) collectionSet.add(record.collection);
    if (record.date) years.push(Number(record.date));
  }

  const earliestYear = years.length ? Math.min(...years) : null;
  const latestYear = years.length ? Math.max(...years) : null;

  return {
    totalRecords: records.length,
    totalSubjects: subjectSet.size,
    totalCollections: collectionSet.size,
    earliestYear,
    latestYear,
  };
}

function computeShelves(records) {
  const fictionRecords = [];
  const nonfictionRecords = [];
  const genreGroups = new Map();

  for (const record of records) {
    const genres = deriveGenres(record);
    const subjectString = (record.subjects ?? []).join(' ').toLowerCase();
    const isFiction =
      genres.some((genre) => /fiction|novel|romance|fantasy|poetry|drama/.test(genre.toLowerCase())) ||
      /fiction|novel|romance|literature|fantasy|story/.test(subjectString);
    const isNonfiction =
      genres.some((genre) => /non[- ]?fiction|memoir|biography|essay|history|theology|philosophy/.test(genre.toLowerCase())) ||
      !isFiction;

    if (isFiction) fictionRecords.push(record);
    if (isNonfiction) nonfictionRecords.push(record);

    for (const genre of genres) {
      const normalized = genre.trim();
      if (!normalized) continue;
      const slug = slugify(normalized);
      if (!genreGroups.has(slug)) {
        genreGroups.set(slug, { name: normalized, slug, records: [] });
      }
      genreGroups.get(slug).records.push(record);
    }
  }

  const sortedGenres = Array.from(genreGroups.values())
    .sort((a, b) => {
      if (b.records.length !== a.records.length) return b.records.length - a.records.length;
      return a.name.localeCompare(b.name);
    })
    .map((group) => ({
      ...group,
      records: group.records.slice(0, 12),
    }));

  const carousels = [
    {
      id: 'fiction',
      title: 'Fiction shelf',
      description: 'Novels and imaginative literature to explore.',
      accent: 'rose',
      records: fictionRecords.slice(0, 12),
    },
    {
      id: 'nonfiction',
      title: 'Ideas & non-fiction shelf',
      description: 'Memoir, philosophy, sermons, and other grounded writing.',
      accent: 'teal',
      records: nonfictionRecords.slice(0, 12),
    },
  ].filter((shelf) => shelf.records.length > 0);

  return {
    heroRecords: records.slice(0, 6),
    carousels,
    genres: sortedGenres,
  };
}

function renderRecordCard(record, { basePath = '', compact = false, showCta = true } = {}) {
  const classes = ['card'];
  if (compact) classes.push('card--compact');
  const meta = [
    Array.isArray(record.creators) ? record.creators.join(', ') : null,
    record.date ?? null,
  ]
    .filter(Boolean)
    .join(' · ');
  const subjects = (record.subjects ?? [])
    .slice(0, compact ? 2 : 3)
    .map((subject) => `<span>${escapeHtml(subject)}</span>`)
    .join(' ');

  return `
    <article class="${classes.join(' ')}" data-record-id="${record.record_id}">
      <h3><a href="${withBase(basePath, record.permalink)}">${escapeHtml(record.title)}</a></h3>
      ${meta ? `<p class="meta">${escapeHtml(meta)}</p>` : ''}
      ${subjects ? `<p class="meta meta--tags">${subjects}</p>` : ''}
      ${showCta ? `<a class="badge" href="${withBase(basePath, record.permalink)}">View record</a>` : ''}
    </article>
  `;
}

function renderHeroSpotlight(record) {
  if (!record) {
    return `<div class="hero-spotlight-card empty">New titles are on the way. Explore the shelves below.</div>`;
  }

  const genres = deriveGenres(record).slice(0, 3).map((genre) => `<span>${escapeHtml(genre)}</span>`).join('');
  const meta = [
    Array.isArray(record.creators) ? record.creators.join(', ') : null,
    record.date ?? null,
  ]
    .filter(Boolean)
    .join(' · ');

  return `
    <div class="hero-spotlight-card" data-hero-card data-record="${record.record_id}">
      <p class="eyebrow">Spotlight edition</p>
      <h3>${escapeHtml(record.title)}</h3>
      ${meta ? `<p class="meta">${escapeHtml(meta)}</p>` : ''}
      ${genres ? `<p class="meta meta--tags">${genres}</p>` : ''}
      <a class="button" href="${record.permalink}">View record</a>
    </div>
  `;
}

function renderHome(records, stats, shelves) {
  const heroPayload = toDataAttribute(
    shelves.heroRecords.map((record) => ({
      id: record.record_id,
      title: record.title,
      permalink: record.permalink,
      creators: record.creators ?? [],
      year: record.date ?? null,
      genres: deriveGenres(record),
      subjects: record.subjects ?? [],
    })),
  );

  const shelfPayload = toDataAttribute({
    carousels: shelves.carousels.map((shelf) => ({
      id: shelf.id,
      title: shelf.title,
      description: shelf.description,
      accent: shelf.accent,
      records: shelf.records.map((record) => ({
        id: record.record_id,
        title: record.title,
        permalink: record.permalink,
        creators: record.creators ?? [],
        year: record.date ?? null,
        subjects: record.subjects ?? [],
        genres: deriveGenres(record),
      })),
    })),
    genres: shelves.genres.map((group) => ({
      name: group.name,
      slug: group.slug,
      records: group.records.map((record) => ({
        id: record.record_id,
        title: record.title,
        permalink: record.permalink,
        creators: record.creators ?? [],
        year: record.date ?? null,
        subjects: record.subjects ?? [],
        genres: deriveGenres(record),
      })),
    })),
  });

  const carouselMarkup = shelves.carousels
    .map(
      (shelf) => `
        <section class="shelf" data-shelf data-shelf-id="${shelf.id}">
          <header>
            <div>
              <h3>${escapeHtml(shelf.title)}</h3>
              <p>${escapeHtml(shelf.description)}</p>
            </div>
            <div class="shelf-controls">
              <button type="button" class="shelf-btn prev" data-shelf-prev aria-label="Scroll backward through ${escapeHtml(shelf.title)}">&#8592;</button>
              <button type="button" class="shelf-btn next" data-shelf-next aria-label="Scroll forward through ${escapeHtml(shelf.title)}">&#8594;</button>
            </div>
          </header>
          <div class="shelf-track" data-shelf-track>
            ${shelf.records.map((record) => renderRecordCard(record)).join('\n')}
          </div>
        </section>
      `,
    )
    .join('\n');

  const genreButtons = shelves.genres
    .slice(0, 8)
    .map((group, index) => `
      <button type="button" data-genre-switch="${group.slug}"${index === 0 ? ' class="is-active"' : ''}>
        ${escapeHtml(group.name)}
        <span aria-hidden="true">${group.records.length}</span>
      </button>
    `)
    .join('\n');

  const genrePanels = shelves.genres
    .slice(0, 8)
    .map((group, index) => `
      <div class="genre-panel${index === 0 ? ' is-active' : ''}" data-genre-panel="${group.slug}">
        ${group.records.map((record) => renderRecordCard(record, { compact: true, showCta: false })).join('\n')}
      </div>
    `)
    .join('\n');

  const statsMarkup = `
    <section class="metrics" aria-label="Library metrics">
      <dl class="stats-grid">
        <div>
          <dt>Total records</dt>
          <dd data-stat="records" data-target="${stats.totalRecords}">${stats.totalRecords}</dd>
        </div>
        <div>
          <dt>Subjects covered</dt>
          <dd data-stat="subjects" data-target="${stats.totalSubjects}">${stats.totalSubjects}</dd>
        </div>
        <div>
          <dt>Collections</dt>
          <dd data-stat="collections" data-target="${stats.totalCollections}">${stats.totalCollections}</dd>
        </div>
        <div>
          <dt>Publication span</dt>
          <dd>${stats.earliestYear ?? '—'} – ${stats.latestYear ?? '—'}</dd>
        </div>
      </dl>
    </section>
  `;

  return `
    <section class="hero dynamic-hero" data-hero data-hero-payload="${heroPayload}">
      <div class="hero-copy">
        <p class="eyebrow">A living, client-side digital library</p>
        <h2>Scholarly editions, animated for curious readers.</h2>
        <p>Search ${stats.totalRecords} catalogued works or glide along interactive shelves arranged by genre, fiction, and non-fiction.</p>
        <div class="hero-actions">
          <a class="button primary" href="search/">Launch advanced search</a>
          <button type="button" class="button ghost" data-hero-cycle>Shuffle spotlight</button>
        </div>
      </div>
      <div class="hero-spotlight" data-hero-spotlight>
        ${renderHeroSpotlight(shelves.heroRecords[0])}
      </div>
    </section>
    ${statsMarkup}
    <section class="shelf-collection" data-shelves data-shelf-payload="${shelfPayload}">
      <header>
        <h2>Interactive shelves</h2>
        <p>Slide through curated sequences or focus on a genre to see what resonates.</p>
      </header>
      <div class="shelf-wrap">
        ${carouselMarkup || '<p>No shelves yet — add more records to populate this space.</p>'}
      </div>
      <section class="genre-shelf" data-genre-shelf>
        <header>
          <h3>Browse by genre</h3>
          <p>Pick a genre to populate a living gallery of related works. Use your keyboard arrow keys or scroll to skim.</p>
        </header>
        <div class="genre-controls" data-genre-controls>
          ${genreButtons || '<p class="meta">Genres populate automatically once records include genre metadata.</p>'}
        </div>
        <div class="genre-panels" data-genre-panels>
          ${genrePanels || ''}
        </div>
      </section>
    </section>
    <section class="cta">
      <div>
        <h2>Ready for deeper exploration?</h2>
        <p>Every record includes downloadable EPUB, PDF, and HTML reading experiences, plus citations and provenance.</p>
      </div>
      <div class="cta-actions">
        <a class="button primary" href="search/">Dive into search</a>
        <a class="button" href="policies.html">Read our editorial policies</a>
      </div>
    </section>
  `;
}

function buildMetadataRows(record) {
  return [
    ['Year', record.date ?? '—'],
    ['Language', record.language ?? '—'],
    ['Collection', record.collection ?? '—'],
    ['Type', record.type ?? '—'],
    ['Rights', record.rights ?? '—'],
    [
      'Source',
      record.source_url ? `<a href="${record.source_url}">${escapeHtml(record.source_url)}</a>` : '—',
    ],
  ]
    .map(([label, value]) => `<tr><th scope="row">${label}</th><td>${value}</td></tr>`)
    .join('\n');
}

function getRelatedRecords(current, records, limit = 4) {
  const subjectSet = new Set(current.subjects ?? []);
  const genreSet = new Set(deriveGenres(current));

  const scored = [];
  for (const candidate of records) {
    if (candidate.record_id === current.record_id) continue;
    let score = 0;
    for (const subject of candidate.subjects ?? []) {
      if (subjectSet.has(subject)) score += 3;
    }
    const candidateGenres = deriveGenres(candidate);
    for (const genre of candidateGenres) {
      if (genreSet.has(genre)) score += 4;
    }
    if (current.collection && candidate.collection === current.collection) {
      score += 2;
    }
    if (score > 0) {
      scored.push({ record: candidate, score });
    }
  }

  return scored
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.record.title.localeCompare(b.record.title);
    })
    .slice(0, limit)
    .map((entry) => entry.record);
}

function renderRecord(record, allRecords) {
  const basePath = '../../';
  const downloads = record.downloads ?? {};
  const downloadLabels = {
    html: 'Read online',
    epub: 'Download EPUB',
    pdf: 'Download PDF',
  };
  const downloadButtons = Object.entries(downloads)
    .filter(([, href]) => Boolean(href))
    .map(
      ([key, href]) =>
        `<a class="button" data-download="${key}" href="${withBase(basePath, href)}">${downloadLabels[key] ?? key.toUpperCase()}</a>`,
    )
    .join('\n');

  const subjectBadges = (record.subjects ?? [])
    .map((subject) => `<span>${escapeHtml(subject)}</span>`)
    .join(' ');
  const metadataRows = buildMetadataRows(record);
  const citationEntries = Object.entries(record.citation ?? {});
  const relatedRecords = getRelatedRecords(record, allRecords);

  const recordPayload = toDataAttribute({
    id: record.record_id,
    subjects: record.subjects ?? [],
    genres: deriveGenres(record),
    collection: record.collection ?? null,
    title: record.title,
    permalink: record.permalink,
  });

  const citationMarkup = citationEntries.length
    ? `
      <section class="citation" data-citation>
        <h3>Citation</h3>
        <div id="citation-${record.record_id}" data-citation-body>
          <ul>
            ${citationEntries
              .map(
                ([style, text]) =>
                  `<li><span class="citation-style">${style.toUpperCase()}</span><span class="citation-text">${escapeHtml(text)}</span></li>`,
              )
              .join('\n')}
          </ul>
        </div>
        <div class="citation-actions">
          <button type="button" class="button ghost" data-copy-citation data-copy-target="#citation-${record.record_id}">Copy all citations</button>
          <span class="copy-status" data-copy-status aria-live="polite"></span>
        </div>
      </section>
    `
    : '';

  const relatedMarkup = relatedRecords.length
    ? relatedRecords
        .map((item) => renderRecordCard(item, { basePath, compact: true }))
        .join('\n')
    : '<p class="meta">More related titles will appear as the catalogue grows.</p>';

  return renderLayout({
    title: `${record.title} — ${siteName}`,
    description: record.abstract ?? record.title,
    basePath,
    bodyClass: 'page-record',
    footerScripts: ['assets/js/record.js'],
    content: `
      <article class="record-hero">
        <div>
          <p class="eyebrow">${record.quality_grade ? `Quality grade ${escapeHtml(record.quality_grade)}` : 'Library record'}</p>
          <h2>${escapeHtml(record.title)}</h2>
          <p class="meta">${[
            Array.isArray(record.creators) ? record.creators.join(', ') : null,
            (record.contributors ?? []).map((person) => `${person.name} (${person.role})`).join(', ') || null,
            record.date ?? null,
          ]
            .filter(Boolean)
            .join(' · ')}</p>
          <div class="downloads">${downloadButtons || '<span>No downloads available.</span>'}</div>
          ${subjectBadges ? `<p class="meta meta--tags">${subjectBadges}</p>` : ''}
          ${record.abstract ? `<p>${escapeHtml(record.abstract)}</p>` : ''}
        </div>
        <aside class="record-meta">
          <table>
            <tbody>
              ${metadataRows}
            </tbody>
          </table>
        </aside>
      </article>
      ${citationMarkup}
      <section class="related" data-related data-related-payload="${recordPayload}">
        <h3>More to explore</h3>
        <div class="related-grid" data-related-list>
          ${relatedMarkup}
        </div>
      </section>
    `,
  });
}

function renderSearchPage(records, stats, shelves) {
  const basePath = '../';
  const genrePreview = shelves.genres.slice(0, 3);

  const previewMarkup = genrePreview.length
    ? genrePreview
        .map(
          (group) => `
          <article class="preview-group">
            <h4>${escapeHtml(group.name)}</h4>
            <div class="preview-track">
              ${group.records
                .slice(0, 3)
                .map((record) => {
                  const meta = [
                    Array.isArray(record.creators) ? record.creators.join(', ') : null,
                    record.date ?? null,
                  ]
                    .filter(Boolean)
                    .join(' · ');
                  return `
                    <a class="preview-card" href="${withBase(basePath, record.permalink)}">
                      <span class="preview-title">${escapeHtml(record.title)}</span>
                      <span class="preview-meta">${escapeHtml(meta)}</span>
                    </a>
                  `;
                })
                .join('')}
            </div>
          </article>
        `,
        )
        .join('\n')
    : '<p class="meta">Add more records to populate the preview shelves.</p>';

  return renderLayout({
    title: `Search — ${siteName}`,
    description: 'Search open-access records across the Waypoint Digital Library with live filters and genre shelves.',
    basePath,
    bodyClass: 'page-search',
    footerScripts: ['assets/js/search.js'],
    content: `
      <section class="search-hero">
        <div>
          <p class="eyebrow">Deep catalogue search</p>
          <h2>Filter ${stats.totalRecords} records in real time.</h2>
          <p>Search by keyword, collection, subject, or genre. Active filters appear as removable chips so you can experiment.</p>
        </div>
      </section>
      <section class="search-shell" data-search-root>
        <form class="search-form" data-search-form>
          <div class="field">
            <label for="search-input">Keyword</label>
            <input id="search-input" name="q" type="search" autocomplete="off" placeholder="Search by title, author, or subject" data-search-input />
          </div>
          <div class="field-grid">
            <label>
              <span>Collection</span>
              <select name="collection" data-filter-collection>
                <option value="">Any collection</option>
              </select>
            </label>
            <label>
              <span>Subject</span>
              <select name="subject" data-filter-subject>
                <option value="">Any subject</option>
              </select>
            </label>
            <label>
              <span>Genre</span>
              <select name="genre" data-filter-genre>
                <option value="">Any genre</option>
              </select>
            </label>
          </div>
          <div class="active-filters" data-active-filters role="list" aria-live="polite"></div>
          <div class="form-footer">
            <button type="button" class="button ghost" data-clear>Clear filters</button>
            <p data-total>Loading index…</p>
          </div>
        </form>
        <div class="search-results">
          <ol class="results-list" data-results></ol>
          <p class="empty" data-empty hidden>No records match your filters yet. Try widening your search terms.</p>
        </div>
      </section>
      <section class="search-shelves" data-shelf-preview>
        <header>
          <h3>Preview the interactive shelves</h3>
          <p>Jump into a shelf sequence or open a record to keep exploring.</p>
        </header>
        <div class="shelf-preview" data-shelf-preview-grid>
          ${previewMarkup}
        </div>
      </section>
    `,
  });
}

function renderPoliciesPage() {
  return renderLayout({
    title: `Policies — ${siteName}`,
    description: 'Rights, preservation, and acquisition policies for the Waypoint Digital Library.',
    basePath: '',
    bodyClass: 'page-policies',
    content: `
      <section class="hero">
        <div>
          <h2>Collection development &amp; rights</h2>
          <p>We focus on public-domain and openly licensed texts suitable for research and teaching. Every item is vetted for provenance, rights status, and editorial quality before publication.</p>
        </div>
      </section>
      <section class="policy-grid">
        <article>
          <h3>Acquisition principles</h3>
          <ul>
            <li>Preference for texts with established scholarly value or instructional demand.</li>
            <li>Source materials must be public domain or released under an open license compatible with redistribution.</li>
            <li>Digital assets over 25&nbsp;MB are mirrored to long-term repositories such as Zenodo or the Internet Archive.</li>
          </ul>
        </article>
        <article>
          <h3>Editorial guarantees</h3>
          <ul>
            <li>Each edition is proofed and assigned a quality grade (A–C).</li>
            <li>Downloads include EPUB, PDF, and an accessible HTML reading view.</li>
            <li>Metadata is checked for completeness and accuracy prior to deployment.</li>
          </ul>
        </article>
        <article>
          <h3>Takedowns</h3>
          <p>To request a takedown or raise a rights concern, open an issue using the <em>Takedown request</em> template or email <a href="mailto:library@waypoint.example">library@waypoint.example</a>. We respond within five business days.</p>
        </article>
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
    genres: deriveGenres(record),
    collection: record.collection ?? null,
    year: record.date ?? null,
    lang: record.language ?? null,
    quality: record.quality_grade ?? null,
    permalink: record.permalink,
  }));
}

function redirectMarkup(target, message = 'Redirecting…') {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta http-equiv="refresh" content="0; url=${target}" />
    <link rel="canonical" href="${target}" />
    <title>${message}</title>
    <style>
      body { font-family: system-ui, sans-serif; line-height: 1.5; padding: 3rem; text-align: center; }
      a { color: #0f4c81; }
    </style>
  </head>
  <body>
    <p>${message} If you are not redirected automatically, <a href="${target}">continue to ${target}</a>.</p>
  </body>
</html>`;
}

async function writeRedirect(relativePath, target, message) {
  const destination = join(root, relativePath);
  await fs.mkdir(dirname(destination), { recursive: true });
  await fs.writeFile(destination, redirectMarkup(target, message));
}

(async () => {
  const records = await loadRecords();
  const stats = computeStats(records);
  const shelves = computeShelves(records);

  const homeHtml = renderLayout({
    title: siteName,
    description: 'A pre-built static library site with dynamic shelves, search, and dependable metadata.',
    basePath: '',
    bodyClass: 'page-home',
    footerScripts: ['assets/js/home.js'],
    content: renderHome(records, stats, shelves),
  });
  await fs.writeFile(join(docsDir, 'index.html'), homeHtml);

  for (const record of records) {
    const filepath = join(docsDir, record.permalink);
    await fs.mkdir(filepath, { recursive: true });
    const html = renderRecord(record, records);
    await fs.writeFile(join(filepath, 'index.html'), html);
  }

  const searchIndex = JSON.stringify(buildSearchIndex(records), null, 2) + '\n';
  await fs.mkdir(join(docsDir, 'search'), { recursive: true });
  await fs.writeFile(join(docsDir, 'search', 'index.json'), searchIndex);
  await fs.writeFile(join(root, 'search', 'index.json'), searchIndex);

  const searchHtml = renderSearchPage(records, stats, shelves);
  await fs.writeFile(join(docsDir, 'search', 'index.html'), searchHtml);

  const policiesHtml = renderPoliciesPage();
  await fs.writeFile(join(docsDir, 'policies.html'), policiesHtml);

  await Promise.all([
    writeRedirect('index.html', 'docs/index.html', 'Redirecting to the Waypoint Digital Library'),
    writeRedirect('policies.html', 'docs/policies.html', 'Redirecting to policies'),
    writeRedirect('search/index.html', '../docs/search/', 'Redirecting to search'),
    writeRedirect('404.html', 'docs/index.html', 'Page not found — redirecting to the library home'),
  ]);

  await Promise.all(
    records.map((record) =>
      writeRedirect(
        join('record', record.record_id, 'index.html'),
        `docs/record/${record.record_id}/`,
        `Redirecting to ${record.title}`,
      ),
    ),
  );

  console.log(`Built site with ${records.length} record${records.length === 1 ? '' : 's'}.`);
})();
