import './globals.css';
import type { Metadata, Viewport } from 'next';
import { cookies } from 'next/headers';
import NotFoundClient from './[lang]/NotFoundClient';
import { I18nProvider } from '@/components/I18nProvider';
import { DEFAULT_LOCALE, LOCALE_COOKIE, hasLocale, type Dictionary, type Locale } from './[lang]/dictionaries';

/* ---------------------------------------------------------
   ONEPLAY — 404 for URLs that match no route at all

   `app/[lang]/not-found.tsx` covers `notFound()` inside the app, but every
   route here sits under a top-level dynamic segment, so there is no root
   layout for Next to compose a global 404 from — which is exactly the case
   this file exists for (see not-found.md in the bundled docs). It bypasses
   layouts entirely, so the document, the stylesheet and the fonts are all
   ours to render, and the locale comes from the cookie the proxy writes
   rather than from a route parameter that does not exist here.
--------------------------------------------------------- */

const dictionaries: Record<Locale, () => Promise<Dictionary>> = {
  en: () => import('./[lang]/dictionaries/en.json').then((module) => module.default),
  th: () => import('./[lang]/dictionaries/th.json').then((module) => module.default)
};

async function readLocale(): Promise<Locale> {
  const saved = (await cookies()).get(LOCALE_COOKIE)?.value;
  return hasLocale(saved) ? saved : DEFAULT_LOCALE;
}

export async function generateMetadata(): Promise<Metadata> {
  const dict = await dictionaries[await readLocale()]();
  return { title: dict.notFound.metaTitle, description: dict.notFound.metaDescription };
}

export const viewport: Viewport = {
  themeColor: '#1B1D26',
  colorScheme: 'light'
};

export default async function GlobalNotFound() {
  const locale = await readLocale();
  const dict = await dictionaries[locale]();

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font -- no layout to hang this on */}
        <link
          href="https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@300;400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {/* No nav or footer — but the page still renders game cards and links,
            which read the dictionary, so the provider comes along. */}
        <I18nProvider locale={locale} dict={dict}>
          <NotFoundClient dict={dict.notFound} />
        </I18nProvider>
      </body>
    </html>
  );
}
