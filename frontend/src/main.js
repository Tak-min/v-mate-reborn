/** App entry point — orchestrates init order and wires all modules together. */
import * as THREE from 'three';
import { authService } from './api/auth.js';
import { connect, sendMessage, sendAudio } from './socket/client.js';
import { buildRenderers } from './scene/renderer.js';
import { BackgroundManager } from './scene/background.js';
import { loadVRM } from './character/loader.js';
import { AnimationController } from './character/animation.js';
import { ExpressionController } from './character/expression.js';
import { AudioPlayer } from './audio/player.js';
import { LipSync } from './audio/lipsync.js';
import { SpeechBubble } from './ui/bubble.js';
import { InputPanel } from './ui/panel.js';
import { Sidebar } from './ui/sidebar.js';
import { toast } from './ui/toast.js';
import { DEFAULT_SETTINGS, ANIMATION_PATHS } from './config.js';

class App {
  constructor() {
    this._vrm          = null;
    this._mixer        = null;
    this._animCtrl     = null;
    this._exprCtrl     = null;
    this._player       = null;
    this._lipsync      = null;
    this._bubble       = null;
    this._scene        = null;
    this._camera       = null;
    this._renderer     = null;
    this._css3d        = null;
    this._css3dScene   = null;
    this._bgManager    = null;
    this._clock        = new THREE.Clock();
    this._currentChar  = null;
    this._settings     = { ...DEFAULT_SETTINGS };
    this._isProcessing = false;
    this._mediaRecorder = null;
    this._audioChunks   = [];
  }

  async init() {
    // ── 1. Auth guard ──────────────────────────────────────────────────────
    if (!authService.isAuthenticated()) {
      window.location.href = '/auth/login.html';
      return;
    }

    // ── 2. Build 3D scene ──────────────────────────────────────────────────
    const container = document.getElementById('scene-container');
    const { renderer, css3d, scene, css3dScene, camera, controls } =
      buildRenderers(container);
    this._renderer   = renderer;
    this._css3d      = css3d;
    this._scene      = scene;
    this._css3dScene = css3dScene;
    this._camera     = camera;

    // ── 3. Background ──────────────────────────────────────────────────────
    this._bgManager = new BackgroundManager(scene);
    this._bgManager.load(this._settings.background);

    // ── 4. Audio subsystem ─────────────────────────────────────────────────
    this._lipsync = new LipSync(null); // expression assigned after VRM load
    this._player  = new AudioPlayer({
      volume:    this._settings.volume,
      speed:     this._settings.voiceSpeed,
      onLipSync: audio => this._lipsync.attach(audio),
    });

    // ── 5. UI ──────────────────────────────────────────────────────────────
    this._bubble = new SpeechBubble();

    this._sidebar = new Sidebar({
      onCharacterChange: c  => this._switchCharacter(c),
      onBgChange:        (v, url) => this._bgManager.load(v, url),
      onVolumeChange:    v  => { this._player.volume = v; this._settings.volume = v; },
      onSpeedChange:     s  => { this._player.speed  = s; this._settings.voiceSpeed = s; },
    });

    this._panel = new InputPanel(css3dScene, {
      onSend:       msg  => this._onSend(msg),
      onVoiceStart: ()   => this._startRecording(),
      onVoiceStop:  ()   => this._stopRecording(),
    });

    // ── 6. Socket ──────────────────────────────────────────────────────────
    connect({
      onMessageChunk:     chunk => this._onChunk(chunk),
      onStreamingComplete: data => this._onComplete(data),
      onError:            err  => { toast.error(err.message ?? 'エラーが発生しました'); this._unlock(); },
      onTranscript:       txt  => { document.querySelector('.message-input-textarea').value = txt; },
    });

    // ── 7. Load default character ──────────────────────────────────────────
    try {
      const chars = await (await fetch('/api/characters')).json();
      const first = chars.characters?.[0];
      if (first) await this._switchCharacter(first);
    } catch { toast.error('キャラクターの読み込みに失敗しました'); }

    // ── 8. Render loop ─────────────────────────────────────────────────────
    this._loop();

    // Unlock AudioContext on first click
    document.addEventListener('click', () => this._lipsync.init(), { once: true });
  }

  async _switchCharacter(character) {
    if (this._vrm) {
      this._scene.remove(this._vrm.scene);
      this._vrm = null;
      this._animCtrl = null;
      this._exprCtrl = null;
    }
    this._currentChar = character;
    try {
      const { vrm, mixer } = await loadVRM(
        this._scene,
        `/models/${character.model_file ?? 'default.vrm'}`,
        character.name,
      );
      this._vrm    = vrm;
      this._mixer  = mixer;
      this._exprCtrl = new ExpressionController(vrm);
      this._lipsync._expr = this._exprCtrl;
      this._animCtrl = new AnimationController(vrm, mixer, ANIMATION_PATHS);
      await this._animCtrl.boot();
    } catch { toast.error(`${character.name} の読み込みに失敗しました`); }
  }

  _onSend(text) {
    if (this._isProcessing) return;
    this._isProcessing = true;
    this._player.reset();
    sendMessage({
      message:      text,
      character_id: this._currentChar?.id ?? 1,
      user_id:      authService.userId(),
    });
  }

  _onChunk(chunk) {
    if (chunk.text) {
      this._bubble.show(chunk.text);
      if (this._exprCtrl && chunk.emotion) this._exprCtrl.set(chunk.emotion);
      if (this._animCtrl && chunk.emotion) this._animCtrl.react(chunk.emotion);
    }
    this._player.push(chunk);
  }

  _onComplete(data) {
    this._player.markDone();
    this._unlock();
  }

  _unlock() { this._isProcessing = false; }

  async _startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this._audioChunks = [];
      this._mediaRecorder = new MediaRecorder(stream);
      this._mediaRecorder.ondataavailable = e => {
        if (e.data.size > 0) this._audioChunks.push(e.data);
      };
      this._mediaRecorder.onstop = () => {
        const blob = new Blob(this._audioChunks, { type: 'audio/webm' });
        blob.arrayBuffer().then(buf => sendAudio(buf));
        stream.getTracks().forEach(t => t.stop());
      };
      this._mediaRecorder.start();
    } catch { toast.error('マイクにアクセスできませんでした'); }
  }

  _stopRecording() {
    this._mediaRecorder?.stop();
  }

  _loop() {
    requestAnimationFrame(() => this._loop());
    const dt = this._clock.getDelta();
    this._mixer?.update(dt);
    this._animCtrl?.update(dt);
    this._exprCtrl?.tick(dt);
    this._bubble.trackHead(this._vrm, this._camera);
    this._renderer.render(this._scene, this._camera);
    this._css3d.render(this._css3dScene, this._camera);
  }
}

const app = new App();
app.init().catch(err => console.error('Init failed:', err));
