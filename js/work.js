/* ============================================================================
   work.js — "Our Work" gallery
   Drop assets/videos/work-01.mp4 … to fill the cards; until then each slot
   shows a placeholder with the exact filename it is waiting for.
   ========================================================================== */
(function (w) {
  'use strict';

  var WHATSAPP = '910000000000';
  var WA_TEXT  = "Hi APEX — I saw your work and I'd like a quote.\nCar: \nService: ";

  /* id, category, title, service label, grid size */
  var WORK = [
    ['01', 'ppf',       'Matte Black GT',    'Full-front PPF', 'wide'],
    ['02', 'ceramic',   'Chameleon 911',     'Ceramic + wheels', ''],
    ['03', 'detailing', 'Concours Revival',  'Paint correction', 'tall'],
    ['04', 'bodyshop',  'Panel Respray',     'Bodyshop', ''],
    ['05', 'ppf',       'Track Build',       'Coloured PPF', ''],
    ['06', 'ceramic',   'Daily Driver',      '9-year coating', 'wide'],
    ['07', 'detailing', 'Interior Reset',    'Full detail', ''],
    ['08', 'bodyshop',  'Widebody Fit',      'Bodykit', ''],
    ['09', 'ppf',       'Showroom Fresh',    'PPF + sun film', '']
  ];

  var M = w.APEX.motion, $ = M.$, $$ = M.$$, reduced = M.reduced;
  gsap.registerPlugin(ScrollTrigger);
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

  var lenis = null;
  function initScroll() {
    if (reduced || typeof Lenis === 'undefined') return;
    lenis = new Lenis({ duration: 1.05, smoothWheel: true, touchMultiplier: 1.6 });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
    gsap.ticker.lagSmoothing(0);
  }

  /* ---- gallery --------------------------------------------------------- */
  function buildGrid() {
    var grid = $('#grid');
    grid.innerHTML = WORK.map(function (it) {
      var mod = it[4] ? ' card--' + it[4] : '';
      return '<article class="card' + mod + '" data-cat="' + it[1] + '" data-n="' + it[0] + '" ' +
        'tabindex="0" role="button" aria-label="' + it[2] + ' — play clip" data-cursor="Play">' +
        '<div class="card__ph"><svg viewBox="0 0 24 24" aria-hidden="true">' +
        '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M10 9l5 3-5 3z" fill="currentColor" stroke="none"/></svg></div>' +
        '<video muted loop playsinline preload="none"></video>' +
        '<div class="card__meta"><div><div class="card__c">' + it[3] + '</div>' +
        '<div class="card__t">' + it[2] + '</div></div>' +
        '<div class="idx">' + it[0] + '</div></div></article>';
    }).join('');

    var cards = $$('.card', grid);
    cards.forEach(function (card) {
      var v = $('video', card), ph = $('.card__ph', card);
      var url = 'assets/videos/work-' + card.dataset.n + '.mp4';
      M.withVideo(url, function () {
        v.onloadeddata = function () { ph.style.display = 'none'; };
        v.src = url;
        v.load();
      });

      function open() {
        var it = WORK.filter(function (x) { return x[0] === card.dataset.n; })[0];
        openModal(it);
      }
      card.addEventListener('click', open);
      card.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
      });
    });

    // play only what is on screen
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          var v = $('video', e.target);
          if (!v) return;
          if (e.isIntersecting) { var p = v.play(); if (p) p.catch(function () {}); }
          else v.pause();
        });
      }, { threshold: 0.3 });
      cards.forEach(function (c) { io.observe(c); });
    }

    // staggered entrance
    if (!reduced) {
      gsap.from(cards, {
        y: 46, opacity: 0, duration: 1, ease: 'expo.out', stagger: 0.06,
        scrollTrigger: { trigger: grid, start: 'top 85%', once: true }
      });
    }
  }

  function initFilters() {
    var chips = $$('#filters .chip');
    chips.forEach(function (chip) {
      chip.addEventListener('click', function () {
        chips.forEach(function (c) { c.classList.remove('is-on'); });
        chip.classList.add('is-on');
        var cat = chip.dataset.cat;
        $$('.card').forEach(function (card) {
          var show = cat === 'all' || card.dataset.cat === cat;
          if (show) {
            card.style.display = '';
            if (!reduced) gsap.fromTo(card, { opacity: 0, y: 16 },
              { opacity: 1, y: 0, duration: .5, ease: 'expo.out' });
          } else {
            card.style.display = 'none';
          }
        });
        ScrollTrigger.refresh();
      });
    });
  }

  /* ---- modal ----------------------------------------------------------- */
  var modal = $('#modal'), lastFocus = null;
  function openModal(it) {
    $('#modalT').textContent = it[2];
    $('#modalBody').textContent = it[3] + ' — full clip coming soon.';
    $('#modalPath').textContent = 'assets/videos/work-' + it[0] + '.mp4';
    var v = $('#modalVid'), ph = $('#modalPh');
    var url = 'assets/videos/work-' + it[0] + '.mp4';
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

  /* ---- sequences ------------------------------------------------------- */
  function initSequences() {
    // hero: parallax scrub as it leaves
    var heroCanvas = $('.whero .layer--canvas');
    if (heroCanvas) {
      var hero = new Sequence(heroCanvas, 'work', { priority: 100 });
      hero.load();
      if (!reduced) {
        ScrollTrigger.create({
          trigger: '.whero', start: 'top top', end: 'bottom top', scrub: 0.5,
          onUpdate: function (self) { hero.seek(self.progress); }
        });
      }
    }
    // end CTA
    var cta = $('#cta');
    if (cta) {
      var seq = new Sequence($('.layer--canvas', cta), cta.dataset.seq, { priority: 20 });
      if (reduced) { seq.load(null, function () { seq.draw(seq.count >> 1); }); }
      else {
        ScrollTrigger.create({ trigger: cta, start: 'top bottom+=150%', once: true,
          onEnter: function () { seq.priority = 50; seq.load(); } });
        ScrollTrigger.create({ trigger: cta, start: 'top top', end: 'bottom bottom', scrub: true,
          onUpdate: function (self) { seq.seek(self.progress); } });
      }
    }
  }

  /* ---- menu (shared behaviour with the home page) ---------------------- */
  function initMenu() {
    var menu = $('#menu'), burger = $('#burger'), txt = $('#burgerTxt');
    var links = $$('.menu__list a');
    var seq = null, raf = 0, last = 0, frame = 0;
    function loop(t) {
      raf = requestAnimationFrame(loop);
      if (t - last < 46) return;
      last = t;
      if (seq && seq.loaded > 1) { frame = (frame + 1) % seq.count; seq.draw(frame); }
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
          if (!seq) { seq = new Sequence($('.menu__canvas', menu), 'menu', { priority: 40 }); seq.load(); }
          cancelAnimationFrame(raf); last = 0; raf = requestAnimationFrame(loop);
        }
      } else { cancelAnimationFrame(raf); raf = 0; }
    }
    burger.addEventListener('click', function () { set(!menu.classList.contains('is-open')); });
    links.forEach(function (a) { a.addEventListener('click', function () { set(false); }); });
    w.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      if (modal.classList.contains('is-open')) closeModal();
      else if (menu.classList.contains('is-open')) set(false);
    });
  }

  function initChrome() {
    $('#yr').textContent = new Date().getFullYear();
    var href = 'https://wa.me/' + WHATSAPP + '?text=' + encodeURIComponent(WA_TEXT);
    ['#waBtn', '#menuWa', '#footWa'].forEach(function (s) { var el = $(s); if (el) el.href = href; });

    var bar = $('#progress'), navUpdate = M.initNav($('#nav')), ticking = false;
    function onScroll() {
      if (ticking) return; ticking = true;
      requestAnimationFrame(function () {
        var d = document.documentElement;
        bar.style.transform = 'scaleX(' + (d.scrollTop / Math.max(1, d.scrollHeight - d.clientHeight)) + ')';
        if (navUpdate) navUpdate(d.scrollTop);
        ticking = false;
      });
    }
    w.addEventListener('scroll', onScroll, { passive: true }); onScroll();

    $$('a[data-transition]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        if (reduced || e.metaKey || e.ctrlKey) return;
        e.preventDefault();
        gsap.to('#curtain', { scaleY: 1, duration: .55, ease: 'power3.inOut',
          onComplete: function () { location.href = a.href; } });
      });
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    initScroll();
    buildGrid();
    initFilters();
    initSequences();
    initMenu();
    initChrome();
    M.initCursor();
    M.initReveals();
    M.initFades();
    M.initMagnetic();
    // page arrives from a curtain wipe — lift it
    gsap.set('#curtain', { scaleY: 1, transformOrigin: '50% 0%' });
    gsap.to('#curtain', { scaleY: 0, duration: .7, ease: 'expo.inOut', delay: .05 });
  });
})(window);
