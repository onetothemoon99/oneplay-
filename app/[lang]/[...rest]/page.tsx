import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getDictionarySafe } from '../dictionaries';

/* ---------------------------------------------------------
   ONEPLAY — anything under a language that matches no route

   The proxy gives every request a language, so a mistyped URL arrives
   here as /{locale}/whatever and this hands it to the not-found
   boundary next door — which knows the language, and renders inside
   the layout with the header and footer.

   `app/global-not-found.tsx` still exists for the paths the proxy skips
   (/auth, /api, /cores, /gamepad); that one is prerendered and cannot
   read the request, so it stays in the default language.

   A catch-all never shadows a real route: more specific segments win.
--------------------------------------------------------- */

/* Without this the tab would read the layout's title — the site name — on a
   page that is telling you it does not exist. */
export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionarySafe();
  return { title: dict.notFound.metaTitle, description: dict.notFound.metaDescription };
}

export default function CatchAll(): never {
  notFound();
}
