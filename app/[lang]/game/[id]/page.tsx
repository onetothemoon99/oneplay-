'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import Link from '@/components/LocaleLink';
import { useParams } from 'next/navigation';
import { GAMES, getGame, type TrophyTier } from '@/lib/games';
import { Store, fmt } from '@/lib/store';
import GameCard from '@/components/GameCard';
import { useT } from '@/components/I18nProvider';

function tierColor(t: TrophyTier) { return t === 'Gold' ? '#FACC15' : t === 'Silver' ? '#D4D4D8' : '#D9A066'; }

export default function GameDetailPage() {
  const t = useT();
  // `t` is shadowed inside the trophy list below, where the item is also `t`
  const label = t;
  const { id } = useParams<{ id: string }>();
  const game = getGame(id) || GAMES[0];

  const [best, setBest] = useState(0);
  const [plays, setPlays] = useState(0);
  const [time, setTime] = useState(0);
  const [saved, setSaved] = useState(false);
  const [unlocked, setUnlocked] = useState<string[]>([]);
  const [bestMap, setBestMap] = useState<Record<string, number>>({});

  useEffect(() => {
    document.title = game.title + ' — OnePlay';
    setBest(Store.best(game.id));
    setPlays(Store.plays(game.id));
    setTime(Store.time(game.id));
    setSaved(Store.inLibrary(game.id));
    setUnlocked(game.trophies.filter((t) => Store.hasTrophy(game.id, t.name)).map((t) => t.name));
    const bm: Record<string, number> = {};
    GAMES.forEach((g) => { bm[g.id] = Store.best(g.id); });
    setBestMap(bm);
    // `game` is derived from `id` via getGame(); re-running per id change is correct.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.id]);

  const related = GAMES.filter((g) => g.id !== game.id && (g.genre === game.genre || g.studio === game.studio)).slice(0, 4);
  const fill = GAMES.filter((g) => g.id !== game.id && !related.includes(g)).slice(0, 4 - related.length);
  const suggestions = [...related, ...fill];

  function toggleSave() {
    const now = Store.toggleLibrary(game.id);
    setSaved(now);
  }

  return (
    <main>
      {/* hero */}
      <section className="px-4 pt-4 sm:px-6">
        <div className="cover" style={{ '--c1': game.accent[0], '--c2': game.accent[1], '--c3': game.accent[2], borderRadius: 8 } as CSSProperties}>
          <div className="container py-16 sm:py-20">
            <Link className="pill pill-inverse no-underline" href="/library">{t('game.backLibrary')}</Link>
            <div className="grid lg:grid-cols-[1fr_300px] gap-12 items-end mt-8">
              <div>
                <h1 className="h1 text-white max-w-[16ch]">{game.title}</h1>
                <p className="lead mt-4 max-w-[42ch]" style={{ color: 'rgba(255,255,255,.88)' }}>{game.tagline}</p>
                <div className="flex flex-wrap gap-2 mt-6">
                  {game.tags.map((t) => <span key={t} className="pill pill-inverse">{t}</span>)}
                </div>
                <div className="mt-9 flex flex-wrap gap-3">
                  <Link className="btn btn-white btn-lg" href={`/play/${game.id}`}>
                    <svg width="12" height="14" viewBox="0 0 12 14" fill="currentColor" aria-hidden="true"><path d="M11 6.13a1 1 0 0 1 0 1.74l-9.5 5.5A1 1 0 0 1 0 12.5v-11A1 1 0 0 1 1.5.63L11 6.13Z" /></svg>
                    {t('game.playNow')}
                  </Link>
                  <button className="btn btn-glass btn-lg" onClick={toggleSave}>{saved ? t('game.removeFromLibrary') : t('game.addToLibrary')}</button>
                </div>
              </div>
              <div className="hidden lg:block">
                <div className="bg-white p-5" style={{ borderRadius: 8, boxShadow: '0 24px 50px -22px rgba(0,0,0,.5)' }}>
                  <div className="grid grid-cols-2 gap-y-5">
                    <div><p className="mono" style={{ color: 'var(--color-text-sub)' }}>{t('game.best')}</p><p className="h3 mt-1">{fmt.score(best)}</p></div>
                    <div><p className="mono" style={{ color: 'var(--color-text-sub)' }}>{t('game.rounds')}</p><p className="h3 mt-1">{plays}</p></div>
                    <div><p className="mono" style={{ color: 'var(--color-text-sub)' }}>{t('game.rating')}</p><p className="h3 mt-1">★ {game.rating}</p></div>
                    <div><p className="mono" style={{ color: 'var(--color-text-sub)' }}>{t('game.playtime')}</p><p className="h3 mt-1">{fmt.time(time)}</p></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="container">
        {/* body */}
        <section className="grid lg:grid-cols-[1fr_320px] gap-14 pt-16">
          <div>
            <p className="mono" style={{ color: 'var(--color-text-sub)' }}>{t('game.about')}</p>
            <p className="mt-4" style={{ fontSize: 20, fontWeight: 330, lineHeight: 1.5, letterSpacing: '-0.012em' }}>{game.description}</p>

            <div className="grid sm:grid-cols-3 gap-6 mt-10">
              {game.features.map((f) => (
                <div key={f} className="panel p-5">
                  <p style={{ fontWeight: 480, fontSize: 15 }}>{f}</p>
                </div>
              ))}
            </div>

            <hr className="divider my-12" />

            <p className="mono" style={{ color: 'var(--color-text-sub)' }}>{t('game.controls')}</p>
            <div className="mt-5 panel overflow-hidden">
              {game.controls.map(([key, action], i) => (
                <div key={key} className="flex items-center justify-between px-5 py-4" style={i ? { borderTop: '1px solid var(--line)' } : undefined}>
                  <span className="pill pill-line" style={{ fontSize: 12 }}>{key}</span>
                  <span style={{ fontWeight: 400 }}>{action}</span>
                </div>
              ))}
            </div>
            <p className="body-sub mt-4" style={{ fontSize: 14 }}>{t('game.gamepadNote')}</p>

            <hr className="divider my-12" />

            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="mono" style={{ color: 'var(--color-text-sub)' }}>{t('game.trophies')}</p>
                <h2 className="h3 mt-2">{t('game.trophiesUnlocked', { unlocked: unlocked.length, total: game.trophies.length })}</h2>
              </div>
            </div>
            <div className="mt-6 grid sm:grid-cols-3 gap-5">
              {game.trophies.map((t) => {
                const has = unlocked.includes(t.name);
                return (
                  <div key={t.name} className="panel p-5" style={has ? undefined : { opacity: .55 }}>
                    <span className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: has ? tierColor(t.tier) : 'rgba(0,0,0,.08)' }}>
                      <svg width="15" height="15" viewBox="0 0 16 16" fill={has ? '#000' : 'rgba(0,0,0,.45)'}><path d="M4 2h8v1h2v3a3 3 0 0 1-3 3 3 3 0 0 1-2 1v2h2v2H5v-2h2v-2a3 3 0 0 1-2-1 3 3 0 0 1-3-3V3h2V2Zm0 2H3v2a2 2 0 0 0 1 1.7V4Zm9 0h-1v3.7A2 2 0 0 0 13 6V4Z" /></svg>
                    </span>
                    <p className="mt-4" style={{ fontWeight: 480 }}>{t.name}</p>
                    <p className="body-sub mt-1" style={{ fontSize: 14 }}>{t.desc}</p>
                    <p className="mono mt-3" style={{ color: 'var(--color-text-sub)' }}>{t.tier}{has ? ` · ${label('game.unlocked')}` : ''}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* sidebar */}
          <aside>
            <div className="panel-soft p-6 lg:sticky lg:top-[92px]">
              <div className="lg:hidden mb-6 grid grid-cols-2 gap-y-4">
                <div><p className="mono" style={{ color: 'var(--color-text-sub)' }}>{t('game.best')}</p><p className="h3 mt-1">{fmt.score(best)}</p></div>
                <div><p className="mono" style={{ color: 'var(--color-text-sub)' }}>{t('game.rounds')}</p><p className="h3 mt-1">{plays}</p></div>
              </div>
              <dl className="m-0 space-y-4">
                {[
                  [t('game.studio'), game.studio],
                  [t('game.genre'), game.genre],
                  [t('game.released'), game.year],
                  [t('game.players'), game.players],
                  [t('game.difficulty'), game.difficulty],
                  [t('game.downloadSize'), game.size]
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4">
                    <dt className="mono" style={{ color: 'var(--color-text-sub)' }}>{k}</dt>
                    <dd className="m-0 text-right" style={{ fontWeight: 450, fontSize: 15 }}>{v}</dd>
                  </div>
                ))}
              </dl>
              <Link className="btn btn-black w-full mt-7" href={`/play/${game.id}`}>{t('game.pressStart')}</Link>
              <p className="mono mt-3 text-center" style={{ color: 'var(--color-text-sub)' }}>{t('game.loadsInstantly')}</p>
            </div>
          </aside>
        </section>

        {/* more */}
        <section className="pt-20 pb-4">
          <div className="flex items-end justify-between gap-6 mb-8">
            <div>
              <p className="mono" style={{ color: 'var(--color-text-sub)' }}>{t('game.moreLikeThis')}</p>
              <h2 className="h2 mt-2">{t('game.ifYouLiked', { title: game.title })}</h2>
            </div>
            <Link className="btn btn-outline btn-sm hidden sm:inline-flex" href="/library">{t('game.allGames')}</Link>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-5 gap-y-9">
            {suggestions.map((g) => <GameCard key={g.id} game={g} best={bestMap[g.id] || 0} />)}
          </div>
        </section>
      </div>
    </main>
  );
}
