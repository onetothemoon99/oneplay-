'use client';

/* ---------------------------------------------------------
   ONEPLAY — language switch

   Swaps the locale segment of whatever path is open, so switching
   language keeps you on the page you were reading. The proxy writes
   the choice to a cookie on arrival, which is what makes it stick for
   the next visit.

   Styled as one quiet segmented control rather than two buttons: a
   filled button here would compete with Quick Play, and a header
   should only have one thing shouting.
--------------------------------------------------------- */

import { usePathname, useRouter } from 'next/navigation';
import type { Locale } from '@/app/[lang]/dictionaries';
import { useLocale } from './I18nProvider';

const LOCALES: [code: Locale, short: string][] = [['en', 'EN'], ['th', 'ไทย']];

export interface LanguageSwitchProps {
  label?: string;
  className?: string;
}

export default function LanguageSwitch({ label, className = '' }: LanguageSwitchProps) {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  function switchTo(next: Locale) {
    if (next === locale) return;
    // "/th/play/psx" -> ["", "th", "play", "psx"]
    const segments = pathname.split('/');
    segments[1] = next;
    router.push(segments.join('/') || `/${next}`);
  }

  return (
    <span className={`lang-switch ${className}`} role="group" aria-label={label}>
      {LOCALES.map(([code, short]) => (
        <button
          key={code}
          type="button"
          className="lang-option"
          aria-current={code === locale ? 'true' : undefined}
          onClick={() => switchTo(code)}
        >
          {short}
        </button>
      ))}
    </span>
  );
}
