"""Socket.IO event handlers — all real-time message passing lives here."""
import asyncio
import logging
import time
from datetime import datetime

from flask import request
from flask_socketio import emit, join_room

logger = logging.getLogger(__name__)


def register(socketio, ai_manager, tts_service, memory_manager, auth_manager):
    """Wire up all Socket.IO events against the given singletons."""

    @socketio.on("connect")
    def on_connect():
        token = request.args.get("token")
        if token:
            payload = auth_manager.verify_access(token)
            if payload:
                join_room(f"user_{payload['user_id']}")
                emit("connected", {"status": "ok", "authenticated": True, "user_id": payload["user_id"]})
                return
        emit("connected", {"status": "ok", "authenticated": False})

    @socketio.on("disconnect")
    def on_disconnect():
        pass  # handled by Socket.IO internally

    @socketio.on("send_message")
    def on_message(data):
        session_id = data.get("session_id", "default")
        message = (data.get("message") or "").strip()
        personality = data.get("personality") or "shiro"
        user_id = data.get("user_id")

        if not message:
            return
        if user_id:
            session_id = f"user_{user_id}"

        t0 = time.time()

        # Build prompt → call Gemini (blocking path; keep it simple)
        from backend.core.ai import _build_prompt, _safe_text, _primary, _fallback
        from backend.core import emotion as emo

        prompt = _build_prompt(personality, message)
        user_emotion = emo.analyze(message)

        try:
            resp = _primary.generate_content(prompt)
            text = _safe_text(resp) or ""
        except Exception as exc:
            logger.warning("Primary model error (%s), fallback", exc)
            try:
                resp = _fallback.generate_content(prompt)
                text = _safe_text(resp) or ""
            except Exception:
                text = ""

        if not text:
            text = "ごめん、ちょっとうまく声が出せないみたい。もう一回お願いしてもいい？"

        resp_emotion = emo.analyze(text)

        # TTS
        audio = None
        if tts_service:
            try:
                audio = tts_service.synthesize(text, character_id=personality)
            except Exception as exc:
                logger.error("TTS failed: %s", exc)

        # Persist
        try:
            memory_manager.save(session_id, "user", message, user_emotion)
            memory_manager.save(session_id, "assistant", text, resp_emotion)
        except Exception as exc:
            logger.error("Memory save failed: %s", exc)

        emit("message_response", {
            "text": text,
            "emotion": resp_emotion,
            "user_emotion": user_emotion,
            "audio_data": audio,
            "timestamp": datetime.utcnow().isoformat(),
            "personality": personality,
        })
        logger.info("[PERF] handle_message %.2fs", time.time() - t0)

    @socketio.on("send_audio")
    def on_audio(data):
        from backend.services import stt

        session_id = data.get("session_id", "default")
        audio_hex = data.get("audio_data", "")
        personality = data.get("personality", "shiro")

        if not audio_hex:
            return

        audio_bytes = bytes.fromhex(audio_hex)
        text = asyncio.run(stt.transcribe(audio_bytes))

        if not text:
            emit("error", {"message": "ごめんなさい、うまく聞き取れませんでした。"})
            return

        on_message({"session_id": session_id, "message": text, "personality": personality})
