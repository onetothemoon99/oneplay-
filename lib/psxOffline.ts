/* ---------------------------------------------------------
   Registers `public/sw.js`, which caches the PSX core and whatever
   pages/chunks a player has already loaded so the emulator keeps
   working with no connection. Call this from the PSX routes only —
   there is nothing for the service worker to do until a player has
   actually opened the shelf or a disc once while online.
--------------------------------------------------------- */

export function registerPsxServiceWorker(): void {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('/sw.js').catch((err) => {
    console.warn('[psx] offline support unavailable', err);
  });
}
