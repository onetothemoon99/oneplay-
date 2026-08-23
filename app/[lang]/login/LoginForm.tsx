'use client';

import { useActionState } from 'react';
import Link from '@/components/LocaleLink';
import { useLocale, useT } from '@/components/I18nProvider';
import GoogleSignIn from '@/components/GoogleSignIn';
import { signIn } from '@/app/actions/auth';

export interface LoginFormProps {
  /** Where to land once the session exists. */
  next?: string;
  /** A message from the provider round trip, already in a human language. */
  notice?: string;
}

export default function LoginForm({ next, notice }: LoginFormProps) {
  const t = useT();
  const locale = useLocale();
  const [state, action, pending] = useActionState(signIn, undefined);

  return (
    <main className="container">
      <section className="max-w-[420px] mx-auto pt-20 pb-24">
        <p className="mono" style={{ color: 'var(--color-text-sub)' }}>{t('auth.account')}</p>
        <h1 className="h1 mt-3">{t('auth.signIn')}</h1>
        <p className="lead mt-4">{t('auth.signInLead')}</p>

        {notice && (
          <p className="panel-soft mt-8 p-4 body-sub" role="status">{notice}</p>
        )}

        <GoogleSignIn next={next} />

        <form action={action} className="mt-2 flex flex-col gap-5" noValidate>
          {next ? <input type="hidden" name="next" value={next} /> : null}
          <input type="hidden" name="locale" value={locale} />

          <div>
            <label className="mono block mb-2" htmlFor="email" style={{ color: 'var(--color-text-sub)' }}>{t('auth.email')}</label>
            <input
              id="email"
              name="email"
              type="email"
              className="field"
              autoComplete="email"
              placeholder="you@example.com"
              defaultValue={state?.values?.email || ''}
              aria-describedby={state?.fieldErrors?.email ? 'email-error' : undefined}
              required
            />
            {state?.fieldErrors?.email && (
              <p id="email-error" className="mono mt-2" style={{ color: '#DC2626' }}>{t(state.fieldErrors.email)}</p>
            )}
          </div>

          <div>
            <label className="mono block mb-2" htmlFor="password" style={{ color: 'var(--color-text-sub)' }}>{t('auth.password')}</label>
            <input
              id="password"
              name="password"
              type="password"
              className="field"
              autoComplete="current-password"
              placeholder="••••••••"
              aria-describedby={state?.fieldErrors?.password ? 'password-error' : undefined}
              required
            />
            {state?.fieldErrors?.password && (
              <p id="password-error" className="mono mt-2" style={{ color: '#DC2626' }}>{t(state.fieldErrors.password)}</p>
            )}
          </div>

          {(state?.errorKey || state?.error) && (
            <p className="mono" role="alert" style={{ color: '#DC2626' }}>
              {state.errorKey ? t(state.errorKey) : state.error}
            </p>
          )}

          <button className="btn btn-black btn-lg mt-1" type="submit" disabled={pending}>
            {pending ? t('auth.signingIn') : t('auth.signIn')}
          </button>
        </form>

        <p className="body-sub mt-8">
          {t('auth.noAccount')} <Link href="/signup">{t('auth.createOne')}</Link>
        </p>
      </section>
    </main>
  );
}
