'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import Link, { localePath } from '@/components/LocaleLink';
import { useLocale, useT } from '@/components/I18nProvider';
import { GAMES, type Game } from '@/lib/games';
import { Store, fmt } from '@/lib/store';
import CoverArt from '@/components/CoverArt';
import Reveal from '@/components/Reveal';
import RoomSection from '@/components/room/RoomSection';

export default function HomeClient() {
  const router = useRouter();
  const locale = useLocale();
  const t = useT();
  const hero = GAMES[0];

  const [recent, setRecent] = useState<Game[]>([]);
  const [stats, setStats] = useState({ plays: 0, time: 0, trophies: 0 });
  const [bestMap, setBestMap] = useState<Record<string, number>>({});

  useEffect(() => {
    setRecent(Store.recent().slice(0, 5));
    const totalPlays = GAMES.reduce((n, g) => n + Store.plays(g.id), 0);
    const totalTime = GAMES.reduce((n, g) => n + Store.time(g.id), 0);
    setStats({ plays: totalPlays, time: totalTime, trophies: Store.trophies().length });
    const best: Record<string, number> = {};
    GAMES.forEach((g) => { best[g.id] = Store.best(g.id); });
    setBestMap(best);
  }, []);

  function randomQuickPlay() {
    const g = GAMES[Math.floor(Math.random() * GAMES.length)];
    router.push(localePath(`/play/${g.id}`, locale));
  }

  return (
    <main>
      {/* ============ THE ROOM ============ */}
      <RoomSection games={GAMES} bestMap={bestMap} />

      {/* ============ TICKER ============ */}
      <section className="py-7 overflow-hidden" style={{ borderBottom: '1px solid var(--line)' }}>
        <div className="marquee-track w-max">
          {[0, 1].map((k) => (
            <div key={k} className="flex gap-12 shrink-0" aria-hidden={k === 1 ? true : undefined}>
              {GAMES.map((g) => (
                <span key={g.id} className="mono-lg whitespace-nowrap" style={{ color: 'rgba(0,0,0,.42)' }}>
                  {g.title} <span style={{ color: 'rgba(0,0,0,.2)' }}>/</span> {g.studio}
                </span>
              ))}
            </div>
          ))}
        </div>
      </section>

      {/* ============ CONTINUE ============ */}
      {recent.length > 0 && (
        <section>
          <div className="container pt-20">
            <div className="flex items-end justify-between gap-6 mb-8">
              <div>
                <p className="mono" style={{ color: 'var(--color-text-sub)' }}>{t('home.continue')}</p>
                <h2 className="h2 mt-2">{t('home.pickUp')}</h2>
              </div>
              <Link className="btn btn-outline btn-sm hidden sm:inline-flex" href="/profile">{t('home.viewActivity')}</Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-5">
              {recent.map((g) => (
                <Link key={g.id} className="game-card" href={`/play/${g.id}`}>
                  <CoverArt game={g} ratio="aspect-[16/10]" glyphSize="text-[34px]" />
                  <p className="mt-2.5 card-title" style={{ fontWeight: 480, fontSize: 15 }}>{g.title}</p>
                  <p className="mono mt-1" style={{ color: 'var(--color-text-sub)' }}>{fmt.time(Store.time(g.id))} · {t('home.best')} {fmt.score(Store.best(g.id))}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ============ HOW IT WORKS ============ */}
      <section>
        <div className="container" style={{ paddingTop: 'var(--section-py)' }}>
          <div className="panel-soft p-8 sm:p-12">
            <p className="mono" style={{ color: 'var(--color-text-sub)' }}>{t('home.howItWorks')}</p>
            <h2 className="h2 mt-2 max-w-[20ch]">{t('home.threeSteps')}</h2>
            <div className="grid sm:grid-cols-3 gap-10 mt-12">
              <Reveal>
                <p className="mono-lg" style={{ color: 'var(--color-text-sub)' }}>01</p>
                <h3 className="h3 mt-3">{t('home.step1Title')}</h3>
                <p className="body-sub mt-2">{t('home.step1Body')}</p>
              </Reveal>
              <Reveal>
                <p className="mono-lg" style={{ color: 'var(--color-text-sub)' }}>02</p>
                <h3 className="h3 mt-3">{t('home.step2Title')}</h3>
                <p className="body-sub mt-2">{t('home.step2Body')}</p>
              </Reveal>
              <Reveal>
                <p className="mono-lg" style={{ color: 'var(--color-text-sub)' }}>03</p>
                <h3 className="h3 mt-3">{t('home.step3Title')}</h3>
                <p className="body-sub mt-2">{t('home.step3Body')}</p>
              </Reveal>
            </div>
          </div>
        </div>
      </section>

      {/* ============ STATS BAND ============ */}
      <section>
        <div className="container" style={{ paddingTop: 'var(--section-py)' }}>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-px" style={{ background: 'var(--line)', border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden' }}>
            <div className="bg-white p-8"><p className="h1" style={{ fontSize: 44 }}>8</p><p className="mono mt-2" style={{ color: 'var(--color-text-sub)' }}>{t('home.statTitles')}</p></div>
            <div className="bg-white p-8"><p className="h1" style={{ fontSize: 44 }}>{stats.plays}</p><p className="mono mt-2" style={{ color: 'var(--color-text-sub)' }}>{t('home.statRounds')}</p></div>
            <div className="bg-white p-8"><p className="h1" style={{ fontSize: 44 }}>{fmt.time(stats.time)}</p><p className="mono mt-2" style={{ color: 'var(--color-text-sub)' }}>{t('home.statTime')}</p></div>
            <div className="bg-white p-8"><p className="h1" style={{ fontSize: 44 }}>{stats.trophies}</p><p className="mono mt-2" style={{ color: 'var(--color-text-sub)' }}>{t('home.statTrophies')}</p></div>
          </div>
        </div>
      </section>

      {/* ============ CTA ============ */}
      <section>
        <div className="container" style={{ paddingTop: 'var(--section-py)' }}>
          <div className="cover px-8 py-16 sm:px-16 sm:py-24 text-center" style={{ '--c1': 'var(--color-signal)', '--c2': 'var(--color-ink)', '--c3': 'var(--color-cartridge)' } as CSSProperties}>
            <h2 className="h1 text-white mx-auto max-w-[22ch]">{t('home.ctaTitle')}</h2>
            <p className="lead mt-5 mx-auto max-w-[44ch]" style={{ color: 'rgba(255,255,255,.86)' }}>{t('home.ctaBody')}</p>
            <div className="mt-9 flex flex-wrap gap-3 justify-center">
              <Link className="btn btn-white btn-lg" href="/library">{t('home.chooseGame')}</Link>
              <button className="btn btn-glass btn-lg" onClick={randomQuickPlay}>{t('home.randomPlay')}</button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
