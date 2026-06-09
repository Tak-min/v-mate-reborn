/** Glass input panel + message input — CSS3D objects in 3D space. */
import { CSS3DObject } from 'three/addons/renderers/CSS3DRenderer.js';

export class InputPanel {
  constructor(css3dScene, { onSend, onVoiceStart, onVoiceStop } = {}) {
    this._scene = css3dScene;
    this._onSend = onSend ?? (() => {});
    this._glassObj  = null;
    this._inputObj  = null;
    this._recording = false;
    this._build(onVoiceStart, onVoiceStop);
    this._animate();
  }

  _build(onVoiceStart, onVoiceStop) {
    // ── Glass trigger panel ──────────────────────────────────────────────
    const glass = document.createElement('div');
    glass.className = 'glass-panel';
    glass.innerHTML = `
      <div class="glass-panel-icon"><i class="fas fa-comments"></i></div>
      <div class="glass-panel-text">メッセージを送信</div>
      <div class="glass-panel-subtext">クリックして会話を始める</div>`;
    glass.style.pointerEvents = 'auto';
    glass.addEventListener('click', () => this._showInput());

    this._glassObj = new CSS3DObject(glass);
    this._glassObj.position.set(0.5, 1.0, -0.2);
    this._glassObj.rotation.y = Math.PI + Math.PI * 0.08;
    this._glassObj.scale.setScalar(0.002);
    this._scene.add(this._glassObj);

    // ── Message input panel ───────────────────────────────────────────────
    const input = document.createElement('div');
    input.className = 'message-input-panel';
    input.innerHTML = `
      <div class="message-input-panel-header">
        <span class="message-input-panel-title"><i class="fas fa-comment-dots"></i> メッセージを入力</span>
        <button class="btn-close-panel"><i class="fas fa-times"></i></button>
      </div>
      <textarea class="message-input-textarea" placeholder="ここにメッセージを入力…"></textarea>
      <div class="message-input-actions">
        <button class="btn-voice" title="音声入力"><i class="fas fa-microphone"></i></button>
        <span class="recording-indicator" style="display:none"><i class="fas fa-circle"></i> 録音中</span>
        <button class="btn-cancel">キャンセル</button>
        <button class="btn-send primary">送信</button>
      </div>`;
    input.style.pointerEvents = 'auto';

    input.querySelector('.btn-close-panel').addEventListener('click', () => this._hideInput());
    input.querySelector('.btn-cancel').addEventListener('click', () => this._hideInput());
    input.querySelector('.btn-send').addEventListener('click', () => this._send(input));
    input.querySelector('.message-input-textarea').addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this._send(input); }
    });

    const voiceBtn = input.querySelector('.btn-voice');
    const recInd   = input.querySelector('.recording-indicator');
    voiceBtn.addEventListener('click', () => {
      this._recording = !this._recording;
      if (this._recording) {
        onVoiceStart?.();
        voiceBtn.innerHTML = '<i class="fas fa-stop"></i>';
        voiceBtn.classList.add('recording');
        recInd.style.display = 'inline-flex';
      } else {
        onVoiceStop?.();
        voiceBtn.innerHTML = '<i class="fas fa-microphone"></i>';
        voiceBtn.classList.remove('recording');
        recInd.style.display = 'none';
      }
    });

    this._inputObj = new CSS3DObject(input);
    this._inputObj.position.set(0.5, 0.5, -0.2);
    this._inputObj.rotation.y = Math.PI + Math.PI * 0.08;
    this._inputObj.scale.setScalar(0.0015);
    this._scene.add(this._inputObj);
  }

  _send(container) {
    const ta = container.querySelector('.message-input-textarea');
    const msg = ta.value.trim();
    if (msg) { this._onSend(msg); ta.value = ''; this._hideInput(); }
  }

  _showInput() {
    this._inputObj.element.classList.add('show');
    setTimeout(() => this._inputObj.element.querySelector('textarea')?.focus(), 80);
  }

  _hideInput() {
    this._inputObj.element.classList.remove('show');
    this._inputObj.element.querySelector('textarea').value = '';
  }

  _animate() {
    const tick = () => {
      if (this._glassObj) {
        const t = Date.now() * 0.001;
        this._glassObj.position.y = 1.0 + Math.sin(t * 0.5) * 0.03;
        this._glassObj.rotation.y = Math.PI + Math.PI * 0.08 + Math.sin(t * 0.3) * 0.015;
      }
      requestAnimationFrame(tick);
    };
    tick();
  }
}
