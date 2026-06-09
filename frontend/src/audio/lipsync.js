/** AudioContext-based lip-sync — connect an Audio element and poll amplitude. */

export class LipSync {
  constructor(expressionController) {
    this._expr    = expressionController;
    this._ctx     = null;
    this._analyser = null;
    this._source  = null;
    this._data    = null;
    this._rafId   = null;
  }

  /** Call on first user interaction to unlock AudioContext. */
  init() {
    if (this._ctx) return;
    try {
      this._ctx = new (window.AudioContext ?? window.webkitAudioContext)();
    } catch { /* no audio API */ }
  }

  /** Attach to a playing HTMLAudioElement. */
  attach(audio) {
    if (!this._ctx) return;
    this._detach();
    try {
      this._analyser = this._ctx.createAnalyser();
      this._analyser.fftSize = 256;
      this._data   = new Uint8Array(this._analyser.frequencyBinCount);
      this._source = this._ctx.createMediaElementSource(audio);
      this._source.connect(this._analyser);
      this._analyser.connect(this._ctx.destination);
      this._poll();
    } catch { /* silently skip */ }
  }

  _detach() {
    if (this._rafId) { cancelAnimationFrame(this._rafId); this._rafId = null; }
    if (this._source) { try { this._source.disconnect(); } catch { } this._source = null; }
    this._expr.setLipSync(0);
  }

  _poll() {
    if (!this._analyser) return;
    this._analyser.getByteFrequencyData(this._data);
    const avg = this._data.slice(0, 16).reduce((a, b) => a + b, 0) / 16 / 255;
    this._expr.setLipSync(avg);
    this._rafId = requestAnimationFrame(() => this._poll());
  }
}
