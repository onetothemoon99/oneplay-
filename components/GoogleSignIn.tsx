'use client';

/* ---------------------------------------------------------
   ONEPLAY — sign in with Google

   Its own little form, so it can sit beside the password form without
   fighting it for the submit. The locale rides along in a hidden field
   for the same reason it does everywhere else: Server Actions cannot
   read root params.
--------------------------------------------------------- */

import { useActionState } from 'react';
import { useLocale, useT } from '@/components/I18nProvider';
import { signInWithGoogle } from '@/app/actions/auth';

function GoogleMark() {
  return (
    <svg width="17" height="17" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#4285F4" d="M45.1 24.5c0-1.6-.1-2.7-.4-3.9H24v7.1h12.1c-.2 1.8-1.6 4.6-4.5 6.5l6.9 5.3c4.1-3.8 6.6-9.4 6.6-15Z" />
      <path fill="#34A853" d="M24 46c5.9 0 10.9-2 14.5-5.3l-6.9-5.3c-1.8 1.3-4.3 2.2-7.6 2.2-5.8 0-10.7-3.8-12.5-9.700000000000001l-7.1 5.5C7.9 40.8 15.4 46 24 46Z" />
      <path fill="#FBBC05" d="M11.5 27.9c-.5-1.4-.7-2.9-.7-4.4s.3-3 .7-4.4l-7.1-5.5C2.9 16.5 2 20.1 2 23.5s.9 7 2.4 9.9l7.1-5.5Z" />
      <path fill="#EA4335" d="M24 9.5c4.1 0 6.9 1.8 8.5 3.3l6.2-6C34.9 3.3 29.9 1 24 1 15.4 1 7.9 6.2 4.4 13.6l7.1 5.5C13.3 13.3 18.2 9.5 24 9.5Z" />
    </svg>
  );
}

export interface GoogleSignInProps {
  /** Where to land after the round trip through Google. */
  next?: string;
}

export default function GoogleSignIn({ next }: GoogleSignInProps) {
  const t = useT();
  const locale = useLocale();
  const [state, action, pending] = useActionState(signInWithGoogle, undefined);

  return (
    <div className="mt-8">
      <form action={action}>
        <input type="hidden" name="locale" value={locale} />
        {next ? <input type="hidden" name="next" value={next} /> : null}
        <button className="btn btn-outline btn-lg w-full" type="submit" disabled={pending}>
          <GoogleMark />
          {pending ? t('auth.redirecting') : t('auth.continueGoogle')}
        </button>
      </form>

      {state?.errorKey && (
        <p className="mono mt-3" role="alert" style={{ color: '#DC2626' }}>
          {t(state.errorKey, state.errorValues)}
        </p>
      )}

      <p className="auth-divider mono">{t('auth.or')}</p>
    </div>
  );
}
