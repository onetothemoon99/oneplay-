'use client';

/* ---------------------------------------------------------
   ONEPLAY — translations, client side

   Most of this app is Client Components, and `next/root-params`
   deliberately does not reach them. So the root layout — which is a
   Server Component and can read the locale — loads the dictionary
   once and hands it down through this provider. Nothing is fetched
   twice and nothing is prop-drilled.
--------------------------------------------------------- */

import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';
import type { Dictionary, Locale } from '@/app/[lang]/dictionaries';

/** The values `t('key', { … })` can interpolate. */
export type TranslationValues = Record<string, string | number>;

/** `t('play.powerOn')`, or `t('psx.linked', { count: 3 })`. */
export type Translate = (key: string, values?: TranslationValues) => string;

interface I18nValue {
  locale: Locale;
  dict: Dictionary;
}

const I18nContext = createContext<I18nValue | null>(null);

/** "nav.games" -> dict.nav.games, or undefined if it is missing. */
function lookup(dict: Dictionary, key: string): string | undefined {
  let value: unknown = dict;
  for (const part of String(key).split('.')) {
    if (value == null || typeof value !== 'object') return undefined;
    value = (value as Record<string, unknown>)[part];
  }
  return typeof value === 'string' ? value : undefined;
}

/** Fills {name} placeholders: t('shelf.count', { n: 3 }) */
function interpolate(text: string, values?: TranslationValues): string {
  if (!values) return text;
  return text.replace(/\{(\w+)\}/g, (match, name: string) => (
    Object.hasOwn(values, name) ? String(values[name]) : match
  ));
}

export interface I18nProviderProps {
  locale: Locale;
  dict: Dictionary;
  children: ReactNode;
}

export function I18nProvider({ locale, dict, children }: I18nProviderProps) {
  const value = useMemo(() => ({ locale, dict }), [locale, dict]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const context = useContext(I18nContext);
  if (!context) throw new Error('useI18n must be used inside <I18nProvider>');
  return context;
}

/**
 * `const t = useT()` then `t('play.powerOn')`.
 *
 * A missing key returns the key itself rather than blowing up: a half-finished
 * translation should look unfinished, not take the page down.
 */
export function useT(): Translate {
  const { dict } = useI18n();

  return useCallback<Translate>((key, values) => {
    const text = lookup(dict, key);
    if (text === undefined) {
      if (process.env.NODE_ENV !== 'production') console.warn(`[i18n] missing key: ${key}`);
      return key;
    }
    return interpolate(text, values);
  }, [dict]);
}

/** The active locale, for `Intl` formatting and for building links. */
export function useLocale(): Locale {
  return useI18n().locale;
}
