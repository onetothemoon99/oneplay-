/* ---------------------------------------------------------
   ONEPLAY — discs from Google Drive

   The player's own Drive, read with the player's own token. Their
   files, their quota, their bandwidth: this app never holds a disc
   image and never proxies one.

   Why the API and not a share link: `drive.google.com/uc?export=…`
   sends no CORS headers and puts a virus-scan interstitial in front
   of big files, so a browser cannot fetch it — you would need a
   server proxy, which would make us the one distributing the file.
   `www.googleapis.com/drive/v3/files/{id}?alt=media` does support
   CORS with an Authorization header, so the download goes straight
   from Google to the player.

   Scope is `drive.file`, paired with the Picker: the app only ever
   sees files the player hands it. (`drive.readonly` would see the
   whole Drive and is a restricted scope — it needs a security
   assessment before an app can ship with it.)

   Disc images are downloaded, not streamed: the core needs the whole
   image in memory anyway (see lib/psx.ts), so a picked file lands in
   IndexedDB like any other copied disc, tagged with where it came
   from.

   Unconfigured is a supported state — every entry point checks
   isDriveConfigured() and the UI hides itself when the keys are
   missing.
--------------------------------------------------------- */

export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

const GIS_SRC = 'https://accounts.google.com/gsi/client';
const GAPI_SRC = 'https://apis.google.com/js/api.js';

/* Read statically so Next can inline them at build time. */
export const driveConfig = {
  clientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '',
  apiKey: process.env.NEXT_PUBLIC_GOOGLE_API_KEY || '',
  appId: process.env.NEXT_PUBLIC_GOOGLE_APP_ID || ''
};

export const isDriveConfigured = (): boolean =>
  Boolean(driveConfig.clientId && driveConfig.apiKey && driveConfig.appId);

/** One row the player picked out of the Picker. */
export interface DriveDoc {
  id: string;
  name: string;
  sizeBytes?: string | number;
  mimeType?: string;
}

/* ---------------- script loading ---------------- */

const scripts = new Map<string, Promise<void>>();

function loadScript(src: string): Promise<void> {
  const cached = scripts.get(src);
  if (cached) return cached;

  const promise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
    if (existing?.dataset.loaded === 'true') return resolve();

    const script = existing || document.createElement('script');
    script.src = src;
    script.async = true;
    script.addEventListener('load', () => { script.dataset.loaded = 'true'; resolve(); });
    script.addEventListener('error', () => {
      scripts.delete(src);
      reject(new Error('Google could not be reached — check the connection or a blocker.'));
    });
    if (!existing) document.head.append(script);
  });

  scripts.set(src, promise);
  return promise;
}

/* ---------------- auth ---------------- */

let token = { value: '', expiresAt: 0 };

function authError(response: { error?: string; type?: string } | null | undefined): string {
  const type = response?.error || response?.type || '';
  if (/popup_closed|popup_failed_to_open/.test(type)) return 'The Google window was closed before access was granted.';
  if (/access_denied/.test(type)) return 'Access to Drive was declined.';
  return `Google sign-in failed (${type || 'unknown error'}).`;
}

/**
 * A Drive access token for this browser tab. Opens Google's consent popup, so
 * it has to run inside a user gesture. Tokens last about an hour and are kept
 * in memory only — never in storage.
 */
export async function getDriveToken({ force = false }: { force?: boolean } = {}): Promise<string> {
  if (!force && token.value && Date.now() < token.expiresAt - 60_000) return token.value;

  await loadScript(GIS_SRC);

  return new Promise<string>((resolve, reject) => {
    const client = window.google?.accounts?.oauth2?.initTokenClient({
      client_id: driveConfig.clientId,
      scope: DRIVE_SCOPE,
      prompt: force ? 'consent' : '',
      callback: (response) => {
        if (response?.error || !response?.access_token) return reject(new Error(authError(response)));
        token = {
          value: response.access_token,
          expiresAt: Date.now() + (Number(response.expires_in) || 3600) * 1000
        };
        resolve(token.value);
      },
      error_callback: (error) => reject(new Error(authError(error)))
    });

    if (!client) return reject(new Error('Google Identity Services did not load.'));
    client.requestAccessToken();
  });
}

/* ---------------- picker ---------------- */

/**
 * Opens the Google Picker and resolves with what the player chose — an empty
 * array if they cancelled. Each entry is `{ id, name, sizeBytes, mimeType }`.
 */
export async function pickDriveFiles(accessToken: string): Promise<DriveDoc[]> {
  await loadScript(GAPI_SRC);
  await new Promise<void>((resolve, reject) => {
    window.gapi.load('picker', {
      callback: resolve,
      onerror: () => reject(new Error('The Google Picker could not be loaded.'))
    });
  });

  const { picker } = window.google;

  return new Promise<DriveDoc[]>((resolve) => {
    const view = new picker.DocsView(picker.ViewId.DOCS)
      .setIncludeFolders(true)
      .setSelectFolderEnabled(false);

    new picker.PickerBuilder()
      .setOAuthToken(accessToken)
      .setDeveloperKey(driveConfig.apiKey)
      .setAppId(driveConfig.appId)
      .enableFeature(picker.Feature.MULTISELECT_ENABLED)
      .addView(view)
      .setTitle('Pick a disc image — select the .cue and its tracks together')
      // data.action is 'picked' | 'cancel' | 'loaded'
      .setCallback((data) => {
        if (data.action === 'picked') resolve(data.docs || []);
        else if (data.action === 'cancel') resolve([]);
      })
      .build()
      .setVisible(true);
  });
}

/* ---------------- download ---------------- */

function downloadError(status: number): string {
  if (status === 401) return 'That Drive token expired — try again.';
  if (status === 403) return 'Drive refused the download. Check that the Drive API is enabled for the Google project, and that the daily quota is not spent.';
  if (status === 404) return 'That file is not shared with this app any more — pick it again.';
  return `Drive returned ${status}.`;
}

export interface DownloadProgress {
  loaded: number;
  total: number;
}

export interface DownloadOptions {
  id: string;
  name: string;
  size?: number;
  token: string;
  onProgress?: (progress: DownloadProgress) => void;
  signal?: AbortSignal;
}

/** Streams one Drive file into a `File`, reporting progress as it goes. */
export async function downloadDriveFile(
  { id, name, size = 0, token: accessToken, onProgress, signal }: DownloadOptions
): Promise<File> {
  const url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?alt=media&supportsAllDrives=true`;
  const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` }, signal });

  if (!response.ok) throw new Error(downloadError(response.status));

  const total = Number(response.headers.get('content-length')) || Number(size) || 0;

  // No streaming body (very old browsers, or a mocked response): take the blob.
  if (!response.body?.getReader) {
    const blob = await response.blob();
    onProgress?.({ loaded: blob.size, total: total || blob.size });
    return new File([blob], name);
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.byteLength;
    onProgress?.({ loaded, total });
  }

  return new File(chunks as BlobPart[], name);
}
