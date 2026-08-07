/* ============================================================
   work.js — "Our Work" page
   Cinematic sequence hero + a grid of work-clip placeholders.
   Drop assets/videos/work-01.mp4 ... to fill the cards.
   ============================================================ */

if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
window.scrollTo(0, 0);

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const WORK = [
  { n: '01', cat: 'ceramic',  tag: 'Ceramic',      title: 'Matte Black GT' },
  { n: '02', cat: 'ppf',      tag: 'PPF',          title: 'Track Build' },
  { n: '03', cat: 'detailing',tag: 'Detailing',    title: 'Concours Revival' },
  { n: '04', cat: 'bodyshop', tag: 'Bodyshop',     title: 'Panel Respray' },
  { n: '05', cat: 'ppf',      tag: 'Coloured PPF', title: 'Chrome Shift' },
  { n: '06', cat: 'ceramic',  tag: 'Ceramic',      title: 'Daily Driver' },
  { n: '07', cat: 'detailing',tag: 'Detailing',    title: 'Interior Reset' },
  { n: '08', cat: 'ppf',      tag: 'PPF',          title: 'Full Front' },
  { n: '09', cat: 'bodyshop', tag: 'Bodykit',      title: 'Widebody' },
];

/* ---- build the grid ---- */
function buildGrid() {
  const grid = $('#workGrid');
  grid.innerHTML = WORK.map(w => `
    <article class="work-card" data-cat="${w.cat}" data-n="${w.n}" data-cursor>
      <div class="work-card__ph">
        <svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M10 9l5 3-5 3z" fill="currentColor" stroke="none"/></svg>
      </div>
      <video muted loop playsinline preload="none"></video>
      <div class="work-card__meta">
        <div>
          <div class="work-card__tag">${w.tag}</div>
          <div class="work-card__title">${w.title}</div>
        </div>
        <div class="work-card__n">${w.n}</div>
      </div>
    </article>`).join('');

  // try to load each clip; if present it autoplays on view, else stays a placeholder
  $$('.work-card').forEach(card => {
    const v = $('video', card), ph = $('.work-card__ph', card);
    v.onloadeddata = () => { ph.style.display = 'none'; };
    v.onerror = () => { v.style.display = 'none'; };
    v.src = `assets/videos/work-${card.dataset.n}.mp4`;
    v.load();
    // click a loaded clip -> unmute + native controls
    card.addEventListener('click', () => {
      if (v.style.display === 'none') return;
      v.muted = !v.muted; v.controls = !v.muted;
    });
  });

  // play only what's on screen (perf)
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(es => es.forEach(e => {
      const v = $('video', e.target);
      if (e.isIntersecting) v.play?.().catch(() => {}); else v.pause?.();
    }), { threshold: 0.35 });
    $$('.work-card').forEach(c => io.observe(c));
  }
}

/* ---- filter chips ---- */
function initFilters() {
  $$('#workFilters .chip').forEach(chip => chip.addEventListener('click', () => {
    $$('#workFilters .chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    const cat = chip.dataset.cat;
    $$('.work-card').forEach(card => {
      const show = cat === 'all' || card.dataset.cat === cat;
      card.style.display = show ? '' : 'none';
    });
  }));
}

/* ---- cinematic sequence hero ---- */
function initHero() {
  const canvas = $('.work-hero__canvas');
  const seq = new Sequence(canvas, 'work', 171);
  seq.load(p => { if (p > 0.02 && seq.current < 0) seq.seek(0); });
  if (reduced) { seq.load().then(() => seq.seek(0.4)); return; }
  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.create({
    trigger: '#workHero', start: 'top top', end: 'bottom top', scrub: 0.4,
    onUpdate: self => seq.seek(self.progress)
  });
}

/* ---- shared chrome ---- */
function initChrome() {
  $('#year').textContent = new Date().getFullYear();
  const bar = $('#scrollProgress');
  const onScroll = () => {
    const h = document.documentElement;
    bar.style.width = (h.scrollTop / (h.scrollHeight - h.clientHeight) * 100) + '%';
  };
  addEventListener('scroll', onScroll, { passive: true }); onScroll();

  const cur = $('#cursor');
  if (cur && matchMedia('(hover:hover)').matches) {
    let x = innerWidth / 2, y = innerHeight / 2, cx = x, cy = y;
    addEventListener('mousemove', e => { x = e.clientX; y = e.clientY; });
    const tick = () => { cx += (x - cx) * .18; cy += (y - cy) * .18; cur.style.transform = `translate(${cx}px,${cy}px)`; requestAnimationFrame(tick); };
    tick();
    document.addEventListener('mouseover', e => cur.classList.toggle('grow', !!e.target.closest('[data-cursor],a,button,.work-card,.chip')));
  }
}

document.addEventListener('DOMContentLoaded', () => { buildGrid(); initFilters(); initHero(); initChrome(); });
