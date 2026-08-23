/* ---------------------------------------------------------
   ONEPLAY — email confirmation landing route

   Supabase sends new users here after they click the link in their
   confirmation email. Two link shapes are supported:

   1. ?token_hash=...&type=signup   — the recommended SSR shape. Requires the
      "Confirm signup" email template to point at
      {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup
   2. ?code=...                     — what the default template produces; the
      code is exchanged for a session here.

   Either way the session cookie is written before we redirect.
--------------------------------------------------------- */

import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createClient } from '@/utils/supabase/server';

const LOCALES = ['en', 'th'] as const;
type Locale = (typeof LOCALES)[number];

const isLocale = (value: string | null | undefined): value is Locale =>
  typeof value === 'string' && (LOCALES as readonly string[]).includes(value);

function safeNext(value: string | null, locale: Locale): string {
  const next = typeof value === 'string' ? value : '';
  return next.startsWith('/') && !next.startsWith('//') ? next : `/${locale}/profile`;
}

export async function GET(request: NextRequest) {
  // Route Handlers cannot read root params either — the confirmation link
  // carries the language it was sent in, with the cookie as a fallback.
  const asked = new URL(request.url).searchParams.get('locale');
  const cookieLocale = request.cookies.get('pshub.locale')?.value;
  const locale: Locale = isLocale(asked) ? asked : (isLocale(cookieLocale) ? cookieLocale : 'en');
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const code = searchParams.get('code');
  const next = safeNext(searchParams.get('next'), locale);

  // An OAuth provider that refuses comes back here with an error instead of a
  // code — hand that straight to the sign-in page rather than reporting a
  // missing token, which is not what went wrong.
  const providerError = searchParams.get('error_description') || searchParams.get('error');
  if (providerError) {
    const url = new URL(`/${locale}/login`, origin);
    url.searchParams.set('error', providerError);
    return NextResponse.redirect(url);
  }

  const supabase = createClient(await cookies());

  let error: { message?: string } | null = null;
  if (tokenHash && type) {
    ({ error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash }));
  } else if (code) {
    ({ error } = await supabase.auth.exchangeCodeForSession(code));
  } else {
    error = { message: 'This confirmation link is missing its token.' };
  }

  if (error) {
    const url = new URL(`/${locale}/login`, origin);
    url.searchParams.set('error', error.message || 'That confirmation link is invalid or has expired.');
    return NextResponse.redirect(url);
  }

  return NextResponse.redirect(new URL(next, origin));
}
