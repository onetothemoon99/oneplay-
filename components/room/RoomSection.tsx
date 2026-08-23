'use client';

/* ---------------------------------------------------------
   ONEPLAY — the room, and everything the room cannot do

   The 3D gallery is loaded only in the browser and only when it can
   run. Underneath it sits a real list of links: that list is what a
   crawler reads, what a screen reader announces and what the keyboard
   walks through, and focus moving along it lights the matching frame
   in the scene. If WebGL is missing, the motion preference says no,
   or the canvas simply has not loaded yet, the list is shown as the
   familiar grid instead and nothing is lost.
--------------------------------------------------------- */

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link, { localePath } from '@/components/LocaleLink';
import GameCard from '@/components/GameCard';
import LogoAnimation from './LogoAnimation';
import { useLocale, useT } from '@/components/I18nProvider';
import type { Game } from '@/lib/games';

// three is ~150KB gzipped; it has no business in the first load of a
// page that must also boot an emulator elsewhere.
const GameRoom = dynamic(() => import('./GameRoom'), { ssr: false });

const WALL_CAPACITY = 8;

export interface RoomSectionProps {
  games: Game[];
  /** game id -> personal best, read from localStorage after mount. */
  bestMap?: Record<string, number>;
}

export default function RoomSection({ games, bestMap = {} }: RoomSectionProps) {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();

  const [canRender3D, setCanRender3D] = useState(false);
  const [touch, setTouch] = useState(false);
  const [hovered, setHovered] = useState<Game | null>(null);
  const [focused, setFocused] = useState(-1);

  useEffect(() => {
    // WebGL, and only if the reader has not asked for stillness
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let supported = false;
    try {
      const probe = document.createElement('canvas');
      supported = Boolean(probe.getContext('webgl2') || probe.getContext('webgl'));
    } catch { supported = false; }
    setCanRender3D(supported && !reduceMotion);
    setTouch(window.matchMedia('(hover: none)').matches);
  }, []);

  const onSelect = useCallback((game: Game) => {
    router.push(localePath(`/game/${game.id}`, locale));
  }, [locale, router]);

  const onHover = useCallback((game: Game | null) => setHovered(game), []);

  const wall = games.slice(0, WALL_CAPACITY);
  const shown = hovered || (focused >= 0 ? wall[focused] : null);

  return (
    <>
    <section className={`room ${canRender3D ? 'room-live' : ''}`}>
      {canRender3D ? <GameRoom games={wall} onHover={onHover} onSelect={onSelect} focusedIndex={focused} className="room-canvas" /> : null}

      <div className="container room-inner">
        <div className="room-copy">
          {/* The animation says the headline; the h1 stays in the markup for
              the crawler and the screen reader. It is part of this tree, not
              a frame, so it shares the page's fonts and dark ground and reads
              as the set rather than as an embedded clip. */}
          <h1 className="sr-only">
            {t('home.titleLine1')} {t('home.titleLine2')}
          </h1>
          <LogoAnimation />

          {canRender3D ? (
            <p className="mono room-hint mt-6" aria-hidden="true">
              {shown ? `${shown.title} — ${shown.genre}` : t(touch ? 'home.roomHintTouch' : 'home.roomHint')}
            </p>
          ) : null}
        </div>
      </div>

      {/* The wall, as markup — hidden until something in it takes focus, at
          which point it becomes a visible index and lights the frames. */}
      {canRender3D ? (
        <div className="room-index">
          <ul className="room-index-list">
            {wall.map((game, index) => (
              <li key={game.id}>
                <Link
                  href={`/game/${game.id}`}
                  onFocus={() => setFocused(index)}
                  onBlur={() => setFocused(-1)}
                >
                  {game.title} — {game.genre}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>

    {canRender3D ? null : (
      <section className="container pt-20">
        <p className="mono mb-6" style={{ color: 'var(--color-text-sub)' }}>{t('home.theLibrary')}</p>
        <h2 className="h2 mb-8 max-w-[18ch]">{t('home.libraryTitle')}</h2>
        <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-5 gap-y-9 list-none p-0 m-0">
          {wall.map((game) => (
            <li key={game.id}><GameCard game={game} best={bestMap[game.id] || 0} /></li>
          ))}
        </ul>
      </section>
    )}
    </>
  );
}
