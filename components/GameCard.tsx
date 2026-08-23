'use client';

import Link from '@/components/LocaleLink';
import CoverArt from './CoverArt';
import { useT } from '@/components/I18nProvider';
import type { Game } from '@/lib/games';
import { fmt } from '@/lib/store';

export interface GameCardProps {
  game: Game;
  best?: number;
  showBest?: boolean;
}

/**
 * `game.href` overrides the default game page — PlayStation entries point
 * straight at the disc (or at /play/psx when the player has not added it yet).
 * `game.badge` is drawn over the cover for anything that is not ready to play.
 */
export default function GameCard({ game, best = 0, showBest = true }: GameCardProps) {
  const t = useT();
  const pending = Boolean(game.badge);

  return (
    <Link className="game-card" href={game.href || `/game/${game.id}`}>
      <div className="relative">
        <CoverArt game={game} />
        {pending ? (
          <div className="absolute top-3 right-3">
            <span className="pill" style={{ background: '#fff', color: '#000' }}>{game.badge}</span>
          </div>
        ) : (
          <div className="play-fab absolute bottom-3 right-3">
            <span className="btn btn-white btn-icon shadow-lg" aria-hidden="true">
              <svg width="14" height="14" viewBox="0 0 12 14" fill="currentColor"><path d="M11 6.13a1 1 0 0 1 0 1.74l-9.5 5.5A1 1 0 0 1 0 12.5v-11A1 1 0 0 1 1.5.63L11 6.13Z"/></svg>
            </span>
          </div>
        )}
      </div>
      <div className="pt-3">
        <p className="card-title" style={{ fontWeight: 480, letterSpacing: '-0.015em' }}>{game.title}</p>
        <p className="mono mt-1.5" style={{ color: 'var(--color-text-sub)' }}>
          {game.studio}{showBest && best ? ` · ${t('card.best')} ${fmt.score(best)}` : ''}
        </p>
      </div>
    </Link>
  );
}
