const basePath = document.documentElement.dataset.basePath || document.body.dataset.basePath || '';

function resolveUrl(path) {
  if (/^[a-z]+:/i.test(path) || path.startsWith('//')) return path;
  return `${basePath}${path}`;
}

function safeParse(value, fallback) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch (error) {
    console.warn('Unable to parse related payload', error);
    return fallback;
  }
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderCompactCard(record) {
  const metaParts = [];
  if (Array.isArray(record.creators) && record.creators.length) {
    metaParts.push(record.creators.join(', '));
  }
  if (record.year) metaParts.push(record.year);
  const subjects = (record.subjects || [])
    .slice(0, 2)
    .map((subject) => `<span>${escapeHtml(subject)}</span>`)
    .join(' ');

  return `
    <article class="card card--compact">
      <h4><a href="${resolveUrl(record.permalink)}">${escapeHtml(record.title)}</a></h4>
      ${metaParts.length ? `<p class="meta">${escapeHtml(metaParts.join(' · '))}</p>` : ''}
      ${subjects ? `<p class="meta meta--tags">${subjects}</p>` : ''}
      <a class="badge" href="${resolveUrl(record.permalink)}">Open record</a>
    </article>
  `;
}

function computeRelated(current, records) {
  const subjectSet = new Set(current.subjects || []);
  const genreSet = new Set(current.genres || []);
  return records
    .filter((record) => record.id !== current.id)
    .map((record) => {
      let score = 0;
      (record.subjects || []).forEach((subject) => {
        if (subjectSet.has(subject)) score += 3;
      });
      (record.genres || []).forEach((genre) => {
        if (genreSet.has(genre)) score += 4;
      });
      if (current.collection && record.collection === current.collection) score += 2;
      return { record, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.record.year && a.record.year) return b.record.year - a.record.year;
      return a.record.title.localeCompare(b.record.title);
    })
    .slice(0, 4)
    .map((entry) => entry.record);
}

document.addEventListener('DOMContentLoaded', async () => {
  enhanceCopyButtons();
  await enhanceRelated();
});

function enhanceCopyButtons() {
  document.querySelectorAll('[data-copy-citation]').forEach((button) => {
    button.addEventListener('click', async () => {
      const targetSelector = button.dataset.copyTarget;
      const status = button.closest('.citation')?.querySelector('[data-copy-status]');
      const source = targetSelector ? document.querySelector(targetSelector) : null;
      const text = source ? source.textContent.trim() : '';
      if (!text) return;
      try {
        await navigator.clipboard.writeText(text);
        if (status) {
          status.textContent = 'Citations copied';
          setTimeout(() => {
            status.textContent = '';
          }, 2000);
        }
      } catch (error) {
        console.error('Unable to copy citation', error);
        if (status) status.textContent = 'Copy failed';
      }
    });
  });
}

async function enhanceRelated() {
  const related = document.querySelector('[data-related]');
  if (!related) return;
  const payload = safeParse(related.dataset.relatedPayload, null);
  if (!payload || !payload.id) return;
  const list = related.querySelector('[data-related-list]');
  if (!list) return;

  try {
    const response = await fetch(resolveUrl('search/index.json'), { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const index = await response.json();
    const relatedRecords = computeRelated(payload, index);
    if (!relatedRecords.length) return;
    list.innerHTML = relatedRecords.map(renderCompactCard).join('');
  } catch (error) {
    console.warn('Unable to populate related titles', error);
  }
}
