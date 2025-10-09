export interface BookSchemaOptions {
  id: string;
  title: string;
  creators: string[];
  date: number;
  language: string;
  description?: string;
  downloadHtml?: string | null;
  downloadPdf?: string | null;
  downloadEpub?: string | null;
  url: string;
}

export const buildBookJsonLd = (options: BookSchemaOptions) => ({
  '@context': 'https://schema.org',
  '@type': 'Book',
  '@id': options.url,
  url: options.url,
  name: options.title,
  inLanguage: options.language,
  author: options.creators.map((name) => ({ '@type': 'Person', name })),
  datePublished: options.date,
  description: options.description,
  isAccessibleForFree: true,
  offers: [
    options.downloadHtml && {
      '@type': 'Offer',
      url: options.downloadHtml,
      itemOffered: {
        '@type': 'DigitalDocument',
        encodingFormat: 'text/html'
      }
    },
    options.downloadPdf && {
      '@type': 'Offer',
      url: options.downloadPdf,
      itemOffered: {
        '@type': 'DigitalDocument',
        encodingFormat: 'application/pdf'
      }
    },
    options.downloadEpub && {
      '@type': 'Offer',
      url: options.downloadEpub,
      itemOffered: {
        '@type': 'DigitalDocument',
        encodingFormat: 'application/epub+zip'
      }
    }
  ].filter(Boolean)
});
