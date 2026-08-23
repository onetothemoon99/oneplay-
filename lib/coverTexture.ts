/* ---------------------------------------------------------
   ONEPLAY — game covers, painted onto a canvas

   The covers on the rest of the site are CSS gradients. A texture in
   a 3D scene cannot be CSS, so this redraws the same thing with the
   2D context: the accent sweep, the soft highlights, the faint grid
   and the glyph. Same three colours in, same picture out.

   Also paints the little museum plaque that hangs under each frame,
   because a room of unlabelled pictures is a puzzle, not a library.
--------------------------------------------------------- */

import type { Game } from './games';

const COVER_W = 512;
const COVER_H = 683;   // 3:4, matching CoverArt

export function paintCover(game: Game): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = COVER_W;
  canvas.height = COVER_H;
  const ctx = canvas.getContext('2d')!;

  const [c1, c2, c3] = game.accent?.length === 3 ? game.accent : ['#1B1D26', '#F2794A', '#7E92F5'];

  // the 135° sweep
  const sweep = ctx.createLinearGradient(0, 0, COVER_W, COVER_H);
  sweep.addColorStop(0, c1);
  sweep.addColorStop(0.55, c2);
  sweep.addColorStop(1, c3);
  ctx.fillStyle = sweep;
  ctx.fillRect(0, 0, COVER_W, COVER_H);

  // highlight top-left, shade bottom-right — the same two radials as the CSS
  const light = ctx.createRadialGradient(COVER_W * 0.22, COVER_H * 0.26, 0, COVER_W * 0.22, COVER_H * 0.26, COVER_W * 0.75);
  light.addColorStop(0, 'rgba(255,255,255,.42)');
  light.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = light;
  ctx.fillRect(0, 0, COVER_W, COVER_H);

  const shade = ctx.createRadialGradient(COVER_W * 0.82, COVER_H * 0.74, 0, COVER_W * 0.82, COVER_H * 0.74, COVER_W * 0.7);
  shade.addColorStop(0, 'rgba(0,0,0,.30)');
  shade.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, COVER_W, COVER_H);

  // the grid, fading out towards the top
  ctx.save();
  const fade = ctx.createLinearGradient(0, COVER_H, 0, COVER_H * 0.15);
  fade.addColorStop(0, 'rgba(255,255,255,.22)');
  fade.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.strokeStyle = fade;
  ctx.lineWidth = 1;
  for (let x = 0; x <= COVER_W; x += 32) {
    ctx.beginPath(); ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, COVER_H); ctx.stroke();
  }
  for (let y = 0; y <= COVER_H; y += 32) {
    ctx.beginPath(); ctx.moveTo(0, y + 0.5); ctx.lineTo(COVER_W, y + 0.5); ctx.stroke();
  }
  ctx.restore();

  // the glyph, bottom-left, sitting in the art rather than on top of it
  ctx.save();
  ctx.globalCompositeOperation = 'soft-light';
  ctx.fillStyle = '#ffffff';
  ctx.font = `700 ${Math.round(COVER_W * 0.32)}px "IBM Plex Mono", monospace`;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(game.glyph || '??', COVER_W * 0.07, COVER_H * 0.93);
  ctx.restore();

  return canvas;
}

const PLAQUE_W = 512;
const PLAQUE_H = 128;

export interface PlaqueText {
  title?: string;
  subtitle?: string;
}

/** The engraved label under a frame: title on top, genre beneath. */
export function paintPlaque(game: Game, { title, subtitle }: PlaqueText = {}): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = PLAQUE_W;
  canvas.height = PLAQUE_H;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#C9C3B4';
  ctx.fillRect(0, 0, PLAQUE_W, PLAQUE_H);

  const sheen = ctx.createLinearGradient(0, 0, 0, PLAQUE_H);
  sheen.addColorStop(0, 'rgba(255,255,255,.5)');
  sheen.addColorStop(0.5, 'rgba(255,255,255,0)');
  sheen.addColorStop(1, 'rgba(0,0,0,.18)');
  ctx.fillStyle = sheen;
  ctx.fillRect(0, 0, PLAQUE_W, PLAQUE_H);

  ctx.fillStyle = '#1B1D26';
  ctx.textAlign = 'center';
  ctx.font = '600 40px "Chakra Petch", system-ui, sans-serif';
  ctx.fillText(title ?? game.title, PLAQUE_W / 2, 56, PLAQUE_W - 40);

  ctx.fillStyle = 'rgba(27,29,38,.62)';
  ctx.font = '400 26px "IBM Plex Mono", monospace';
  ctx.fillText(subtitle ?? game.genre, PLAQUE_W / 2, 96, PLAQUE_W - 40);

  return canvas;
}
