# Waypoint Digital Library

Waypoint Digital Library is a static-first reference implementation of a university-caliber digital library that can run entirely on GitHub Pages. The project pairs Astro, Tailwind CSS, and lightweight Alpine.js islands with a manual publishing workflow so you remain in full control of when builds run.

## Features

- **Astro + Tailwind UI:** Component-driven site shell with dark mode, responsive layouts, and reusable design primitives.
- **Record-driven architecture:** Catalog metadata is stored in `_records/` Markdown files with YAML front matter, while long-form works live in `books/<slug>/` folders.
- **Client-side discovery:** A prebuilt `/search/index.json` is queried with Fuse.js for search and filtering experiences.
- **Readers:** Inline PDF previews, EPUB reader shell, and placeholders for IIIF Mirador integration.
- **Local tooling:** Scripts in `scripts/` rebuild the search index and validate metadata before you commit updates.

## Repository Layout

```
src/
  components/      UI primitives such as RecordCard, MetadataTable, DownloadButtons
  layouts/         Base shells for records, search, policies, and reading views
  pages/           Astro routes for home, search, browse, record, and policies
  styles/          Tailwind base styles and long-form reading CSS
  data/            Controlled vocabularies and site settings
  lib/             Client helpers (search, facets, schema generators)
books/             Source Markdown for reading editions + book.yml metadata
_records/          Catalog metadata records with descriptive abstracts
search/index.json  Prebuilt search index (generated locally)
scripts/           Node utilities for indexing and validation
.github/           Issue templates and PR checklist
```

## Local Development

```bash
npm install
npm run dev
```

Run the helper scripts whenever you change records or book metadata:

```bash
node scripts/build-search-index.mjs
node scripts/validate-records.mjs
```

## Manual Deployment to GitHub Pages

Automated workflows have been removed so deploys happen only when you decide to publish. To ship a new version of the site:

1. Build the project locally. The Astro output is configured to write into the `docs/` folder so GitHub Pages can serve it directly.
   ```bash
   npm install
   npm run build
   ```
2. Commit the updated `docs/` directory along with any source changes and push to your repository.
3. In GitHub, open **Settings → Pages**. Under **Build and deployment**, choose **Source → Deploy from a branch**, select your publishing branch (for example `main`), and set the folder to `/docs`.
4. GitHub Pages will publish the contents of `docs/` straight from the branch. Repeat the build and commit process whenever you need to deploy updates.

## License

Released under the MIT License. See `LICENSE` for details.
