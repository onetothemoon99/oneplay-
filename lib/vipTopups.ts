'use client';

/* ---------------------------------------------------------
   ONEPLAY — VIP top-up requests

   No payment gateway: a player transfers money by bank and submits the
   reference — plus a photo of the slip — here (see
   supabase/migrations/0005_vip_topups.sql and 0006_vip_slips.sql). An admin
   reviews pending rows from the Supabase dashboard; approving one flips
   VIP on automatically via a database trigger.
--------------------------------------------------------- */

import { createClient } from '@/utils/supabase/client';

const SLIP_BUCKET = 'vip-slips';

export type TopupStatus = 'pending' | 'approved' | 'rejected';

export interface TopupRecord {
  id: string;
  amount: number;
  reference: string;
  note: string | null;
  status: TopupStatus;
  slipPath: string | null;
  createdAt: string;
}

/** Uploads the slip photo first — its storage path is what `submitTopup` records. */
export async function uploadSlip(userId: string, file: File): Promise<string> {
  const supabase = createClient();
  const ext = file.name.split('.').pop() || 'jpg';
  const path = `${userId}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from(SLIP_BUCKET).upload(path, file, {
    contentType: file.type || 'image/jpeg'
  });
  if (error) throw error;
  return path;
}

/** Slip photos are private, so viewing one back needs a short-lived signed URL. */
export async function getSlipUrl(path: string): Promise<string | null> {
  const supabase = createClient();
  const { data, error } = await supabase.storage.from(SLIP_BUCKET).createSignedUrl(path, 60 * 10);
  if (error || !data) return null;
  return data.signedUrl;
}

export async function submitTopup(
  userId: string, amount: number, reference: string, note: string, slipPath: string
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from('vip_topups')
    .insert({ user_id: userId, amount, reference, note: note || null, slip_path: slipPath });
  if (error) throw error;
}

/** Most recent first, so the caller only needs `[0]` for "is there an open request". */
export async function listMyTopups(userId: string): Promise<TopupRecord[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('vip_topups')
    .select('id, amount, reference, note, status, slip_path, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return data.map((row) => ({
    id: row.id,
    amount: Number(row.amount),
    reference: row.reference,
    note: row.note,
    status: row.status,
    slipPath: row.slip_path,
    createdAt: row.created_at
  }));
}
