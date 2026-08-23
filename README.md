# OnePlay — Next.js

This is the original static "PlayStation Hub" arcade site (plain HTML/CSS/JS
with a Tailwind CDN `<script>` tag) converted into a proper Next.js 16 App
Router application, and since renamed to **OnePlay**.

## What changed

- **Framework**: Next.js (App Router) + React 19, instead of hand-rolled
  multi-page HTML with `innerHTML`-based rendering.
- **Styling**: Tailwind is now installed via PostCSS (`@tailwindcss/postcss`)
  instead of the CDN `<script>` build. All the original custom CSS
  (`assets/base.css`, plus the inline `<style>` block from `play.html`) lives
  in `app/globals.css`, unchanged.
- **Routing**: `game.html?id=X` and `play.html?id=X` became real dynamic
  routes: `/game/[id]` and `/play/[id]`. `index.html` → `/`, `library.html` →
  `/library`, `profile.html` → `/profile`, `settings.html` → `/settings`,
  `404.html` → the automatic Next.js not-found page (`app/not-found.tsx`).
- **Shell**: the shared nav/footer (previously injected via
  `renderNav`/`renderFooter` into `<div data-nav>` / `<div data-footer>`) are
  now `components/Nav.tsx` and `components/Footer.tsx`.
- **Game data & storage**: `assets/app.js`'s `GAMES` array and `Store`
  (localStorage) helper moved to `lib/games.ts` and `lib/store.ts`. Every
  page reads `Store` inside a `useEffect` (after mount) into React state, so
  the server-rendered HTML never disagrees with the client — localStorage
  doesn't exist on the server.
- **Canvas game engine**: `assets/games.js` (the 8 playable games) and
  `assets/engine.js` (the `Runner` — input, loop, HUD, pause/game-over,
  trophies) moved to `lib/gameModules.ts` and `lib/runner.ts`, kept
  imperative on purpose (it still manipulates canvas + DOM nodes by id) but
  wrapped with a proper `Runner.destroy()` cleanup path so listeners and the
  animation frame are torn down correctly when the Play page unmounts or you
  switch games.

## Supabase

The **game catalogue** on `/library` now comes from the `public.games` table in
Supabase; **email + password accounts** are handled by Supabase Auth.

- `supabase/migrations/0001_games.sql` — creates `public.games`, turns on RLS
  with a public (anon + authenticated) read policy, and seeds the eight titles.
  There is no write policy, and the default anon/authenticated write grants are
  revoked on top of that, so the catalogue can only be edited with the
  service-role key or from the SQL editor.
- `supabase/migrations/0002_platform.sql` — adds `games.platform`
  (`'hub' | 'psx'`), so one catalogue can hold both the bundled canvas games and
  PlayStation titles. See *One library for both* below.
- `lib/gamesRepo.ts` — `getGames()` / `getGameById()`, server-only. Reads the
  table in `sort_order` (the original "Featured" order) and maps rows back to
  the plain game objects the components already expect. If the table is
  missing, empty, or unreachable it logs a warning and falls back to the
  bundled `lib/games.ts` array, so the site never goes blank. In development
  `/library` also shows a one-line note when the fallback is in use.
- `lib/auth.ts` — `getUser()` (memoised with `React.cache`) and `getUserDto()`,
  which is what the root layout hands to `components/Nav.tsx`.
- `app/actions/auth.ts` — the `signIn` / `signUp` / `signInWithGoogle` /
  `signOut` Server Actions behind `/login` and `/signup`.
- `app/auth/confirm/route.ts` — where the confirmation email lands. It accepts
  both `?token_hash=…&type=…` and the default template's `?code=…`, writes the
  session cookie, then redirects to `/profile`.
- `proxy.js` (Next 16's renamed middleware) refreshes the session cookie on
  every request.

The rest of the app — home, `/game/[id]`, `/play/[id]`, `/profile`,
`/settings` — still imports `GAMES` from `lib/games.ts` directly, and scores,
trophies, saved games and preferences are all still `localStorage` only.

### First-time setup

1. `.env.local` needs `NEXT_PUBLIC_SUPABASE_URL` and
   `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
2. Open the Supabase dashboard → **SQL Editor** → paste
   `supabase/migrations/0001_games.sql` and run it, then
   `supabase/migrations/0002_platform.sql`. Re-running either is safe: the seed
   upserts on `id`, and 0002 only adds a column.
3. Dashboard → **Authentication → URL Configuration**: add
   `http://localhost:3000/auth/confirm` (plus your deployed equivalent) to the
   redirect allow-list.
4. Optional: to offer *Continue with Google*, follow *Signing in with Google*
   below. Without it the button still renders but says the provider is off.
5. Optional: to offer Google Drive imports on `/play/psx`, add the three
   `NEXT_PUBLIC_GOOGLE_*` values described under *Discs from Google Drive*.
   Without them that button simply does not render.
6. Optional but recommended: **Authentication → Email Templates → Confirm
   signup** → point the link at
   `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup`. The
   default template also works — `/auth/confirm` handles both shapes.

Email confirmation is on for this project, so `signUp` sends a link and the
account only gets a session after it is clicked.

### Signing in with Google

`Continue with Google` sits above the password form on both `/login` and
`/signup`. The round trip reuses machinery that was already there:
`signInWithOAuth` hands back a URL, Google returns to
`/auth/confirm?code=…`, and that route already knows how to trade a code for a
session — it was written for the email confirmation link, and the PKCE exchange
is the same one.

Two failure modes are handled, because both produce something ugly otherwise:

- **The provider is switched off.** `signInWithOAuth` builds its URL without
  ever calling it, so a disabled provider is only discovered at the far end,
  where Supabase answers with raw JSON in the address bar. The action knocks on
  the authorize endpoint first and turns that into a sentence on our own page.
  If the knock itself fails the redirect goes ahead anyway — a probe should
  never be the thing that stops someone signing in.
- **Google refuses.** Then it comes back to `/auth/confirm` with `?error=…` and
  no code, so that route forwards the provider's own message to `/login`
  instead of reporting a missing token, which is not what went wrong.

To switch it on:

1. Google Cloud console → **APIs & Services → Credentials → Create OAuth client
   ID → Web application**. Under *Authorized redirect URIs* add
   `https://<project-ref>.supabase.co/auth/v1/callback` — the callback belongs
   to Supabase, not to this app.
2. Supabase dashboard → **Authentication → Providers → Google** → enable, and
   paste the client ID and client secret.
3. Supabase dashboard → **Authentication → URL Configuration** → the redirect
   allow-list needs `http://localhost:3000/auth/confirm` and the deployed
   equivalent. It is the same entry the email confirmation flow already uses.

This is a **different OAuth client** from the one behind the Google Drive
importer. That one is a browser client identified by
`NEXT_PUBLIC_GOOGLE_CLIENT_ID`, has no secret, and lists JavaScript origins;
this one is used server-side by Supabase, has a secret, and lists a redirect
URI. They can live in the same Google Cloud project, but they are not
interchangeable.

## The room (`/`)

The home page is a gallery. The eight games hang framed on the back wall of a
dark room lit warm from above and cool from the left; pointing at a picture
lifts it off the plaster and names it, clicking opens the game.

- `components/room/GameRoom.tsx` is the scene — plain `three`, no React
  renderer. It is built once in an effect and never rebuilt: the callbacks live
  in a ref so a parent re-render cannot tear the room down.
- `lib/coverTexture.ts` repaints each cover onto a 2D canvas. The covers
  elsewhere are CSS gradients, which a texture cannot be, so the same three
  accent colours are drawn again with the same sweep, highlights and grid — plus
  the little museum plaque that hangs under each frame.
- `components/room/RoomSection.tsx` owns everything the canvas cannot do.

Each picture carries its own little brass lamp. The lamp is geometry with an
emissive face — the light it appears to throw is the point light that was
already there for the hover state, now given a resting brightness instead of
zero, so eight lamps cost nothing beyond the eight lights the scene had anyway.

**The canvas is decoration; the list is the page.** Underneath the scene sits a
real `<ul>` of links — that is what a crawler reads and what the keyboard walks
through, and focus moving along it lights the matching frame. It is clipped out
of sight until something in it takes focus, at which point it becomes a visible
index. When WebGL is missing, or the reader has asked for reduced motion, the
room never loads and the familiar card grid is rendered instead.

`three` is ~150KB gzipped, so it is behind `next/dynamic` with `ssr: false` — a
page that has to boot an emulator elsewhere should not be carrying a renderer in
its first load. The loop also stops when the section scrolls out of view or the
tab is hidden.

Two bits of framing worth keeping:

- Below 900px the copy cannot share the frame with the wall — the words end up
  unreadable over the pictures. There the layout stacks, the scrim comes off,
  and the camera **squares up on the wall at a distance computed from the art's
  own size** rather than a number picked by eye, so all eight always fit.
- The header's desktop breakpoint moved from `md` to `lg`. At 834px the Thai
  labels plus the language toggle plus the sign-in button overflowed the row by
  a few pixels; tablets now get the sheet.

## Brand

The identity sheet gives four colours, one typeface and a mark, and
`app/globals.css` holds them as the only source:

| token | value | where |
| --- | --- | --- |
| `--color-ink` | `#1B1D26` | text, primary buttons, dark bands |
| `--color-paper` | `#F5F3EE` | the page, text on ink |
| `--color-cartridge` | `#F2794A` | the accent — wordmark, links, current page |
| `--color-signal` | `#7E92F5` | the mark's centre, anything that reads as "live" |

Type is **Chakra Petch** with **IBM Plex Mono** for the monospaced labels. Chakra
Petch was chosen by the identity because it carries Thai and Latin in one
family: one face, one set of metrics, no second stylesheet for the Thai build.
It is not a variable font, so the old half-step weights (330, 420, 480…) round
to the nearest of 300/400/500/600/700.

`components/Logo.tsx` draws the mark — a D-pad on an ink tile, arms in
Cartridge, centre in Signal with the play triangle punched through it — on a 64
unit grid with 12 unit cells and 2 unit gaps. Outer corners are rounded and
inner ones are square, which is what keeps it reading as a pad at 18px rather
than as a flower. `Logo` pairs it with the wordmark: "One" in the surrounding
colour, "Play" in Cartridge, never both.

Two notes on how the repaint was done:

- The stylesheet was written in literal `#000`/`#fff` because the old identity
  was monochrome, and every one of those was semantic — ink on paper, paper on
  ink — so they map straight onto the tokens.
- The markup uses Tailwind's `bg-black` / `text-white` / `bg-white` in about
  thirty places, meaning "the dark one" and "the light one". Rather than edit
  each, those three utilities are re-pointed at the tokens in `globals.css`,
  which wins because this stylesheet is unlayered.

Cover art keeps its own colour: each game's `accent` triple is content, not
chrome. The four covers that are *not* game art — the home hero, the home CTA,
the profile header and the 404 — were repainted in the brand palette.

## The name

The product is **OnePlay**. "PlayStation" still appears throughout, but only
where it means Sony's console — the `/play/psx` section, disc formats, the pad
layout — and the footer keeps the disclaimer that goes with that.

Three things deliberately kept their original names, because renaming them would
throw away data that already exists in people's browsers:

- `localStorage` keys (`pshub.best`, `pshub.settings`, `pshub.psxZoom`, …)
- the IndexedDB database `pshub-psx` — discs, BIOS dumps, save states, cards
- the locale cookie `pshub.locale`

They are internal identifiers that nobody sees. Renaming them is a migration,
not a find-and-replace, and it is not worth wiping a shelf of 600 MB discs for.

## Two languages (`/en`, `/th`)

Every route lives under `app/[lang]`, following the guide bundled with this
Next version (`node_modules/next/dist/docs/01-app/02-guides/internationalization.md`).

- **`proxy.js`** does two jobs now: refreshes the Supabase session cookie *and*
  makes sure the URL carries a language. A path without one is redirected to the
  reader's choice — a cookie first, then `Accept-Language` (q-values honoured, no
  dependency for two locales), then English. Visiting a localed URL writes that
  cookie, so the next bare link agrees. `/auth`, `/api`, `/cores` and `/gamepad`
  are passed through untouched: they are not pages.
- **`app/[lang]/dictionaries.ts`** loads `dictionaries/en.json` or `th.json`
  and reads the locale through **`next/root-params`**, which is what this Next
  version provides instead of threading `lang` through every layer.
  `getDictionarySafe()` exists for the not-found boundary alone — `/nonsense`
  puts "nonsense" in the locale slot, and a 404 page that 404s has nowhere to go.
- **`components/I18nProvider.tsx`** carries it into the client tree. Root params
  deliberately do not reach Client Components, and most of this app is one, so
  the root layout reads the dictionary once and hands it down; `useT()` returns
  `t('nav.games')`, with `{name}` interpolation and a missing key rendering as
  itself rather than throwing.
- **`components/LocaleLink.tsx`** replaces `next/link` everywhere. A bare
  `href="/library"` would hit the proxy and be redirected to whatever the browser
  prefers — quietly discarding the language the reader picked.
- **`components/LanguageSwitch.tsx`** swaps the locale segment of the current
  path, so switching keeps you on the page you were reading.

### 404s under a language

Two files, because one cannot cover both cases:

- **`app/[lang]/[...rest]/page.tsx`** catches anything under a language that
  matches no route and calls `notFound()`. Since the proxy gives every request a
  language, a mistyped URL arrives as `/{locale}/whatever` and lands here — so
  the 404 is in the reader's language and renders inside the layout, header and
  footer included. A catch-all never shadows a real route; more specific
  segments win.
- **`app/global-not-found.tsx`** covers the paths the proxy skips (`/auth`,
  `/api`, `/cores`, `/gamepad`). Next builds this one ahead of time and skips
  rendering entirely, which also means request APIs do not work in it: reading
  the locale cookie there returns nothing, so it stays in the default language
  by design. It needs `experimental.globalNotFound` in `next.config.ts`, and it
  must return a whole HTML document — there is no layout to inherit, which is
  the situation the bundled docs describe for an app whose root layout sits
  under a dynamic segment.

### The header

`components/Nav.tsx` keeps everything on one quiet level except a single
emphasis: sections as plain text links with an underline for the current page,
the language control as a segmented toggle rather than two buttons, and account
actions after a hairline so the row reads as two groups instead of a wall of
chips. The duplicate *Browse* button is gone; it went to the same place as
*Games*.

**Sign in** is the only filled button, and only while signed out — once you are
in, the header has nothing left to shout about. **Sign out** is the one place
`--color-danger` appears: filled red with paper text and a door-and-arrow icon,
4.83:1, the same red the forms already use for validation so the product has one
red and not two.

Below `md` the row keeps only the logo, Quick Play and the menu button, and
everything else — sections, account, language — moves into the sheet, which
closes itself on navigation.

One trap worth knowing about, because it bit this header: **`globals.css` is
unlayered, so its class rules outrank Tailwind's utilities regardless of source
order**. `.btn { display: inline-flex }` beat `hidden md:inline-flex`, which is
why the sign-in button and the hamburger used to show on every screen and push
the row off the side of a phone. Responsive visibility now lives on plain
wrapper elements that carry no custom class.

Three places cannot read root params, and each carries the locale explicitly:
Server Actions (`app/actions/auth.ts` — a hidden `locale` field in each form),
the confirmation Route Handler (`?locale=` on the emailed link, falling back to
the cookie), and Client Components (the provider). The actions also return
message *keys* rather than sentences, so the form translates them.

Game copy — titles, taglines, descriptions, trophy names — stays as written.
Those are catalogue content, not interface, and translating them would mean a
schema change in Supabase rather than a dictionary entry.

## Real PlayStation games (`/play/psx`)

Next to the eight canvas games there is a second kind of Play page: an actual
PlayStation 1 emulator, running in the browser.

- **Core** — `pcsx_rearmed`, the libretro PS1 core, compiled to WebAssembly.
  `scripts/fetch-psx-core.mts` downloads the Emscripten build and unpacks the
  `.js` + `.wasm` (~3 MB) into `public/cores/`, so the page loads the core from
  our own origin instead of a CDN at runtime. It runs automatically before
  `npm run dev` and `npm run build`, is a no-op once the files exist, and can be
  forced with `npm run psx:core`. `public/cores/` is git-ignored — it is a build
  artefact, not source.
- **Driver** — [`nostalgist`](https://nostalgist.js.org), a thin wrapper around
  RetroArch's Emscripten build. `lib/psx.ts` holds everything we configure:
  which core, the RetroArch keyboard bindings (which also make the on-screen pad
  work, since `press()` synthesises the bound key), and the pcsx_rearmed core
  options.
- **`/play/psx`** — the shelf. Add a disc image, add an optional BIOS dump, see
  what is stored and how much room is left.
- **`/play/psx/[discId]`** — the console, laid out like `/play/[id]`: session
  bar, stage, pause/error overlays, on-screen pad, controls and stats below the
  fold. `components/PsxStage.tsx` owns the emulator; the core is only started
  from a real click, which is what unlocks audio.

### One library for both

`/library` is a single shelf. It is built client-side from two sources that
never touch each other on the server:

- **Supabase** — every catalogue row, `platform: 'hub'` or `'psx'`. A `psx` row
  is metadata only (name, cover colours, genre); the disc image is never stored
  there and never served by us.
- **This browser** — the discs the player has actually added, from IndexedDB.

`lib/psxCatalogue.ts` merges them. A local disc claims a catalogue row when its
slugified title matches the row id, and whatever is left over still gets a card,
with the glyph and cover colours derived from its own name so the same disc
always looks the same. Cards end up in one of two states:

- **ready** — links straight to `/play/psx/[discId]`
- **disc needed** — a `psx` row with no matching disc: the card wears a *Disc
  needed* badge and links to `/play/psx`, where the player supplies the file

A **Platform** filter row appears under the genre tabs as soon as anything
PlayStation is present, and stays hidden otherwise. `getGames()` tolerates a
database still on `0001`: if the `platform` column is missing it re-reads
without it and treats every row as `'hub'`.

### Bring your own disc

No disc images and no BIOS ship with this app, and nothing you add is uploaded.
`lib/psxDb.ts` keeps discs, BIOS dumps, save states and memory cards in
IndexedDB on the machine that added them — so they do not follow a signed-in
account between devices, and clearing site data removes them.

- Formats: `.cue` + its `.bin` tracks, `.chd`, `.pbp`, `.exe`, `.iso`, `.img`,
  and `.m3u` for multi-disc games (the HUD's *Next disc* button swaps discs).
  Archives are rejected — extract them first.
- Three ways in, described below: **link a folder** (nothing is copied),
  **choose files** (copied into the browser), or **Google Drive** (downloaded
  from the player's own Drive, then copied in).
- BIOS is optional. Without one the core uses its own HLE BIOS, which boots most
  games; a real dump (`scph5501.bin` and friends) fixes the stubborn ones.
- Save states get three slots per disc; the memory card is written back on
  pause, on exit and once a minute while playing.
- Controllers need no setup: the core polls the Gamepad API itself, once per
  emulated frame, and any standard pad reports as a DualShock. Browsers only
  hand a pad over after it has been used, so press a button on it once — the
  session bar then shows *Controller connected*. Keyboard bindings live in
  `KEY_BINDINGS` in `lib/psx.ts`; the on-screen pad is described below.

### Linked folders vs copies

`lib/psxFs.ts` adds the File System Access path, and it is the one to prefer
where the browser has it (Chrome/Edge — the button hides itself elsewhere).

|                    | Link a folder            | Choose files              |
| ------------------ | ------------------------ | ------------------------- |
| Copies the disc    | no                       | yes, into IndexedDB       |
| Storage quota      | untouched                | the full size of the disc |
| Adding 40 discs    | one picker, one scan     | one at a time             |
| Survives a session | needs permission again   | yes                       |
| Browsers           | Chrome, Edge             | all                       |

Linking stores `FileSystemFileHandle`s — they survive structured cloning, so
IndexedDB can hold them — and `resolveDiscFiles()` reads the files off disk at
boot instead. A 600 MB game is on the shelf in a second and costs no quota.

`scanFolder()` walks the picked folder (4 levels, 4000 files) and groups what it
finds the way the files themselves say to: an `.m3u` claims the cue sheets it
lists, a `.cue` claims the tracks its `FILE` lines name, and anything that boots
on its own becomes its own disc. A folder holding exactly one disc lends it its
name, which is usually tidier than `Track 01.bin`. Re-linking the same folder
adds nothing twice — discs carry the path they came from as a key.

The cost is permission. The browser re-asks on a new session, and
`requestPermission()` only works inside a user gesture, so the ask happens on the
*Power on* click; the shelf checks quietly with `queryPermission()` beforehand
and offers a **Grant access** button on any disc that would prompt. Removing a
linked disc forgets the handles and its save states — the files on disk are
untouched. If the disc moved or was renamed, the boot overlay says so.

### Discs from Google Drive

`lib/psxDrive.ts` adds a third way in, and it is off unless the app is
configured for it — no keys, no button.

The player signs in with their own Google account, picks files through the
Google Picker, and the browser downloads them **straight from Google** with
their own token. This app never holds a disc image and never proxies one: the
bytes go from Google to that browser, on the player's Drive quota and Google's
bandwidth.

A few things forced that shape:

- **A share link does not work.** `drive.google.com/uc?export=download` sends no
  CORS headers and puts a virus-scan interstitial in front of large files, so a
  browser cannot fetch it. The fix would be a server proxy — which would put our
  bandwidth *and our name* on the distribution of someone's disc image.
  `www.googleapis.com/drive/v3/files/{id}?alt=media` does support CORS with an
  `Authorization` header, so no proxy is needed.
- **The scope is `drive.file`, not `drive.readonly`.** Paired with the Picker,
  the app only ever sees files the player explicitly hands it. `drive.readonly`
  sees the entire Drive and is a *restricted* scope — shipping with it means a
  third-party security assessment.
- **The file is downloaded, not streamed.** The core needs the whole image in
  memory (see the MEMFS note above), so a Drive disc lands in IndexedDB like any
  other copy, tagged `origin: { kind: 'drive' }` and badged *Drive* on the shelf.
  Drive is cross-device *storage*, not cross-device *play*.

Downloads stream through a reader so the panel can show progress — worth having
when a disc is several hundred megabytes.

To turn it on, add three public identifiers to `.env.local`:

```bash
NEXT_PUBLIC_GOOGLE_CLIENT_ID=…apps.googleusercontent.com
NEXT_PUBLIC_GOOGLE_API_KEY=…
NEXT_PUBLIC_GOOGLE_APP_ID=…   # the Google Cloud project number
```

In the Google Cloud console: create a project, enable **Google Drive API** and
**Google Picker API**, add the `drive.file` scope on the OAuth consent screen,
then create an **OAuth client ID** (Web application, with your origins under
*Authorized JavaScript origins* — `http://localhost:3000` for development) and
an **API key**. The app id is the project number. All three are public values
that ship in the client bundle; the origin allow-list is what protects them.

### Aspect ratio

RetroArch's own default is the wrong one for this console: with
`video_aspect_ratio_auto` off and no explicit `video_aspect_ratio`, *"1:1 PAR
will always be assumed"* — the framebuffer's pixels are drawn square. Almost no
PlayStation game has square pixels. 512×240 and 384×240 framebuffers are
everywhere and were always meant to be shown at 4:3, so 1:1 stretches the
picture wide and squashes everything in it.

`retroarchConfig()` therefore sets `video_aspect_ratio_auto: true` (the core
declares the ratio) together with `video_force_aspect: true` (the rendering area
keeps to it, letterboxing inside the canvas rather than stretching to its
edges). The canvas itself stays 4:3, so on a correctly-behaving game the picture
fills it exactly.

### Sizing the picture

Screens are not the same width, and no single default suits all of them, so the
size of the picture is the player's call: `−` / `+` either side of a percentage
in the HUD, from 60% to 160%, and the percentage itself resets to 100%. Above
100% the picture is deliberately larger than its frame and the frame clips it —
which is how you fill a phone screen with a 4:3 game and lose the letterbox.

The controls also render **inside the stage while fullscreen** (`.psx-fs-bar`,
next to *Exit fullscreen*), because the HUD is not reachable there and
fullscreen is exactly where the adjustment is wanted.

Two things were learned the hard way, both recorded in `globals.css`:

- **Zoom is a `transform`, not a width.** RetroArch's Emscripten glue writes
  inline `width`/`height` in pixels with `!important`, and no stylesheet can
  outrank an inline `!important`; a width-based zoom silently did nothing in
  fullscreen. A transform sidesteps it, and leaves the render buffer at its
  layout size so zooming costs no GL work.
- **The canvas needs `flex: 0 0 auto`.** The stage frame is a flex container,
  and a flex item wider than its parent is shrunk back to fit by default —
  which is another way zooming past 100% quietly does nothing.

The chosen value is kept in `localStorage` (`pshub.psxZoom`), so it is
remembered per device: the phone, the tablet and the desktop each keep their
own.

### Controller ports

A PlayStation has two ports and the browser hands pads over in whatever order it
noticed them, which is rarely the order the people on the sofa expect. The
*Controller ports* panel on the play page lists every pad the browser is
reporting — the on-screen pad included, since it arrives through the same API —
and lets each one be set to Port 1, Port 2 or Not used.

RetroArch takes this as `input_player%u_joypad_index`, a key it builds at
runtime (`input_player%u_joypad_index` is in the core binary) and reads **only
when the core starts**, so a change applies on the next power on and the panel
says so. Leave everything on *Not used* and RetroArch's own ordering stands.

`lib/psxPorts.ts` keeps the assignment keyed by the controller's id string, so
the same physical pad returns to the same port next time it is plugged in, and
giving a port to one pad takes it away from whichever pad held it before — two
controllers sharing a port would only fight each other. The map lives in
`localStorage`, per device.

Browsers keep a pad hidden until it has been used, so the list fills in as
buttons are pressed; the panel polls alongside the connect events because those
do not fire reliably for a pad that was already attached when the page loaded.

### Frame rate readout

*Show FPS* in the HUD (and in the fullscreen bar) puts a live reading over the
stage. It is worth having here in a way it would not be for a native emulator:
there is **no dynarec under WebAssembly** — `pcsx_rearmed_drc` is off because a
recompiler cannot emit native code inside wasm, so the PlayStation's CPU is
interpreted — and the core build carries no `SharedArrayBuffer`, no `pthread`
and no `Worker`, so emulation, video and audio share one thread. Speed is
therefore whatever a single core of that particular device can manage. Throttling
Chrome's CPU shows it plainly: 60 fps at full speed, 32 at a quarter, 20 at a
sixth, 11 at a tenth.

The number is counted from the emulator's own WebGL context, which clears
exactly once per rendered frame — verified against its draw calls, its rAF ticks
and its gamepad polls, all four agreeing at 60.3/s full speed and 14.0/s at a
sixth. The context is wrapped per instance rather than on the prototype, and
unwrapped when the readout is switched off.

Two tempting signals are wrong, and both were measured to be wrong before this
one was chosen: counting Gamepad API polls reads ~180 on a touch device, because
the on-screen pad library polls the same API; Emscripten's own main-loop counter
ticks several times per frame and reads ~200.

The toggle writes the `showFps` preference the canvas games and `/settings`
already share, so turning it on here ticks the box there too.

### The on-screen pad

`components/PsxTouchPad.tsx` puts a DualShock on the glass for phones and
tablets. It does not synthesise key presses — that approach cannot roll from ↑
to ↖ without letting go, and has no analog sticks at all. Instead
[`virtual-gamepad-lib`](https://github.com/KW-M/virtual-gamepad-lib) patches
`navigator.getGamepads()` and reports a standard-mapping pad driven by touch,
which lands on the same path a real controller uses: the core polls that API
once per emulated frame, so RetroArch sees a DualShock and diagonals,
multi-touch and the sticks all come for free.

Three details are load-bearing:

- **It mounts only after the emulator is running.** Nostalgist's `postRun`
  builds a `new GamepadEvent(…, { gamepad })` for every pad already present, and
  an emulated pad is a plain object — the constructor throws on it, which would
  fail the boot.
- **It lives inside `#stage-wrap`.** That is the element that goes fullscreen,
  which is how anyone actually plays on a phone; a pad outside it disappears the
  moment fullscreen starts.
- **It is skipped entirely on hover-capable, fine-pointer devices** — the same
  test the stylesheet uses — so a desktop browser is never told a controller is
  connected that nobody can press. For the same reason the *Controller
  connected* pill ignores pads whose id starts with `Emulated Gamepad`.

Fullscreen is where a phone actually plays, and three things had to be fixed
before it filled the screen:

- The wrapper carries an **inline `max-width`** (860px, or 1100 in 16:9). The
  fullscreen rules beat it with `max-width: none !important`, or the stage stays
  a letterboxed 860px island in the middle of the display.
- **iPhone Safari has no element fullscreen at all** — `requestFullscreen` is
  simply not there, so the button used to do nothing. `PsxStage` falls back to a
  CSS stand-in (`.psx-faux-fullscreen`: `position: fixed`, `100dvh`, body scroll
  locked), and also tries `webkitRequestFullscreen` for older WebKit.
- **Portrait cannot fill a tall screen with a 4:3 picture**, so entering
  fullscreen also asks for `screen.orientation.lock('landscape')`. Android
  grants it once the document is fullscreen; everywhere else rejects and is
  ignored.

Fullscreen also hides the session bar, which is where the Fullscreen button
lives — so an *Exit fullscreen* button renders inside the stage, clear of the
notch via `env(safe-area-inset-*)`. The canvas is re-measured on the way in, so
it renders at the screen's resolution rather than upscaling the windowed buffer.

The artwork is two SVG halves pinned to the bottom corners, leaving the middle
of the screen (the game) clear.

It scales with the screen rather than sitting at a fixed size, because a thumb
is the same size on every phone: each half is
`clamp(--pad-min, --pad-share, --pad-max)` tall, a share of the stage with a
pixel floor and ceiling, and the ceiling carries a `58vw` term so two halves
never crowd a narrow screen. Fullscreen raises all three — that is where the
stage *is* the screen — which works out at roughly:

| | windowed | fullscreen |
| --- | --- | --- |
| phone, portrait | 121–148 px tall, 60% of the width clear | — |
| phone, landscape | — | 327 px tall, 59% clear |
| tablet | capped at 240 px | capped at 420 px |

It is also deliberately see-through: `--pad-idle`
(0.38) while nothing is happening, `--pad-active` (0.8) while a button is down,
both on `.psx-pad` in `globals.css` if they want tuning. The rise is driven by
`:has(.gpad-highlight.pressed)` rather than `.touched` — the library leaves a
stray `touched` on the artwork from load, which would pin the pad at full
strength forever — and where `:has()` is missing the pad simply stays at its
idle opacity. `scripts/copy-gamepad-assets.mts` copies them
out of the package into `public/gamepad/` on `predev` / `prebuild`; the page
fetches them at runtime rather than importing them, keeping 57 KB of pad out of
the bundle for everyone on a desktop. The `.gpad-*` rules in `globals.css` are
the library's own `base.css`, inlined.

### What the canvas is doing

RetroArch renames whatever canvas it is handed to `id="canvas"` and writes
inline pixel `width`/`height` onto it, so the PS1 stage is styled by class
(`.psx-stage`, with `!important` on the box) rather than by id like the canvas
games' `#stage`. The core also measures the canvas only once, so `PsxStage`
re-measures and calls `resize()` on window resize, fullscreen and the 4:3/16:9
toggle — otherwise fullscreen would just upscale the small buffer.

## Run it

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

```bash
npm run build && npm run start   # production build
npm run lint                     # eslint
npm run psx:core                 # re-download the PS1 core into public/cores
```
