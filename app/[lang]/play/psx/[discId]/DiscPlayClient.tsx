'use client';

/* ---------------------------------------------------------
   ONEPLAY — PS1 play page

   Mirrors the layout of the canvas Play page (`/play/[id]`):
   console on black up top, controls and stats below the fold.
   The disc and any BIOS dumps come out of IndexedDB, so this only
   ever renders on the client.
--------------------------------------------------------- */

import { useCallback, useEffect, useState } from 'react';
import Link from '@/components/LocaleLink';
import { useParams } from 'next/navigation';
import PsxStage from '@/components/PsxStage';
import PsxControllerPorts from '@/components/PsxControllerPorts';
import { BUTTON_GUIDE, formatBytes } from '@/lib/psx';
import * as db from '@/lib/psxDb';
import type { BiosRecord, DiscRecord } from '@/lib/psxDb';
import { fmt } from '@/lib/store';
import { useT } from '@/components/I18nProvider';

export interface DiscPlayClientProps {
  /** Signed-in player's id, for the cloud memory-card backup. null = local only. */
  userId?: string | null;
}

export default function DiscPlayClient({ userId }: DiscPlayClientProps) {
  const t = useT();
  const { discId } = useParams<{ discId: string }>();

  const [disc, setDisc] = useState<DiscRecord | null>(null);
  const [bios, setBios] = useState<BiosRecord[]>([]);
  const [others, setOthers] = useState<DiscRecord[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [record, biosList, all] = await Promise.all([db.getDisc(discId), db.listBios(), db.listDiscs()]);
        if (cancelled) return;
        if (!record) { setStatus('missing'); return; }
        document.title = t('disc.docTitle', { title: record.title });
        setDisc(record);
        setBios(biosList);
        setOthers(all.filter((other) => other.id !== discId).slice(0, 4));
        setStatus('ready');
      } catch (err) {
        if (cancelled) return;
        setError((err as Error).message);
        setStatus('error');
      }
    })();

    return () => { cancelled = true; };
  }, [discId, t]);

  /* keep the sidebar counters honest once a session ends */
  const onSession = useCallback((seconds: number) => {
    if (seconds <= 5) return;
    setDisc((current) => (current ? {
      ...current,
      plays: (current.plays || 0) + 1,
      seconds: (current.seconds || 0) + Math.round(seconds)
    } : current));
  }, []);

  if (status === 'loading') {
    return (
      <section className="bg-black">
        <div className="container py-24">
          <p className="mono" style={{ color: 'rgba(255,255,255,.5)' }}>{t('disc.loading')}</p>
          <h1 className="h2 text-white mt-3">{t('disc.fetching')}</h1>
        </div>
      </section>
    );
  }

  if (status !== 'ready' || !disc) {
    return (
      <section className="bg-black">
        <div className="container py-24">
          <p className="mono" style={{ color: 'rgba(255,255,255,.5)' }}>{status === 'missing' ? t('disc.noDisc') : t('disc.error')}</p>
          <h1 className="h2 text-white mt-3">
            {status === 'missing' ? t('disc.missingTitle') : t('disc.storageTitle')}
          </h1>
          <p className="lead mt-4 max-w-[52ch]" style={{ color: 'rgba(255,255,255,.7)' }}>
            {status === 'missing' ? t('disc.missingBody') : error}
          </p>
          <Link className="btn btn-white mt-7" href="/play/psx">{t('disc.backToShelf')}</Link>
        </div>
      </section>
    );
  }

  return (
    <>
      {/* ============ CONSOLE ============ */}
      <div className="bg-black">
        <div className="container pt-6 sm:pt-8">
          <Link className="btn btn-glass btn-sm" href="/play/psx">
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9.5 3.5 5 8l4.5 4.5" /></svg>
            {t('disc.allDiscs')}
          </Link>
        </div>
      </div>

      <PsxStage key={disc.id} disc={disc} bios={bios} userId={userId} onSession={onSession} />

      {/* ============ BELOW THE FOLD ============ */}
      <div className="container">
        <section className="grid lg:grid-cols-[1fr_320px] gap-14 pt-16">
          <div>
            <p className="mono" style={{ color: 'var(--color-text-sub)' }}>{t('disc.controls')}</p>
            <h2 className="h2 mt-2">{t('disc.controlsTitle')}</h2>
            <p className="lead mt-4 max-w-[52ch]">{t('disc.controlsLead')}</p>

            <div className="mt-8 panel overflow-hidden">
              {BUTTON_GUIDE.map(([button, glyph, key], index) => (
                <div
                  key={button}
                  className="flex items-center justify-between px-5 py-4"
                  style={index ? { borderTop: '1px solid var(--line)' } : undefined}
                >
                  <span className="pill pill-line" style={{ fontSize: 12 }}>{key}</span>
                  <span style={{ fontWeight: 400 }}>{glyph}</span>
                </div>
              ))}
            </div>

            <div className="mt-6 grid sm:grid-cols-2 gap-4">
              <div className="panel-soft p-5">
                <p className="mono" style={{ color: 'var(--color-text-sub)' }}>{t('disc.analog')}</p>
                <p className="mt-2" style={{ fontWeight: 450, fontSize: 15 }}>{t('disc.analogBody')}</p>
              </div>
              <div className="panel-soft p-5">
                <p className="mono" style={{ color: 'var(--color-text-sub)' }}>{t('disc.touch')}</p>
                <p className="mt-2" style={{ fontWeight: 450, fontSize: 15 }}>{t('disc.touchBody')}</p>
              </div>
              <div className="panel-soft p-5">
                <p className="mono" style={{ color: 'var(--color-text-sub)' }}>{t('disc.memoryCard')}</p>
                <p className="mt-2" style={{ fontWeight: 450, fontSize: 15 }}>{t('disc.memoryCardBody')}</p>
              </div>
              <div className="panel-soft p-5">
                <p className="mono" style={{ color: 'var(--color-text-sub)' }}>{t('disc.saveStates')}</p>
                <p className="mt-2" style={{ fontWeight: 450, fontSize: 15 }}>{t('disc.saveStatesBody')}</p>
              </div>
            </div>
          </div>

          <aside className="space-y-6">
            <PsxControllerPorts />

            <div className="panel-soft p-6">
              <p className="mono" style={{ color: 'var(--color-text-sub)' }}>{t('disc.disc')}</p>
              <p className="mt-2" style={{ fontWeight: 500, fontSize: 18, letterSpacing: '-0.02em' }}>{disc.title}</p>

              <hr className="divider my-5" />
              <div className="flex justify-between"><span className="mono" style={{ color: 'var(--color-text-sub)' }}>{t('disc.bootFile')}</span><span className="mono truncate ml-3" style={{ fontSize: 11 }}>{disc.mainFile}</span></div>
              <div className="flex justify-between mt-3"><span className="mono" style={{ color: 'var(--color-text-sub)' }}>{t('disc.files')}</span><span style={{ fontWeight: 450 }}>{db.discFileCount(disc)}</span></div>
              <div className="flex justify-between mt-3"><span className="mono" style={{ color: 'var(--color-text-sub)' }}>{t('disc.source')}</span><span style={{ fontWeight: 450 }}>{disc.source === 'fsa' ? t('disc.sourceLinked') : t('disc.sourceCopied')}</span></div>
              <div className="flex justify-between mt-3"><span className="mono" style={{ color: 'var(--color-text-sub)' }}>{t('disc.size')}</span><span style={{ fontWeight: 450 }}>{formatBytes(disc.size)}</span></div>
              <div className="flex justify-between mt-3"><span className="mono" style={{ color: 'var(--color-text-sub)' }}>{t('disc.sessions')}</span><span style={{ fontWeight: 450 }}>{disc.plays || 0}</span></div>
              <div className="flex justify-between mt-3"><span className="mono" style={{ color: 'var(--color-text-sub)' }}>{t('disc.playtime')}</span><span style={{ fontWeight: 450 }}>{fmt.time(disc.seconds)}</span></div>
              <div className="flex justify-between mt-3"><span className="mono" style={{ color: 'var(--color-text-sub)' }}>BIOS</span><span style={{ fontWeight: 450 }}>{bios.length ? t('disc.biosInstalled', { count: bios.length }) : 'HLE'}</span></div>
            </div>
          </aside>
        </section>

        {others.length ? (
          <section className="pt-20 pb-4">
            <p className="mono" style={{ color: 'var(--color-text-sub)' }}>{t('disc.switchItUp')}</p>
            <h2 className="h2 mt-2 mb-8">{t('disc.otherDiscs')}</h2>
            <div className="panel overflow-hidden">
              {others.map((other, index) => (
                <div
                  key={other.id}
                  className="flex items-center justify-between gap-4 px-5 py-4"
                  style={index ? { borderTop: '1px solid var(--line)' } : undefined}
                >
                  <div className="min-w-0">
                    <p className="truncate" style={{ fontWeight: 450, fontSize: 16 }}>{other.title}</p>
                    <p className="mono mt-1" style={{ color: 'var(--color-text-sub)', fontSize: 10 }}>{formatBytes(other.size)} · {fmt.time(other.seconds)}</p>
                  </div>
                  <Link className="btn btn-black btn-sm shrink-0" href={`/play/psx/${other.id}`}>{t('disc.play')}</Link>
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </>
  );
}
