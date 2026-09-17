import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/utils/supabase/proxy';

/* ---------------------------------------------------------
   Two jobs on every request: keep the Supabase session cookie fresh,
   and make sure the URL carries a language.

   Every route lives under app/[lang], so a path without one has to be
   sent to a language before it can render. The choice is the player's
   first (a cookie, written whenever they visit a localed URL), then
   what their browser asks for, then English.
--------------------------------------------------------- */

const LOCALES = ['en', 'th'];
const DEFAULT_LOCALE = 'en';
const LOCALE_COOKIE = 'pshub.locale';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** Paths that are not pages and must never be given a language prefix. */
const PASSTHROUGH = /^\/(?:auth|api|cores|gamepad)(?:\/|$)|^\/sw\.js$/;

/**
 * The best supported language out of an Accept-Language header, honouring
 * q-values. Small enough not to be worth a dependency for two locales.
 */
function fromAcceptLanguage(header: string | null): string | null {
  if (!header) return null;

  const ranked = header
    .split(',')
    .map((part) => {
      const [tag, ...params] = part.trim().split(';');
      const q = params.find((p) => p.trim().startsWith('q='));
      return { tag: tag.trim().toLowerCase(), q: q ? Number(q.split('=')[1]) || 0 : 1 };
    })
    .filter((entry) => entry.tag)
    .sort((a, b) => b.q - a.q);

  for (const { tag } of ranked) {
    const base = tag.split('-')[0];           // th-TH -> th
    if (LOCALES.includes(base)) return base;
  }
  return null;
}

function chooseLocale(request: NextRequest): string {
  const saved = request.cookies.get(LOCALE_COOKIE)?.value;
  if (saved && LOCALES.includes(saved)) return saved;
  return fromAcceptLanguage(request.headers.get('accept-language')) || DEFAULT_LOCALE;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Session first: whatever happens next, the refreshed auth cookies have to
  // survive onto the response we actually return.
  const sessionResponse = await updateSession(request);

  if (PASSTHROUGH.test(pathname)) return sessionResponse;

  const current = LOCALES.find(
    (locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`)
  );

  if (current) {
    // Remember what they are actually reading, so the next bare URL agrees.
    sessionResponse.cookies.set(LOCALE_COOKIE, current, {
      maxAge: COOKIE_MAX_AGE,
      path: '/',
      sameSite: 'lax'
    });
    return sessionResponse;
  }

  const locale = chooseLocale(request);
  const url = request.nextUrl.clone();
  url.pathname = `/${locale}${pathname === '/' ? '' : pathname}`;

  const redirectResponse = NextResponse.redirect(url);
  for (const cookie of sessionResponse.cookies.getAll()) redirectResponse.cookies.set(cookie);
  redirectResponse.cookies.set(LOCALE_COOKIE, locale, {
    maxAge: COOKIE_MAX_AGE,
    path: '/',
    sameSite: 'lax'
  });

  return redirectResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - manifest.webmanifest (PWA manifest, also only ever at the root)
     * - image files
     */
    '/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'
  ]
};
