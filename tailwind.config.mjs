import { join } from 'node:path';

export default {
  content: [
    join('src', '**', '*.{astro,js,jsx,ts,tsx,mdx}')
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui'],
        serif: ['"Source Serif 4"', 'ui-serif', 'Georgia']
      },
      colors: {
        primary: {
          50: '#f2f5ff',
          100: '#dce6ff',
          500: '#3651ff',
          700: '#2537b5'
        }
      }
    }
  },
  plugins: []
};
