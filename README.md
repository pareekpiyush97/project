# Z LAB DESIGN

A scroll-driven site for a paint-protection / detailing studio. The car footage
isn't video — each chapter is a **canvas image sequence scrubbed by scroll**, so
the picture moves exactly with the wheel and never buffers.

No build step, no framework. Open `index.html` on any static host.

**There are two builds, not one responsive page.** `index.html` / `work.html` are
the desktop build: 1920x1080 sequences at 120 frames a chapter (plus a 1200/60 tier that data-saver, 2G and ~2GB machines fall back to), GSAP + Lenis.
`mobile.html` is an app shell in the same graphite + saffron identity: fixed
bottom tab bar, a snap rail of services, bottom sheets with drag-to-dismiss,
photographs instead of canvas, and zero dependencies or third-party requests.
A guard at the top of each file routes by primary pointer type (coarse ->
mobile, fine -> desktop) on the same domain; `?full=1` and `?m=1` override it
for the tab, and the hash survives the hop so deep links keep working.
Cold load of the phone build: 9 requests, ~330KB, no webfont CDN.

---

## Run it

```bash
npm run dev
```

Then open <http://localhost:4970>. (Any static server works; `server.js` is a
30-line one so there's no dependency to install just to look at it.)

---

## The two things you'll want to change

**1 · WhatsApp number** — top of `js/app.js` and `js/work.js`:

```js
var WHATSAPP = '910000000000';   // country code, no '+'
```

**2 · Your clips.** Drop MP4s into `assets/videos/` and they appear by
themselves — each slot shows a placeholder until its file exists, then upgrades
on the next load. Filenames it looks for:

| Where | Filenames |
|---|---|
| Service modals (home) | `ppf.mp4`, `coloured-ppf.mp4`, `matte-ppf.mp4`, `ceramic-coating.mp4`, `coating.mp4`, `detailing.mp4`, `car-wash.mp4`, `bodyshop.mp4`, `bodykit.mp4`, `sunfilm.mp4` |
| Work grid | `work-01.mp4` … `work-09.mp4` |

**3 · The detail sheet under each clip.** `js/details.js` holds one entry per
service and per finished car; every row under "Details" is just a key in a
`specs` object, so adding `Film: 'XPEL Ultimate Plus'` or `'In studio': '4 days'`
to an entry makes a new row appear with no code change. The service modal, the
work modal and the phone bottom sheet all read that one file, so they cannot
drift. Per-car facts we do not have (film brand, hours, registered warranty) are
absent rather than guessed — fill them in and they show up.

Other quick edits: studio name/hours/location live in the HTML; the stat
figures under "By the numbers" are placeholders and marked as such on the page.

**Rebrand the whole site in one line** — `css/app.css`:

```css
--signal:#ffa51f;   /* every accent on the desktop build reads from this */
                    /* mobile.html has its own --signal in css/mobile.css */
```

---

## Structure

```
index.html          desktop home — hero · manifesto · services · process · numbers · booking
work.html           desktop gallery — filterable grid + end CTA
mobile.html         the phone build — one page, everything above, no canvas
css/app.css         desktop design system (tokens → components → sections)
css/mobile.css      phone design system — dark app shell, tab bar, sheets
js/
  core/sequence.js  the scroll-sequence engine
  core/motion.js    split text, reveals, magnetic buttons, counters, cursor
  app.js            desktop home page
  work.js           desktop work page
  mobile.js         the phone build — zero dependencies
  details.js        the spec sheet under every clip — shared by all 3 surfaces
  seq-manifest.js   generated — frame counts per sequence
  lib/              gsap, ScrollTrigger, lenis (vendored, no CDN)
assets/
  seq/<name>/1920/  generated frames, full density — phones never load these
  seq/<name>/1200/  the thrifty tier: half the frames, for weak connections
  img/              source photographs (desktop build)
  img/m/            generated 900px WebP tier for the phone build
  fonts/            self-hosted Archivo + JetBrains Mono
  videos/           ← your clips go here
tools/
  build-sequences.mjs   regenerates assets/seq from the raw frame dumps
```

## Regenerating the footage

`tools/build-sequences.mjs` turns raw frame folders into the responsive WebP
sequences the site loads. Point `SRC` and `CLIPS` at your own frames and:

```bash
npm install && npm run build:seq   # scroll sequences (desktop)
npm run build:img                  # 900px WebP photos + small wordmark (phone)
```

It samples each clip to 120 frames at 1920 and 60 at 1200 (the source dumps are
1080p — anything wider would be upscaling), encodes WebP q68, and rewrites
`js/seq-manifest.js`. Frames then stream in **passes of decreasing stride** --
1 in 8, then 1 in 4, 1 in 2, then the rest -- so a chapter is scrubbable after
~15 requests instead of 120. Total **~90 MB of WebP** across both tiers, streamed
progressively: the preloader lifts on the first hero frame, not the last.

Frame *count* is the cheap half of smooth scrubbing — measured on this footage,
1920/q68 is ~83 KB a frame against ~68 KB for the old 1600/q62 — so the budget
goes into density. The other half is the sub-frame cross-fade in `sequence.js`
(median 0 ms, max 0.5 ms per paint at a 2545x1440 backing).

---

## Notes for whoever picks this up next

Four things here are deliberate, and undoing them will cost you frames:

- **Frames are kept compressed, not decoded.** A decoded 1920×1080 frame is
  ~8.3 MB; 120 of them is ~1 GB a chapter, which nothing will hold, so the
  browser silently re-decodes mid-scroll and you get the stutter. `sequence.js`
  keeps `Image` objects and pre-`decode()`s only a rolling window around the
  playhead.
- **The cross-fade must land on a whole frame when the scrub stops.** A blend
  held at rest is a visible double exposure. `_schedule()` runs one extra tick
  after the last movement to settle on `Math.round(target)`.
- **No `mix-blend-mode` on fixed overlays.** A blended fixed layer forces the
  whole page to re-composite every scroll frame. Measured: 31fps → 58fps just
  from removing it.
- **`.pin` must not have `overflow`.** Any overflow value on the ancestor
  silently kills `position:sticky` on `.stage` and every chapter stops pinning.

Reduced-motion is honoured throughout: pinning, scrubbing and the marquee all
turn off and the sections become plain stacked content.
