'use client';

/* ---------------------------------------------------------
   ONEPLAY — header

   Section links are quiet text, the language control is a plain
   segmented toggle, and account actions sit after a hairline so the
   eye reads "where to go" and "who you are" as two groups. Signing in
   is the only filled button, and only while signed out — once you are
   in, the header has nothing left to shout about.

   Below lg everything except the logo moves into the sheet: the row
   cannot hold Thai labels, a language toggle and an account action on
   a phone.
--------------------------------------------------------- */

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link, { localePath } from '@/components/LocaleLink';
import LanguageSwitch from '@/components/LanguageSwitch';
import Logo from '@/components/Logo';
import { useLocale, useT } from '@/components/I18nProvider';
import { signOut } from '@/app/actions/auth';
import type { UserDto } from '@/lib/auth';

type NavItem = [href: string, key: string];

const SECTIONS: NavItem[] = [
  ['/', 'nav.home'],
  ['/library', 'nav.games'],
  ['/play/psx', 'nav.playstation']
];

/* A door with the arrow leaving it — same 16px, 1.6 stroke and round caps as
   the menu button, so the two read as one family. */
function SignOutIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor"
         strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6.5 2.5H3.6a1.1 1.1 0 0 0-1.1 1.1v8.8a1.1 1.1 0 0 0 1.1 1.1h2.9" />
      <path d="M10.6 5.4 13.2 8l-2.6 2.6M13.2 8H6.6" />
    </svg>
  );
}

const ACCOUNT: NavItem[] = [
  ['/profile', 'nav.profile'],
  ['/settings', 'nav.settings']
];

export interface NavProps {
  user?: UserDto | null;
}

export default function Nav({ user = null }: NavProps) {
  const pathname = usePathname();
  const locale = useLocale();
  const t = useT();
  const [open, setOpen] = useState(false);

  // pathname carries the locale, the hrefs here do not
  const isCurrent = (href: string) => pathname === localePath(href, locale);

  // a route change should not leave the sheet hanging open
  useEffect(() => { setOpen(false); }, [pathname]);

  return (
    <header className="site-header sticky top-0 z-40">
      <div className="container flex items-center justify-between h-[68px] gap-4">
        <Link href="/" className="no-underline text-black shrink-0" aria-label="OnePlay"><Logo /></Link>

        <nav className="hidden lg:flex items-center gap-7" aria-label={t('nav.sections')}>
          {[...SECTIONS, ...ACCOUNT].map(([href, key]) => (
            <Link key={href} className="nav-link" href={href} aria-current={isCurrent(href) ? 'page' : undefined}>
              {t(key)}
            </Link>
          ))}
        </nav>

        {/* Visibility lives on these plain wrappers: globals.css is unlayered,
            so .btn and .lang-switch outrank Tailwind's `hidden` and would show
            through it. */}
        <div className="flex items-center gap-3 shrink-0">
          <span className="hidden lg:inline-flex">
            <LanguageSwitch label={t('nav.language')} />
          </span>

          <span className="nav-divider hidden lg:block" aria-hidden="true" />

          {user ? (
            <form action={signOut} className="hidden lg:flex items-center gap-3">
              <input type="hidden" name="locale" value={locale} />
              <span className="mono hidden xl:inline max-w-[16ch] truncate" style={{ color: 'var(--color-text-sub)' }}>
                {user.name}
              </span>
              <button className="btn btn-accent btn-sm" type="submit">
                <SignOutIcon />
                {t('nav.signOut')}
              </button>
            </form>
          ) : (
            <span className="hidden lg:inline-flex">
              <Link className="btn btn-black btn-sm" href="/login">{t('nav.signIn')}</Link>
            </span>
          )}

          <span className="lg:hidden inline-flex">
          <button
            className="btn btn-ghost btn-icon"
            aria-label={t('nav.openMenu')}
            aria-expanded={open}
            aria-controls="nav-sheet"
            onClick={() => setOpen((o) => !o)}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
              {open
                ? <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" />
                : <path d="M2 4.5h12M2 8h12M2 11.5h12" />}
            </svg>
          </button>
          </span>
        </div>
      </div>

      <div id="nav-sheet" className={`lg:hidden ${open ? '' : 'hidden'}`}>
        <div className="container py-4" style={{ borderTop: '1px solid var(--line)' }}>
          <nav className="flex flex-col" aria-label={t('nav.sections')}>
            {SECTIONS.map(([href, key]) => (
              <Link key={href} className="sheet-link" href={href} aria-current={isCurrent(href) ? 'page' : undefined}>
                {t(key)}
              </Link>
            ))}
          </nav>

          <hr className="divider my-3" />

          <nav className="flex flex-col" aria-label={t('nav.account')}>
            {ACCOUNT.map(([href, key]) => (
              <Link key={href} className="sheet-link" href={href} aria-current={isCurrent(href) ? 'page' : undefined}>
                {t(key)}
              </Link>
            ))}
          </nav>

          <hr className="divider my-3" />

          <div className="flex items-center justify-between gap-4 pt-1">
            <LanguageSwitch label={t('nav.language')} />

            {user ? (
              <form action={signOut}>
                <input type="hidden" name="locale" value={locale} />
                <button className="btn btn-accent btn-sm" type="submit">
                <SignOutIcon />
                {t('nav.signOut')}
              </button>
              </form>
            ) : (
              <Link className="btn btn-outline btn-sm" href="/login">{t('nav.signIn')}</Link>
            )}
          </div>

          {user ? (
            <p className="mono mt-3 truncate" style={{ color: 'var(--color-text-sub)' }}>{user.email || user.name}</p>
          ) : null}
        </div>
      </div>
    </header>
  );
}
