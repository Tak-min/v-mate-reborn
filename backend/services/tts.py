"""ElevenLabs TTS service."""
import hashlib
import logging
import time
from pathlib import Path
from typing import Optional

import requests

from backend import config

logger = logging.getLogger(__name__)


class TTSService:
    """Converts text to speech via ElevenLabs and stores MP3 files on disk."""

    _BASE = "https://api.elevenlabs.io/v1"

    def __init__(self):
        if not config.ELEVENLABS_API_KEY:
            raise ValueError("ELEVENLABS_API_KEY is required")
        self._headers = {
            "Accept": "audio/mpeg",
            "Content-Type": "application/json",
            "xi-api-key": config.ELEVENLABS_API_KEY,
        }

    def voice_id_for(self, character_id: str) -> str:
        return config.VOICE_IDS.get(character_id, config.VOICE_IDS.get("default", ""))

    def synthesize(
        self,
        text: str,
        character_id: str = "shiro",
        voice_id: Optional[str] = None,
        stability: float = 0.5,
        similarity_boost: float = 0.75,
    ) -> Optional[str]:
        """Generate audio. Returns relative URL like '/audio/abc.mp3', or None on error."""
        if not text or not text.strip():
            return None

        vid = voice_id or self.voice_id_for(character_id)
        if not vid:
            logger.warning("No voice_id configured for character '%s'", character_id)
            return None

        text_hash = hashlib.md5(text.encode()).hexdigest()
        filename = f"{text_hash}_{int(time.time())}.mp3"
        file_path = config.AUDIO_DIR / filename

        payload = {
            "text": text,
            "model_id": config.ELEVENLABS_MODEL,
            "voice_settings": {
                "stability": stability,
                "similarity_boost": similarity_boost,
                "style": 0.0,
                "use_speaker_boost": True,
            },
        }

        try:
            resp = requests.post(
                f"{self._BASE}/text-to-speech/{vid}",
                json=payload,
                headers=self._headers,
                timeout=30,
            )
            resp.raise_for_status()
            file_path.write_bytes(resp.content)
            logger.info("TTS OK: %s (%d bytes)", filename, len(resp.content))
            return f"/audio/{filename}"
        except requests.exceptions.Timeout:
            logger.error("ElevenLabs request timed out")
        except requests.exceptions.HTTPError as exc:
            logger.error("ElevenLabs HTTP %s: %s", exc.response.status_code, exc)
        except Exception as exc:
            logger.error("TTS error: %s", exc)
        return None

    def cleanup_old(self, max_age_hours: int = 24) -> None:
        cutoff = time.time() - max_age_hours * 3600
        deleted = 0
        for f in config.AUDIO_DIR.glob("*.mp3"):
            if f.stat().st_mtime < cutoff:
                f.unlink()
                deleted += 1
        if deleted:
            logger.info("Cleaned up %d old audio files", deleted)

    def available_voices(self) -> dict[str, str]:
        return {
            "default":      "Rachel (Default)",
            "shiro":        "Rachel (Shiro)",
            "yui_natural":  "Bella (Yui)",
            "rei_engineer": "Antoni (Rei)",
        }


# Module-level singleton
_instance: Optional[TTSService] = None


def get_tts(force_reinit: bool = False) -> TTSService:
    global _instance
    if _instance is None or force_reinit:
        _instance = TTSService()
    return _instance
