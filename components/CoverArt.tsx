import type { CSSProperties } from 'react';
import type { Game } from '@/lib/games';

/** The three accent stops, as the CSS custom properties `.cover` reads. */
export function coverStyle(game: Pick<Game, 'accent'>): CSSProperties {
  return {
    '--c1': game.accent[0],
    '--c2': game.accent[1],
    '--c3': game.accent[2]
  } as CSSProperties;
}

export interface CoverArtProps {
  game: Pick<Game, 'accent' | 'glyph' | 'genre'>;
  ratio?: string;
  glyphSize?: string;
  className?: string;
}

export default function CoverArt({
  game,
  ratio = 'aspect-[3/4]',
  glyphSize = 'text-[64px]',
  className = ''
}: CoverArtProps) {
  return (
    <div className={`cover ${ratio} ${className}`} style={coverStyle(game)}>
      <div className="absolute inset-0 flex items-end p-4">
        <span className={`cover-glyph ${glyphSize}`}>{game.glyph}</span>
      </div>
      <div className="absolute top-3 left-3">
        <span className="pill pill-inverse">{game.genre}</span>
      </div>
    </div>
  );
}
