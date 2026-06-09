"""AI conversation manager — Gemini streaming with TTS queue."""
import asyncio
import logging
import time
from typing import Optional

import google.generativeai as genai

from backend import config
from backend.core import emotion as emo
from backend.core.memory import MemoryManager
from backend.core.text_splitter import TextSplitter

logger = logging.getLogger(__name__)

genai.configure(api_key=config.GEMINI_API_KEY)

_primary = genai.GenerativeModel(config.GEMINI_PRIMARY_MODEL)
_fallback = genai.GenerativeModel(config.GEMINI_FALLBACK_MODEL)


def _build_prompt(personality: str, user_input: str) -> str:
    template = config.CHARACTER_PROMPTS.get(personality, config.SHIRO_PROMPT)
    return f"{template}\n\nUser: {user_input}\nShiro:"


class AIConversationManager:
    def __init__(self, memory: MemoryManager):
        self.memory = memory
        self.splitter = TextSplitter()

    async def stream_response(
        self,
        session_id: str,
        user_input: str,
        personality: str = "shiro",
        on_chunk,  # async callable(text, chunk_idx, emotion)
    ) -> str:
        """Stream Gemini response; call on_chunk for each text chunk. Returns full text."""
        user_emotion = emo.analyze(user_input)
        prompt = _build_prompt(personality, user_input)

        full_text = ""
        chunk_idx = 0

        try:
            stream = await asyncio.get_event_loop().run_in_executor(
                None, lambda: _primary.generate_content(prompt, stream=True)
            )
        except Exception as exc:
            if "429" in str(exc) or "quota" in str(exc).lower():
                await asyncio.sleep(5)
            logger.warning("Primary model failed (%s), trying fallback", exc)
            stream = await asyncio.get_event_loop().run_in_executor(
                None, lambda: _fallback.generate_content(prompt, stream=True)
            )

        for raw_chunk in stream:
            text = _safe_text(raw_chunk)
            if not text:
                continue
            full_text += text
            for part in self.splitter.split(text):
                if part.strip():
                    chunk_idx += 1
                    chunk_emotion = emo.analyze(part)
                    await on_chunk(part, chunk_idx, chunk_emotion)
                    await asyncio.sleep(0)

        asyncio.create_task(self._persist(session_id, user_input, full_text, user_emotion))
        return full_text

    async def generate(self, session_id: str, user_input: str, personality: str = "shiro") -> dict:
        """Non-streaming fallback: generate full response synchronously."""
        user_emotion = emo.analyze(user_input)
        prompt = _build_prompt(personality, user_input)
        try:
            resp = await asyncio.get_event_loop().run_in_executor(
                None, lambda: _primary.generate_content(prompt)
            )
            text = _safe_text(resp) or ""
        except Exception as exc:
            logger.warning("Primary model error: %s", exc)
            resp = await asyncio.get_event_loop().run_in_executor(
                None, lambda: _fallback.generate_content(prompt)
            )
            text = _safe_text(resp) or ""

        if not text:
            text = "ごめん、ちょっとうまく声が出せないみたい。もう一回お願いしてもいい？"

        resp_emotion = emo.analyze(text)
        asyncio.create_task(self._persist(session_id, user_input, text, user_emotion))
        return {"text": text, "emotion": resp_emotion, "user_emotion": user_emotion}

    async def _persist(
        self, session_id: str, user_input: str, response: str, user_emotion: str
    ) -> None:
        self.memory.save(session_id, "user", user_input, user_emotion)
        self.memory.save(session_id, "assistant", response, emo.analyze(response))


def _safe_text(response) -> Optional[str]:
    try:
        t = response.text
        return t if t and t.strip() else None
    except (ValueError, AttributeError):
        return None
