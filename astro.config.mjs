import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import alpine from '@astrojs/alpinejs';

export default defineConfig({
  site: 'https://example.github.io/waypoint-library',
  integrations: [
    tailwind({
      applyBaseStyles: false
    }),
    alpine()
  ],
  markdown: {
    syntaxHighlight: 'prism'
  },
  build: {
    outDir: 'docs'
  }
});
