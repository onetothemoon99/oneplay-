/* ---------------------------------------------------------
   ONEPLAY — session helpers (server only)

   The session cookie is refreshed in proxy.ts on every request; these helpers
   just read it. Memoised with React.cache so a layout and a page in the same
   render pass share one round-trip to Supabase.
--------------------------------------------------------- */

import { cache } from 'react';
import { cookies } from 'next/headers';
import type { User } from '@supabase/supabase-js';
import { createClient } from '@/utils/supabase/server';

/** The trimmed-down user that Client Components are allowed to see. */
export interface UserDto {
  id: string;
  email: string | null;
  name: string;
}

/** The raw Supabase user, or null when nobody is signed in. */
export const getUser = cache(async (): Promise<User | null> => {
  const supabase = createClient(await cookies());
  const { data, error } = await supabase.auth.getUser();
  if (error) return null;
  return data?.user ?? null;
});

/**
 * A trimmed-down user for Client Components — never hand the whole Supabase
 * user object (which carries app/user metadata and identities) to the browser.
 */
export async function getUserDto(): Promise<UserDto | null> {
  const user = await getUser();
  if (!user) return null;
  return {
    id: user.id,
    email: user.email ?? null,
    name: user.user_metadata?.name || user.email?.split('@')[0] || 'Player One'
  };
}
