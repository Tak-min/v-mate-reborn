/** Sequential audio chunk queue — plays chunks in order as they arrive. */
import { BACKEND_URL } from '../config.js';

export class AudioPlayer {
  constructor({ volume = 0.7, speed = 1.0, onLipSync } = {}) {
    this.volume    = volume;
    this.speed     = speed;
    this.onLipSync = onLipSync ?? (() => {});
    this._queue    = [];
    this._playing  = false;
    this._nextIdx  = 1;
    this._done     = false;   // set true when streaming_complete fires
  }

  /** Add a chunk from `message_chunk` event. */
  push(chunk) {
    if (!chunk.audio_data) return;
    this._queue.push({ index: chunk.chunk_index, url: this._toUrl(chunk.audio_data) });
    if (!this._playing) this._drain();
  }

  /** Called when streaming_complete arrives. */
  markDone() { this._done = true; }

  reset() {
    this._queue   = [];
    this._playing = false;
    this._nextIdx = 1;
    this._done    = false;
  }

  _toUrl(data) {
    return data.startsWith('/audio/') ? `${BACKEND_URL}${data}` : data;
  }

  async _drain() {
    this._playing = true;
    while (true) {
      const idx = this._queue.findIndex(c => c.index === this._nextIdx);
      if (idx === -1) {
        // Nothing ready: wait if more is coming, otherwise done
        if (this._done && this._queue.length === 0) break;
        await new Promise(r => setTimeout(r, 80));
        continue;
      }
      const chunk = this._queue.splice(idx, 1)[0];
      this._nextIdx++;
      try { await this._play(chunk.url); } catch { /* skip bad chunks */ }
    }
    this._playing = false;
  }

  _play(url) {
    return new Promise((resolve, reject) => {
      const audio = new Audio(url);
      audio.volume       = this.volume;
      audio.playbackRate = this.speed;
      this.onLipSync(audio);
      audio.onended = resolve;
      audio.onerror = reject;
      audio.play().catch(reject);
    });
  }
}
