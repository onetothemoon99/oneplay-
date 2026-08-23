'use client';

import { useEffect, useState } from 'react';
import Link from '@/components/LocaleLink';
import { GAMES } from '@/lib/games';
import { Store, type Settings } from '@/lib/store';
import { useT } from '@/components/I18nProvider';

const DIFFICULTIES = ['casual', 'normal', 'hard'];
/* Stored as stable ids so a language switch does not rewrite the saved value. */
const REGIONS = ['sea', 'europe', 'northAmerica', 'japan'];

/* The form always has a region, even before one has been saved. */
type SettingsForm = Settings & { region: string };

export default function SettingsClient() {
  const t = useT();
  const [settings, setSettings] = useState<SettingsForm>({
    name: 'Player One',
    region: 'sea',
    difficulty: 'normal',
    sound: true,
    haptics: true,
    showFps: false,
    reduceFlash: false
  });
  const [note, setNote] = useState('settings.autosave');
  const [counts, setCounts] = useState({ plays: 0, trophies: 0, library: 0 });

  useEffect(() => {
    setSettings((prev) => ({ ...prev, ...Store.settings() }));
    refreshCounts();
  }, []);

  function refreshCounts() {
    setCounts({
      plays: GAMES.reduce((n, g) => n + Store.plays(g.id), 0),
      trophies: Store.trophies().length,
      library: Store.library().length
    });
  }

  // notes are held as keys so a language switch mid-page still reads right
  function flash(key: string) {
    setNote(key);
    setTimeout(() => setNote('settings.autosave'), 1800);
  }

  function update(patch: Partial<SettingsForm>) {
    setSettings((prev) => ({ ...prev, ...patch }));
    Store.saveSettings(patch);
  }

  function handleExport() {
    const dump = {
      exported: new Date().toISOString(),
      settings: Store.settings(),
      best: Store.read<Record<string, number>>('best', {}),
      plays: Store.read<Record<string, number>>('plays', {}),
      time: Store.read<Record<string, number>>('time', {}),
      trophies: Store.trophies(),
      library: Store.library()
    };
    const blob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'oneplay-data.json';
    a.click();
    URL.revokeObjectURL(a.href);
    flash('settings.exported');
  }

  function handleResetScores() {
    if (!confirm(t('settings.confirmResetScores'))) return;
    Store.write('best', {});
    Store.write('plays', {});
    Store.write('time', {});
    Store.write('recent', []);
    refreshCounts();
    flash('settings.scoresReset');
  }

  function handleResetAll() {
    if (!confirm(t('settings.confirmEraseAll'))) return;
    ['best', 'plays', 'time', 'recent', 'trophies', 'library', 'settings'].forEach((k) => {
      try { localStorage.removeItem('pshub.' + k); } catch { /* private mode */ }
    });
    location.reload();
  }

  return (
    <main className="container">
      <section className="pt-14 pb-10">
        <p className="mono" style={{ color: 'var(--color-text-sub)' }}>{t('settings.preferences')}</p>
        <h1 className="h1 mt-3">{t('settings.title')}</h1>
        <p className="lead mt-5 max-w-[50ch]">{t('settings.lead')}</p>
      </section>

      <div className="grid lg:grid-cols-[220px_1fr] gap-12 pb-6">

        {/* side nav */}
        <aside>
          <nav className="lg:sticky lg:top-[92px] flex lg:flex-col gap-1 scroll-x" aria-label={t('settings.sections')}>
            <a className="tab no-underline" href="#profile">{t('settings.navProfile')}</a>
            <a className="tab no-underline" href="#gameplay">{t('settings.navGameplay')}</a>
            <a className="tab no-underline" href="#display">{t('settings.navDisplay')}</a>
            <a className="tab no-underline" href="#data">{t('settings.navData')}</a>
          </nav>
        </aside>

        <div className="space-y-8">

          {/* profile */}
          <section id="profile" className="panel p-8" style={{ scrollMarginTop: 96 }}>
            <h2 className="h3">{t('settings.navProfile')}</h2>
            <p className="body-sub mt-1">{t('settings.profileBody')}</p>
            <div className="mt-7 grid sm:grid-cols-2 gap-6">
              <div>
                <label className="mono block mb-2" htmlFor="name" style={{ color: 'var(--color-text-sub)' }}>{t('settings.displayName')}</label>
                <input
                  id="name"
                  className="field"
                  type="text"
                  maxLength={24}
                  placeholder="Player One"
                  value={settings.name}
                  onChange={(e) => setSettings((p) => ({ ...p, name: e.target.value }))}
                  onBlur={(e) => { update({ name: e.target.value.trim() || t('settings.defaultName') }); flash('settings.nameSaved'); }}
                />
              </div>
              <div>
                <label className="mono block mb-2" htmlFor="region" style={{ color: 'var(--color-text-sub)' }}>{t('settings.region')}</label>
                <select id="region" className="field" value={settings.region} onChange={(e) => setSettings((p) => ({ ...p, region: e.target.value }))}>
                  {REGIONS.map((r) => <option key={r} value={r}>{t(`settings.region_${r}`)}</option>)}
                </select>
              </div>
            </div>
          </section>

          {/* gameplay */}
          <section id="gameplay" className="panel p-8" style={{ scrollMarginTop: 96 }}>
            <h2 className="h3">{t('settings.navGameplay')}</h2>
            <p className="body-sub mt-1">{t('settings.gameplayBody')}</p>

            <div className="mt-7">
              <p className="mono mb-3" style={{ color: 'var(--color-text-sub)' }}>{t('settings.difficulty')}</p>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t('settings.difficulty')}>
                {DIFFICULTIES.map((d) => (
                  <button
                    key={d}
                    className="tab"
                    role="radio"
                    aria-checked={settings.difficulty === d}
                    onClick={() => { update({ difficulty: d }); flash('settings.difficultySaved'); }}
                  >
                    {t(`settings.difficulty_${d}`)}
                  </button>
                ))}
              </div>
              <p className="body-sub mt-3" style={{ fontSize: 14 }}>{t('settings.difficultyNote')}</p>
            </div>

            <hr className="divider my-7" />

            <div className="space-y-5">
              <label className="flex items-center justify-between gap-6 cursor-pointer">
                <span>
                  <span className="block" style={{ fontWeight: 450 }}>{t('settings.sound')}</span>
                  <span className="body-sub" style={{ fontSize: 14 }}>{t('settings.soundBody')}</span>
                </span>
                <input type="checkbox" className="switch" checked={settings.sound} onChange={(e) => { update({ sound: e.target.checked }); flash('settings.saved'); }} />
              </label>
              <label className="flex items-center justify-between gap-6 cursor-pointer">
                <span>
                  <span className="block" style={{ fontWeight: 450 }}>{t('settings.haptics')}</span>
                  <span className="body-sub" style={{ fontSize: 14 }}>{t('settings.hapticsBody')}</span>
                </span>
                <input type="checkbox" className="switch" checked={settings.haptics} onChange={(e) => { update({ haptics: e.target.checked }); flash('settings.saved'); }} />
              </label>
            </div>
          </section>

          {/* display */}
          <section id="display" className="panel p-8" style={{ scrollMarginTop: 96 }}>
            <h2 className="h3">{t('settings.navDisplay')}</h2>
            <p className="body-sub mt-1">{t('settings.displayBody')}</p>
            <div className="mt-7 space-y-5">
              <label className="flex items-center justify-between gap-6 cursor-pointer">
                <span>
                  <span className="block" style={{ fontWeight: 450 }}>{t('settings.showFps')}</span>
                  <span className="body-sub" style={{ fontSize: 14 }}>{t('settings.showFpsBody')}</span>
                </span>
                <input type="checkbox" className="switch" checked={settings.showFps} onChange={(e) => { update({ showFps: e.target.checked }); flash('settings.saved'); }} />
              </label>
              <label className="flex items-center justify-between gap-6 cursor-pointer">
                <span>
                  <span className="block" style={{ fontWeight: 450 }}>{t('settings.reduceFlash')}</span>
                  <span className="body-sub" style={{ fontSize: 14 }}>{t('settings.reduceFlashBody')}</span>
                </span>
                <input type="checkbox" className="switch" checked={settings.reduceFlash} onChange={(e) => { update({ reduceFlash: e.target.checked }); flash('settings.saved'); }} />
              </label>
            </div>
          </section>

          {/* data */}
          <section id="data" className="panel p-8" style={{ scrollMarginTop: 96 }}>
            <h2 className="h3">{t('settings.storedData')}</h2>
            <p className="body-sub mt-1">{t('settings.storedDataBody')}</p>

            <div className="grid sm:grid-cols-3 gap-4 mt-7">
              <div className="panel-soft p-5"><p className="mono" style={{ color: 'var(--color-text-sub)' }}>{t('settings.rounds')}</p><p className="h3 mt-1">{counts.plays}</p></div>
              <div className="panel-soft p-5"><p className="mono" style={{ color: 'var(--color-text-sub)' }}>{t('settings.trophies')}</p><p className="h3 mt-1">{counts.trophies}</p></div>
              <div className="panel-soft p-5"><p className="mono" style={{ color: 'var(--color-text-sub)' }}>{t('settings.savedGames')}</p><p className="h3 mt-1">{counts.library}</p></div>
            </div>

            <div className="flex flex-wrap gap-3 mt-7">
              <button className="btn btn-outline" onClick={handleExport}>{t('settings.exportJson')}</button>
              <button className="btn btn-outline" onClick={handleResetScores}>{t('settings.resetScores')}</button>
              <button className="btn btn-black" onClick={handleResetAll}>{t('settings.eraseAll')}</button>
            </div>
            <p className="body-sub mt-3" style={{ fontSize: 14 }}>{t('settings.eraseNote')}</p>
          </section>

          <div className="flex items-center justify-between gap-4 py-2">
            <p className="mono" style={{ color: 'var(--color-text-sub)' }}>{t(note)}</p>
            <Link className="btn btn-black" href="/library">{t('settings.backToGames')}</Link>
          </div>

        </div>
      </div>
    </main>
  );
}
