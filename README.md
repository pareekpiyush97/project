# APEX AUTO STUDIO — cinematic scroll site

A car-detailing studio website driven entirely by **scroll-scrubbed image sequences**
(Apple-style: the footage plays as you scroll). Vanilla HTML/CSS/JS + GSAP ScrollTrigger,
no build step.

## Pages
- **`index.html`** — one continuous scroll story:
  1. Hero intro (sequence reveal + loader)
  2. Statement (words light up on scroll)
  3. **Services** — 10 services appear one-by-one; click a name to open a video box
  4. Booking finale — **Book on WhatsApp** CTA
- **`work.html`** — “Our Work”: sequence hero + filterable grid of work-clip cards.

## Edit these
- **WhatsApp number + brand** → top of `js/main.js` (`WHATSAPP_NUMBER`).
- **Service videos** → drop `assets/videos/<slug>.mp4` (e.g. `ceramic-coating.mp4`, `ppf.mp4`).
- **Work videos** → `assets/videos/work-01.mp4 … work-09.mp4`.
  Until a file exists, the box shows a “footage coming soon” placeholder.

## Run locally
Any static server works. With Node:
```bash
node server.js        # http://localhost:4970
```

## Structure
```
index.html  work.html
css/style.css
js/sequence.js   # reusable canvas image-sequence player
js/main.js       # home-page scroll orchestration
js/work.js       # work-page grid + hero
assets/seq/{hero,services,protect,booking,work}/   # scroll frames
assets/videos/   # drop your .mp4 work clips here
```
