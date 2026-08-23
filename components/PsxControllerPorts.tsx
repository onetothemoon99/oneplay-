'use client';

/* ---------------------------------------------------------
   ONEPLAY — controller ports

   Lists whatever pads the browser is reporting and lets the player say
   which one is player one. Browsers only reveal a pad after it has been
   used, so the list fills in as people press buttons — hence the poll
   alongside the connect events, which do not always fire for a pad that
   was already attached when the page loaded.
--------------------------------------------------------- */

import { useCallback, useEffect, useState } from 'react';
import { PSX_PORTS } from '@/lib/psx';
import { useT } from '@/components/I18nProvider';
import {
  assignPort,
  connectedPads,
  isVirtualPad,
  padName,
  readAssignments,
  type PortAssignments
} from '@/lib/psxPorts';

/** What the list needs to know about one pad — flattened out of the live Gamepad. */
interface PadRow {
  id: string;
  index: number;
  virtual: boolean;
}

export default function PsxControllerPorts() {
  const t = useT();
  const [pads, setPads] = useState<PadRow[]>([]);
  const [assignments, setAssignments] = useState<PortAssignments>({});
  const [touched, setTouched] = useState(false);

  const sync = useCallback(() => {
    setPads(connectedPads().map((pad) => ({ id: pad.id, index: pad.index, virtual: isVirtualPad(pad) })));
  }, []);

  useEffect(() => {
    setAssignments(readAssignments());
    sync();

    window.addEventListener('gamepadconnected', sync);
    window.addEventListener('gamepaddisconnected', sync);
    const timer = window.setInterval(sync, 2000);

    return () => {
      window.removeEventListener('gamepadconnected', sync);
      window.removeEventListener('gamepaddisconnected', sync);
      window.clearInterval(timer);
    };
  }, [sync]);

  const choose = useCallback((padId: string, port: number) => {
    setAssignments(assignPort(padId, port));
    setTouched(true);
  }, []);

  return (
    <div className="panel-soft p-6">
      <p className="mono" style={{ color: 'var(--color-text-sub)' }}>{t('ports.title')}</p>
      <h3 className="mt-2" style={{ fontWeight: 500, fontSize: 18, letterSpacing: '-0.02em' }}>{t('ports.heading')}</h3>

      {pads.length === 0 ? (
        <p className="mt-3" style={{ fontSize: 15, color: 'var(--color-text-sub)' }}>
          {t('ports.none')}
        </p>
      ) : (
        <div className="mt-5 space-y-4">
          {pads.map((pad) => (
            <div key={pad.id} className="flex items-center justify-between gap-3">
              <span className="min-w-0">
                <span className="block truncate" style={{ fontWeight: 450, fontSize: 15 }}>
                  {pad.virtual ? t('ports.onScreenPad') : padName(pad)}
                </span>
                <span className="mono block mt-0.5" style={{ color: 'var(--color-text-sub)', fontSize: 10 }}>
                  {pad.virtual ? t('ports.onThisScreen') : t('ports.slot', { index: pad.index })}
                </span>
              </span>
              <select
                className="field field-box py-2 px-3 w-auto shrink-0"
                style={{ borderRadius: 50 }}
                aria-label={t('ports.portFor', { name: pad.virtual ? t('ports.onScreenPad') : padName(pad) })}
                value={Number(assignments[pad.id]) || 0}
                onChange={(event) => choose(pad.id, Number(event.target.value))}
              >
                <option value={0}>{t('ports.notUsed')}</option>
                {PSX_PORTS.map((port) => <option key={port} value={port}>{t('ports.port', { port })}</option>)}
              </select>
            </div>
          ))}
        </div>
      )}

      <hr className="divider my-5" />
      <p style={{ fontSize: 14, color: 'var(--color-text-sub)' }}>
        {touched ? t('ports.savedHint') : t('ports.defaultHint')}
      </p>
    </div>
  );
}
