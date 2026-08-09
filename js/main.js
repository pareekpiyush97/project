/* ============================================================
   main.js — scroll orchestration for APEX
   Sections: hero → statement → services → booking
   Each act = a sticky canvas whose Sequence scrubs with scroll.
   ============================================================ */

/* ---- EDIT THESE ---------------------------------------------------------- */
const WHATSAPP_NUMBER = '910000000000';           // <-- studio WhatsApp (country code, no +)
const WHATSAPP_TEXT   = "Hi APEX! I'd like to book my car in. Car: ____  Service: ____";
/* -------------------------------------------------------------------------- */

const SERVICES = [
  { name: 'Car Wash',        slug: 'car-wash',        desc: 'Foam, decontaminate, hand-dry. The weekly ritual your paint actually deserves.' },
  { name: 'Ceramic Coating', slug: 'ceramic-coating', desc: 'A liquid-glass shell — slick, hydrophobic, and years of depth in the gloss.' },
  { name: 'Matte PPF',       slug: 'matte-ppf',       desc: 'Self-healing film that keeps matte, matte. Stone chips strictly optional.' },
  { name: 'Bodyshop',        slug: 'bodyshop',        desc: 'Dent, scratch, respray — brought back factory-fresh, panel by panel.' },
  { name: 'Bodykit',         slug: 'bodykit',         desc: 'Splitters, diffusers, wings — fitted tighter than the OEM ever dared.' },
  { name: 'Sunfilm',         slug: 'sunfilm',         desc: 'Heat and UV rejected at the glass. Cabin stays cool, interior stays new.' },
  { name: 'Detailing',       slug: 'detailing',       desc: 'Every pore of paint and leather taken back to zero-mile condition.' },
  { name: 'Coloured PPF',    slug: 'coloured-ppf',    desc: 'Change the colour, keep the paint underneath. Fully reversible.' },
  { name: 'PPF',             slug: 'ppf',             desc: 'Invisible armour over the clear coat. Track days very welcome.' },
  { name: 'Coating',         slug: 'coating',         desc: 'Wheels, glass, trim and interior — all coated to repel the world.' },
];

// always open on the hero — never restore a mid-scroll position
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
window.scrollTo(0, 0);

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

/* ---------- build the services list ---------- */
function buildServices() {
  const ul = $('#servicesList');
  if (!ul) return;
  ul.innerHTML = SERVICES.map((s, i) => `
    <li class="svc" data-i="${i}" data-cursor>
      <span class="svc__idx">${String(i + 1).padStart(2, '0')}</span>
      <span class="svc__name">${s.name}</span>
      <span class="svc__play"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></span>
    </li>`).join('');
  $$('.svc', ul).forEach(el => el.addEventListener('click', () => openVideo(+el.dataset.i)));
}

/* ---------- video lightbox ---------- */
const vbox = $('#vbox');
function openVideo(i) {
  const s = SERVICES[i];
  $('#vboxTitle').innerHTML = `${s.name}<span>.</span>`;
  $('#vboxDesc').textContent = s.desc;
  const video = $('#vboxVideo'), ph = $('#vboxPlaceholder');
  const src = `assets/videos/${s.slug}.mp4`;   // drop the clip here to make it play
  $('#vboxHint').textContent = `assets/videos/${s.slug}.mp4`;
  video.style.display = 'none'; ph.style.display = 'flex';
  video.onloadeddata = () => { video.style.display = 'block'; ph.style.display = 'none'; video.play().catch(() => {}); };
  video.onerror = () => { video.style.display = 'none'; ph.style.display = 'flex'; };
  video.src = src;
  video.load();
  vbox.classList.add('open'); vbox.setAttribute('aria-hidden', 'false');
  document.body.classList.add('no-scroll');
}
function closeVideo() {
  vbox.classList.remove('open'); vbox.setAttribute('aria-hidden', 'true');
  const v = $('#vboxVideo'); v.pause(); v.removeAttribute('src'); v.load();
  document.body.classList.remove('no-scroll');
}
$('#vboxClose').addEventListener('click', closeVideo);
vbox.addEventListener('click', e => { if (e.target === vbox) closeVideo(); });
addEventListener('keydown', e => { if (e.key === 'Escape' && vbox.classList.contains('open')) closeVideo(); });

/* ---------- per-act sequence + scrub ---------- */
const sequences = [];
function initAct(section) {
  const canvas = $('.act__canvas', section);
  const seq = new Sequence(canvas, section.dataset.seq, +section.dataset.count);
  sequences.push({ section, seq });

  if (reduced) { seq.load().then(() => seq.seek(0.5)); return { section, seq }; }

  // lazy-load frames when the act gets close
  ScrollTrigger.create({
    trigger: section, start: 'top bottom+=80%',
    once: true, onEnter: () => seq.load()
  });
  // scrub the sequence across the act
  ScrollTrigger.create({
    trigger: section, start: 'top top', end: 'bottom bottom', scrub: 0.4,
    onUpdate: self => seq.seek(self.progress)
  });
  return { section, seq };
}

/* ---------- statement words ---------- */
function initStatement(section) {
  const words = $$('.statement__word', section);
  if (reduced) { words.forEach(w => w.classList.add('lit')); return; }
  ScrollTrigger.create({
    trigger: section, start: 'top top', end: 'bottom bottom', scrub: true,
    onUpdate: self => {
      const lit = Math.round(gsap.utils.clamp(0, 1, (self.progress - 0.08) / 0.6) * words.length);
      words.forEach((w, i) => w.classList.toggle('lit', i < lit));
    }
  });
}

/* ---------- services reveal one-by-one ---------- */
function initServices(section) {
  const items = $$('.svc', section);
  const count = $('#svcCount');
  if (reduced) { items.forEach(el => el.classList.add('is-in', 'is-active')); return; }
  const START = 0.0, END = 0.82, N = items.length;
  ScrollTrigger.create({
    trigger: section, start: 'top top', end: 'bottom bottom', scrub: true,
    onUpdate: self => {
      let active = -1;
      items.forEach((el, i) => {
        const t = START + (i / (N - 1)) * (END - START);
        const on = self.progress >= t;
        el.classList.toggle('is-in', on);
        el.classList.toggle('is-active', false);
        if (on) active = i;
      });
      if (active >= 0) {
        items[active].classList.add('is-active');
        count.textContent = String(active + 1).padStart(2, '0');
      } else {
        count.textContent = '01';
      }
    }
  });
}

/* ---------- global chrome: cursor, progress bar ---------- */
function initChrome() {
  $('#year').textContent = new Date().getFullYear();
  const wa = $('#waBtn');
  wa.href = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(WHATSAPP_TEXT)}`;

  const bar = $('#scrollProgress');
  let ticking = false;
  const onScroll = () => {
    if (ticking) return; ticking = true;
    requestAnimationFrame(() => {
      const h = document.documentElement;
      bar.style.transform = `scaleX(${(h.scrollTop / (h.scrollHeight - h.clientHeight)) || 0})`;
      ticking = false;
    });
  };
  addEventListener('scroll', onScroll, { passive: true }); onScroll();

  // smooth in-page anchors
  $$('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
    const t = $(a.getAttribute('href'));
    if (t) { e.preventDefault(); t.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' }); }
  }));

  // custom cursor
  const cur = $('#cursor');
  if (cur && matchMedia('(hover:hover)').matches) {
    let x = innerWidth / 2, y = innerHeight / 2, cx = x, cy = y;
    addEventListener('mousemove', e => { x = e.clientX; y = e.clientY; });
    const tick = () => { cx += (x - cx) * .18; cy += (y - cy) * .18; cur.style.transform = `translate(${cx}px,${cy}px)`; requestAnimationFrame(tick); };
    tick();
    document.addEventListener('mouseover', e => {
      cur.classList.toggle('grow', !!e.target.closest('[data-cursor],a,button,.svc,.work-card'));
    });
  }
}

/* ---------- menu box ---------- */
function initMenu() {
  const menu = $('#menu'), toggle = $('#navToggle');
  if (!menu || !toggle) return;
  const txt = toggle.querySelector('.nav__toggle-txt');
  const mwa = $('#menuWa');
  if (mwa) mwa.href = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(WHATSAPP_TEXT)}`;

  // looping car backdrop (unused sequence), only while the menu is open
  const canvas = menu.querySelector('.menu__canvas');
  let seq = null, raf = 0, last = 0, frame = 0;
  const loop = t => {
    raf = requestAnimationFrame(loop);
    if (t - last < 45) return;            // ~22fps
    last = t;
    if (seq && seq.loaded > 0) { frame = (frame + seq.step) % seq.count; seq.draw(frame); }
  };
  const startAnim = () => {
    if (reduced || !canvas) return;
    if (!seq) { seq = new Sequence(canvas, 'menu', 264); seq.load(); }
    cancelAnimationFrame(raf); last = 0; raf = requestAnimationFrame(loop);
  };
  const stopAnim = () => { cancelAnimationFrame(raf); raf = 0; };

  const set = open => {
    document.body.classList.toggle('menu-open', open);
    menu.classList.toggle('open', open);
    menu.setAttribute('aria-hidden', open ? 'false' : 'true');
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (txt) txt.textContent = open ? 'Close' : 'Menu';
    if (open) startAnim(); else stopAnim();
  };
  toggle.addEventListener('click', () => set(!menu.classList.contains('open')));
  $$('.menu a').forEach(a => a.addEventListener('click', () => set(false)));
  addEventListener('keydown', e => { if (e.key === 'Escape' && menu.classList.contains('open')) set(false); });
}

/* ---------- clean hero entrance ---------- */
function heroIntro() {
  if (reduced) return;
  gsap.from('.hero__eyebrow, .hero__title, .hero__sub', {
    y: 44, opacity: 0, duration: 1.1, ease: 'power3.out', stagger: 0.12, delay: 0.1
  });
  gsap.from('.hero__scroll', { opacity: 0, duration: 1, delay: 1 });
}

/* ---------- boot ---------- */
function boot() {
  buildServices();
  initChrome();
  initMenu();

  if (!reduced) gsap.registerPlugin(ScrollTrigger);
  $$('.act').forEach(initAct);
  initStatement($('.act--statement'));
  initServices($('.act--services'));

  // Reveal the intro as soon as the FIRST hero frame is ready — the rest of
  // the frames keep streaming in the background while the user reads the hero.
  const hero = sequences.find(s => s.seq.name === 'hero').seq;
  const fill = $('#loaderFill'), pct = $('#loaderPct');
  let revealed = false;
  const reveal = () => {
    if (revealed) return; revealed = true;
    const loader = $('#loader');
    if (!loader) return;
    fill.style.width = '100%';
    loader.classList.add('done');
    heroIntro();
    setTimeout(() => { loader.remove(); if (!reduced) ScrollTrigger.refresh(); }, 700);
    // warm the other acts once the intro is up
    ['protect', 'services', 'booking'].forEach(n => {
      const s = sequences.find(x => x.seq.name === n);
      if (s) s.seq.load();
    });
  };

  hero.load(p => {
    fill.style.width = Math.round(p * 100) + '%';
    pct.textContent = `Loading the studio · ${Math.round(p * 100)}%`;
    if (hero.images[0] || p > 0.05) reveal();   // first frame in → go
  }).then(reveal);

  setTimeout(reveal, 8000); // safety net
}

document.addEventListener('DOMContentLoaded', boot);
