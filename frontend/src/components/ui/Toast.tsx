import { useToastStore } from '@/store/toastStore';
import '@/styles/tokens.css';
import './toast.css';

/** Stack of dismissible notification toasts, anchored to the bottom-right of the viewport. */
export function ToastStack() {
  const toasts = useToastStore((state) => state.toasts);
  const dismiss = useToastStore((state) => state.dismiss);

  if (toasts.length === 0) return null;

  return (
    <div className="toast-stack" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <button
          key={toast.id}
          type="button"
          className={`toast toast--${toast.variant}`}
          onClick={() => dismiss(toast.id)}
        >
          {toast.message}
        </button>
      ))}
    </div>
  );
}
