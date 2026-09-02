'use client';

/* ---------------------------------------------------------
   ONEPLAY — become VIP

   No payment gateway yet: the player transfers money by bank and submits
   the reference plus a photo of the slip here (see lib/vipTopups.ts). An
   admin reviews it from the Supabase dashboard; approving flips VIP on
   automatically.
--------------------------------------------------------- */

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import Link from '@/components/LocaleLink';
import { useT } from '@/components/I18nProvider';
import { submitTopup, listMyTopups, uploadSlip, getSlipUrl, type TopupRecord } from '@/lib/vipTopups';

/** Placeholder — swap in the real receiving account before this goes live. */
const VIP_PRICE_THB = 99;
const BANK = { bank: 'Kasikorn Bank', accountNumber: '000-0-00000-0', accountName: 'OnePlay' };

const MAX_SLIP_BYTES = 5 * 1024 * 1024;

export interface VipTopupPanelProps {
  /** Signed-in player's id. null = not signed in, so there's no account to attach VIP to. */
  userId: string | null;
}

export default function VipTopupPanel({ userId }: VipTopupPanelProps) {
  const t = useT();
  const [topups, setTopups] = useState<TopupRecord[] | null>(null);
  const [amount, setAmount] = useState(String(VIP_PRICE_THB));
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [slipFile, setSlipFile] = useState<File | null>(null);
  const [slipPreview, setSlipPreview] = useState<string | null>(null);
  const [pendingSlipUrl, setPendingSlipUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    listMyTopups(userId).then((rows) => { if (!cancelled) setTopups(rows); });
    return () => { cancelled = true; };
  }, [userId]);

  const latest = topups?.[0] ?? null;
  const pending = latest?.status === 'pending' ? latest : null;

  /* the slip is private storage, so showing it back needs a fresh signed URL */
  useEffect(() => {
    setPendingSlipUrl(null);
    if (!pending?.slipPath) return;
    let cancelled = false;
    getSlipUrl(pending.slipPath).then((url) => { if (!cancelled) setPendingSlipUrl(url); });
    return () => { cancelled = true; };
  }, [pending?.slipPath]);

  /* revoke the local preview URL on unmount / when a new file replaces it */
  useEffect(() => () => { if (slipPreview) URL.revokeObjectURL(slipPreview); }, [slipPreview]);

  if (!userId) {
    return (
      <section className="panel-soft p-6 mt-6">
        <p className="mono" style={{ color: 'var(--color-text-sub)' }}>{t('vip.title')}</p>
        <p className="mt-2" style={{ fontWeight: 450 }}>{t('vip.signInBody')}</p>
        <Link className="btn btn-black btn-sm mt-4" href="/login">{t('vip.signInCta')}</Link>
      </section>
    );
  }

  function handleSlipChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setErrorKey(null);
    if (slipPreview) URL.revokeObjectURL(slipPreview);
    if (!file) { setSlipFile(null); setSlipPreview(null); return; }
    if (file.size > MAX_SLIP_BYTES) {
      setErrorKey('vip.slipTooLarge');
      setSlipFile(null);
      setSlipPreview(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    setSlipFile(file);
    setSlipPreview(URL.createObjectURL(file));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsedAmount = Number(amount);
    if (!userId || !parsedAmount || parsedAmount <= 0 || !reference.trim()) return;
    if (!slipFile) { setErrorKey('vip.slipRequired'); return; }

    setSubmitting(true);
    setErrorKey(null);
    try {
      const slipPath = await uploadSlip(userId, slipFile);
      await submitTopup(userId, parsedAmount, reference.trim(), note.trim(), slipPath);
      setTopups(await listMyTopups(userId));
      setReference('');
      setNote('');
      setSlipFile(null);
      setSlipPreview(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch {
      setErrorKey('vip.submitError');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="panel-soft p-6 mt-6">
      <p className="mono" style={{ color: 'var(--color-text-sub)' }}>{t('vip.title')}</p>

      {pending ? (
        <div className="mt-3">
          <p style={{ fontWeight: 480 }}>{t('vip.pendingTitle')}</p>
          <p className="body-sub mt-1" style={{ fontSize: 14 }}>{t('vip.pendingBody')}</p>
          <p className="mono mt-3" style={{ fontSize: 11, color: 'var(--color-text-sub)' }}>
            {t('vip.submittedAt', { date: new Date(pending.createdAt).toLocaleString() })}
          </p>
          {pendingSlipUrl ? (
            <a href={pendingSlipUrl} target="_blank" rel="noreferrer" className="block mt-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={pendingSlipUrl} alt="" style={{ width: 120, borderRadius: 8, border: '1px solid var(--line)' }} />
              <span className="mono mt-1 inline-block" style={{ fontSize: 11, color: 'var(--color-text-sub)' }}>{t('vip.viewSlip')}</span>
            </a>
          ) : null}
        </div>
      ) : (
        <>
          <p className="mt-2 body-sub" style={{ fontSize: 14 }}>{t('vip.lead', { price: VIP_PRICE_THB })}</p>

          <div className="mt-4 grid sm:grid-cols-3 gap-4">
            <div>
              <p className="mono" style={{ fontSize: 10, color: 'var(--color-text-sub)' }}>{t('vip.bankLabel')}</p>
              <p style={{ fontWeight: 450 }}>{BANK.bank}</p>
            </div>
            <div>
              <p className="mono" style={{ fontSize: 10, color: 'var(--color-text-sub)' }}>{t('vip.accountNumberLabel')}</p>
              <p className="mono" style={{ fontWeight: 450 }}>{BANK.accountNumber}</p>
            </div>
            <div>
              <p className="mono" style={{ fontSize: 10, color: 'var(--color-text-sub)' }}>{t('vip.accountNameLabel')}</p>
              <p style={{ fontWeight: 450 }}>{BANK.accountName}</p>
            </div>
          </div>

          {latest?.status === 'rejected' ? (
            <p className="mt-4" style={{ color: '#DC2626', fontSize: 14 }}>{t('vip.rejectedBody')}</p>
          ) : null}

          <form className="mt-5 grid sm:grid-cols-2 gap-4" onSubmit={handleSubmit}>
            <div>
              <label className="mono block mb-2" style={{ color: 'var(--color-text-sub)', fontSize: 11 }} htmlFor="vip-amount">
                {t('vip.amountLabel')}
              </label>
              <input
                id="vip-amount" className="field" type="number" min="1" step="0.01"
                value={amount} onChange={(e) => setAmount(e.target.value)} required
              />
            </div>
            <div>
              <label className="mono block mb-2" style={{ color: 'var(--color-text-sub)', fontSize: 11 }} htmlFor="vip-reference">
                {t('vip.referenceLabel')}
              </label>
              <input
                id="vip-reference" className="field" type="text" maxLength={120}
                placeholder={t('vip.referencePlaceholder')}
                value={reference} onChange={(e) => setReference(e.target.value)} required
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mono block mb-2" style={{ color: 'var(--color-text-sub)', fontSize: 11 }} htmlFor="vip-note">
                {t('vip.noteLabel')}
              </label>
              <input
                id="vip-note" className="field" type="text" maxLength={500}
                value={note} onChange={(e) => setNote(e.target.value)}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mono block mb-2" style={{ color: 'var(--color-text-sub)', fontSize: 11 }} htmlFor="vip-slip">
                {t('vip.slipLabel')}
              </label>
              <input
                id="vip-slip" ref={fileInputRef} className="field" type="file"
                accept="image/jpeg,image/png,image/webp" onChange={handleSlipChange} required
              />
              <p className="body-sub mt-2" style={{ fontSize: 12 }}>{t('vip.slipHint')}</p>
              {slipPreview ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={slipPreview} alt="" className="mt-3" style={{ width: 120, borderRadius: 8, border: '1px solid var(--line)' }} />
              ) : null}
            </div>
            <div className="sm:col-span-2 flex items-center gap-4">
              <button className="btn btn-black btn-sm" type="submit" disabled={submitting}>
                {submitting ? t('vip.submitting') : t('vip.submit')}
              </button>
              {errorKey ? <p style={{ color: '#DC2626', fontSize: 14 }}>{t(errorKey)}</p> : null}
            </div>
          </form>
        </>
      )}
    </section>
  );
}
