import { useChatStore } from '@/store/chatStore';
import '@/styles/tokens.css';
import './speech-bubble.css';

/** Floating dialogue bubble showing the character's current line. */
export function SpeechBubble() {
  const bubbleText = useChatStore((state) => state.bubbleText);

  if (!bubbleText) return null;

  return (
    <div className="speech-bubble" role="status" aria-live="polite">
      <p>{bubbleText}</p>
    </div>
  );
}
