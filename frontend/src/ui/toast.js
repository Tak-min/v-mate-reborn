/** Lightweight toast notifications. */

function show(message, color, duration = 3000) {
  const el = document.createElement('div');
  el.textContent = message;
  el.style.cssText = `position:fixed;top:20px;right:20px;background:${color};color:#fff;padding:12px 18px;border-radius:6px;z-index:10000;box-shadow:0 2px 10px rgba(0,0,0,.2);font-size:14px;`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), duration);
}

export const toast = {
  success: (msg) => show(msg, '#4CAF50'),
  error:   (msg) => show(msg, '#e53935'),
  info:    (msg) => show(msg, '#1976D2'),
};
