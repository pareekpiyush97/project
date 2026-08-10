/* ============================================================================
   motion.js — the shared motion vocabulary
   Small, dependency-free helpers (beyond GSAP) used by both pages so the two
   pages move identically. Everything here degrades to "just show it" when the
   user asks for reduced motion.
   ========================================================================== */
(function (w) {
  'use strict';

  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ---- text splitting --------------------------------------------------
     Wraps each word in a masked span so it can rise into view. Line-aware:
     re-splitting on resize is unnecessary because we mask per word, not line. */
  function wrapWord(node) {
    var outer = document.createElement('span');
    outer.className = 'word';
    var inner = document.createElement('span');
    inner.className = 'word__i';
    inner.appendChild(node);
    outer.appendChild(inner);
    return outer;
  }

  /* Splits into masked word units while preserving inline markup — an
     accent like <span class="sig">Craft</span> survives as its own unit
     instead of being flattened to text. */
  function splitWords(el) {
    if (el.dataset.split) return $$('.word__i', el);
    var frag = document.createDocumentFragment();
    Array.prototype.slice.call(el.childNodes).forEach(function (node) {
      if (node.nodeType === 3) {
        var words = node.textContent.replace(/\s+/g, ' ').split(' ').filter(Boolean);
        words.forEach(function (word) {
          frag.appendChild(wrapWord(document.createTextNode(word)));
          frag.appendChild(document.createTextNode(' '));
        });
      } else if (node.nodeType === 1) {
        frag.appendChild(wrapWord(node));
        frag.appendChild(document.createTextNode(' '));
      }
    });
    el.innerHTML = '';
    el.appendChild(frag);
    el.dataset.split = '1';
    return $$('.word__i', el);
  }

  /** Rise-in reveal for any [data-reveal] element, staggered by word. */
  function initReveals(scope) {
    $$('[data-reveal]', scope).forEach(function (el) {
      var parts = el.hasAttribute('data-reveal-words') ? splitWords(el) : [el];
      if (reduced) { gsap.set(parts, { y: 0, opacity: 1 }); return; }
      gsap.set(parts, { yPercent: 110, opacity: el.hasAttribute('data-reveal-words') ? 1 : 0 });
      gsap.to(parts, {
        yPercent: 0, opacity: 1,
        duration: 1.05, ease: 'expo.out', stagger: 0.055,
        scrollTrigger: { trigger: el, start: 'top 88%', once: true }
      });
    });
  }

  /** Generic fade/slide for blocks that should not be word-split. */
  function initFades(scope) {
    $$('[data-fade]', scope).forEach(function (el, i) {
      if (reduced) return;
      gsap.from(el, {
        y: 34, opacity: 0, duration: 1, ease: 'expo.out',
        delay: (parseFloat(el.dataset.fade) || 0),
        scrollTrigger: { trigger: el, start: 'top 90%', once: true }
      });
    });
  }

  /** Buttons that lean toward the cursor. Pointer-fine only. */
  function initMagnetic(scope) {
    if (reduced || !matchMedia('(hover:hover)').matches) return;
    $$('[data-magnetic]', scope).forEach(function (el) {
      var strength = parseFloat(el.dataset.magnetic) || 0.32;
      var xTo = gsap.quickTo(el, 'x', { duration: 0.5, ease: 'power3' });
      var yTo = gsap.quickTo(el, 'y', { duration: 0.5, ease: 'power3' });
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        xTo((e.clientX - (r.left + r.width / 2)) * strength);
        yTo((e.clientY - (r.top + r.height / 2)) * strength);
      });
      el.addEventListener('pointerleave', function () { xTo(0); yTo(0); });
    });
  }

  /** Count up to [data-count] when scrolled into view. */
  function initCounters(scope) {
    $$('[data-count]', scope).forEach(function (el) {
      var target = parseFloat(el.dataset.count);
      var dec = (el.dataset.count.split('.')[1] || '').length;
      if (reduced) { el.textContent = target.toFixed(dec); return; }
      var obj = { v: 0 };
      gsap.to(obj, {
        v: target, duration: 1.8, ease: 'expo.out',
        scrollTrigger: { trigger: el, start: 'top 92%', once: true },
        onUpdate: function () { el.textContent = obj.v.toFixed(dec); }
      });
    });
  }

  /** Seamless marquee; speed/direction react to scroll velocity. */
  function initMarquee(el) {
    if (!el) return null;
    var track = $('.marquee__track', el);
    if (!track) return null;
    var content = track.innerHTML;
    track.innerHTML = content + content;               // duplicate for the loop
    if (reduced) return null;
    var base = parseFloat(el.dataset.speed) || 42;
    var tween = gsap.to(track, {
      xPercent: -50, duration: base, ease: 'none', repeat: -1
    });
    return {
      boost: function (velocity) {
        var dir = velocity < 0 ? -1 : 1;
        tween.timeScale(dir * Math.min(6, 1 + Math.abs(velocity) * 0.22));
      },
      settle: function () { gsap.to(tween, { timeScale: tween.timeScale() < 0 ? -1 : 1, duration: 0.6 }); }
    };
  }

  /** Cursor: a dot that tracks precisely + a ring that lags, with states. */
  function initCursor() {
    if (reduced || !matchMedia('(hover:hover) and (pointer:fine)').matches) return;
    var root = document.createElement('div');
    root.className = 'cursor';
    root.innerHTML = '<div class="cursor__ring"></div><div class="cursor__dot"></div>' +
                     '<div class="cursor__label"></div>';
    document.body.appendChild(root);
    var ring = $('.cursor__ring', root), dot = $('.cursor__dot', root), label = $('.cursor__label', root);
    document.documentElement.classList.add('has-cursor');

    var rx = gsap.quickTo(ring, 'x', { duration: 0.42, ease: 'power3' });
    var ry = gsap.quickTo(ring, 'y', { duration: 0.42, ease: 'power3' });
    var dx = gsap.quickTo(dot, 'x', { duration: 0.08, ease: 'power2' });
    var dy = gsap.quickTo(dot, 'y', { duration: 0.08, ease: 'power2' });
    var lx = gsap.quickTo(label, 'x', { duration: 0.42, ease: 'power3' });
    var ly = gsap.quickTo(label, 'y', { duration: 0.42, ease: 'power3' });

    w.addEventListener('pointermove', function (e) {
      rx(e.clientX); ry(e.clientY); dx(e.clientX); dy(e.clientY);
      lx(e.clientX); ly(e.clientY);
    }, { passive: true });

    document.addEventListener('pointerover', function (e) {
      var t = e.target.closest('[data-cursor]');
      var txt = t && t.dataset.cursor;
      root.classList.toggle('is-active', !!t);
      root.classList.toggle('is-labelled', !!txt);
      label.textContent = txt || '';
    });
    w.addEventListener('pointerdown', function () { root.classList.add('is-down'); });
    w.addEventListener('pointerup', function () { root.classList.remove('is-down'); });
    document.addEventListener('mouseleave', function () { root.classList.add('is-out'); });
    document.addEventListener('mouseenter', function () { root.classList.remove('is-out'); });
  }

  /** Nav hides while scrolling down, returns on the way up. */
  function initNav(nav) {
    if (!nav) return;
    var last = 0;
    return function (y) {
      if (Math.abs(y - last) < 6) return;
      nav.classList.toggle('is-hidden', y > last && y > 260 && !document.body.classList.contains('menu-open'));
      nav.classList.toggle('is-solid', y > 40);
      last = y;
    };
  }

  /* Attach a clip only once we know it exists. Probing with HEAD keeps the
     console clean while the studio's footage is still being filmed, and the
     slot upgrades itself the moment a file is dropped in assets/videos/. */
  var probeCache = {};
  function withVideo(url, onFound) {
    if (probeCache[url] === false) return;
    if (probeCache[url] === true) { onFound(); return; }
    fetch(url, { method: 'HEAD' }).then(function (r) {
      probeCache[url] = r.ok;
      if (r.ok) onFound();
    }).catch(function () { probeCache[url] = false; });
  }

  w.ZLAB = w.ZLAB || {};
  w.ZLAB.motion = {
    withVideo: withVideo,
    reduced: reduced, $: $, $$: $$,
    splitWords: splitWords,
    initReveals: initReveals,
    initFades: initFades,
    initMagnetic: initMagnetic,
    initCounters: initCounters,
    initMarquee: initMarquee,
    initCursor: initCursor,
    initNav: initNav
  };
})(window);
