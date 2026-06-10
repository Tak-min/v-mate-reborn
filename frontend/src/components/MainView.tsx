import { useEffect, useRef } from 'react';
import { apiFetch } from '@/api/http';
import { VMateSocket, type MessageChunk } from '@/ws/client';
import { useSocketStore } from '@/store/socketStore';
import { useChatStore, type Character } from '@/store/chatStore';
import { useCharacterStore } from '@/store/characterStore';
import { useToastStore } from '@/store/toastStore';
import { useAudioPlayer } from '@/hooks/useAudioPlayer';
import { Scene } from './scene/Scene';
import { Sidebar } from './ui/Sidebar';
import { SpeechBubble } from './ui/SpeechBubble';
import { InputPanel } from './ui/InputPanel';
import { ToastStack } from './ui/Toast';
import './main-view.css';

const BUBBLE_HOLD_MS = 4000;

/** Authenticated main screen: connects the chat socket, loads characters, and renders the 3D UI. */
export function MainView() {
  const audioPlayer = useAudioPlayer();
  const audioPlayerRef = useRef(audioPlayer);
  audioPlayerRef.current = audioPlayer;

  useEffect(() => {
    const { setCharacters, setCurrentCharacter, setProcessing, showBubble, hideBubble, setEmotion } =
      useChatStore.getState();

    let bubbleTimeout: ReturnType<typeof setTimeout> | undefined;

    const socket = new VMateSocket({
      onMessageChunk: (chunk: MessageChunk) => {
        showBubble(chunk.text);
        setEmotion(chunk.emotion);
        if (chunk.audio_data) audioPlayerRef.current.enqueue(chunk.audio_data);
        if (chunk.emotion === 'happy') {
          useCharacterStore.getState().controller?.playAnimation('liked');
        }
      },
      onStreamingComplete: () => {
        setProcessing(false);
        clearTimeout(bubbleTimeout);
        bubbleTimeout = setTimeout(hideBubble, BUBBLE_HOLD_MS);
      },
      onTranscript: (text) => {
        const character = useChatStore.getState().currentCharacter;
        if (!character) return;
        setProcessing(true);
        socket.sendMessage(text, character.id);
      },
      onError: (message) => {
        useToastStore.getState().push(message, 'error');
        setProcessing(false);
      },
    });

    socket.connect();
    useSocketStore.getState().setSocket(socket);

    apiFetch<{ characters: Character[] }>('/api/characters')
      .then(({ characters }) => {
        setCharacters(characters);
        if (characters.length > 0) setCurrentCharacter(characters[0]);
      })
      .catch(() => useToastStore.getState().push('キャラクターの読み込みに失敗しました', 'error'));

    return () => {
      clearTimeout(bubbleTimeout);
      socket.close();
      useSocketStore.getState().setSocket(null);
    };
  }, []);

  return (
    <div className="main-view">
      <Scene />
      <Sidebar />
      <SpeechBubble />
      <InputPanel />
      <ToastStack />
    </div>
  );
}
