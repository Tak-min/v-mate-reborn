import { useAuthStore } from '@/store/authStore';
import type { Emotion } from '@/config';

export interface MessageChunk {
  type: 'message_chunk';
  chunk_index: number;
  text: string;
  emotion: Emotion;
  audio_data: string | null;
}

interface TranscriptMsg { type: 'transcript'; text: string }
interface StreamingCompleteMsg { type: 'streaming_complete' }
interface ErrorMsg { type: 'error'; message: string }

export type ServerMessage = MessageChunk | TranscriptMsg | StreamingCompleteMsg | ErrorMsg;

export interface SocketHandlers {
  onMessageChunk: (chunk: MessageChunk) => void;
  onStreamingComplete: () => void;
  onTranscript: (text: string) => void;
  onError: (message: string) => void;
}

export class VMateSocket {
  private ws: WebSocket | null = null;
  private handlers: SocketHandlers;

  constructor(handlers: SocketHandlers) {
    this.handlers = handlers;
  }

  connect() {
    const token = useAuthStore.getState().accessToken;
    if (!token) throw new Error('Not authenticated');

    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    this.ws = new WebSocket(`${protocol}://${window.location.host}/ws?token=${encodeURIComponent(token)}`);

    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data) as ServerMessage;
      switch (data.type) {
        case 'message_chunk': this.handlers.onMessageChunk(data); break;
        case 'streaming_complete': this.handlers.onStreamingComplete(); break;
        case 'transcript': this.handlers.onTranscript(data.text); break;
        case 'error': this.handlers.onError(data.message); break;
      }
    };

    this.ws.onerror = () => this.handlers.onError('接続エラーが発生しました');
  }

  sendMessage(message: string, characterId: string) {
    this.send({ type: 'message', message, character_id: characterId });
  }

  sendAudio(buffer: ArrayBuffer) {
    this.ws?.send(buffer);
  }

  private send(payload: unknown) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }
  }

  close() {
    this.ws?.close();
    this.ws = null;
  }
}
