'use client';

import { useEffect, useState } from 'react';
import Link from '@/components/LocaleLink';
import { useParams } from 'next/navigation';
import { GAMES, getGame, type TrophyTier } from '@/lib/games';
import { Store, fmt } from '@/lib/store';
import GameCard from '@/components/GameCard';
import { Runner } from '@/lib/runner';
import { useT } from '@/components/I18nProvider';

function tierColor(t: TrophyTier) { return t === 'Gold' ? '#FACC15' : t === 'Silver' ? '#D4D4D8' : '#D9A066'; }

export default function PlayPage() {
  const t = useT();
  const { id } = useParams<{ id: string }>();
  const game = getGame(id) || GAMES[0];

  const [plays, setPlays] = useState(0);
  const [time, setTime] = useState(0);
  const [unlocked, setUnlocked] = useState<string[]>([]);
  const [bestMap, setBestMap] = useState<Record<string, number>>({});

  // one-time-per-game data pull (mirrors the original page-load script)
  useEffect(() => {
    document.title = t('play.docTitle', { title: game.title });
    setPlays(Store.plays(game.id));
    setTime(Store.time(game.id));
    setUnlocked(game.trophies.filter((t) => Store.hasTrophy(game.id, t.name)).map((t) => t.name));
    const bm: Record<string, number> = {};
    GAMES.forEach((g) => { bm[g.id] = Store.best(g.id); });
    setBestMap(bm);
    // `game` is derived from `id` via getGame(); re-running per id change is correct.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.id]);

  // boot / tear down the canvas game engine
  useEffect(() => {
    Runner.init(game);
    return () => Runner.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.id]);

  // fullscreen toggle (kept outside the engine, same as the original page script)
  useEffect(() => {
    const btn = document.getElementById('btn-fullscreen');
    function onClick() {
      const wrap = document.getElementById('stage-wrap');
      if (!document.fullscreenElement) wrap?.requestFullscreen?.();
      else document.exitFullscreen?.();
    }
    btn?.addEventListener('click', onClick);
    return () => btn?.removeEventListener('click', onClick);
  }, []);

  const others = GAMES.filter((g) => g.id !== game.id).slice(0, 4);

  return (
    <main>
      {/* ============ CONSOLE ============ */}
      <section className="bg-black">
        <div className="container py-6 sm:py-8">

          {/* session bar */}
          <div className="flex items-center justify-between gap-4 mb-5">
            <div className="flex items-center gap-3 min-w-0">
              <Link className="btn btn-glass btn-icon shrink-0" href={`/game/${game.id}`} aria-label={t('play.backToGame')}>
                <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M9.5 3.5 5 8l4.5 4.5" /></svg>
              </Link>
              <div className="min-w-0">
                <p className="mono" style={{ color: 'rgba(255,255,255,.45)' }}>{game.genre} · {game.studio}</p>
                <p className="truncate text-white" style={{ fontWeight: 480, fontSize: 18, letterSpacing: '-0.02em' }}>{game.title}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="pill pill-inverse" id="pad-status" hidden>{t('play.controllerConnected')}</span>
              <span className="pill pill-inverse" id="hud-fps" hidden>60 FPS</span>
              <button className="btn btn-glass btn-sm" id="btn-pause">{t('play.pause')}</button>
              <button className="btn btn-white btn-sm" id="btn-fullscreen">{t('play.fullscreen')}</button>
            </div>
          </div>

          {/* stage */}
          <div className="relative mx-auto" style={{ maxWidth: 1100 }} id="stage-wrap">
            <canvas id="stage" width="960" height="540" tabIndex={0} aria-label={t('play.stage')}></canvas>

            {/* start */}
            <div className="overlay" id="overlay-start">
              <div>
                <p className="mono" style={{ color: 'rgba(255,255,255,.5)' }}>{t('play.ready')}</p>
                <h2 className="h2 text-white mt-3">{game.title}</h2>
                <p className="lead mt-3 mx-auto max-w-[40ch]" style={{ color: 'rgba(255,255,255,.7)' }}>{game.tagline}</p>
                <button className="btn btn-white btn-lg mt-7" id="btn-start">
                  <svg width="12" height="14" viewBox="0 0 12 14" fill="currentColor" aria-hidden="true"><path d="M11 6.13a1 1 0 0 1 0 1.74l-9.5 5.5A1 1 0 0 1 0 12.5v-11A1 1 0 0 1 1.5.63L11 6.13Z" /></svg>
                  {t('play.startGame')}
                </button>
                <p className="mono mt-5" style={{ color: 'rgba(255,255,255,.42)' }}>{t('play.startHint')}</p>
              </div>
            </div>

            {/* pause */}
            <div className="overlay hidden" id="overlay-pause">
              <div>
                <p className="mono" style={{ color: 'rgba(255,255,255,.5)' }}>{t('play.paused')}</p>
                <h2 className="h2 text-white mt-3">{t('play.sessionOnHold')}</h2>
                <p className="lead mt-3" style={{ color: 'rgba(255,255,255,.7)' }}>{t('play.currentScore')} <span className="text-white" id="pause-score">0</span></p>
                <div className="mt-7 flex flex-wrap gap-3 justify-center">
                  <button className="btn btn-white" id="btn-resume">{t('play.resume')}</button>
                  <button className="btn btn-glass" id="btn-restart">{t('play.restart')}</button>
                  <Link className="btn btn-glass" href="/library">{t('play.quitToLibrary')}</Link>
                </div>
              </div>
            </div>

            {/* game over */}
            <div className="overlay hidden" id="overlay-over">
              <div className="w-full max-w-[440px]">
                <p className="mono" style={{ color: 'rgba(255,255,255,.5)' }}>{t('play.roundComplete')}</p>
                <h2 className="h2 text-white mt-3">{t('play.finalScore')}</h2>
                <p className="text-white mt-2" style={{ fontSize: 56, fontWeight: 480, letterSpacing: '-0.03em', lineHeight: 1 }} id="over-score">0</p>
                <p className="mono mt-3" style={{ color: 'rgba(255,255,255,.6)' }}>{t('play.personalBest')} <span id="over-best">0</span></p>
                <p className="pill mt-4" style={{ background: '#fff', color: '#000' }} id="over-record" hidden>{t('play.newBest')}</p>

                <div className="mt-6 text-left mx-auto max-w-[300px]" id="over-trophies"></div>

                <div className="mt-7 flex flex-wrap gap-3 justify-center">
                  <button className="btn btn-white" id="btn-retry">{t('play.playAgain')}</button>
                  <Link className="btn btn-glass" href={`/game/${game.id}`}>{t('play.gamePage')}</Link>
                </div>
              </div>
            </div>
          </div>

          {/* hud */}
          <div className="mx-auto mt-5 flex flex-wrap items-center gap-x-10 gap-y-4 px-1" style={{ maxWidth: 1100 }}>
            <div>
              <p className="mono" style={{ color: 'rgba(255,255,255,.42)', fontSize: 10 }}>{t('play.hudScore')}</p>
              <p className="text-white" style={{ fontWeight: 540, fontSize: 28, letterSpacing: '-0.02em', lineHeight: 1.1 }} id="hud-score">0</p>
            </div>
            <div>
              <p className="mono" style={{ color: 'rgba(255,255,255,.42)', fontSize: 10 }}>{t('play.hudBest')}</p>
              <p className="text-white" style={{ fontWeight: 480, fontSize: 28, letterSpacing: '-0.02em', lineHeight: 1.1 }} id="hud-best">0</p>
            </div>
            <div className="flex flex-wrap items-center gap-x-8 gap-y-3" id="hud-stats"></div>
          </div>

          {/* touch pad */}
          <div id="touchpad" className="mx-auto mt-7 flex items-center justify-between gap-6" style={{ maxWidth: 1100 }}>
            <div className="grid grid-cols-3 gap-2" style={{ width: 190 }}>
              <span></span>
              <button className="padbtn" data-pad="up" aria-label={t('play.up')}>▲</button>
              <span></span>
              <button className="padbtn" data-pad="left" aria-label={t('play.left')}>◀</button>
              <button className="padbtn" data-pad="start" aria-label={t('play.start')} style={{ fontSize: 9 }}>START</button>
              <button className="padbtn" data-pad="right" aria-label={t('play.right')}>▶</button>
              <span></span>
              <button className="padbtn" data-pad="down" aria-label={t('play.down')}>▼</button>
              <span></span>
            </div>
            <button className="padbtn" data-pad="fire" aria-label={t('play.action')} style={{ width: 82, height: 82, background: 'rgba(255,255,255,.18)' }}>✕</button>
          </div>

        </div>
      </section>

      {/* ============ BELOW THE FOLD ============ */}
      <div className="container">
        <section className="grid lg:grid-cols-[1fr_320px] gap-14 pt-16">
          <div>
            <p className="mono" style={{ color: 'var(--color-text-sub)' }}>{t('play.controls')}</p>
            <h2 className="h2 mt-2">{t('play.howToPlay', { title: game.title })}</h2>
            <p className="lead mt-4 max-w-[52ch]">{game.description}</p>

            <div className="mt-8 panel overflow-hidden">
              {game.controls.map(([key, action], i) => (
                <div key={key} className="flex items-center justify-between px-5 py-4" style={i ? { borderTop: '1px solid var(--line)' } : undefined}>
                  <span className="pill pill-line" style={{ fontSize: 12 }}>{key}</span>
                  <span style={{ fontWeight: 400 }}>{action}</span>
                </div>
              ))}
            </div>

            <div className="mt-6 grid sm:grid-cols-3 gap-4">
              <div className="panel-soft p-5">
                <p className="mono" style={{ color: 'var(--color-text-sub)' }}>{t('play.keyboard')}</p>
                <p className="mt-2" style={{ fontWeight: 450, fontSize: 15 }}>{t('play.keyboardBody')}</p>
              </div>
              <div className="panel-soft p-5">
                <p className="mono" style={{ color: 'var(--color-text-sub)' }}>{t('play.gamepad')}</p>
                <p className="mt-2" style={{ fontWeight: 450, fontSize: 15 }}>{t('play.gamepadBody')}</p>
              </div>
              <div className="panel-soft p-5">
                <p className="mono" style={{ color: 'var(--color-text-sub)' }}>{t('play.touch')}</p>
                <p className="mt-2" style={{ fontWeight: 450, fontSize: 15 }}>{t('play.touchBody')}</p>
              </div>
            </div>
          </div>

          <aside>
            <div className="panel-soft p-6">
              <p className="mono" style={{ color: 'var(--color-text-sub)' }}>{t('play.trophies')}</p>
              <div className="mt-5 space-y-5">
                {game.trophies.map((trophy) => {
                  const has = unlocked.includes(trophy.name);
                  return (
                    <div key={trophy.name} className="flex items-start gap-3" style={has ? undefined : { opacity: .5 }}>
                      <span className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ background: has ? tierColor(trophy.tier) : 'rgba(0,0,0,.08)' }}>
                        <svg width="13" height="13" viewBox="0 0 16 16" fill={has ? '#000' : 'rgba(0,0,0,.45)'}><path d="M4 2h8v1h2v3a3 3 0 0 1-3 3 3 3 0 0 1-2 1v2h2v2H5v-2h2v-2a3 3 0 0 1-2-1 3 3 0 0 1-3-3V3h2V2Zm0 2H3v2a2 2 0 0 0 1 1.7V4Zm9 0h-1v3.7A2 2 0 0 0 13 6V4Z" /></svg>
                      </span>
                      <div>
                        <p style={{ fontWeight: 450, fontSize: 15 }}>{trophy.name}</p>
                        <p className="mono mt-0.5" style={{ color: 'var(--color-text-sub)', fontSize: 10 }}>{trophy.tier} · {trophy.desc}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
              <hr className="divider my-6" />
              <div className="flex justify-between"><span className="mono" style={{ color: 'var(--color-text-sub)' }}>{t('play.roundsPlayed')}</span><span style={{ fontWeight: 450 }}>{plays}</span></div>
              <div className="flex justify-between mt-3"><span className="mono" style={{ color: 'var(--color-text-sub)' }}>{t('play.playtime')}</span><span style={{ fontWeight: 450 }}>{fmt.time(time)}</span></div>
            </div>
          </aside>
        </section>

        <section className="pt-20 pb-4">
          <p className="mono" style={{ color: 'var(--color-text-sub)' }}>{t('play.switchItUp')}</p>
          <h2 className="h2 mt-2 mb-8">{t('play.otherGames')}</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-5 gap-y-9">
            {others.map((g) => <GameCard key={g.id} game={g} best={bestMap[g.id] || 0} />)}
          </div>
        </section>
      </div>
    </main>
  );
}
