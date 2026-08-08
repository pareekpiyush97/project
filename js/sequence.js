/* ============================================================
   sequence.js — canvas image-sequence player
   Frames are downscaled into lightweight ImageBitmaps on load so
   mobile can keep them decoded (no re-decode jank while scrubbing).
   On small screens we also thin the frames out to cap memory.
   One class, reused by every act + the Work page.
   ============================================================ */

const DPR = Math.min(window.devicePixelRatio || 1, 2);
const IS_MOBILE = matchMedia('(max-width:768px)').matches || 'ontouchstart' in window;
const CAP_W = IS_MOBILE ? 720 : 1440;     // max stored frame width
const STEP  = IS_MOBILE ? 3 : 1;          // load every Nth frame on mobile
const CAN_BMP = typeof createImageBitmap === 'function';

class Sequence {
  constructor(canvas, name, count) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.name = name;
    this.count = count;
    this.step = STEP;
    this.images = new Array(count);
    this.loaded = 0;
    this.current = -1;
    this.started = false;
    this._resize = this._resize.bind(this);
    window.addEventListener('resize', this._resize);
    this._resize();
  }

  url(i) {
    const n = String(i + 1).padStart(3, '0');
    return `assets/seq/${this.name}/ezgif-frame-${n}.jpg`;
  }

  /** Load frames (downscaled). onProgress(0..1) as they arrive. */
  load(onProgress) {
    if (this.started) return this._promise;
    this.started = true;

    const idxs = [];
    for (let i = 0; i < this.count; i += this.step) idxs.push(i);
    if (idxs[idxs.length - 1] !== this.count - 1) idxs.push(this.count - 1);
    const total = idxs.length;

    this._promise = new Promise((resolve) => {
      let done = 0;
      const finish = () => {
        done++;
        this.loaded = done;
        if (onProgress) onProgress(done / total);
        if (this.current === -1) this.draw(0);
        if (done === total) resolve();
      };
      idxs.forEach((i) => {
        const img = new Image();
        img.decoding = 'async';
        img.onload = () => {
          const scale = Math.min(1, CAP_W / (img.naturalWidth || CAP_W));
          if (scale < 1 && CAN_BMP) {
            createImageBitmap(img, {
              resizeWidth: Math.round(img.naturalWidth * scale),
              resizeHeight: Math.round(img.naturalHeight * scale),
              resizeQuality: 'medium'
            }).then((bmp) => { this.images[i] = bmp; }, () => { this.images[i] = img; })
              .then(finish);
          } else {
            this.images[i] = img;
            finish();
          }
        };
        img.onerror = finish;
        img.src = this.url(i);
      });
    });
    return this._promise;
  }

  _pick(i) {
    if (this.images[i]) return this.images[i];
    for (let d = 1; d < this.count; d++) {
      if (this.images[i - d]) return this.images[i - d];
      if (this.images[i + d]) return this.images[i + d];
    }
    return null;
  }

  draw(i) {
    i = Math.max(0, Math.min(this.count - 1, Math.round(i)));
    this.current = i;
    const img = this._pick(i);
    const { ctx, canvas } = this;
    if (!img) return;
    const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
    const cw = canvas.width, ch = canvas.height;
    const ir = iw / ih, cr = cw / ch;
    let w, h, x, y;
    if (ir > cr) { h = ch; w = ch * ir; x = (cw - w) / 2; y = 0; }
    else         { w = cw; h = cw / ir; x = 0; y = (ch - h) / 2; }
    ctx.fillStyle = '#08090b';
    ctx.fillRect(0, 0, cw, ch);
    ctx.drawImage(img, x, y, w, h);
  }

  seek(p) { this.draw(p * (this.count - 1)); }

  _resize() {
    const r = this.canvas.getBoundingClientRect();
    this.canvas.width = Math.max(1, Math.round(r.width * DPR));
    this.canvas.height = Math.max(1, Math.round(r.height * DPR));
    if (this.current >= 0) this.draw(this.current);
  }
}

window.Sequence = Sequence;
