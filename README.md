# Z LAB DESIGN

A scroll-driven site for a paint-protection / detailing studio. The car footage
isn't video — each chapter is a **canvas image sequence scrubbed by scroll**, so
the picture moves exactly with the wheel and never buffers.

No build step, no framework. Open `index.html` on any static host.

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

Other quick edits: studio name/hours/location live in the HTML; the stat
figures under "By the numbers" are placeholders and marked as such on the page.

**Rebrand the whole site in one line** — `css/app.css`:

```css
--signal:#d6ff3f;   /* every accent on the site reads from this */
```

---

## Structure

```
index.html          home — hero · manifesto · services · process · numbers · booking
work.html           gallery — filterable grid + end CTA
css/app.css         design system (tokens → components → sections), one file
js/
  core/sequence.js  the scroll-sequence engine
  core/motion.js    split text, reveals, magnetic buttons, counters, cursor
  app.js            home page
  work.js           work page
  seq-manifest.js   generated — frame counts per sequence
  lib/              gsap, ScrollTrigger, lenis (vendored, no CDN)
assets/
  seq/<name>/<w>/   generated frames, 1280 desktop + 720 mobile
  fonts/            self-hosted Archivo + JetBrains Mono
  videos/           ← your clips go here
tools/
  build-sequences.mjs   regenerates assets/seq from the raw frame dumps
```

## Regenerating the footage

`tools/build-sequences.mjs` turns raw frame folders into the responsive WebP
sequences the site loads. Point `SRC` and `CLIPS` at your own frames and:

```bash
npm install && npm run build:seq
```

It samples each clip to 72 desktop / 40 mobile frames, resizes to 1280/720,
encodes WebP, and rewrites `js/seq-manifest.js`. That took the raw footage from
**54 MB of JPEGs to ~38 MB of WebP**, and a phone only ever pulls the 720px set
(~0.8 MB per chapter).

---

## Notes for whoever picks this up next

Three things here are deliberate, and undoing them will cost you frames:

- **Frames are kept compressed, not decoded.** A decoded 1280×720 frame is
  ~3.7 MB; 72 of them is ~265 MB per chapter, which phones cannot hold, so the
  browser silently re-decodes mid-scroll and you get the stutter. `sequence.js`
  keeps `Image` objects and pre-`decode()`s only a rolling window around the
  playhead.
- **No `mix-blend-mode` on fixed overlays.** A blended fixed layer forces the
  whole page to re-composite every scroll frame. Measured: 31fps → 58fps just
  from removing it.
- **`.pin` must not have `overflow`.** Any overflow value on the ancestor
  silently kills `position:sticky` on `.stage` and every chapter stops pinning.

Reduced-motion is honoured throughout: pinning, scrubbing and the marquee all
turn off and the sections become plain stacked content.
