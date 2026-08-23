'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import Link from '@/components/LocaleLink';
import { GAMES, type Game } from '@/lib/games';
import { Store } from '@/lib/store';
import GameCard from '@/components/GameCard';
import type { Dictionary } from '@/app/[lang]/dictionaries';

export interface NotFoundClientProps {
  /** Just the 404 branch of the dictionary — see the note below. */
  dict: Dictionary['notFound'];
}

/* The dictionary arrives as a prop rather than through the provider: an
   unknown locale in the URL still has to render something, and the provider
   above may be carrying a language this page could not resolve. */
export default function NotFoundClient({ dict }: NotFoundClientProps) {
  const [picks, setPicks] = useState<Game[]>([]);
  const [bestMap, setBestMap] = useState<Record<string, number>>({});

  useEffect(() => {
    setPicks(GAMES.slice().sort(() => Math.random() - 0.5).slice(0, 4));
    const bm: Record<string, number> = {};
    GAMES.forEach((g) => { bm[g.id] = Store.best(g.id); });
    setBestMap(bm);
  }, []);

  return (
    <main className="container">
      <section className="pt-10">
        <div className="cover px-8 py-20 sm:px-16 sm:py-28 text-center" style={{ '--c1': 'var(--color-ink)', '--c2': '#2B2F45', '--c3': 'var(--color-cartridge)' } as CSSProperties}>
          <p className="mono" style={{ color: 'rgba(255,255,255,.6)' }}>{dict.code}</p>
          <h1 className="display text-white mt-5">{dict.title}</h1>
          <p className="lead mt-6 mx-auto max-w-[42ch]" style={{ color: 'rgba(255,255,255,.82)' }}>
            {dict.body}
          </p>
          <div className="mt-9 flex flex-wrap gap-3 justify-center">
            <Link className="btn btn-white btn-lg" href="/">{dict.home}</Link>
            <Link className="btn btn-glass btn-lg" href="/library">{dict.browse}</Link>
          </div>
        </div>
      </section>

      <section className="pt-20 pb-4">
        <p className="mono" style={{ color: 'var(--color-text-sub)' }}>{dict.whileHere}</p>
        <h2 className="h2 mt-2 mb-8">{dict.tryThese}</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-5 gap-y-9">
          {picks.map((g) => <GameCard key={g.id} game={g} best={bestMap[g.id] || 0} />)}
        </div>
      </section>
    </main>
  );
}
