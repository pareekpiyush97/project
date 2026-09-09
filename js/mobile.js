/* ============================================================================
   mobile.js — the phone build. No framework, no GSAP, no Lenis, no canvas:
   an app shell that has to feel instant on a mid-range Android over 4G.

   What is actually engineered here, rather than styled:
     · bottom sheet with real drag-to-dismiss (distance OR velocity), focus
       handling and an Escape route
     · tab bar whose active destination is driven by which section owns the
       middle of the viewport
     · a service picker that composes the WhatsApp message, so the customer
       never types the thing we already know
     · clips fetched only on tap and released on close — nine autoplaying
       videos would pull ~45MB unprompted
   ========================================================================== */
(function (w) {
  'use strict';

  /* ---- studio config — edit these ------------------------------------- */
  var WHATSAPP = '918745028280';                     // country code, no '+'

  /* [name, clip basename in assets/videos/, description, photo basename] */
  var SERVICES = [
    ['Paint Protection Film', 'ppf-01',    'Invisible, self-healing armour over the clear coat. Track days very welcome.', 'car-benz-road'],
    ['Coloured PPF',          'cppf-01',   'Change the colour, keep the paint underneath untouched. Fully reversible.',    'cppf-rover'],
    ['Matte PPF',             'matte-01',  'Keeps matte exactly matte, and takes the stone chips so the panel does not.',  'car-audi-matte'],
    ['Ceramic Coating',       'coat-01',   'A liquid-glass shell — slick, hydrophobic, years of depth in the gloss.',      'car-black-duo'],
    ['Graphene Coating',      'coat-02',   'Harder, slicker and more heat-tolerant than ceramic alone. Our longest layer.','car-maybach'],
    ['Paint Correction',      'ppf-02',    'Swirls and etching machined out under calibrated light — never filled.',       'cppf-bmw'],
    ['Detailing',             'detail-01', 'Every pore of paint, glass and trim taken back to zero-mile condition.',       'car-rover-purple'],
    ['Interior Spa',          'coat-03',   'Leather, alcantara and fabric deep-cleaned, conditioned and sealed.',          'car-maybach'],
    ['Sunfilm',               'sun-01',    'Heat and UV stopped at the glass. Cabin stays cool, interior stays new.',      'car-bmw-blue'],
    ['Car Wash',              'wash-01',   'Foam, decontaminate, hand-dry. The weekly ritual your paint deserves.',        'wash-bay']
  ];

  /* [clip, category, title, service label, wide?, photo basename] */
  var WORK = [
    ['ppf-03',   'ppf',       'Range Rover',    'Full-body PPF',    1, 'car-rover-purple'],
    ['cppf-02',  'cppf',      'Colour Change',  'Coloured PPF',     0, 'cppf-bmw'],
    ['detail-01','detailing', 'Concours Detail','Full detail',      0, 'car-maybach'],
    ['coat-01',  'ceramic',   'Ceramic Build',  'Ceramic coating',  0, 'car-benz-road'],
    ['cppf-03',  'cppf',      'Satin Wrap',     'Coloured PPF',     0, 'cppf-rover'],
    ['coat-02',  'ceramic',   'Graphene Layer', 'Graphene coating', 1, 'car-bmw-blue'],
    ['matte-01', 'ppf',       'Matte Finish',   'Matte PPF',        0, 'car-audi-matte'],
    ['ppf-04',   'ppf',       'Front Armour',   'Paint protection', 0, 'car-black-duo'],
    ['wash-01',  'detailing', 'Wash Bay',       'Maintenance wash', 0, 'wash-bay']
  ];

  var FILTERS = [
    ['all', 'All'], ['ppf', 'PPF'], ['cppf', 'Coloured PPF'],
    ['ceramic', 'Coating'], ['detailing', 'Detailing']
  ];

  /* the picker offers the services people actually ask for by name */
  var PICKS = ['Paint Protection Film', 'Coloured PPF', 'Ceramic Coating', 'Detailing', 'Paint Correction', 'Not sure yet'];

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var IMG = 'assets/img/m/';            // 900px WebP tier, 57% lighter than the JPEGs
  var PLAY = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>';

  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'); }

  function waLink(service) {
    var line = service && service !== 'Not sure yet' ? service : 'a quote for my car';
    return 'https://wa.me/' + WHATSAPP +
      '?text=' + encodeURIComponent('Hi Z Lab Design — I\'d like to book ' + line + '.\nCar: \nWhen: ');
  }

  /* ---- service rail ---------------------------------------------------- */
  function buildServices() {
    $('#svcRail').innerHTML = SERVICES.map(function (s, i) {
      return '<button class="scard rv" data-i="' + i + '" ' +
        'style="transition-delay:' + Math.min(i, 4) * 45 + 'ms" ' +
        'aria-label="' + esc(s[0]) + ' — watch the clip">' +
        '<img class="scard__img" src="' + IMG + s[3] + '.webp" alt="" loading="lazy" decoding="async" />' +
        '<span class="scard__veil"></span>' +
        '<span class="scard__no">' + String(i + 1).padStart(2, '0') + ' / 10</span>' +
        '<span class="scard__play">' + PLAY + '</span>' +
        '<span class="scard__cap"><span class="scard__t">' + esc(s[0]) + '</span>' +
        '<span class="scard__d">' + esc(s[2]) + '</span></span>' +
        '</button>';
    }).join('');

    $$('#svcRail .scard').forEach(function (b) {
      b.addEventListener('click', function () {
        var s = SERVICES[+b.dataset.i];
        openSheet('Service', s[0], s[1], s[2]);
      });
    });
  }

  /* ---- work grid + filters --------------------------------------------- */
  function buildWork() {
    $('#chips').innerHTML = FILTERS.map(function (f, i) {
      return '<button class="chip" data-cat="' + f[0] + '" aria-pressed="' + (i === 0) + '">' + f[1] + '</button>';
    }).join('');

    $('#grid').innerHTML = WORK.map(function (it, i) {
      return '<button class="tile rv' + (it[4] ? ' tile--wide' : '') + '" data-cat="' + it[1] + '" ' +
        'data-i="' + i + '" style="transition-delay:' + Math.min(i, 4) * 45 + 'ms" ' +
        'aria-label="' + esc(it[2]) + ' — play the clip">' +
        '<img src="' + IMG + it[5] + '.webp" alt="" loading="lazy" decoding="async" />' +
        '<span class="tile__veil"></span>' +
        '<span class="tile__cap"><span class="tile__c">' + esc(it[3]) + '</span>' +
        '<span class="tile__t">' + esc(it[2]) + '</span></span>' +
        '</button>';
    }).join('') + '<p class="grid__empty" id="gridEmpty" hidden>Nothing filed under that yet — ask us on WhatsApp.</p>';

    $$('#grid .tile').forEach(function (t) {
      t.addEventListener('click', function () {
        var it = WORK[+t.dataset.i];
        openSheet(it[3], it[2], it[0], 'Finished at the studio in Indirapuram. ' + it[3] + '.');
      });
    });

    $$('#chips .chip').forEach(function (chip) {
      chip.addEventListener('click', function () {
        var cat = chip.dataset.cat, shown = 0;
        $$('#chips .chip').forEach(function (c) { c.setAttribute('aria-pressed', String(c === chip)); });
        $$('#grid .tile').forEach(function (t) {
          var on = cat === 'all' || t.dataset.cat === cat;
          t.hidden = !on;
          if (on) shown++;
        });
        $('#gridEmpty').hidden = shown > 0;
      });
    });
  }

  /* ---- booking: the picker writes the message -------------------------- */
  function buildBooking() {
    var chosen = '';
    $('#picker').innerHTML = PICKS.map(function (p) {
      return '<button class="chip" data-svc="' + esc(p) + '" aria-pressed="false">' + esc(p) + '</button>';
    }).join('');

    function apply() {
      $('#previewTxt').innerHTML = 'Your message: <b>' +
        esc(chosen && chosen !== 'Not sure yet' ? chosen : 'a quote for my car') + '</b>';
      var href = waLink(chosen);
      $('#bookWa').href = href;
      $('#heroWa').href = href;
      $('#footWa').href = href;
    }

    $$('#picker .chip').forEach(function (c) {
      c.addEventListener('click', function () {
        // tapping the active chip clears it — a picker you cannot un-pick is a trap
        chosen = chosen === c.dataset.svc ? '' : c.dataset.svc;
        $$('#picker .chip').forEach(function (o) {
          o.setAttribute('aria-pressed', String(o.dataset.svc === chosen));
        });
        apply();
      });
    });
    apply();
  }

  /* ---- bottom sheet ---------------------------------------------------- */
  var sheet, panel, vid, shim, media, lastFocus = null, shimTimer = 0;

  function openSheet(kind, title, clip, copy) {
    $('#sheetKind').textContent = kind;
    $('#sheetT').textContent = title;
    $('#sheetCopy').textContent = copy;
    $('#sheetDetail').innerHTML = w.ZLAB_DETAILS ? w.ZLAB_DETAILS.html(title) : '';
    $('.sheet__body').scrollTop = 0;      // a reopened sheet must start at the video
    $('#sheetWa').href = waLink(title);

    media.hidden = false;
    shim.style.display = '';
    // preload=none in the markup keeps the page from touching the network until
    // someone asks for a clip — but it also means load() alone fetches nothing,
    // so a refused play() would leave the shimmer up over a player that never
    // started. Promoting to metadata here guarantees the fetch either way.
    vid.preload = 'metadata';
    vid.src = 'assets/videos/' + clip + '.mp4';
    vid.load();

    lastFocus = document.activeElement;
    sheet.classList.add('is-open');
    document.body.classList.add('is-locked');
    $('#sheetX').focus();
    // the tap that opened the sheet is the gesture, so sound is allowed; when a
    // browser refuses anyway, drop the shimmer so the native controls are usable
    vid.play().catch(function () { shim.style.display = 'none'; });
    clearTimeout(shimTimer);
    shimTimer = setTimeout(function () { shim.style.display = 'none'; }, 6000);
  }

  function closeSheet() {
    if (!sheet.classList.contains('is-open')) return;
    sheet.classList.remove('is-open');
    document.body.classList.remove('is-locked');
    vid.pause();
    vid.removeAttribute('src');
    vid.load();                       // release the buffer, not just pause it
    if (lastFocus) lastFocus.focus();
  }

  function initSheet() {
    vid.addEventListener('loadeddata', function () { shim.style.display = 'none'; });
    vid.addEventListener('error', function () {
      // recovery path: hide the dead player, the WhatsApp button is right below
      shim.style.display = 'none';
      media.hidden = true;
      $('#sheetCopy').textContent = 'That clip is not uploaded yet — ask us for it on WhatsApp and we will send it over.';
    });

    $('#sheetX').addEventListener('click', closeSheet);
    $('#sheetScrim').addEventListener('click', closeSheet);

    /* drag to dismiss: distance OR flick velocity, tracking the finger 1:1 */
    var grab = $('#sheetGrab');
    var startY = 0, lastY = 0, lastT = 0, vy = 0, dragging = false;

    grab.addEventListener('pointerdown', function (e) {
      dragging = true;
      startY = lastY = e.clientY;
      lastT = e.timeStamp; vy = 0;
      sheet.classList.add('is-dragging');
      grab.setPointerCapture(e.pointerId);
    });
    grab.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      var dy = Math.max(0, e.clientY - startY);       // downward only
      var dt = e.timeStamp - lastT;
      if (dt > 0) vy = (e.clientY - lastY) / dt;      // px per ms
      lastY = e.clientY; lastT = e.timeStamp;
      panel.style.transform = 'translateY(' + dy + 'px)';
    });
    function endDrag(e) {
      if (!dragging) return;
      dragging = false;
      var dy = Math.max(0, e.clientY - startY);
      sheet.classList.remove('is-dragging');          // restores the transition
      panel.style.transform = '';                     // hand it back to CSS
      if (dy > 110 || vy > 0.55) closeSheet();
    }
    grab.addEventListener('pointerup', endDrag);
    grab.addEventListener('pointercancel', endDrag);

    /* Escape closes; Tab stays inside the panel while it is open */
    w.addEventListener('keydown', function (e) {
      if (!sheet.classList.contains('is-open')) return;
      if (e.key === 'Escape') { closeSheet(); return; }
      if (e.key !== 'Tab') return;
      var f = $$('button, a[href], video[controls]', panel).filter(function (el) { return !el.disabled; });
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
  }

  /* ---- tab bar: whichever section owns the middle of the screen -------- */
  function initTabs() {
    var tabs = {};
    $$('.tab').forEach(function (t) { tabs[t.dataset.tab] = t; });
    /* #process has no destination of its own — it belongs to Services */
    var owner = { home: 'home', services: 'services', process: 'services', work: 'work', book: 'book' };

    function set(name) {
      Object.keys(tabs).forEach(function (k) {
        tabs[k].setAttribute('aria-current', String(k === name));
      });
    }
    set('home');

    if (!('IntersectionObserver' in w)) return;
    // a root squeezed to a 1% band at the vertical middle: only the section
    // actually under the middle of the screen can intersect it, so there is
    // never more than one candidate and no scroll handler to throttle
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) set(owner[en.target.id] || 'home');
      });
    }, { rootMargin: '-50% 0px -49% 0px' });
    ['home', 'services', 'process', 'work', 'book'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) io.observe(el);
    });
  }

  /* ---- reveals --------------------------------------------------------- */
  function initReveals() {
    var items = $$('.rv');
    if (reduced || !('IntersectionObserver' in w)) {
      items.forEach(function (el) { el.classList.add('in'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        en.target.classList.add('in');
        io.unobserve(en.target);
      });
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0.05 });
    items.forEach(function (el) { io.observe(el); });
  }

  /* ---- chrome ---------------------------------------------------------- */
  function initChrome() {
    $('#yr').textContent = new Date().getFullYear();

    // duplicate the ticker content so the -50% loop is seamless
    var track = $('#tickTrack');
    if (track) track.innerHTML = track.innerHTML + track.innerHTML;

    var bar = $('#appbar'), ticking = false;
    w.addEventListener('scroll', function () {
      if (ticking) return; ticking = true;
      requestAnimationFrame(function () {
        bar.classList.toggle('is-solid', w.scrollY > 12);
        ticking = false;
      });
    }, { passive: true });

    // a short tick on the actions that commit to something (Android only)
    document.addEventListener('click', function (e) {
      if (e.target.closest('[data-haptic]') && navigator.vibrate) navigator.vibrate(8);
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    sheet = $('#sheet'); panel = $('#sheetPanel'); vid = $('#sheetVid');
    shim = $('#sheetShim'); media = $('.sheet__media');
    buildServices();
    buildWork();
    buildBooking();
    initSheet();
    initTabs();
    initChrome();
    initReveals();                    // last: the built cards must exist first
  });
})(window);
