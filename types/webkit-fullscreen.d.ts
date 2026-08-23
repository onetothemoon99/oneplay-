/* ---------------------------------------------------------
   iOS Safari never shipped the unprefixed element fullscreen API, so
   components/PsxStage.tsx reaches for the WebKit spellings before
   falling back to its CSS-only "faux" fullscreen. These are the only
   prefixed members it touches — everything else stays standard.
--------------------------------------------------------- */

interface Document {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
}

interface HTMLElement {
  webkitRequestFullscreen?: (options?: FullscreenOptions) => Promise<void> | void;
}

interface DocumentEventMap {
  webkitfullscreenchange: Event;
}
