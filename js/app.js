/* ============================================================================
   app.js — home page. Chapters: hero · manifesto · services · process · book
   ========================================================================== */
(function (w) {
  'use strict';

  /* ---- studio config — edit these ------------------------------------- */
  var WHATSAPP = '918745028280';                     // country code, no '+'
  var WA_TEXT  = "Hi Z Lab Design — I'd like to book my car in.\nCar: \nService: ";

  /* [name, clip basename in assets/videos/, description] */
  var SERVICES = [
    ['Paint Protection Film', 'ppf-01',    'Invisible, self-healing armour over the clear coat. Track days very welcome.'],
    ['Coloured PPF',          'cppf-01',   'Change the colour, keep the paint underneath untouched. Fully reversible.'],
    ['Matte PPF',             'matte-01',  'Keeps matte exactly matte, and takes the stone chips so the panel does not.'],
    ['Ceramic Coating',       'coat-01',   'A liquid-glass shell — slick, hydrophobic, years of depth in the gloss.'],
    ['Graphene Coating',      'coat-02',   'Harder, slicker and more heat-tolerant than ceramic alone. Our longest-lasting layer.'],
    ['Paint Correction',      'ppf-02',    'Swirls and etching machined out under calibrated light — never filled or hidden.'],
    ['Detailing',             'detail-01', 'Every pore of paint, glass and trim taken back to zero-mile condition.'],
    ['Interior Spa',          'coat-03',   'Leather, alcantara and fabric deep-cleaned, conditioned and sealed.'],
    ['Sunfilm',               'sun-01',    'Heat and UV stopped at the glass. Cabin stays cool, interior stays new.'],
    ['Car Wash',              'wash-01',   'Foam, decontaminate, hand-dry. The weekly ritual your paint actually deserves.']
  ];

  var M = w.ZLAB.motion, $ = M.$, $$ = M.$$, reduced = M.reduced;
  gsap.registerPlugin(ScrollTrigger);

  /* keep the page at the top on reload — a mid-scroll restore breaks pinning */
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

  /* ---- smooth scroll (Lenis drives ScrollTrigger) ---------------------- */
  var lenis = null;
  function initScroll() {
    if (reduced || typeof Lenis === 'undefined') return;
    // lerp beats duration here: duration:1.05 keeps gliding after the wheel
    // stops, which reads as lag rather than smoothness.
    lenis = new Lenis({ lerp: 0.11, smoothWheel: true, wheelMultiplier: 1.05, touchMultiplier: 1.8 });
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

      if (reduced) { seq.preload(null, function () { seq.draw(Math.floor(seq.count / 2)); }); return; }

      var isPinned = section.classList.contains('process');

      // Two-stage fetch. Approaching a section buys only the sparse skeleton
      // (~1 frame in 8); the dense passes are earned by actually arriving, so
      // a visitor who never scrolls past the hero never pays for five
      // sequences they did not see.
      ScrollTrigger.create({
        trigger: section, start: 'top bottom+=60%', once: true,
        onEnter: function () {
          seq.preload();
          // the pinned section never sleeps (see below), so it has no wake
          // handler to densify it — do that here instead
          if (isPinned) seq.activate();
        }
      });

      // .process is pinned by GSAP, which injects ~2000px of spacer and so
      // shifts this element's start/end. ANY trigger created on it here
      // resolves against the *unpinned* geometry: a scrub falls out of sync,
      // and a sleep/wake pair releases the canvas while the section is still
      // on screen — leaving a bare scrim gradient where the footage should be.
      // initProcess() drives both from the pin itself; nothing more here.
      if (isPinned) return;

      // hold the backing store — and the download budget — only while the
      // section is anywhere near view
      ScrollTrigger.create({
        trigger: section, start: 'top bottom+=100%', end: 'bottom top-=100%',
        onToggle: function (self) {
          if (self.isActive) { seq.wake(); seq.activate(); }
          else { seq.sleep(); seq.deactivate(); }
        }
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
    w.ZLAB.heroIn = function () {
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
    // Touch the DOM only when the lit count actually moves. Rewriting every
    // word's class on every scroll tick invalidates style for the whole line
    // 60 times a second for nothing.
    var litNow = -1;
    ScrollTrigger.create({
      trigger: '.manifesto', start: 'top top', end: 'bottom bottom', scrub: true,
      onUpdate: function (self) {
        var lit = Math.round(gsap.utils.clamp(0, 1, (self.progress - .05) / .45) * words.length);
        if (lit === litNow) return;
        var from = Math.min(lit, litNow), to = Math.max(lit, litNow);
        for (var i = Math.max(0, from); i < to; i++) words[i].classList.toggle('on', i < lit);
        litNow = lit;
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
    // The rows are a pure function of one index, so derive that index and bail
    // unless it changed — otherwise this rewrites 20 class lists per tick.
    var shown = -1;
    ScrollTrigger.create({
      trigger: '.services', start: 'top top', end: 'bottom bottom', scrub: true,
      onUpdate: function (self) {
        var span = (END - START) / (N - 1);
        var active = Math.floor((self.progress - START) / span + 1e-6);
        active = Math.max(-1, Math.min(N - 1, active));
        if (active === shown) return;
        var from = Math.min(active, shown), to = Math.max(active, shown);
        for (var i = Math.max(0, from); i <= to; i++) items[i].classList.toggle('is-in', i <= active);
        if (shown >= 0) items[shown].classList.remove('is-on');
        if (active >= 0) items[active].classList.add('is-on');
        num.textContent = String(Math.max(0, active) + 1).padStart(2, '0');
        shown = active;
      }
    });
  }

  /* ---- process: vertical scroll drives a horizontal track -------------- */
  function initProcess() {
    var section = $('.process'), track = $('#processTrack');
    if (!section || !track || reduced) return;
    var steps = $$('.step', track);
    var distance = function () { return Math.max(0, track.scrollWidth - w.innerWidth); };
    // offsetLeft is a layout read; cache it and refresh only when geometry can
    // actually have changed
    var offsets = [], revealed = 0;
    function measure() {
      offsets = steps.map(function (s) { return s.offsetLeft; });
    }
    measure();
    ScrollTrigger.addEventListener('refreshInit', function () { revealed = 0; });
    ScrollTrigger.addEventListener('refresh', measure);

    gsap.to(track, {
      x: function () { return -distance(); },
      ease: 'none',
      scrollTrigger: {
        trigger: section, start: 'top top', pin: true, scrub: 0.6,
        end: function () { return '+=' + (distance() + w.innerHeight * 0.5); },
        invalidateOnRefresh: true,
        // This pin injects ~2000px of spacer, which moves every section below
        // it. Without a higher refresh priority those triggers recalculate
        // against the pre-pin layout and end up ~2000px too early — which is
        // why the booking footage never scrubbed.
        refreshPriority: 1,
        // Reveal each card from the pin's own progress. Deriving it here is far
        // sturdier than a second ScrollTrigger bound via containerAnimation.
        onUpdate: function (self) {
          // the footage scrubs off the *pin's* progress, so it stays locked to
          // the horizontal track for the whole pinned range
          if (seqs.process) seqs.process.seek(self.progress);
          // reveal is one-way, so only ever look at the next card — and read
          // offsetLeft once per card instead of on every tick (it forces layout)
          if (revealed >= steps.length) return;
          var x = distance() * self.progress;
          while (revealed < steps.length && offsets[revealed] - x < w.innerWidth * 0.82) {
            steps[revealed++].classList.add('is-in');
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
          // rush, not load: this plays on a 2.2s clock, so stride passes would
          // step visibly. The user opened the menu, so the bytes are wanted.
          if (!seq) { seq = new Sequence($('.menu__canvas', menu), 'menu', { priority: 200 }); seq.rush(); }
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
    var hud = $('#hud');
    // the HUD is display:none under 1100px — don't pay for its triggers there
    if (!hud || !hud.offsetParent) return;
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
    // scrollHeight is a layout read — sampling it on every scroll tick forces a
    // reflow mid-scroll. It only changes when the page is re-measured anyway.
    var maxScroll = 1;
    function remeasure() {
      var d = document.documentElement;
      maxScroll = Math.max(1, d.scrollHeight - d.clientHeight);
    }
    remeasure();
    ScrollTrigger.addEventListener('refresh', remeasure);

    function onScroll() {
      if (ticking) return; ticking = true;
      requestAnimationFrame(function () {
        var y = w.scrollY || document.documentElement.scrollTop;
        bar.style.transform = 'scaleX(' + (y / maxScroll) + ')';
        if (navUpdate) navUpdate(y);
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
          if (w.ZLAB.heroIn) w.ZLAB.heroIn();
        }
      });
      tl.to('#preload .pl__inner', { opacity: 0, y: -18, duration: .5, ease: 'power2.in' })
        .to('#preload', { yPercent: -100, duration: .85, ease: 'expo.inOut' }, '-=.1');
    }

    if (!hero) { reveal(); return; }
    // Only the sparse first pass gates the curtain — that is ~8 frames, not 64.
    // The dense passes stream in behind the hero once it is on screen.
    hero.preload(function (p) {
      var pct = Math.min(99, Math.round(p * 100));
      gsap.to(fill, { scaleX: p, duration: .4, ease: 'power2.out', overwrite: true });
      num.textContent = pct;
    }, reveal);
    hero.activate();
    setTimeout(reveal, 7000);   // never trap the user behind a slow network
  }

  document.addEventListener('DOMContentLoaded', boot);
})(window);
