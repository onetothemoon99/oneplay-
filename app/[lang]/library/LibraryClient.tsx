'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type SVGProps } from 'react';
import Link from '@/components/LocaleLink';
import { useT } from '@/components/I18nProvider';
import { Store } from '@/lib/store';
import GameCard from '@/components/GameCard';
import { mergeLibrary } from '@/lib/psxCatalogue';
import { listDiscs } from '@/lib/psxDb';
import type { DiscRecord } from '@/lib/psxDb';
import type { Game } from '@/lib/games';

const PLATFORMS: [value: string, labelKey: string][] = [
  ['all', 'library.platformAll'],
  ['hub', 'library.platformHub'],
  ['psx', 'library.platformPsx']
];

const SORTS: [value: string, labelKey: string][] = [
  ['featured', 'library.sortFeatured'],
  ['rating', 'library.sortRating'],
  ['newest', 'library.sortNewest'],
  ['best', 'library.sortBest'],
  ['az', 'library.sortAz']
];

/* The header is 68px tall; the toolbar parks directly under it. */
const HEADER_H = 68;

function IconSearch(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <circle cx="7" cy="7" r="4.6" /><path d="m10.6 10.6 3.4 3.4" strokeLinecap="round" />
    </svg>
  );
}

function IconX({ size = 11 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="m2 2 8 8M10 2l-8 8" />
    </svg>
  );
}

/**
 * Fades the ends of the genre strip, but only on the side that actually has
 * something scrolled off it — a fade over a strip that fits would just clip
 * the first pill for no reason.
 */
function useScrollFade() {
  const ref = useRef<HTMLDivElement>(null);
  const [fade, setFade] = useState<'none' | 'left' | 'right' | 'both'>('none');

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const left = el.scrollLeft > 4;
    const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 4;
    setFade(left && right ? 'both' : left ? 'left' : right ? 'right' : 'none');
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    measure();
    el.addEventListener('scroll', measure, { passive: true });
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => { el.removeEventListener('scroll', measure); observer.disconnect(); };
  }, [measure]);

  return [ref, fade, measure] as const;
}

/** True once the toolbar has been pinned under the header. */
function useStuck() {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return undefined;
    const observer = new IntersectionObserver(
      ([entry]) => setStuck(!entry.isIntersecting),
      { rootMargin: `-${HEADER_H + 1}px 0px 0px 0px`, threshold: 0 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return [sentinelRef, stuck] as const;
}

export interface LibraryClientProps {
  games?: Game[];
  /** Development-only hint that the Supabase catalogue has not been seeded. */
  showFallbackNotice?: boolean;
}

export default function LibraryClient({ games = [], showFallbackNotice = false }: LibraryClientProps) {
  const t = useT();
  const [genre, setGenre] = useState('All');
  const [platform, setPlatform] = useState('all');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState('featured');
  const [bestMap, setBestMap] = useState<Record<string, number>>({});
  const [shelfCount, setShelfCount] = useState(0);
  const [discs, setDiscs] = useState<DiscRecord[]>([]);

  const [scrollerRef, fade, remeasure] = useScrollFade();
  const [sentinelRef, stuck] = useStuck();

  useEffect(() => {
    const best: Record<string, number> = {};
    games.forEach((g) => { best[g.id] = Store.best(g.id); });
    setBestMap(best);
    setShelfCount(Store.library().length);
  }, [games]);

  // The PlayStation half of the catalogue lives in this browser, so it can only
  // be read after mount — the server has no idea which discs exist.
  useEffect(() => {
    listDiscs().then(setDiscs).catch(() => setDiscs([]));
  }, []);

  const all = useMemo(
    // the badge is worded here, where translations are available
    () => mergeLibrary(games, discs).map((item) => (
      item.state === 'needs-disc' ? { ...item, badge: t('library.discNeeded') } : item
    )),
    [games, discs, t]
  );
  const hasPlaystation = all.some((g) => g.platform === 'psx');

  const genres = useMemo(() => ['All', ...new Set(all.map((g) => g.genre))], [all]);

  // A genre that only exists on the other platform would otherwise strand the
  // grid on an empty result the player cannot see the cause of.
  useEffect(() => {
    if (genre !== 'All' && !genres.includes(genre)) setGenre('All');
  }, [genre, genres]);

  // A new set of tabs can change whether the strip overflows.
  useEffect(() => { remeasure(); }, [genres, remeasure]);

  const query = q.trim().toLowerCase();

  const matchesPlatform = useCallback(
    (g: Game) => platform === 'all' || g.platform === platform,
    [platform]
  );
  const matchesSearch = useCallback(
    (g: Game) => !query || `${g.title} ${g.studio} ${g.tags.join(' ')}`.toLowerCase().includes(query),
    [query]
  );

  // Counts sit on the genre tabs, so they answer "is there anything in there"
  // before the player spends a click finding out. They honour every filter but
  // the genre itself — otherwise every tab except the open one would read 0.
  const genreCounts = useMemo(() => {
    const counts: Record<string, number> = { All: 0 };
    all.forEach((g) => {
      if (!matchesPlatform(g) || !matchesSearch(g)) return;
      counts.All += 1;
      counts[g.genre] = (counts[g.genre] || 0) + 1;
    });
    return counts;
  }, [all, matchesPlatform, matchesSearch]);

  const list = useMemo(() => {
    const l = all.filter((g) => (
      (genre === 'All' || g.genre === genre) && matchesPlatform(g) && matchesSearch(g)
    ));
    const sorters: Record<string, (a: Game, b: Game) => number> = {
      featured: () => 0,
      rating: (a, b) => b.rating - a.rating,
      newest: (a, b) => b.year - a.year,
      best: (a, b) => (bestMap[b.id] || 0) - (bestMap[a.id] || 0),
      az: (a, b) => a.title.localeCompare(b.title)
    };
    return l.slice().sort(sorters[sort]);
  }, [all, genre, matchesPlatform, matchesSearch, sort, bestMap]);

  function clearFilters() {
    setGenre('All');
    setPlatform('all');
    setQ('');
    setSort('featured');
  }

  // What is narrowing the grid right now, each one removable on its own.
  interface Chip { key: string; label: string; clear: () => void }

  const chips: Chip[] = ([
    q.trim() && { key: 'q', label: t('library.searchChip', { q: q.trim() }), clear: () => setQ('') },
    genre !== 'All' && { key: 'genre', label: genre, clear: () => setGenre('All') },
    platform !== 'all' && {
      key: 'platform',
      label: t(PLATFORMS.find(([value]) => value === platform)![1]),
      clear: () => setPlatform('all')
    }
  ] as (Chip | '' | false)[]).filter((chip): chip is Chip => Boolean(chip));

  return (
    <main>
      <section className="container pt-14 pb-9">
        <p className="mono" style={{ color: 'var(--color-text-sub)' }}>{t('library.catalogue')}</p>
        <h1 className="h1 mt-3 max-w-[16ch]">{t('library.title')}</h1>
        <p className="lead mt-5 max-w-[52ch]">{t('library.lead', { count: all.length })}</p>

        <dl className="lib-stats">
          <div className="lib-stat">
            <dt className="mono" style={{ color: 'var(--color-text-sub)' }}>{t('library.statGames')}</dt>
            <dd>{all.length}</dd>
          </div>
          <div className="lib-stat">
            <dt className="mono" style={{ color: 'var(--color-text-sub)' }}>{t('library.statGenres')}</dt>
            <dd>{Math.max(genres.length - 1, 0)}</dd>
          </div>
          {hasPlaystation && (
            <div className="lib-stat">
              <dt className="mono" style={{ color: 'var(--color-text-sub)' }}>{t('library.statDiscs')}</dt>
              <dd>{discs.length}</dd>
            </div>
          )}
        </dl>

        {showFallbackNotice && (
          <p className="mono mt-7 panel-soft inline-block px-4 py-3" style={{ color: 'var(--color-text-sub)' }}>
            {t('library.devNote')}
          </p>
        )}
      </section>

      {/* Watched instead of the bar itself: a sticky element never stops
          intersecting, so it cannot report its own pinning. */}
      <div ref={sentinelRef} aria-hidden="true" />

      <div className={`lib-bar${stuck ? ' is-stuck' : ''}`}>
        <div className="container">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <div className="relative flex-1 min-w-[200px] sm:max-w-[340px]">
              <IconSearch className="search-icon" />
              <input
                id="search"
                className="field field-search"
                type="search"
                placeholder={t('library.searchPlaceholder')}
                aria-label={t('library.searchLabel')}
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              {q && (
                <button type="button" className="search-clear" aria-label={t('library.clearSearch')} onClick={() => setQ('')}>
                  <IconX />
                </button>
              )}
            </div>

            {/* Only worth the control once there is something on both platforms. */}
            {hasPlaystation && (
              <div className="seg" role="tablist" aria-label={t('library.platform')}>
                {PLATFORMS.map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className="seg-option"
                    role="tab"
                    aria-selected={platform === value}
                    onClick={() => setPlatform(value)}
                  >
                    {t(label)}
                  </button>
                ))}
              </div>
            )}

            <div className="flex items-center gap-2 ml-auto shrink-0">
              <label className="mono whitespace-nowrap" htmlFor="sort" style={{ color: 'var(--color-text-sub)' }}>
                {t('library.sort')}
              </label>
              <div className="select-wrap">
                <select
                  id="sort"
                  className="field select-field"
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                >
                  {SORTS.map(([value, label]) => (
                    <option key={value} value={value}>{t(label)}</option>
                  ))}
                </select>
                <svg width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m1 1 4 4 4-4" />
                </svg>
              </div>
            </div>
          </div>

          <div ref={scrollerRef} className="lib-scroll scroll-x mt-2 -mx-1 px-1" data-fade={fade}>
            <div className="flex gap-1.5 py-1" role="tablist" aria-label={t('library.genre')}>
              {genres.map((g) => (
                <button
                  key={g}
                  type="button"
                  className="tab"
                  role="tab"
                  aria-selected={genre === g}
                  data-empty={genre !== g && !genreCounts[g]}
                  onClick={() => setGenre(g)}
                >
                  {g === 'All' ? t('library.allGenres') : g}
                  <span className="tab-count">{genreCounts[g] || 0}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <section className="container py-9">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3 mb-7">
          <p className="mono shrink-0" style={{ color: 'var(--color-text-sub)' }}>{t('library.count', { count: list.length })}</p>
          {chips.length > 0 && (
            <>
              <span aria-hidden="true" className="hidden sm:block h-4 w-px" style={{ background: 'var(--line)' }} />
              <div className="flex flex-wrap items-center gap-2">
                {chips.map((chip) => (
                  <span key={chip.key} className="chip">
                    <span className="chip-label">{chip.label}</span>
                    <button type="button" className="chip-x" aria-label={`${t('library.remove')}: ${chip.label}`} onClick={chip.clear}>
                      <IconX />
                    </button>
                  </span>
                ))}
                <button type="button" className="link-quiet" onClick={clearFilters}>{t('library.clearAll')}</button>
              </div>
            </>
          )}
        </div>

        {list.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-5 gap-y-10">
            {list.map((g) => <GameCard key={g.id} game={g} best={bestMap[g.id] || 0} />)}
          </div>
        ) : (
          <div className="panel-soft text-center py-20 px-6">
            <span className="empty-mark" aria-hidden="true"><IconSearch width="20" height="20" /></span>
            <p className="h3 mt-5">{t('library.noMatch')}</p>
            <p className="body-sub mt-2 max-w-[36ch] mx-auto">{t('library.noMatchBody')}</p>
            <button type="button" className="btn btn-black btn-sm mt-6" onClick={clearFilters}>{t('library.clearFilters')}</button>
          </div>
        )}
      </section>

      <section className="container pb-16 grid lg:grid-cols-2 gap-5">
        <div className="panel-soft p-8 sm:p-10 h-full flex flex-col sm:flex-row sm:items-center gap-6 justify-between">
          <div>
            <p className="mono" style={{ color: 'var(--color-text-sub)' }}>{t('library.yourShelf')}</p>
            <h2 className="h3 mt-2">{t('library.savedCount', { count: shelfCount })}</h2>
            <p className="body-sub mt-1 max-w-[42ch]">{t('library.savedBody')}</p>
          </div>
          <Link className="btn btn-black shrink-0" href="/profile">{t('library.openProfile')}</Link>
        </div>

        <div className="panel-soft p-8 sm:p-10 h-full flex flex-col sm:flex-row sm:items-center gap-6 justify-between">
          <div>
            <p className="mono" style={{ color: 'var(--color-text-sub)' }}>PlayStation</p>
            <h2 className="h3 mt-2">
              {discs.length ? t('library.psxDiscs', { count: discs.length }) : t('library.psxNone')}
            </h2>
            <p className="body-sub mt-1 max-w-[42ch]">{t('library.psxBody')}</p>
          </div>
          <Link className="btn btn-outline shrink-0" href="/play/psx">
            {discs.length ? t('library.manageDiscs') : t('library.addDisc')}
          </Link>
        </div>
      </section>
    </main>
  );
}
