'use client';

/* ---------------------------------------------------------
   ONEPLAY — links that stay in the current language

   Every route is under /[lang], so a bare href="/library" would land
   on the proxy and be redirected to whatever the browser prefers —
   quietly throwing away the language the player picked. This wrapper
   prefixes internal paths with the active locale; drop-in for
   next/link, so the hrefs in the pages stay readable.
--------------------------------------------------------- */

import NextLink from 'next/link';
import type { ComponentProps } from 'react';
import { useLocale } from './I18nProvider';

/** "/library" + "th" -> "/th/library"; anything external is left alone. */
export function localePath(href: string, locale: string): string {
  if (typeof href !== 'string' || !href.startsWith('/') || href.startsWith('//')) return href;
  const [path, rest] = href.split(/(?=[?#])/, 2);
  const clean = path === '/' ? '' : path;
  return `/${locale}${clean}${rest || ''}`;
}

/** Same props as next/link, except `href` is always a plain unlocalised path. */
export type LocaleLinkProps = Omit<ComponentProps<typeof NextLink>, 'href'> & { href: string };

export default function LocaleLink({ href, ...props }: LocaleLinkProps) {
  const locale = useLocale();
  return <NextLink href={localePath(href, locale)} {...props} />;
}
