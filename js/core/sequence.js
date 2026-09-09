/* ============================================================================
   sequence.js — scroll-scrubbed canvas image sequence
   ----------------------------------------------------------------------------
   Memory note (this is the whole trick):
   A decoded 1920x1080 frame costs ~8.3MB of RAM. Holding 120 of them decoded
   is ~1GB per sequence, which nothing will keep, so the browser re-decodes
   mid-scroll and that is the stutter. So we keep the *compressed* Image objects
   (~83KB each, trivial) and explicitly pre-decode only a rolling window around
   the playhead via img.decode(), which runs off the main thread.

   Motion note (the third half):
   Density alone still steps. paint() takes a FRACTIONAL position and blends the
   two frames it sits between, then settles on a whole frame one tick after the
   scrub stops — a blend held at rest is a visible double exposure.

   Bandwidth note (the other half):
   Fetching every frame of every sequence up front is ~20MB on the home page,
   and all of it competes with the frames the user is actually looking at. So
   frames arrive in *passes* of decreasing stride — 1 frame in 8 first, then
   1 in 4, 1 in 2, then the rest. A sparse pass is already scrubbable (_pick
   falls back to the nearest frame it holds), so the sequence is usable after
   ~15 requests instead of 120, and only a sequence the user has actually reached
   ever pays for the dense passes.
   ========================================================================== */
(function (w) {
  'use strict';

  var MANIFEST = w.ZLAB_SEQ || {};

  /* ---- source variant --------------------------------------------------
     Coarse pointers are routed to mobile.html, which has no sequences at all,
     so the small tier is now for weak DESKTOPS: data-saver, 2G, ~2GB of RAM,
     or someone who forced ?full=1 onto a phone. */
  var conn = navigator.connection || {};
  var thrifty = !!conn.saveData ||
                /(^|\W)(slow-)?2g$/.test(conn.effectiveType || '') ||
                (navigator.deviceMemory || 8) <= 2;
  var isMobile = matchMedia('(max-width: 768px)').matches;
  var SRC_W = (isMobile || thrifty) ? 1200 : 1920;
  /* The frames are 1920x1080 natively, so 1920 buys real detail. Backing the
     canvas at source width and letting the compositor stretch it is softer
     than resampling once ourselves at 'high', which is what a 2K/4K monitor
     wants — but only where there is source detail to resample, so the thrifty
     tier stays pinned to its own width. */
  var MAX_BACKING = SRC_W < 1920 ? SRC_W : 2560;

  /* The width cap alone is not enough on a phone. A portrait viewport
     cover-fits a landscape frame, so the canvas ends up far TALLER than the
     source: 390x844 at dpr 3 is a ~900x1900 backing store, and filling it
     means upscaling a 900x506 frame about 3.8x — on every scrubbed frame.
     Capping the pixel ratio and the total backing area cuts that fill cost
     ~2.4x and costs no real detail, because the source has none to give at
     that size. Desktop is unaffected: MAX_BACKING already binds there. */
  var coarse = matchMedia('(pointer: coarse)').matches;
  var MAX_DPR = coarse ? 1.5 : 2;
  // 2560x1440 is 3.69e6, so the desktop net has to sit above that or it binds
  // before MAX_BACKING does and quietly undoes the 2K backing store
  var MAX_PIXELS = coarse ? 1.1e6 : 4.2e6;

  var WARM_BACK = 3;    // frames behind the playhead to keep decoded
  var WARM_AHEAD = 10;  // frames ahead (scrolling down is the common case)
  var WARM_STEP = 3;    // only recompute the warm window after this much drift
  var PICK_RADIUS = 16; // how far _pick will hunt before giving up
  var BLEND_MIN = 0.02; // below this the second frame is not worth a blit

  // Stride schedule. Pass 0 is what a merely-approaching sequence gets; the
  // rest are earned by actually arriving at the section.
  var PASSES = [8, 4, 2, 1];

  var idle = w.requestIdleCallback || function (fn) { return setTimeout(fn, 1); };

  /* ---- shared, priority-aware fetch queue ------------------------------- */
  var MAX_INFLIGHT = 6;
  var inflight = 0;
  var queue = [];

  function pump() {
    while (inflight < MAX_INFLIGHT) {
      if (!queue.length) return;
      // highest priority first (menu = 200, hero = 100, on-screen = 50)
      var best = 0;
      for (var i = 1; i < queue.length; i++) if (queue[i].pri > queue[best].pri) best = i;
      var job = queue.splice(best, 1)[0];
      inflight++;
      job.run(function () { inflight--; pump(); });
    }
  }
  function enqueue(job) { queue.push(job); pump(); }

  /* Drop everything still queued for a sequence that went off screen — those
     bytes belong to whatever the user scrolled to instead. The frames go back
     to "not requested" so a later _refill() can pick them up again. */
  function dropQueued(seq) {
    for (var i = queue.length - 1; i >= 0; i--) {
      if (queue[i].seq === seq) {
        seq.requested[queue[i].i] = 0;
        seq.expected--;
        queue.splice(i, 1);
      }
    }
  }

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
    this.ready = new Array(this.count);        // decoded & safe to draw
    this.requested = new Uint8Array(this.count);
    this.loaded = 0;
    this.expected = 0;                         // frames requested so far
    this.frame = -1;
    this.priority = opts.priority || 10;
    this.level = -1;                           // highest pass started
    this.active = false;
    this._painted = false;
    this._raf = 0;
    this._pending = -1;
    this._drawn = -1;                           // last position handed to paint()
    this._warmedAt = -999;
    this._hq = true;
    this._hqTimer = 0;
    this._onFirst = null;
    this._onProgress = null;

    var self = this;
    this._onResize = function () {
      clearTimeout(self._rzTimer);
      self._rzTimer = setTimeout(function () { self.resize(); }, 150);
    };
    w.addEventListener('resize', this._onResize, { passive: true });
    this._applyHints();
    this.resize();
  }

  Sequence.prototype._applyHints = function () {
    // one draw per frame when idle, so the better resampler is worth it there;
    // mid-scrub it is the single most expensive thing drawImage does
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.imageSmoothingQuality = this._hq ? 'high' : 'low';
  };

  Sequence.prototype.src = function (i) {
    return 'assets/seq/' + this.name + '/' + this.width + '/f' +
      String(i + 1).padStart(4, '0') + '.' + this.ext;
  };

  Sequence.prototype._fireProgress = function () {
    if (this._onProgress) this._onProgress(this.loaded / Math.max(1, this.expected));
  };

  Sequence.prototype._request = function (i, pri) {
    if (this.requested[i]) return;
    this.requested[i] = 1;
    this.expected++;
    var self = this;
    enqueue({
      pri: pri, seq: self, i: i,
      run: function (done) {
        var img = new Image();
        img.decoding = 'async';
        img.onload = function () {
          self.imgs[i] = img;
          self.loaded++;
          // decode the first frame immediately so we can paint something
          if (i === 0) {
            self._decode(0, function () {
              self.draw(0);
              if (self._onFirst) { self._onFirst(); self._onFirst = null; }
            });
          } else if (self.frame >= 0 && Math.abs(i - self.frame) <= 1) {
            // a frame landed right where the playhead is sitting — show it
            self._decode(i, function () { self._painted = false; self.paint(self.frame); });
          }
          self._fireProgress();
          done();
        };
        img.onerror = function () { self.loaded++; self._fireProgress(); done(); };
        img.src = self.src(i);
      }
    });
  };

  /** Queue every frame belonging to pass `level`. Returns true if it added any. */
  Sequence.prototype._queuePass = function (level) {
    // an unknown sequence name has count 0 — requesting "frame 0" of it would
    // fire one guaranteed 404
    if (!this.count) return false;
    var stride = PASSES[level], added = 0;
    // frame 0 first — it is what the poster/preloader waits on
    if (!this.requested[0]) { this._request(0, this.priority + 50); added++; }
    for (var i = 0; i < this.count; i += stride) {
      if (!this.requested[i]) { this._request(i, this.priority - i * 0.001); added++; }
    }
    // the last frame matters as much as the first — it is where a scrub rests
    var last = this.count - 1;
    if (last > 0 && !this.requested[last]) { this._request(last, this.priority - 1); added++; }
    return added > 0;
  };

  /** Advance to a new pass. */
  Sequence.prototype._pass = function (level) {
    if (level <= this.level || level >= PASSES.length) return false;
    this.level = level;
    return this._queuePass(level);
  };

  /** Re-request anything a deactivate() dropped out of the queue. */
  Sequence.prototype._refill = function () {
    for (var l = 0; l <= this.level; l++) this._queuePass(l);
  };

  /** Cheap skeleton: enough frames to scrub, ~1/8th of the bytes. */
  Sequence.prototype.preload = function (onProgress, onFirst) {
    if (onProgress) this._onProgress = onProgress;
    if (onFirst) {
      // a second caller must not wait forever if frame 0 already landed
      if (this.ready[0] === true) onFirst();
      else this._onFirst = onFirst;
    }
    if (this.level < 0) this._pass(0);
    else this._refill();
    return this;
  };

  /** The user reached this section — fill in the in-between frames, gently. */
  Sequence.prototype.activate = function () {
    if (this.active) return this;
    this.active = true;
    this.priority = Math.max(this.priority, 50);
    this.preload();
    this._densify();
    return this;
  };

  Sequence.prototype._densify = function () {
    var self = this;
    clearTimeout(this._denseTimer);
    if (!this.active || this.level >= PASSES.length - 1) return;
    // wait until the current pass has actually landed before asking for more,
    // so the network is never carrying two passes of the same sequence at once
    if (this.loaded < this.expected) {
      this._denseTimer = setTimeout(function () { self._densify(); }, 220);
      return;
    }
    idle(function () {
      if (!self.active) return;
      if (self._pass(self.level + 1)) {
        self._denseTimer = setTimeout(function () { self._densify(); }, 220);
      }
    });
  };

  Sequence.prototype.deactivate = function () {
    this.active = false;
    clearTimeout(this._denseTimer);
    dropQueued(this);
  };

  /** Queue every frame at once, in playback order.
   *  For sequences played on a clock rather than scrubbed by scroll: a stride
   *  pass is fine to scrub through (you land between frames either way) but
   *  visibly steps when it has to play at a fixed rate. Only worth it for
   *  user-initiated playback that is already gated behind an interaction. */
  Sequence.prototype.rush = function (onProgress) {
    if (onProgress) this._onProgress = onProgress;
    this.active = true;
    this.level = PASSES.length - 1;
    this._queuePass(this.level);
    return this;
  };

  /** Back-compat: load everything the way the old API did. */
  Sequence.prototype.load = function (onProgress, onFirst) {
    this.preload(onProgress, onFirst);
    this.activate();
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
    if (Math.abs(center - this._warmedAt) < WARM_STEP) return;
    this._warmedAt = center;
    var from = Math.max(0, center - WARM_BACK);
    var to = Math.min(this.count - 1, center + WARM_AHEAD);
    for (var i = from; i <= to; i++) if (this.imgs[i] && !this.ready[i]) this._decode(i);
  };

  /** Nearest drawable frame at or before i, else nearest after. */
  Sequence.prototype._pick = function (i) {
    if (this.ready[i] === true && this.imgs[i]) return this.imgs[i];
    var max = Math.min(PICK_RADIUS, this.count);
    for (var d = 1; d < max; d++) {
      if (this.ready[i - d] === true && this.imgs[i - d]) return this.imgs[i - d];
      if (this.ready[i + d] === true && this.imgs[i + d]) return this.imgs[i + d];
    }
    // nothing decoded nearby — fall back to any loaded image
    return this.imgs[i] || this.imgs[0] || null;
  };

  /** Scrub position 0..1. Batched to one paint per animation frame.
   *  The position stays FRACTIONAL so paint() can cross-fade the two frames it
   *  sits between: at ~120 frames a section that is the difference between
   *  continuous motion and stepping from still to still. */
  Sequence.prototype.seek = function (p) {
    var pos = Math.max(0, Math.min(1, p)) * (this.count - 1);
    if (pos === this._pending) return;
    this._pending = pos;
    this._scrubbing();
    this._tick();
  };

  Sequence.prototype._tick = function () {
    if (this._raf) return;
    var self = this;
    this._raf = requestAnimationFrame(function () {
      self._raf = 0;
      var moving = self._pending !== self._drawn;
      self._drawn = self._pending;
      // Idle scrub: land on a whole frame. A cross-fade held at rest is a
      // visible double exposure, so the last paint of a gesture must be clean.
      self.paint(moving ? self._pending : Math.round(self._pending));
      if (moving) self._tick();       // one extra tick to perform the settle
    });
  };

  /* Drop to the cheap resampler while frames are flying past, then repaint the
     frame the user actually comes to rest on at full quality. */
  Sequence.prototype._scrubbing = function () {
    var self = this;
    if (this._hq) { this._hq = false; this._applyHints(); }
    clearTimeout(this._hqTimer);
    this._hqTimer = setTimeout(function () {
      self._hq = true;
      self._applyHints();
      self._painted = false;
      self.paint(self.frame);
    }, 140);
  };

  /** Draw a whole frame index — menu playback, first paint, redraw on resize. */
  Sequence.prototype.draw = function (i) { this.paint(i | 0); };

  /** Cover-fit blit of one decoded frame. */
  Sequence.prototype._blit = function (img) {
    var ctx = this.ctx, cv = this.canvas;
    var cw = cv.width, ch = cv.height;
    var ir = img.width / img.height, cr = cw / ch;
    var dw, dh, dx, dy;
    if (ir > cr) { dh = ch; dw = ch * ir; dx = (cw - dw) / 2; dy = 0; }
    else { dw = cw; dh = cw / ir; dx = 0; dy = (ch - dh) / 2; }
    ctx.drawImage(img, dx, dy, dw, dh);
  };

  /** Paint a FRACTIONAL position, cross-fading the two frames it sits between. */
  Sequence.prototype.paint = function (pos) {
    pos = Math.max(0, Math.min(this.count - 1, pos || 0));
    if (pos === this.frame && this._painted) return;
    var i = Math.floor(pos), f = pos - i;
    var base = this._pick(i);
    this.frame = pos;
    this._warm(i);
    if (!base || !base.width) return;

    this._blit(base);
    /* Blend toward the next frame only when it is genuinely decoded: waiting on
       it would stall the paint, a half-decoded blit flickers, and during the
       early stride passes (1 frame in 8) the neighbour simply is not there yet
       — those passes fall back to a clean single blit. */
    if (f > BLEND_MIN && this.ready[i + 1] === true && this.imgs[i + 1]) {
      this.ctx.globalAlpha = f;
      this._blit(this.imgs[i + 1]);
      this.ctx.globalAlpha = 1;
    }
    this._painted = true;
  };

  Sequence.prototype.resize = function () {
    if (this.asleep) return;                 // stay released until woken
    var r = this.canvas.getBoundingClientRect();
    if (!r.width || !r.height) return;
    var dpr = Math.min(w.devicePixelRatio || 1, MAX_DPR);
    var scale = Math.min(dpr, MAX_BACKING / Math.max(r.width, 1));
    // the backing store must keep the canvas box's aspect ratio (the browser
    // stretches it to fit), so trim area with a uniform scale, never per-axis
    var px = r.width * r.height * scale * scale;
    if (px > MAX_PIXELS) scale *= Math.sqrt(MAX_PIXELS / px);
    var nw = Math.max(1, Math.round(r.width * scale));
    var nh = Math.max(1, Math.round(r.height * scale));
    if (nw === this.canvas.width && nh === this.canvas.height) return;
    this.canvas.width = nw;
    this.canvas.height = nh;
    // assigning width/height resets the whole 2D context, so quality hints
    // have to be re-applied here or every resize silently drops back to 'low'
    this._applyHints();
    this.ctx.fillStyle = '#0a0a0c';
    this.ctx.fillRect(0, 0, nw, nh);
    this._painted = false;
    if (this.frame >= 0) this.paint(this.frame);
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
    if (this.frame >= 0) this.paint(this.frame);
  };

  Sequence.prototype.destroy = function () {
    w.removeEventListener('resize', this._onResize);
    this.deactivate();
    clearTimeout(this._hqTimer);
    clearTimeout(this._rzTimer);
    clearTimeout(this._denseTimer);
    this.imgs.length = 0;
    this.ready.length = 0;
  };

  w.Sequence = Sequence;
})(window);
