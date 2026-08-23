/* ---------------------------------------------------------
   ONEPLAY — the mark

   Straight from the identity sheet: a D-pad on an ink tile, arms in
   Cartridge, the centre in Signal with a play triangle cut out of it.
   Drawn on a 64 unit grid — 12 unit cells, 2 unit gaps, outer corners
   rounded and inner corners square, which is what keeps it reading as
   a pad rather than a flower at 18px.
--------------------------------------------------------- */

export interface LogoMarkProps {
  size?: number;
  className?: string;
}

export function LogoMark({ size = 30, className = '' }: LogoMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <rect width="64" height="64" rx="14" fill="var(--color-ink)" />

      {/* arms */}
      <path d="M26 24V15a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3v9Z" fill="var(--color-cartridge)" />
      <path d="M24 26h-9a3 3 0 0 0-3 3v6a3 3 0 0 0 3 3h9Z" fill="var(--color-cartridge)" />
      <path d="M40 26h9a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3h-9Z" fill="var(--color-cartridge)" />
      <path d="M26 40v9a3 3 0 0 0 3 3h6a3 3 0 0 0 3-3v-9Z" fill="var(--color-cartridge)" />

      {/* centre, with the play triangle punched through it */}
      <path
        d="M26 26h12v12H26z M30.5 28.5 37 32l-6.5 3.5Z"
        fill="var(--color-signal)"
        fillRule="evenodd"
      />
    </svg>
  );
}

/** "One" in the surrounding colour, "Play" in Cartridge — never both. */
export function Wordmark({ size = 17 }: { size?: number }) {
  return (
    <span style={{ fontWeight: 700, letterSpacing: '-0.03em', fontSize: size }}>
      One<span style={{ color: 'var(--color-cartridge)' }}>Play</span>
    </span>
  );
}

export interface LogoProps {
  size?: number;
  wordSize?: number;
  className?: string;
}

export default function Logo({ size = 30, wordSize = 17, className = '' }: LogoProps) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark size={size} />
      <Wordmark size={wordSize} />
    </span>
  );
}
