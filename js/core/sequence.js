/* ============================================================================
   sequence.js — scroll-scrubbed canvas image sequence
   ----------------------------------------------------------------------------
   Memory note (this is the whole trick):
   A decoded 1280x720 frame costs ~3.7MB of RAM. Holding 72 of them decoded is
   ~265MB per sequence, which is what kills phones and forces the browser to
   re-decode mid-scroll (the stutter). So we keep the *compressed* Image objects
   (~35KB each, trivial) and explicitly pre-decode only a rolling window around
   the playhead via img.decode(), which runs off the main thread. The browser
   evicts what it no longer needs, and the frames we are about to draw are
   already warm.

   Also: a shared request queue keeps concurrent fetches bounded so a background
   sequence can never starve the one the user is actually looking at.
   ========================================================================== */
(function (w) {
  'use strict';

  var MANIFEST = w.APEX_SEQ || {};
  var isMobile = matchMedia('(max-width: 768px)').matches;
  var SRC_W = isMobile ? 720 : 1280;
  // Never allocate more backing pixels than the source image actually has —
  // upscaling a 1280px frame into a 1700px canvas costs fill rate every frame
  // and buys no detail.
  var MAX_BACKING = SRC_W;
  var WARM_BACK = 4;    // frames behind the playhead to keep decoded
  var WARM_AHEAD = 14;  // frames ahead (scrolling down is the common case)

  /* ---- shared, priority-aware fetch queue ------------------------------- */
  var MAX_INFLIGHT = 6;
  var inflight = 0;
  var queue = [];

  function pump() {
    if (inflight >= MAX_INFLIGHT) return;
    // highest priority first (hero = 100, on-screen = 50, prefetch = 10)
    queue.sort(function (a, b) { return b.pri - a.pri; });
    var job = queue.shift();
    if (!job) return;
    inflight++;
    job.run(function () { inflight--; pump(); });
    pump();
  }
  function enqueue(pri, run) { queue.push({ pri: pri, run: run }); pump(); }

  /* ---- Sequence -------------------------------------------------------- */
  function Sequence(canvas, name, opts) {
    opts = opts || {};
    var meta = MANIFEST[name];
    if (!meta) { console.warn('[seq] unknown sequence:', name); }

    this.name = name;
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
    this.width = meta ? (meta.sizes[SRC_W] ? SRC_W : Object.keys(meta.sizes)[0]) : SRC_W;
    this.count = meta ? meta.sizes[this.width] : 0;
    this.ext = meta ? meta.ext : 'webp';

    this.imgs = new Array(this.count);
    this.ready = new Array(this.count);   // decoded & safe to draw
    this.loaded = 0;
    this.frame = -1;
    this.priority = opts.priority || 10;
    this.requested = false;
    this._painted = false;
    this._raf = 0;
    this._pending = -1;

    var self = this;
    this._onResize = function () { self.resize(); };
    w.addEventListener('resize', this._onResize, { passive: true });
    this.resize();
  }

  Sequence.prototype.src = function (i) {
    return 'assets/seq/' + this.name + '/' + this.width + '/f' +
      String(i + 1).padStart(4, '0') + '.' + this.ext;
  };

  /** Fetch every frame (compressed). onFirst fires when frame 0 can be drawn. */
  Sequence.prototype.load = function (onProgress, onFirst) {
    if (this.requested) return this;
    this.requested = true;
    var self = this;

    var order = [];
    for (var i = 0; i < this.count; i++) order.push(i);

    order.forEach(function (i) {
      enqueue(self.priority - (i === 0 ? -50 : i * 0.001), function (done) {
        var img = new Image();
        img.decoding = 'async';
        img.onload = function () {
          self.imgs[i] = img;
          self.loaded++;
          // decode the first frame immediately so we can paint something
          if (i === 0) {
            self._decode(0, function () {
              self.draw(0);
              if (onFirst) { onFirst(); onFirst = null; }
            });
          }
          if (onProgress) onProgress(self.loaded / self.count);
          done();
        };
        img.onerror = function () { self.loaded++; if (onProgress) onProgress(self.loaded / self.count); done(); };
        img.src = self.src(i);
      });
    });
    return this;
  };

  Sequence.prototype._decode = function (i, cb) {
    var img = this.imgs[i];
    if (!img || this.ready[i]) { if (cb) cb(); return; }
    var self = this;
    this.ready[i] = 'pending';
    var p = img.decode ? img.decode() : Promise.resolve();
    p.then(function () { self.ready[i] = true; if (cb) cb(); },
           function () { self.ready[i] = true; if (cb) cb(); });
  };

  /** Keep a rolling window of frames decoded around the playhead. */
  Sequence.prototype._warm = function (center) {
    var from = Math.max(0, center - WARM_BACK);
    var to = Math.min(this.count - 1, center + WARM_AHEAD);
    for (var i = from; i <= to; i++) if (!this.ready[i]) this._decode(i);
  };

  /** Nearest drawable frame at or before i, else nearest after. */
  Sequence.prototype._pick = function (i) {
    if (this.ready[i] === true && this.imgs[i]) return this.imgs[i];
    for (var d = 1; d < this.count; d++) {
      if (this.ready[i - d] === true && this.imgs[i - d]) return this.imgs[i - d];
      if (this.ready[i + d] === true && this.imgs[i + d]) return this.imgs[i + d];
    }
    // nothing decoded yet — fall back to any loaded image
    return this.imgs[i] || this.imgs[0] || null;
  };

  /** Scrub position 0..1. Batched to one paint per animation frame. */
  Sequence.prototype.seek = function (p) {
    var i = Math.round(Math.max(0, Math.min(1, p)) * (this.count - 1));
    if (i === this._pending) return;
    this._pending = i;
    if (this._raf) return;
    var self = this;
    this._raf = requestAnimationFrame(function () {
      self._raf = 0;
      self.draw(self._pending);
    });
  };

  Sequence.prototype.draw = function (i) {
    i = Math.max(0, Math.min(this.count - 1, i | 0));
    if (i === this.frame && this._painted) return;
    var img = this._pick(i);
    this.frame = i;
    this._warm(i);
    if (!img || !img.width) return;

    var ctx = this.ctx, cv = this.canvas;
    var cw = cv.width, ch = cv.height;
    var ir = img.width / img.height, cr = cw / ch;
    var dw, dh, dx, dy;
    if (ir > cr) { dh = ch; dw = ch * ir; dx = (cw - dw) / 2; dy = 0; }
    else { dw = cw; dh = cw / ir; dx = 0; dy = (ch - dh) / 2; }
    ctx.drawImage(img, dx, dy, dw, dh);
    this._painted = true;
  };

  Sequence.prototype.resize = function () {
    if (this.asleep) return;                 // stay released until woken
    var r = this.canvas.getBoundingClientRect();
    if (!r.width || !r.height) return;
    var dpr = Math.min(w.devicePixelRatio || 1, 2);
    var scale = Math.min(dpr, MAX_BACKING / Math.max(r.width, 1));
    var nw = Math.max(1, Math.round(r.width * scale));
    var nh = Math.max(1, Math.round(r.height * scale));
    if (nw === this.canvas.width && nh === this.canvas.height) return;
    this.canvas.width = nw;
    this.canvas.height = nh;
    this.ctx.fillStyle = '#0a0a0c';
    this.ctx.fillRect(0, 0, nw, nh);
    this._painted = false;
    if (this.frame >= 0) this.draw(this.frame);
  };

  /** Release the backing store while the section is far off screen. Five
   *  full-viewport canvases at dpr 2 is ~30MB of GPU texture held for content
   *  nobody can see; on phones that pressure shows up as scroll jank. */
  Sequence.prototype.sleep = function () {
    if (this.asleep) return;
    this.asleep = true;
    this.canvas.width = this.canvas.height = 1;
    this._painted = false;
  };
  Sequence.prototype.wake = function () {
    if (!this.asleep) return;
    this.asleep = false;
    this.resize();
    if (this.frame >= 0) this.draw(this.frame);
  };

  Sequence.prototype.destroy = function () {
    w.removeEventListener('resize', this._onResize);
    this.imgs.length = 0;
    this.ready.length = 0;
  };

  w.Sequence = Sequence;
})(window);
