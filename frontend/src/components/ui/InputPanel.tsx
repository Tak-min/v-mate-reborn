import { useRef, useState } from 'react';
import { useChatStore } from '@/store/chatStore';
import { useSocketStore } from '@/store/socketStore';
import { useToastStore } from '@/store/toastStore';
import '@/styles/tokens.css';
import './input-panel.css';

/** Floating message composer: text entry, send button, and voice-input recording. */
export function InputPanel() {
  const [text, setText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  const socket = useSocketStore((state) => state.socket);
  const currentCharacter = useChatStore((state) => state.currentCharacter);
  const isProcessing = useChatStore((state) => state.isProcessing);
  const setProcessing = useChatStore((state) => state.setProcessing);
  const pushToast = useToastStore((state) => state.push);

  function handleSend() {
    const message = text.trim();
    if (!message || !currentCharacter || !socket || isProcessing) return;

    setProcessing(true);
    socket.sendMessage(message, currentCharacter.id);
    setText('');
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const buffer = await blob.arrayBuffer();
        socket?.sendAudio(buffer);
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    } catch {
      pushToast('マイクにアクセスできませんでした', 'error');
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
    setIsRecording(false);
  }

  function handleMicClick() {
    if (isRecording) {
      stopRecording();
    } else {
      void startRecording();
    }
  }

  return (
    <div className="input-panel">
      <button
        type="button"
        className={`input-panel-mic ${isRecording ? 'input-panel-mic--recording' : ''}`}
        onClick={handleMicClick}
        aria-pressed={isRecording}
        aria-label={isRecording ? '録音を停止' : '音声入力を開始'}
        title={isRecording ? '録音を停止' : '音声入力を開始'}
      >
        {isRecording ? '■' : '🎤'}
      </button>

      <textarea
        className="input-panel-textarea"
        placeholder="メッセージを入力..."
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        rows={1}
        disabled={isProcessing}
      />

      <button
        type="button"
        className="input-panel-send"
        onClick={handleSend}
        disabled={!text.trim() || isProcessing}
      >
        送信
      </button>
    </div>
  );
}
