"""AssemblyAI speech-to-text service."""
import asyncio
import logging
from typing import Optional

import aiohttp
from aiohttp import TCPConnector

from backend import config

logger = logging.getLogger(__name__)

_UPLOAD_URL = "https://api.assemblyai.com/v2/upload"
_TRANSCRIPT_URL = "https://api.assemblyai.com/v2/transcript"


async def transcribe(audio_bytes: bytes) -> Optional[str]:
    """Upload audio and poll for Japanese transcript. Returns text or None."""
    if not config.ASSEMBLYAI_API_KEY:
        logger.warning("ASSEMBLYAI_API_KEY not configured")
        return None

    headers = {"authorization": config.ASSEMBLYAI_API_KEY}
    connector = TCPConnector(ssl=False)

    try:
        async with aiohttp.ClientSession(connector=connector) as session:
            async with session.post(_UPLOAD_URL, headers=headers, data=audio_bytes) as resp:
                if resp.status != 200:
                    logger.error("Upload failed: %d", resp.status)
                    return None
                audio_url = (await resp.json())["upload_url"]

            async with session.post(
                _TRANSCRIPT_URL,
                headers=headers,
                json={"audio_url": audio_url, "language_code": "ja"},
            ) as resp:
                if resp.status != 200:
                    logger.error("Transcript request failed: %d", resp.status)
                    return None
                transcript_id = (await resp.json())["id"]

            poll_url = f"{_TRANSCRIPT_URL}/{transcript_id}"
            while True:
                async with session.get(poll_url, headers=headers) as resp:
                    if resp.status != 200:
                        logger.error("Polling failed: %d", resp.status)
                        return None
                    data = await resp.json()
                    if data["status"] == "completed":
                        return data["text"]
                    if data["status"] == "error":
                        logger.error("Transcription error: %s", data.get("error"))
                        return None
                await asyncio.sleep(3)
    except Exception as exc:
        logger.error("STT error: %s", exc)
        return None
