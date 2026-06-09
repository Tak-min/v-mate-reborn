/** Settings sidebar — character select, background, volume, voice speed. */
import { apiFetch } from '../api/http.js';
import { toast } from './toast.js';

export class Sidebar {
  constructor({ onCharacterChange, onBgChange, onVolumeChange, onSpeedChange } = {}) {
    this._onCharacterChange = onCharacterChange ?? (() => {});
    this._onBgChange        = onBgChange        ?? (() => {});
    this._onVolumeChange    = onVolumeChange    ?? (() => {});
    this._onSpeedChange     = onSpeedChange     ?? (() => {});
    this._el = null;
    this._open = false;
    this._build();
    this._loadCharacters();
  }

  _build() {
    // Toggle button
    const btn = document.createElement('button');
    btn.className = 'sidebar-toggle';
    btn.innerHTML = '<i class="fas fa-cog"></i>';
    btn.addEventListener('click', () => this.toggle());
    document.body.appendChild(btn);

    // Panel
    const el = document.createElement('div');
    el.className = 'sidebar';
    el.innerHTML = `
      <div class="sidebar-header">
        <span class="sidebar-title"><i class="fas fa-sliders-h"></i> 設定</span>
        <button class="sidebar-close"><i class="fas fa-times"></i></button>
      </div>

      <section class="sidebar-section">
        <h3 class="sidebar-section-title">キャラクター</h3>
        <div class="character-list" id="character-list">
          <div class="skeleton-row"></div>
          <div class="skeleton-row"></div>
        </div>
      </section>

      <section class="sidebar-section">
        <h3 class="sidebar-section-title">背景</h3>
        <div class="bg-options">
          <button class="bg-btn" data-bg="gradient-blue">青グラデ</button>
          <button class="bg-btn" data-bg="gradient-purple">紫グラデ</button>
          <button class="bg-btn" data-bg="night">夜景</button>
          <button class="bg-btn" data-bg="white">白</button>
        </div>
        <div class="bg-custom-row">
          <label class="sidebar-label">カスタム画像</label>
          <input type="file" id="bg-file-input" accept="image/*" class="file-input">
          <label for="bg-file-input" class="btn-file">ファイルを選択</label>
        </div>
      </section>

      <section class="sidebar-section">
        <h3 class="sidebar-section-title">音声設定</h3>
        <label class="sidebar-label">音量: <span id="volume-val">70</span>%</label>
        <input type="range" id="volume-range" min="0" max="100" value="70" class="slider">
        <label class="sidebar-label">速度: <span id="speed-val">1.0</span>x</label>
        <input type="range" id="speed-range" min="5" max="20" value="10" class="slider">
      </section>`;

    el.querySelector('.sidebar-close').addEventListener('click', () => this.close());

    el.querySelectorAll('.bg-btn').forEach(b => {
      b.addEventListener('click', () => this._onBgChange(b.dataset.bg, null));
    });

    el.querySelector('#bg-file-input').addEventListener('change', e => {
      const file = e.target.files[0];
      if (!file) return;
      const url = URL.createObjectURL(file);
      this._onBgChange('custom', url);
    });

    const volRange  = el.querySelector('#volume-range');
    const volVal    = el.querySelector('#volume-val');
    volRange.addEventListener('input', () => {
      volVal.textContent = volRange.value;
      this._onVolumeChange(Number(volRange.value) / 100);
    });

    const spdRange = el.querySelector('#speed-range');
    const spdVal   = el.querySelector('#speed-val');
    spdRange.addEventListener('input', () => {
      const v = (Number(spdRange.value) / 10).toFixed(1);
      spdVal.textContent = v;
      this._onSpeedChange(Number(v));
    });

    document.body.appendChild(el);
    this._el = el;
  }

  async _loadCharacters() {
    try {
      const data = await apiFetch('/api/characters');
      const list = this._el.querySelector('#character-list');
      list.innerHTML = '';
      (data.characters ?? []).forEach(c => {
        const btn = document.createElement('button');
        btn.className = 'character-btn';
        btn.dataset.id = c.id;
        btn.innerHTML = `
          <div class="character-avatar" style="background:${c.color ?? '#8b5cf6'}">
            ${c.name?.charAt(0) ?? '?'}
          </div>
          <span class="character-name">${c.name}</span>`;
        btn.addEventListener('click', () => {
          list.querySelectorAll('.character-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          this._onCharacterChange(c);
        });
        list.appendChild(btn);
      });
      if (list.firstChild) list.firstChild.classList.add('active');
    } catch {
      toast.error('キャラクター一覧の読み込みに失敗しました');
    }
  }

  toggle() { this._open ? this.close() : this.open(); }

  open() {
    this._el.classList.add('open');
    this._open = true;
  }

  close() {
    this._el.classList.remove('open');
    this._open = false;
  }
}
