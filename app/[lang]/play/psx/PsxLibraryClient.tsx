'use client';

/* ---------------------------------------------------------
   ONEPLAY — PS1 disc shelf

   Everything here is local: discs and BIOS dumps are read from the
   player's own machine and never uploaded. The app ships no disc
   images.

   A disc gets onto the shelf one of two ways:

     Link a folder  — File System Access. We keep handles, not files;
                      nothing is copied and the quota is untouched, but
                      the browser asks for permission again each session.
     Choose files   — the files are copied into IndexedDB. Works in every
                      browser, spends storage, survives without prompts.
     Google Drive   — the player picks from their own Drive and the file is
                      downloaded with their own token, then copied in like any
                      other file. Only shown when the Google keys are set.
--------------------------------------------------------- */

import { useCallback, useEffect, useRef, useState, type DragEvent } from 'react';
import Link from '@/components/LocaleLink';
import { useT } from '@/components/I18nProvider';
import * as db from '@/lib/psxDb';
import type { BiosRecord, DiscOrigin, DiscRecord } from '@/lib/psxDb';
import { DISC_EXTENSIONS, extOf, formatBytes, isDiscFile, pickPrimaryFile, slugify, titleFromFileName } from '@/lib/psx';
import { pickFolder, readPermission, scanFolder, supportsFolderLink } from '@/lib/psxFs';
import { downloadDriveFile, getDriveToken, isDriveConfigured, pickDriveFiles } from '@/lib/psxDrive';
import { fmt } from '@/lib/store';

const ACCEPT = [...DISC_EXTENSIONS, '.sub', '.ccd', '.wav', '.mp3', '.ogg', '.flac'].join(',');

const discId = (title: string) => `${slugify(title)}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

/** The one-line report above the shelf: green, amber or red. */
interface ShelfMessage {
  tone: 'good' | 'warn' | 'bad';
  text: string;
}

/** How far one Drive download has got. */
interface DownloadState {
  name: string;
  loaded: number;
  total: number;
}

export default function PsxLibraryClient() {
  const t = useT();
  const [discs, setDiscs] = useState<DiscRecord[]>([]);
  const [bios, setBios] = useState<BiosRecord[]>([]);
  const [storage, setStorage] = useState<StorageEstimate | null>(null);
  const [message, setMessage] = useState<ShelfMessage | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [ready, setReady] = useState(false);
  const [canLink, setCanLink] = useState(false);
  const [access, setAccess] = useState<Record<string, PermissionState>>({});
  const [progress, setProgress] = useState<DownloadState | null>(null);

  // Public build-time config, identical on server and client — no effect needed.
  const canUseDrive = isDriveConfigured();

  const discInput = useRef<HTMLInputElement>(null);
  const biosInput = useRef<HTMLInputElement>(null);

  // Feature detection runs after mount: the server has no `window`, and
  // rendering a button that only exists on the client would not match.
  useEffect(() => { setCanLink(supportsFolderLink()); }, []);

  const refresh = useCallback(async () => {
    try {
      const [discList, biosList, estimate] = await Promise.all([
        db.listDiscs(),
        db.listBios(),
        db.estimateStorage()
      ]);
      setDiscs(discList);
      setBios(biosList);
      setStorage(estimate);

      // queryPermission needs no gesture, so the shelf can show which linked
      // folders will prompt before the player clicks Play.
      const states = await Promise.all(
        discList.map(async (disc) => [disc.id, disc.source === 'fsa' ? await readPermission(disc) : 'granted'])
      );
      setAccess(Object.fromEntries(states));
    } catch (err) {
      setMessage({ tone: 'bad', text: t('psx.storageUnavailable', { error: (err as Error).message }) });
    } finally {
      setReady(true);
    }
  }, [t]);

  useEffect(() => { refresh(); }, [refresh]);

  /* ---------------- linking a folder ---------------- */
  const linkFolder = useCallback(async () => {
    let dirHandle: FileSystemDirectoryHandle;
    try {
      dirHandle = await pickFolder();
    } catch {
      return; // the player closed the picker
    }

    // the root of a drive can come back nameless
    const where = dirHandle.name || 'that folder';

    setBusy(true);
    setMessage({ tone: 'good', text: t('psx.reading', { folder: where }) });
    try {
      const found = await scanFolder(dirHandle);
      if (!found.length) {
        setMessage({ tone: 'bad', text: t('psx.noDiscsIn', { folder: where, formats: DISC_EXTENSIONS.join(', ') }) });
        return;
      }

      const known = new Set(
        (await db.listDiscs())
          .map((disc) => (disc.source === 'fsa' ? disc.key : null))
          .filter(Boolean)
      );
      const fresh = found.filter((disc) => !known.has(disc.key));

      for (const disc of fresh) await db.putLinkedDisc({ ...disc, id: discId(disc.title) });
      await refresh();

      const skipped = found.length - fresh.length;
      setMessage({
        tone: 'good',
        text: fresh.length
          ? t('psx.linked', { count: fresh.length, folder: where })
            + (skipped ? ` ${t('psx.linkedSkipped', { count: skipped })}` : '')
          : t('psx.linkedNothingNew', { folder: where })
      });
    } catch (err) {
      setMessage({ tone: 'bad', text: t('psx.folderError', { error: (err as Error).message }) });
    } finally {
      setBusy(false);
    }
  }, [refresh, t]);

  const grantAccess = useCallback(async (disc: DiscRecord) => {
    const state = await readPermission(disc, { request: true });
    setAccess((current) => ({ ...current, [disc.id]: state }));
    if (state !== 'granted') setMessage({ tone: 'bad', text: t('psx.stillNoAccess', { title: disc.title }) });
  }, [t]);

  /* ---------------- copying files in ---------------- */
  const storeCopy = useCallback(async (
    files: File[],
    { origin, note }: { origin?: DiscOrigin; note?: string } = {}
  ) => {
    await db.requestPersistence();
    const mainFile = pickPrimaryFile(files.map((file) => file.name));
    const title = titleFromFileName(mainFile);
    const disc = await db.putDisc({ id: discId(title), title, mainFile, files, origin });
    await refresh();
    setMessage({
      tone: note ? 'warn' : 'good',
      text: t('psx.copied', { title: disc.title, size: formatBytes(disc.size) }) + (note ? ` ${note}` : '')
    });
    return disc;
  }, [refresh, t]);

  const addFiles = useCallback(async (fileList: FileList | null | undefined) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;

    if (files.some((file) => /\.(zip|7z|rar)$/i.test(file.name))) {
      setMessage({ tone: 'bad', text: t('psx.noArchives') });
      return;
    }

    const usable = files.filter((file) => isDiscFile(file.name));
    if (!usable.length) {
      setMessage({ tone: 'bad', text: t('psx.notADisc', { formats: DISC_EXTENSIONS.join(', ') }) });
      return;
    }

    const mainFile = pickPrimaryFile(usable.map((file) => file.name));
    const note = extOf(mainFile) === '.bin' && !usable.some((file) => extOf(file.name) === '.cue')
      ? t('psx.rawBinNote')
      : '';

    setBusy(true);
    try {
      await storeCopy(usable, { note });
    } catch (err) {
      setMessage({ tone: 'bad', text: t('psx.storeError', { error: (err as Error).message }) });
    } finally {
      setBusy(false);
    }
  }, [storeCopy, t]);

  /* ---------------- importing from Drive ---------------- */
  const addFromDrive = useCallback(async () => {
    setBusy(true);
    setMessage({ tone: 'good', text: t('psx.waitingGoogle') });

    try {
      // Both of these open a popup, so they have to stay inside this click.
      const token = await getDriveToken();
      const picked = await pickDriveFiles(token);
      if (!picked.length) { setMessage(null); return; }

      const usable = picked.filter((doc) => isDiscFile(doc.name));
      if (!usable.length) {
        setMessage({ tone: 'bad', text: t('psx.drivePickedNotADisc', { formats: DISC_EXTENSIONS.join(', ') }) });
        return;
      }

      const files: File[] = [];
      for (const doc of usable) {
        setProgress({ name: doc.name, loaded: 0, total: Number(doc.sizeBytes) || 0 });
        files.push(await downloadDriveFile({
          id: doc.id,
          name: doc.name,
          size: Number(doc.sizeBytes) || 0,
          token,
          onProgress: ({ loaded, total }) => setProgress({ name: doc.name, loaded, total })
        }));
      }

      const skipped = picked.length - usable.length;
      await storeCopy(files, {
        origin: { kind: 'drive', files: usable.map((doc) => ({ id: doc.id, name: doc.name })) },
        note: skipped ? t('psx.driveSkipped', { count: skipped }) : ''
      });
    } catch (err) {
      setMessage({ tone: 'bad', text: (err as Error).message });
    } finally {
      setProgress(null);
      setBusy(false);
    }
  }, [storeCopy, t]);

  const addBios = useCallback(async (fileList: FileList | null | undefined) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    setBusy(true);
    try {
      for (const file of files) await db.putBios(file);
      await refresh();
      setMessage({ tone: 'good', text: t('psx.biosInstalled', { names: files.map((file) => file.name).join(', ') }) });
    } catch (err) {
      setMessage({ tone: 'bad', text: t('psx.biosError', { error: (err as Error).message }) });
    } finally {
      setBusy(false);
    }
  }, [refresh, t]);

  const removeDisc = useCallback(async (disc: DiscRecord) => {
    const what = disc.source === 'fsa'
      ? t('psx.confirmRemoveLinked', { title: disc.title })
      : t('psx.confirmRemoveCopied', { title: disc.title });
    if (!window.confirm(what)) return;
    await db.deleteDisc(disc.id);
    await refresh();
  }, [refresh, t]);

  const rename = useCallback(async (disc: DiscRecord) => {
    const title = window.prompt(t('psx.renamePrompt'), disc.title);
    if (!title || title === disc.title) return;
    await db.renameDisc(disc.id, title.trim());
    await refresh();
  }, [refresh, t]);

  const removeBios = useCallback(async (name: string) => {
    await db.deleteBios(name);
    await refresh();
  }, [refresh]);

  const onDrop = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    addFiles(event.dataTransfer?.files);
  }, [addFiles]);

  const linked = discs.filter((disc) => disc.source === 'fsa').length;
  const copied = discs.length - linked;

  return (
    <>
      {/* ============ HERO ============ */}
      <section className="bg-black">
        <div className="container py-14 sm:py-20">
          <p className="mono" style={{ color: 'rgba(255,255,255,.5)' }}>{t('psx.emulation')}</p>
          <h1 className="h1 text-white mt-3" style={{ maxWidth: '18ch' }}>{t('psx.heroTitle')}</h1>
          <p className="lead mt-5 max-w-[58ch]" style={{ color: 'rgba(255,255,255,.7)' }}>{t('psx.heroLead')}</p>
        </div>
      </section>

      <div className="container">
        {/* ============ ADD A DISC ============ */}
        <section className="pt-14">
          <div className="grid lg:grid-cols-[1fr_320px] gap-14">
            <div>
              <p className="mono" style={{ color: 'var(--color-text-sub)' }}>{t('psx.stepOne')}</p>
              <h2 className="h2 mt-2">{t('psx.insertDisc')}</h2>
              <p className="lead mt-4 max-w-[54ch]">{t('psx.insertBody')}</p>

              {canLink && (
                <div className="mt-7 panel p-6 sm:p-7">
                  <div className="flex flex-wrap items-start justify-between gap-5">
                    <div className="max-w-[42ch]">
                      <p style={{ fontWeight: 480, fontSize: 17 }}>{t('psx.linkFolderTitle')}</p>
                      <p className="mt-2" style={{ fontSize: 15, color: 'var(--color-text-sub)' }}>{t('psx.linkFolderBody')}</p>
                    </div>
                    <button className="btn btn-black shrink-0" disabled={busy} onClick={linkFolder}>
                      {busy ? t('psx.working') : t('psx.linkFolder')}
                    </button>
                  </div>
                </div>
              )}

              {canUseDrive && (
                <div className="mt-4 panel p-6 sm:p-7">
                  <div className="flex flex-wrap items-start justify-between gap-5">
                    <div className="max-w-[42ch]">
                      <p style={{ fontWeight: 480, fontSize: 17 }}>{t('psx.driveTitle')}</p>
                      <p className="mt-2" style={{ fontSize: 15, color: 'var(--color-text-sub)' }}>{t('psx.driveBody')}</p>
                    </div>
                    <button className="btn btn-outline shrink-0" disabled={busy} onClick={addFromDrive}>
                      {busy ? t('psx.working') : t('psx.addFromDrive')}
                    </button>
                  </div>

                  {progress ? (
                    <div className="mt-5">
                      <div className="flex justify-between mono" style={{ fontSize: 10, color: 'var(--color-text-sub)' }}>
                        <span className="truncate">{progress.name}</span>
                        <span className="shrink-0 ml-3">
                          {formatBytes(progress.loaded)}{progress.total ? ` / ${formatBytes(progress.total)}` : ''}
                        </span>
                      </div>
                      <div className="mt-2" style={{ height: 4, borderRadius: 4, background: 'var(--line)', overflow: 'hidden' }}>
                        <div
                          style={{
                            height: '100%',
                            background: '#000',
                            width: progress.total ? `${Math.min(100, (progress.loaded / progress.total) * 100)}%` : '100%',
                            transition: 'width .2s linear'
                          }}
                        />
                      </div>
                    </div>
                  ) : null}
                </div>
              )}

              {!canUseDrive && process.env.NODE_ENV !== 'production' && (
                <p className="mono mt-4" style={{ color: 'var(--color-text-sub)' }}>
                  {t('psx.driveDevNote')}
                </p>
              )}

              <div
                onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                className="mt-4 panel-soft flex flex-col items-center justify-center text-center px-6 py-12"
                style={{
                  borderStyle: 'dashed',
                  borderColor: dragging ? '#000' : 'var(--line)',
                  background: dragging ? 'rgba(0,0,0,.04)' : undefined
                }}
              >
                <p style={{ fontWeight: 450, fontSize: 17 }}>{canLink ? t('psx.orCopyIn') : t('psx.dropHere')}</p>
                <p className="mono mt-2" style={{ color: 'var(--color-text-sub)' }}>{DISC_EXTENSIONS.join(' · ')}</p>
                <button className={`btn ${canLink ? 'btn-outline' : 'btn-black'} mt-6`} disabled={busy} onClick={() => discInput.current?.click()}>
                  {busy ? t('psx.working') : t('psx.chooseFiles')}
                </button>
                <input
                  ref={discInput}
                  type="file"
                  multiple
                  accept={ACCEPT}
                  hidden
                  onChange={(event) => { addFiles(event.target.files); event.target.value = ''; }}
                />
              </div>

              {message ? (
                <p
                  className="mt-5 panel px-5 py-4"
                  style={{ fontSize: 15, borderColor: message.tone === 'bad' ? '#DC2626' : message.tone === 'warn' ? '#D9A066' : 'var(--line)' }}
                >
                  {message.text}
                </p>
              ) : null}

              {/* ============ SHELF ============ */}
              <h2 className="h2 mt-14">{t('psx.yourDiscs')}</h2>
              {!ready ? (
                <p className="lead mt-4">{t('psx.readingShelf')}</p>
              ) : discs.length === 0 ? (
                <p className="lead mt-4 max-w-[52ch]">{t('psx.shelfEmpty')}</p>
              ) : (
                <div className="mt-6 panel overflow-hidden">
                  {discs.map((disc, index) => {
                    const isLinked = disc.source === 'fsa';
                    const needsAccess = isLinked && access[disc.id] && access[disc.id] !== 'granted';

                    return (
                      <div
                        key={disc.id}
                        className="flex flex-wrap items-center justify-between gap-4 px-5 py-4"
                        style={index ? { borderTop: '1px solid var(--line)' } : undefined}
                      >
                        <div className="min-w-0">
                          <p className="truncate flex items-center gap-2" style={{ fontWeight: 450, fontSize: 16 }}>
                            {disc.title}
                            <span className="pill pill-line" style={{ fontSize: 10 }}>
                            {isLinked ? t('psx.badgeFolder') : disc.origin?.kind === 'drive' ? t('psx.badgeDrive') : t('psx.badgeCopied')}
                          </span>
                            {needsAccess ? <span className="pill" style={{ fontSize: 10, background: '#000', color: '#fff' }}>{t('psx.needsAccess')}</span> : null}
                          </p>
                          <p className="mono mt-1" style={{ color: 'var(--color-text-sub)', fontSize: 10 }}>
                            {isLinked && disc.folder ? `${disc.folder} · ` : ''}{disc.mainFile} · {formatBytes(disc.size)} · {t('psx.sessions', { count: disc.plays || 0 })} · {fmt.time(disc.seconds)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {needsAccess ? <button className="btn btn-outline btn-sm" onClick={() => grantAccess(disc)}>{t('psx.grantAccess')}</button> : null}
                          <button className="btn btn-ghost btn-sm" onClick={() => rename(disc)}>{t('psx.rename')}</button>
                          <button className="btn btn-ghost btn-sm" onClick={() => removeDisc(disc)}>{t('psx.remove')}</button>
                          <Link className="btn btn-black btn-sm" href={`/play/psx/${disc.id}`}>{t('psx.play')}</Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ============ SIDEBAR ============ */}
            <aside className="space-y-6">
              <div className="panel-soft p-6">
                <p className="mono" style={{ color: 'var(--color-text-sub)' }}>{t('psx.stepTwo')}</p>
                <h3 className="mt-2" style={{ fontWeight: 500, fontSize: 18, letterSpacing: '-0.02em' }}>BIOS</h3>
                <p className="mt-3" style={{ fontSize: 15, color: 'var(--color-text-sub)' }}>{t('psx.biosBody')}</p>
                <button className="btn btn-outline btn-sm mt-4" disabled={busy} onClick={() => biosInput.current?.click()}>{t('psx.addBios')}</button>
                <input
                  ref={biosInput}
                  type="file"
                  multiple
                  accept=".bin,.BIN,.rom"
                  hidden
                  onChange={(event) => { addBios(event.target.files); event.target.value = ''; }}
                />

                {bios.length ? (
                  <div className="mt-5 space-y-3">
                    {bios.map((file) => (
                      <div key={file.name} className="flex items-center justify-between gap-3">
                        <span className="mono truncate" style={{ fontSize: 11 }}>{file.name}</span>
                        <span className="flex items-center gap-2 shrink-0">
                          <span className="mono" style={{ color: 'var(--color-text-sub)', fontSize: 10 }}>{formatBytes(file.size)}</span>
                          <button className="btn btn-ghost btn-sm" onClick={() => removeBios(file.name)}>{t('psx.remove')}</button>
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mono mt-4" style={{ color: 'var(--color-text-sub)' }}>{t('psx.noBios')}</p>
                )}
              </div>

              <div className="panel-soft p-6">
                <p className="mono" style={{ color: 'var(--color-text-sub)' }}>{t('psx.onThisDevice')}</p>
                <div className="mt-4 flex justify-between">
                  <span className="mono" style={{ color: 'var(--color-text-sub)' }}>{t('psx.linkedCount')}</span>
                  <span style={{ fontWeight: 450 }}>{linked}</span>
                </div>
                <div className="mt-3 flex justify-between">
                  <span className="mono" style={{ color: 'var(--color-text-sub)' }}>{t('psx.copiedCount')}</span>
                  <span style={{ fontWeight: 450 }}>{copied}</span>
                </div>
                <div className="mt-3 flex justify-between">
                  <span className="mono" style={{ color: 'var(--color-text-sub)' }}>{t('psx.storageUsed')}</span>
                  <span style={{ fontWeight: 450 }}>{storage?.usage != null ? formatBytes(storage.usage) : '—'}</span>
                </div>
                <div className="mt-3 flex justify-between">
                  <span className="mono" style={{ color: 'var(--color-text-sub)' }}>{t('psx.storageAvailable')}</span>
                  <span style={{ fontWeight: 450 }}>{storage?.quota != null ? formatBytes(storage.quota) : '—'}</span>
                </div>
                <hr className="divider my-5" />
                <p style={{ fontSize: 14, color: 'var(--color-text-sub)' }}>
                  {t('psx.storageNote')}
                </p>
              </div>

              <div className="panel-soft p-6">
                <p className="mono" style={{ color: 'var(--color-text-sub)' }}>{t('psx.fairPlay')}</p>
                <p className="mt-3" style={{ fontSize: 14, color: 'var(--color-text-sub)' }}>{t('psx.fairPlayBody')}</p>
              </div>
            </aside>
          </div>
        </section>

        <section className="pt-20 pb-4">
          <p className="mono" style={{ color: 'var(--color-text-sub)' }}>{t('psx.alsoHere')}</p>
          <h2 className="h2 mt-2 mb-4">{t('psx.arcadeTitle')}</h2>
          <p className="lead max-w-[52ch]">
            {t('psx.arcadeBody')}{' '}
            <Link href="/library">{t('psx.browseLibrary')}</Link>
          </p>
        </section>
      </div>
    </>
  );
}
