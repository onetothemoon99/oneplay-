'use client';

import { useActionState } from 'react';
import Link from '@/components/LocaleLink';
import { useLocale, useT } from '@/components/I18nProvider';
import GoogleSignIn from '@/components/GoogleSignIn';
import { signUp } from '@/app/actions/auth';

export default function SignupForm() {
  const t = useT();
  const locale = useLocale();
  const [state, action, pending] = useActionState(signUp, undefined);

  if (state?.messageKey) {
    return (
      <main className="container">
        <section className="max-w-[420px] mx-auto pt-20 pb-24">
          <p className="mono" style={{ color: 'var(--color-text-sub)' }}>{t('auth.account')}</p>
          <h1 className="h1 mt-3">{t('auth.checkInbox')}</h1>
          <p className="lead mt-4">{t(state.messageKey, state.messageValues)}</p>
          <Link className="btn btn-black btn-lg mt-8" href="/login">{t('auth.backToSignIn')}</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="container">
      <section className="max-w-[420px] mx-auto pt-20 pb-24">
        <p className="mono" style={{ color: 'var(--color-text-sub)' }}>{t('auth.account')}</p>
        <h1 className="h1 mt-3">{t('auth.createAccount')}</h1>
        <p className="lead mt-4">{t('auth.createLead')}</p>

        <GoogleSignIn />

        <form action={action} className="mt-2 flex flex-col gap-5" noValidate>
          <input type="hidden" name="locale" value={locale} />
          <div>
            <label className="mono block mb-2" htmlFor="name" style={{ color: 'var(--color-text-sub)' }}>{t('auth.displayName')}</label>
            <input
              id="name"
              name="name"
              type="text"
              className="field"
              autoComplete="nickname"
              placeholder={t('auth.namePlaceholder')}
              maxLength={24}
              defaultValue={state?.values?.name || ''}
            />
          </div>

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
              autoComplete="new-password"
              placeholder={t('auth.passwordPlaceholder')}
              aria-describedby={state?.fieldErrors?.password ? 'password-error' : 'password-hint'}
              required
            />
            {state?.fieldErrors?.password ? (
              <p id="password-error" className="mono mt-2" style={{ color: '#DC2626' }}>{t(state.fieldErrors.password, state.fieldErrors.passwordValues)}</p>
            ) : (
              <p id="password-hint" className="mono mt-2" style={{ color: 'var(--color-text-sub)' }}>{t('auth.passwordHint')}</p>
            )}
          </div>

          {(state?.errorKey || state?.error) && (
            <p className="mono" role="alert" style={{ color: '#DC2626' }}>
              {state.errorKey ? t(state.errorKey) : state.error}
            </p>
          )}

          <button className="btn btn-black btn-lg mt-1" type="submit" disabled={pending}>
            {pending ? t('auth.creating') : t('auth.createAccount')}
          </button>
        </form>

        <p className="body-sub mt-8">
          {t('auth.haveAccount')} <Link href="/login">{t('auth.signIn')}</Link>
        </p>
      </section>
    </main>
  );
}
