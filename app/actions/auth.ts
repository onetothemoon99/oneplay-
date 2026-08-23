'use server';

/* ---------------------------------------------------------
   ONEPLAY — auth Server Actions (email + password)

   Used with React's useActionState, so every action takes
   (previousState, formData) and returns the new form state.
--------------------------------------------------------- */

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import type { TranslationValues } from '@/components/I18nProvider';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 8;

const LOCALES = ['en', 'th'] as const;
type Locale = (typeof LOCALES)[number];
const DEFAULT_LOCALE: Locale = 'en';

/** Per-field messages, held as translation keys rather than sentences. */
export interface FieldErrors {
  email?: string;
  password?: string;
  passwordValues?: TranslationValues;
}

/** What every action in this file hands back to `useActionState`. */
export interface AuthFormState {
  fieldErrors?: FieldErrors;
  /** Echoed back so the form can re-fill itself after a failed submit. */
  values?: { name?: string; email?: string };
  errorKey?: string;
  errorValues?: TranslationValues;
  /** A message Supabase wrote, which we have no key for. */
  error?: string;
  messageKey?: string;
  messageValues?: TranslationValues;
}

/** `undefined` is the initial state, before the form has ever been submitted. */
export type AuthState = AuthFormState | undefined;

/* `next/root-params` is Server-Component-only, so the form tells us. */
function safeLocale(value: string): Locale {
  return (LOCALES as readonly string[]).includes(value) ? (value as Locale) : DEFAULT_LOCALE;
}

/* Only allow same-site, absolute-path redirects (no open redirects), and keep
   the reader in the language they were already in. */
function safeNext(value: FormDataEntryValue | null, locale: Locale): string {
  const next = typeof value === 'string' ? value : '';
  const path = next.startsWith('/') && !next.startsWith('//') ? next : '/profile';
  return path.startsWith(`/${locale}/`) || path === `/${locale}` ? path : `/${locale}${path}`;
}

/* Where Supabase should send the user back to after they click the
   confirmation link in their email. */
async function siteOrigin(): Promise<string> {
  const h = await headers();
  const origin = h.get('origin');
  if (origin) return origin;
  const host = h.get('host');
  const proto = h.get('x-forwarded-proto') || (host?.startsWith('localhost') ? 'http' : 'https');
  return host ? `${proto}://${host}` : '';
}

/* Keys, not sentences: the form is what knows the reader's language. */
function validate({ email, password }: { email: string; password: string }): FieldErrors {
  const fieldErrors: FieldErrors = {};
  if (!email) fieldErrors.email = 'auth.emailRequired';
  else if (!EMAIL_RE.test(email)) fieldErrors.email = 'auth.emailInvalid';
  if (!password) fieldErrors.password = 'auth.passwordRequired';
  return fieldErrors;
}

export async function signIn(_prevState: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get('email') || '').trim();
  const password = String(formData.get('password') || '');
  const locale = safeLocale(String(formData.get('locale') || ''));
  const next = safeNext(formData.get('next'), locale);

  const fieldErrors = validate({ email, password });
  if (Object.keys(fieldErrors).length) return { fieldErrors, values: { email } };

  const supabase = createClient(await cookies());
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return {
      errorKey: error.code === 'email_not_confirmed' ? 'auth.notConfirmed' : 'auth.wrongCredentials',
      values: { email }
    };
  }

  // Outside the error branch on purpose: redirect() throws a control-flow
  // exception, so nothing after it runs.
  redirect(next);
}

export async function signUp(_prevState: AuthState, formData: FormData): Promise<AuthState> {
  const name = String(formData.get('name') || '').trim();
  const email = String(formData.get('email') || '').trim();
  const password = String(formData.get('password') || '');
  const locale = safeLocale(String(formData.get('locale') || ''));

  const fieldErrors = validate({ email, password });
  if (password && password.length < MIN_PASSWORD) {
    fieldErrors.password = 'auth.passwordTooShort';
    fieldErrors.passwordValues = { min: MIN_PASSWORD };
  }
  if (Object.keys(fieldErrors).length) return { fieldErrors, values: { name, email } };

  const supabase = createClient(await cookies());
  const origin = await siteOrigin();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: name ? { name } : undefined,
      emailRedirectTo: origin ? `${origin}/auth/confirm?locale=${locale}` : undefined
    }
  });

  if (error) {
    return {
      ...(error.code === 'user_already_exists'
        ? { errorKey: 'auth.alreadyRegistered' }
        : { error: error.message }),
      values: { name, email }
    };
  }

  // With email confirmations on (the Supabase default) signUp returns a user
  // but no session, so there is nothing to redirect to yet.
  if (!data.session) {
    return { messageKey: 'auth.confirmSent', messageValues: { email } };
  }

  redirect(`/${locale}/profile`);
}

/**
 * Hands off to Google and comes back through /auth/confirm, which already
 * knows how to trade a `?code=` for a session — that route was built for the
 * email confirmation link, and the PKCE exchange is the same one.
 */
export async function signInWithGoogle(_prevState: AuthState, formData: FormData): Promise<AuthState> {
  const locale = safeLocale(String(formData.get('locale') || ''));
  const next = safeNext(formData.get('next'), locale);
  const origin = await siteOrigin();

  const supabase = createClient(await cookies());
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: origin
        ? `${origin}/auth/confirm?locale=${locale}&next=${encodeURIComponent(next)}`
        : undefined,
      // let people pick which Google account, rather than silently reusing one
      queryParams: { prompt: 'select_account' }
    }
  });

  if (error || !data?.url) {
    const message = error?.message || '';
    if (/not enabled|unsupported provider/i.test(message)) return { errorKey: 'auth.googleNotEnabled' };
    return { errorKey: 'auth.googleFailed', errorValues: { error: message || 'unknown error' } };
  }

  // `signInWithOAuth` hands back a URL without ever calling it, so a provider
  // that is switched off is only discovered at the far end — where Supabase
  // answers with raw JSON. Knock on the door first so that turns into a
  // sentence on our own page. If the knock itself fails, carry on regardless:
  // the probe must never be what stops someone signing in.
  const trouble = await describeOAuthProblem(data.url);
  if (trouble) return trouble;

  redirect(data.url);
}

async function describeOAuthProblem(url: string): Promise<AuthFormState | null> {
  try {
    const response = await fetch(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(4000),
      headers: { accept: 'application/json' }
    });
    if (response.status < 400) return null;

    const body: { msg?: string; error_description?: string; message?: string } =
      await response.json().catch(() => ({}));
    const message = body.msg || body.error_description || body.message || '';
    if (/not enabled|unsupported provider/i.test(message)) return { errorKey: 'auth.googleNotEnabled' };
    return { errorKey: 'auth.googleFailed', errorValues: { error: message || `HTTP ${response.status}` } };
  } catch {
    return null;   // could not check — let the redirect happen
  }
}

export async function signOut(formData: FormData): Promise<void> {
  const locale = safeLocale(String(formData?.get?.('locale') || ''));
  const supabase = createClient(await cookies());
  await supabase.auth.signOut();
  redirect(`/${locale}`);
}
