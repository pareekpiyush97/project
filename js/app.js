/* ============================================================================
   app.js — home page. Chapters: hero · manifesto · services · process · book
   ========================================================================== */
(function (w) {
  'use strict';

  /* ---- studio config — edit these ------------------------------------- */
  var WHATSAPP = '910000000000';                     // country code, no '+'
  var WA_TEXT  = "Hi APEX — I'd like to book my car in.\nCar: \nService: ";

  var SERVICES = [
    ['Paint Protection Film', 'ppf',            'Invisible, self-healing armour over the clear coat. Track days very welcome.'],
    ['Coloured PPF',          'coloured-ppf',   'Change the colour, keep the paint underneath untouched. Fully reversible.'],
    ['Matte PPF',             'matte-ppf',      'Keeps matte exactly matte, and takes the stone chips so the panel does not.'],
    ['Ceramic Coating',       'ceramic-coating','A liquid-glass shell — slick, hydrophobic, years of depth in the gloss.'],
    ['Coating',               'coating',        'Wheels, glass, trim and interior, each coated to repel its own kind of mess.'],
    ['Detailing',             'detailing',      'Every pore of paint and leather taken back to zero-mile condition.'],
    ['Car Wash',              'car-wash',       'Foam, decontaminate, hand-dry. The weekly ritual your paint actually deserves.'],
    ['Bodyshop',              'bodyshop',       'Dent, scratch and respray work colour-matched until the repair disappears.'],
    ['Bodykit',               'bodykit',        'Splitters, diffusers and wings fitted with panel gaps that actually line up.'],
    ['Sun Film',              'sunfilm',        'Heat and UV stopped at the glass. Cabin stays cool, interior stays new.']
  ];

  var M = w.APEX.motion, $ = M.$, $$ = M.$$, reduced = M.reduced;
  gsap.registerPlugin(ScrollTrigger);

  /* keep the page at the top on reload — a mid-scroll restore breaks pinning */
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

  /* ---- smooth scroll (Lenis drives ScrollTrigger) ---------------------- */
  var lenis = null;
  function initScroll() {
    if (reduced || typeof Lenis === 'undefined') return;
    lenis = new Lenis({ duration: 1.05, smoothWheel: true, touchMultiplier: 1.6 });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
    gsap.ticker.lagSmoothing(0);
  }

  /* ---- sequences ------------------------------------------------------- */
  var seqs = {};
  function initSequences() {
    $$('[data-seq]').forEach(function (section) {
      var canvas = $('.layer--canvas', section);
      if (!canvas) return;
      var name = section.dataset.seq;
      var seq = new Sequence(canvas, name, { priority: name === 'hero' ? 100 : 20 });
      seqs[name] = seq;

      if (reduced) { seq.load(null, function () { seq.draw(Math.floor(seq.count / 2)); }); return; }

      // .process is pinned by GSAP, which shifts its start/end. A separate
      // scrub trigger on the same element resolves against the *unpinned*
      // geometry and falls out of sync, so the footage freezes partway
      // through. initProcess() drives that one from the pin itself.
      if (section.classList.contains('process')) {
        ScrollTrigger.create({
          trigger: section, start: 'top bottom+=150%', once: true,
          onEnter: function () { seq.priority = 50; seq.load(); }
        });
        return;
      }

      // start fetching once the section is within ~1.5 screens
      ScrollTrigger.create({
        trigger: section, start: 'top bottom+=150%', once: true,
        onEnter: function () { seq.priority = 50; seq.load(); }
      });
      // scrub across the whole section
      ScrollTrigger.create({
        trigger: section, start: 'top top', end: 'bottom bottom', scrub: true,
        onUpdate: function (self) { seq.seek(self.progress); }
      });
    });
  }

  /* ---- hero: title parts out as you scroll ----------------------------- */
  function initHero() {
    if (reduced) return;
    var tl = gsap.timeline({
      scrollTrigger: { trigger: '.hero', start: 'top top', end: '60% top', scrub: true }
    });
    tl.to('#heroTitle', { yPercent: -18, opacity: 0, filter: 'blur(6px)', ease: 'none' }, 0)
      .to('#heroMeta',  { yPercent: 40, opacity: 0, ease: 'none' }, 0);

    // entrance (runs once the preloader lifts)
    w.APEX.heroIn = function () {
      var t = gsap.timeline({ defaults: { ease: 'expo.out' } });
      t.from('.hero__kicker', { y: 26, opacity: 0, duration: 1 })
       .from(M.splitWords($('.hero__title h1 .l1')), { yPercent: 115, duration: 1.25, stagger: .07 }, '-=.75')
       .from(M.splitWords($('.hero__title h1 .l2')), { yPercent: 115, duration: 1.25, stagger: .07 }, '-=1.05')
       .from('#heroMeta', { y: 30, opacity: 0, duration: 1 }, '-=.8');
    };
  }

  /* ---- manifesto: words illuminate with scroll ------------------------- */
  function initManifesto() {
    var line = $('#manifestoLine');
    if (!line) return;
    var words = M.splitWords(line);      // keeps the <em> accent intact
    if (reduced) { words.forEach(function (s) { s.classList.add('on'); }); return; }
    ScrollTrigger.create({
      trigger: '.manifesto', start: 'top top', end: 'bottom bottom', scrub: true,
      onUpdate: function (self) {
        var lit = Math.round(gsap.utils.clamp(0, 1, (self.progress - .05) / .45) * words.length);
        words.forEach(function (s, i) { s.classList.toggle('on', i < lit); });
      }
    });
  }

  /* ---- services: reveal one by one, click to watch --------------------- */
  function initServices() {
    var list = $('#svcList');
    list.innerHTML = SERVICES.map(function (s, i) {
      return '<li class="svc"><button class="svc__btn" data-i="' + i + '" data-cursor="Watch">' +
        '<span class="svc__i">' + String(i + 1).padStart(2, '0') + '</span>' +
        '<span class="svc__n">' + s[0] + '</span>' +
        '<span class="svc__go"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg></span>' +
        '</button></li>';
    }).join('');

    var items = $$('.svc', list);
    var num = $('#svcNum');
    $$('.svc__btn', list).forEach(function (b) {
      b.addEventListener('click', function () { openModal(+b.dataset.i); });
    });

    if (reduced) { items.forEach(function (el) { el.classList.add('is-in'); }); return; }

    // A sticky stage un-sticks over its final 100vh (here ≈ progress .81),
    // so every row must have landed before that or the last ones reveal
    // while the section is already scrolling away.
    var N = items.length, START = 0.02, END = 0.72;
    ScrollTrigger.create({
      trigger: '.services', start: 'top top', end: 'bottom bottom', scrub: true,
      onUpdate: function (self) {
        var active = -1;
        for (var i = 0; i < N; i++) {
          var t = START + (i / (N - 1)) * (END - START);
          var on = self.progress >= t;
          items[i].classList.toggle('is-in', on);
          items[i].classList.remove('is-on');
          if (on) active = i;
        }
        if (active >= 0) {
          items[active].classList.add('is-on');
          num.textContent = String(active + 1).padStart(2, '0');
        } else { num.textContent = '01'; }
      }
    });
  }

  /* ---- process: vertical scroll drives a horizontal track -------------- */
  function initProcess() {
    var section = $('.process'), track = $('#processTrack');
    if (!section || !track || reduced) return;
    var steps = $$('.step', track);
    var distance = function () { return Math.max(0, track.scrollWidth - w.innerWidth); };

    gsap.to(track, {
      x: function () { return -distance(); },
      ease: 'none',
      scrollTrigger: {
        trigger: section, start: 'top top', pin: true, scrub: 0.6,
        end: function () { return '+=' + (distance() + w.innerHeight * 0.5); },
        invalidateOnRefresh: true,
        // Reveal each card from the pin's own progress. Deriving it here is far
        // sturdier than a second ScrollTrigger bound via containerAnimation.
        onUpdate: function (self) {
          // the footage scrubs off the *pin's* progress, so it stays locked to
          // the horizontal track for the whole pinned range
          if (seqs.process) seqs.process.seek(self.progress);
          var x = distance() * self.progress;
          for (var i = 0; i < steps.length; i++) {
            if (steps[i].offsetLeft - x < w.innerWidth * 0.82) steps[i].classList.add('is-in');
          }
        }
      }
    });
  }

  /* ---- video modal ----------------------------------------------------- */
  var modal = $('#modal'), lastFocus = null;
  function openModal(i) {
    var s = SERVICES[i];
    $('#modalT').textContent = s[0];
    $('#modalBody').textContent = s[2];
    $('#modalPath').textContent = 'assets/videos/' + s[1] + '.mp4';
    var v = $('#modalVid'), ph = $('#modalPh');
    var url = 'assets/videos/' + s[1] + '.mp4';
    v.style.display = 'none'; ph.style.display = '';
    M.withVideo(url, function () {
      v.onloadeddata = function () { v.style.display = 'block'; ph.style.display = 'none'; v.play().catch(function () {}); };
      v.src = url; v.load();
    });
    lastFocus = document.activeElement;
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('is-locked');
    if (lenis) lenis.stop();
    $('#modalX').focus();
  }
  function closeModal() {
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    var v = $('#modalVid'); v.pause(); v.removeAttribute('src'); v.load();
    document.body.classList.remove('is-locked');
    if (lenis) lenis.start();
    if (lastFocus) lastFocus.focus();
  }
  $('#modalX').addEventListener('click', closeModal);
  modal.addEventListener('click', function (e) { if (e.target === modal) closeModal(); });

  /* ---- menu ------------------------------------------------------------ */
  function initMenu() {
    var menu = $('#menu'), burger = $('#burger'), txt = $('#burgerTxt');
    var links = $$('.menu__list a');
    var seq = null, raf = 0, last = 0, frame = 0;

    // Plays through exactly once per opening, then holds the last frame — a
    // looping backdrop reads as a stuck GIF behind the nav. Driven by elapsed
    // time rather than tick count so it always takes MENU_PLAY_MS regardless
    // of the display's refresh rate.
    var MENU_PLAY_MS = 2200;
    function loop(t) {
      if (!last) last = t;
      if (!seq || seq.loaded < 2) { raf = requestAnimationFrame(loop); return; }
      var p = Math.min(1, (t - last) / MENU_PLAY_MS);
      var f = Math.round(p * (seq.count - 1));
      if (f !== frame) { frame = f; seq.draw(frame); }
      if (p >= 1) { raf = 0; return; }        // done — hold on the last frame
      raf = requestAnimationFrame(loop);
    }
    function set(open) {
      document.body.classList.toggle('menu-open', open);
      document.body.classList.toggle('is-locked', open);
      menu.classList.toggle('is-open', open);
      menu.setAttribute('aria-hidden', open ? 'false' : 'true');
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (txt) txt.textContent = open ? 'Close' : 'Menu';
      if (lenis) open ? lenis.stop() : lenis.start();

      // link reveal is handled by CSS off .is-open — nothing to tween here
      if (open) {
        if (!reduced) {
          // top priority: the menu is what the user is looking at right now, so
          // its frames must jump ahead of the page sequences still queued
          if (!seq) { seq = new Sequence($('.menu__canvas', menu), 'menu', { priority: 200 }); seq.load(); }
          cancelAnimationFrame(raf);
          last = 0; frame = 0;              // replay from the first frame
          raf = requestAnimationFrame(loop);
        }
      } else {
        cancelAnimationFrame(raf); raf = 0;
      }
    }
    burger.addEventListener('click', function () { set(!menu.classList.contains('is-open')); });
    links.forEach(function (a) { a.addEventListener('click', function () { set(false); }); });
    w.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      if (modal.classList.contains('is-open')) closeModal();
      else if (menu.classList.contains('is-open')) set(false);
    });
  }

  /* ---- chapter HUD ----------------------------------------------------- */
  function initHud() {
    var dots = $$('#hud a');
    $$('[data-chapter]').forEach(function (sec) {
      var i = +sec.dataset.chapter;
      ScrollTrigger.create({
        trigger: sec, start: 'top 55%', end: 'bottom 45%',
        onToggle: function (self) { if (dots[i]) dots[i].classList.toggle('is-on', self.isActive); }
      });
    });
  }

  /* ---- links, progress, transitions ------------------------------------ */
  function initChrome() {
    $('#yr').textContent = new Date().getFullYear();
    var href = 'https://wa.me/' + WHATSAPP + '?text=' + encodeURIComponent(WA_TEXT);
    ['#waBtn', '#menuWa', '#footWa'].forEach(function (sel) { var el = $(sel); if (el) el.href = href; });

    var bar = $('#progress'), navUpdate = M.initNav($('#nav')), ticking = false;
    function onScroll() {
      if (ticking) return; ticking = true;
      requestAnimationFrame(function () {
        var d = document.documentElement;
        var p = d.scrollTop / Math.max(1, d.scrollHeight - d.clientHeight);
        bar.style.transform = 'scaleX(' + p + ')';
        if (navUpdate) navUpdate(d.scrollTop);
        ticking = false;
      });
    }
    w.addEventListener('scroll', onScroll, { passive: true }); onScroll();

    // in-page anchors go through Lenis so they respect the smooth scroll
    $$('a[href^="#"]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        var t = $(a.getAttribute('href'));
        if (!t) return;
        e.preventDefault();
        if (lenis) lenis.scrollTo(t, { offset: -10, duration: 1.4 });
        else t.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' });
      });
    });

    // curtain wipe when leaving for another page
    $$('a[data-transition]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        if (reduced || e.metaKey || e.ctrlKey) return;
        e.preventDefault();
        gsap.to('#curtain', {
          scaleY: 1, duration: .55, ease: 'power3.inOut',
          onComplete: function () { location.href = a.href; }
        });
      });
    });
  }

  /* ---- preloader ------------------------------------------------------- */
  function boot() {
    initScroll();
    initSequences();
    initHero();
    initManifesto();
    initServices();
    initProcess();
    initMenu();
    initHud();
    initChrome();
    M.initCursor();
    M.initReveals();
    M.initFades();
    M.initMagnetic();
    M.initCounters();

    var marquee = M.initMarquee($('#marquee'));
    if (marquee && lenis) {
      lenis.on('scroll', function (e) { marquee.boost(e.velocity); });
    }

    // reveal as soon as the first hero frame is painted; the rest streams in
    var fill = $('#plFill'), num = $('#plNum'), msg = $('#plMsg');
    var hero = seqs.hero, done = false;
    var msgs = ['Warming the booth', 'Mixing the polish', 'Calibrating the lights', 'Rolling the car in'];
    var mi = 0, cycle = setInterval(function () { msg.textContent = msgs[++mi % msgs.length]; }, 900);

    function reveal() {
      if (done) return; done = true;
      clearInterval(cycle);
      gsap.set(fill, { scaleX: 1 }); num.textContent = '100';
      var tl = gsap.timeline({
        onComplete: function () {
          $('#preload').remove();
          ScrollTrigger.refresh();
          if (w.APEX.heroIn) w.APEX.heroIn();
        }
      });
      tl.to('#preload .pl__inner', { opacity: 0, y: -18, duration: .5, ease: 'power2.in' })
        .to('#preload', { yPercent: -100, duration: .85, ease: 'expo.inOut' }, '-=.1');
    }

    if (!hero) { reveal(); return; }
    hero.load(function (p) {
      var pct = Math.min(99, Math.round(p * 100));
      gsap.to(fill, { scaleX: p, duration: .4, ease: 'power2.out', overwrite: true });
      num.textContent = pct;
    }, reveal);
    setTimeout(reveal, 7000);   // never trap the user behind a slow network
  }

  document.addEventListener('DOMContentLoaded', boot);
})(window);
