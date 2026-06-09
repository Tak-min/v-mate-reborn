/** VRM facial expressions + autonomous blink loop. */

const EXPRESSION_MAP = {
  happy:     { happy: 0.3, relaxed: 1.0 },
  sad:       { sad: 0.6 },
  surprised: { surprised: 1.0 },
  neutral:   { relaxed: 1.0 },
};

const ALL_EXPRESSIONS = ['happy', 'sad', 'surprised', 'angry', 'relaxed', 'aa', 'ih', 'ou'];

export class ExpressionController {
  constructor(vrm) {
    this._vrm       = vrm;
    this._current   = 'neutral';
    this._blinking  = false;
    this._nextBlink = Date.now() + this._randomBlinkInterval();
  }

  set(emotion = 'neutral') {
    const mgr = this._vrm?.expressionManager;
    if (!mgr) return;
    ALL_EXPRESSIONS.forEach(e => mgr.setValue(e, 0));
    this._blinking = false;
    const weights = EXPRESSION_MAP[emotion] ?? EXPRESSION_MAP.neutral;
    Object.entries(weights).forEach(([e, v]) => mgr.setValue(e, v));
    this._current = emotion;
    this._nextBlink = Date.now() + this._randomBlinkInterval();
  }

  setLipSync(weight) {
    const mgr = this._vrm?.expressionManager;
    if (!mgr) return;
    mgr.setValue('aa', Math.min(weight * 1.2, 1.0));
  }

  /** Call every frame from render loop. */
  tick() {
    if (!this._blinking && Date.now() >= this._nextBlink) this._blink();
  }

  _blink() {
    const mgr = this._vrm?.expressionManager;
    if (!mgr || this._blinking) return;
    this._blinking = true;
    const isHappy = this._current === 'happy';
    const max = isHappy ? 0.6 : 1.0;
    const duration = 150;
    const t0 = Date.now();

    const animate = () => {
      const p = (Date.now() - t0) / duration;
      if (p >= 1) {
        mgr.setValue('blink', 0);
        this._blinking = false;
        this._nextBlink = Date.now() + this._randomBlinkInterval();
        return;
      }
      const v = p < 0.5 ? p * 2 : 1 - (p - 0.5) * 2;
      mgr.setValue('blink', Math.min(v, max));
      requestAnimationFrame(animate);
    };
    animate();
  }

  _randomBlinkInterval() { return 2000 + Math.random() * 4000; }
}
