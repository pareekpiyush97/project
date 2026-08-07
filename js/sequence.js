/* ============================================================
   sequence.js — canvas image-sequence player
   Draws a JPG frame stack to a full-bleed canvas (object-fit: cover).
   Frames are lazy-loaded; scrubbing draws the nearest ready frame.
   One class, reused by every act + the Work page hero.
   ============================================================ */

const DPR = Math.min(window.devicePixelRatio || 1, 2);

class Sequence {
  /** @param {HTMLCanvasElement} canvas
   *  @param {string} name   folder under assets/seq/
   *  @param {number} count  number of frames */
  constructor(canvas, name, count) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.name = name;
    this.count = count;
    this.images = new Array(count);
    this.loaded = 0;
    this.current = -1;      // last frame index drawn
    this.started = false;
    this._resize = this._resize.bind(this);
    window.addEventListener('resize', this._resize);
    this._resize();
  }

  url(i) {
    const n = String(i + 1).padStart(3, '0');
    return `assets/seq/${this.name}/ezgif-frame-${n}.jpg`;
  }

  /** Load every frame. onProgress(0..1) fires as they arrive. */
  load(onProgress) {
    if (this.started) return this._promise;
    this.started = true;
    this._promise = new Promise((resolve) => {
      let done = 0;
      const finish = () => {
        done++;
        this.loaded = done;
        if (onProgress) onProgress(done / this.count);
        if (this.current === -1) this.draw(0);   // paint first available
        if (done === this.count) resolve();
      };
      for (let i = 0; i < this.count; i++) {
        const img = new Image();
        img.decoding = 'async';
        img.onload = () => { this.images[i] = img; finish(); };
        img.onerror = finish;
        img.src = this.url(i);
      }
    });
    return this._promise;
  }

  /** Nearest ready image at-or-before i, else nearest after. */
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
    const cw = canvas.width, ch = canvas.height;
    const ir = img.width / img.height, cr = cw / ch;
    let w, h, x, y;
    if (ir > cr) { h = ch; w = ch * ir; x = (cw - w) / 2; y = 0; }
    else         { w = cw; h = cw / ir; x = 0; y = (ch - h) / 2; }
    ctx.fillStyle = '#08090b';
    ctx.fillRect(0, 0, cw, ch);
    ctx.drawImage(img, x, y, w, h);
  }

  /** progress 0..1 -> frame */
  seek(p) { this.draw(p * (this.count - 1)); }

  _resize() {
    const r = this.canvas.getBoundingClientRect();
    this.canvas.width = Math.max(1, Math.round(r.width * DPR));
    this.canvas.height = Math.max(1, Math.round(r.height * DPR));
    if (this.current >= 0) this.draw(this.current);
  }
}

window.Sequence = Sequence;
