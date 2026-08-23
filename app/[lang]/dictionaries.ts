/* ---------------------------------------------------------
   ONEPLAY — translations

   Every route lives under app/[lang], so `lang` is a root
   parameter and any Server Component or server-side helper can
   read it without being handed it. See the Next guide bundled
   with this version: node_modules/next/dist/docs/01-app/
   02-guides/internationalization.md

   Root parameter getters do NOT work in Client Components,
   Server Actions or Route Handlers — those read the locale from
   the cookie the proxy sets, or from a form field.
--------------------------------------------------------- */

import { lang } from 'next/root-params';
import { notFound } from 'next/navigation';
import type en from './dictionaries/en.json';

/** The shape every language file has to match — English is the reference. */
export type Dictionary = typeof en;

/** A language this app ships. */
export type Locale = 'en' | 'th';

const dictionaries: Record<Locale, () => Promise<Dictionary>> = {
  en: () => import('./dictionaries/en.json').then((module) => module.default),
  th: () => import('./dictionaries/th.json').then((module) => module.default)
};

export const LOCALES = Object.keys(dictionaries) as Locale[];
export const DEFAULT_LOCALE: Locale = 'en';
export const LOCALE_COOKIE = 'pshub.locale';

/** Names shown in the language switcher, each in its own language. */
export const LOCALE_LABELS: Record<Locale, string> = { en: 'English', th: 'ไทย' };

export const hasLocale = (locale: string | undefined | null): locale is Locale =>
  typeof locale === 'string' && Object.hasOwn(dictionaries, locale);

/** The locale of the current request. Server-side only. */
export async function getLocale(): Promise<Locale> {
  const locale = await lang();
  if (!hasLocale(locale)) notFound();
  return locale;
}

/**
 * The dictionary for the current request — a 404 rather than a runtime error
 * when the URL carries a locale we do not have.
 */
export async function getDictionary(): Promise<Dictionary> {
  return dictionaries[await getLocale()]();
}

/**
 * Same, but falls back to the default language instead of 404-ing. For the
 * not-found boundary itself: `/nonsense` puts "nonsense" in the locale slot,
 * and a 404 page that 404s has nowhere left to go.
 */
export async function getDictionarySafe(): Promise<Dictionary> {
  const locale = await lang();
  return dictionaries[hasLocale(locale) ? locale : DEFAULT_LOCALE]();
}
