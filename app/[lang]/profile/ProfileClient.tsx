'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import Link from '@/components/LocaleLink';
import { GAMES, getGame, type Game, type TrophyTier } from '@/lib/games';
import { Store, fmt } from '@/lib/store';
import GameCard from '@/components/GameCard';
import CoverArt from '@/components/CoverArt';
import VipTopupPanel from '@/components/VipTopupPanel';
import { useT } from '@/components/I18nProvider';

function tierColor(t: TrophyTier) { return t === 'Gold' ? '#FACC15' : t === 'Silver' ? '#D4D4D8' : '#D9A066'; }

const TOTAL_TROPHIES = GAMES.reduce((n, g) => n + g.trophies.length, 0);

/** Everything the page shows, filled in from localStorage after mount. */
interface ProfileData {
  name: string;
  /** The one-line summary under the player name. */
  sub: string;
  level: number;
  trophiesEarned: number;
  plays: number;
  time: number;
  /** Trophy completion, 0-100. */
  pct: number;
  recent: Game[];
  shelf: Game[];
  bestMap: Record<string, number>;
  playsMap: Record<string, number>;
  timeMap: Record<string, number>;
  /** game id -> the names of the trophies unlocked on it. */
  unlockedMap: Record<string, Set<string>>;
}

export interface ProfileClientProps {
  isVip?: boolean;
  userId?: string | null;
}

export default function ProfileClient({ isVip = false, userId = null }: ProfileClientProps) {
  const t = useT();
  const [data, setData] = useState<ProfileData>({
    name: '',
    sub: '',
    level: 1,
    trophiesEarned: 0,
    plays: 0,
    time: 0,
    pct: 0,
    recent: [],
    shelf: [],
    bestMap: {},
    playsMap: {},
    timeMap: {},
    unlockedMap: {}
  });

  useEffect(() => {
    const settings = Store.settings();
    const totalPlays = GAMES.reduce((n, g) => n + Store.plays(g.id), 0);
    const totalTime = GAMES.reduce((n, g) => n + Store.time(g.id), 0);
    const earned = Store.trophies().length;
    const pct = TOTAL_TROPHIES ? Math.round((earned / TOTAL_TROPHIES) * 100) : 0;

    const bestMap: Record<string, number> = {};
    const playsMap: Record<string, number> = {};
    const timeMap: Record<string, number> = {};
    const unlockedMap: Record<string, Set<string>> = {};
    GAMES.forEach((g) => {
      bestMap[g.id] = Store.best(g.id);
      playsMap[g.id] = Store.plays(g.id);
      timeMap[g.id] = Store.time(g.id);
      unlockedMap[g.id] = new Set(g.trophies.filter((t) => Store.hasTrophy(g.id, t.name)).map((t) => t.name));
    });

    setData({
      name: settings.name,
      sub: totalPlays
        ? t('profile.subPlayed', { rounds: totalPlays, time: fmt.time(totalTime) })
        : t('profile.subFresh'),
      level: 1 + Math.floor(earned * 1.5 + totalPlays / 4),
      trophiesEarned: earned,
      plays: totalPlays,
      time: totalTime,
      pct,
      recent: Store.recent(),
      shelf: Store.library().map(getGame).filter((g): g is Game => Boolean(g)),
      bestMap, playsMap, timeMap, unlockedMap
    });
  }, [t]);

  const scoreRows = GAMES.slice().sort((a, b) => (data.bestMap[b.id] || 0) - (data.bestMap[a.id] || 0));

  return (
    <main className="container">
      {/* header card */}
      <section className="pt-10">
        <div className="cover px-8 py-12 sm:px-12" style={{ '--c1': 'var(--color-ink)', '--c2': '#2A3050', '--c3': 'var(--color-signal)' } as CSSProperties}>
          <div className="flex flex-col sm:flex-row sm:items-end gap-7">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://picsum.photos/seed/pshub-avatar/200/200"
              alt=""
              width={104}
              height={104}
              className="rounded-full shrink-0"
              style={{ border: '3px solid rgba(255,255,255,.85)' }}
            />
            <div className="flex-1">
              <p className="mono" style={{ color: 'rgba(255,255,255,.6)' }}>{t('profile.playerProfile')}</p>
              <div className="flex items-center gap-3 mt-2">
                <h1 className="h1 text-white">{data.name || t('profile.defaultName')}</h1>
                {isVip ? <span className="pill pill-inverse" style={{ borderColor: 'rgba(250,204,21,.5)' }}>{t('profile.vipBadge')}</span> : null}
              </div>
              <p className="lead mt-2" style={{ color: 'rgba(255,255,255,.78)' }}>{data.sub}</p>
              {isVip ? <p className="mono mt-1" style={{ color: 'rgba(250,204,21,.85)', fontSize: 11 }}>{t('profile.vipHint')}</p> : null}
            </div>
            <Link className="btn btn-white shrink-0" href="/settings">{t('profile.editProfile')}</Link>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mt-12">
            <div><p className="mono" style={{ color: 'rgba(255,255,255,.55)' }}>{t('profile.level')}</p><p className="text-white mt-1" style={{ fontSize: 34, fontWeight: 480, letterSpacing: '-0.02em' }}>{data.level}</p></div>
            <div><p className="mono" style={{ color: 'rgba(255,255,255,.55)' }}>{t('profile.trophies')}</p><p className="text-white mt-1" style={{ fontSize: 34, fontWeight: 480, letterSpacing: '-0.02em' }}>{data.trophiesEarned} / {TOTAL_TROPHIES}</p></div>
            <div><p className="mono" style={{ color: 'rgba(255,255,255,.55)' }}>{t('profile.rounds')}</p><p className="text-white mt-1" style={{ fontSize: 34, fontWeight: 480, letterSpacing: '-0.02em' }}>{data.plays}</p></div>
            <div><p className="mono" style={{ color: 'rgba(255,255,255,.55)' }}>{t('profile.playtime')}</p><p className="text-white mt-1" style={{ fontSize: 34, fontWeight: 480, letterSpacing: '-0.02em' }}>{fmt.time(data.time)}</p></div>
          </div>

          <div className="mt-10">
            <div className="flex justify-between mb-2">
              <span className="mono" style={{ color: 'rgba(255,255,255,.6)' }}>{t('profile.trophyProgress')}</span>
              <span className="mono" style={{ color: 'rgba(255,255,255,.6)' }}>{data.pct}%</span>
            </div>
            <div style={{ height: 6, borderRadius: 50, background: 'rgba(255,255,255,.2)' }}>
              <div style={{ height: 6, borderRadius: 50, background: '#fff', width: `${data.pct}%`, transition: 'width .8s cubic-bezier(.2,.8,.3,1)' }}></div>
            </div>
          </div>
        </div>
      </section>

      {!isVip ? <VipTopupPanel userId={userId} /> : null}

      {/* recent */}
      {data.recent.length > 0 && (
        <section className="pt-20">
          <div className="flex items-end justify-between gap-6 mb-8">
            <div>
              <p className="mono" style={{ color: 'var(--color-text-sub)' }}>{t('profile.activity')}</p>
              <h2 className="h2 mt-2">{t('profile.recentlyPlayed')}</h2>
            </div>
            <Link className="btn btn-outline btn-sm hidden sm:inline-flex" href="/library">{t('profile.findNew')}</Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-5">
            {data.recent.map((g) => (
              <Link key={g.id} className="game-card" href={`/play/${g.id}`}>
                <CoverArt game={g} ratio="aspect-[16/10]" glyphSize="text-[34px]" />
                <p className="mt-2.5 card-title" style={{ fontWeight: 480, fontSize: 15 }}>{g.title}</p>
                <p className="mono mt-1" style={{ color: 'var(--color-text-sub)' }}>{t('profile.best')} {fmt.score(data.bestMap[g.id] || 0)}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* shelf */}
      <section className="pt-20">
        <div className="flex items-end justify-between gap-6 mb-8">
          <div>
            <p className="mono" style={{ color: 'var(--color-text-sub)' }}>{t('profile.yourLibrary')}</p>
            <h2 className="h2 mt-2">{t('profile.savedGames')}</h2>
          </div>
          <Link className="btn btn-outline btn-sm hidden sm:inline-flex" href="/library">{t('profile.addMore')}</Link>
        </div>
        {data.shelf.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-5 gap-y-9">
            {data.shelf.map((g) => <GameCard key={g.id} game={g} best={data.bestMap[g.id] || 0} />)}
          </div>
        ) : (
          <div className="panel-soft text-center py-16 px-6">
            <p className="h3">{t('profile.nothingSaved')}</p>
            <p className="body-sub mt-2 max-w-[36ch] mx-auto">{t('profile.nothingSavedBody')}</p>
            <Link className="btn btn-black btn-sm mt-6" href="/library">{t('profile.browseGames')}</Link>
          </div>
        )}
      </section>

      {/* scores */}
      <section className="pt-20">
        <p className="mono" style={{ color: 'var(--color-text-sub)' }}>{t('profile.personalBests')}</p>
        <h2 className="h2 mt-2 mb-8">{t('profile.scoreBoard')}</h2>
        <div className="panel overflow-hidden">
          <div className="scroll-x">
            <table className="w-full" style={{ borderCollapse: 'collapse', minWidth: 620 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--line)' }}>
                  <th className="mono text-left px-6 py-4" style={{ color: 'var(--color-text-sub)', fontWeight: 420 }}>{t('profile.colGame')}</th>
                  <th className="mono text-left px-6 py-4" style={{ color: 'var(--color-text-sub)', fontWeight: 420 }}>{t('profile.colGenre')}</th>
                  <th className="mono text-right px-6 py-4" style={{ color: 'var(--color-text-sub)', fontWeight: 420 }}>{t('profile.colRounds')}</th>
                  <th className="mono text-right px-6 py-4" style={{ color: 'var(--color-text-sub)', fontWeight: 420 }}>{t('profile.colPlaytime')}</th>
                  <th className="mono text-right px-6 py-4" style={{ color: 'var(--color-text-sub)', fontWeight: 420 }}>{t('profile.colBest')}</th>
                  <th className="px-6 py-4"></th>
                </tr>
              </thead>
              <tbody>
                {scoreRows.map((g, i) => (
                  <tr key={g.id} style={i ? { borderTop: '1px solid var(--line)' } : undefined}>
                    <td className="px-6 py-4">
                      <Link className="no-underline text-black inline-flex items-center gap-3 hover:underline" href={`/game/${g.id}`}>
                        <span className="cover inline-block w-9 h-9 shrink-0" style={{ '--c1': g.accent[0], '--c2': g.accent[1], '--c3': g.accent[2], borderRadius: 6 } as CSSProperties}></span>
                        <span style={{ fontWeight: 450 }}>{g.title}</span>
                      </Link>
                    </td>
                    <td className="px-6 py-4 body-sub" style={{ fontSize: 14 }}>{g.genre}</td>
                    <td className="px-6 py-4 text-right" style={{ fontWeight: 400 }}>{data.playsMap[g.id] || 0}</td>
                    <td className="px-6 py-4 text-right body-sub" style={{ fontSize: 14 }}>{fmt.time(data.timeMap[g.id] || 0)}</td>
                    <td className="px-6 py-4 text-right" style={{ fontWeight: 540 }}>{fmt.score(data.bestMap[g.id] || 0)}</td>
                    <td className="px-6 py-4 text-right"><Link className="btn btn-ghost btn-sm" href={`/play/${g.id}`}>{t('profile.play')}</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* trophies */}
      <section id="trophies" className="pt-20 pb-4">
        <p className="mono" style={{ color: 'var(--color-text-sub)' }}>{t('profile.cabinet')}</p>
        <h2 className="h2 mt-2 mb-8">{t('profile.trophies')}</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {GAMES.flatMap((g) => g.trophies.map((trophy) => {
            const has = data.unlockedMap[g.id]?.has(trophy.name);
            return (
              <div key={g.id + trophy.name} className="panel p-5 flex items-start gap-4" style={has ? undefined : { opacity: .5 }}>
                <span className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: has ? tierColor(trophy.tier) : 'rgba(0,0,0,.08)' }}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill={has ? '#000' : 'rgba(0,0,0,.45)'}><path d="M4 2h8v1h2v3a3 3 0 0 1-3 3 3 3 0 0 1-2 1v2h2v2H5v-2h2v-2a3 3 0 0 1-2-1 3 3 0 0 1-3-3V3h2V2Zm0 2H3v2a2 2 0 0 0 1 1.7V4Zm9 0h-1v3.7A2 2 0 0 0 13 6V4Z" /></svg>
                </span>
                <div className="min-w-0">
                  <p style={{ fontWeight: 480 }}>{trophy.name}</p>
                  <p className="body-sub mt-1" style={{ fontSize: 14 }}>{trophy.desc}</p>
                  <p className="mono mt-2" style={{ color: 'var(--color-text-sub)' }}>{g.title} · {trophy.tier}{has ? ` · ${t('profile.unlocked')}` : ''}</p>
                </div>
              </div>
            );
          }))}
        </div>
      </section>
    </main>
  );
}
