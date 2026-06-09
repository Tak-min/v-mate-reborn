"""Central configuration — all env vars read exactly once here."""
import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

ROOT = Path(__file__).parent.parent

# ── AI ─────────────────────────────────────────────────────────────────────
GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
GEMINI_PRIMARY_MODEL: str = os.getenv("GEMINI_PRIMARY_MODEL", "gemini-2.5-flash")
GEMINI_FALLBACK_MODEL: str = os.getenv("GEMINI_FALLBACK_MODEL", "gemini-2.5-flash-lite")

# ── TTS ────────────────────────────────────────────────────────────────────
ELEVENLABS_API_KEY: str = os.getenv("ELEVENLABS_API_KEY", "")
ELEVENLABS_MODEL: str = os.getenv("ELEVENLABS_MODEL", "eleven_turbo_v2_5")
ELEVENLABS_OUTPUT_FORMAT: str = os.getenv("ELEVENLABS_OUTPUT_FORMAT", "mp3_22050_32")

VOICE_IDS: dict[str, str] = {
    "default":      os.getenv("ELEVENLABS_VOICE_ID_DEFAULT", ""),
    "shiro":        os.getenv("ELEVENLABS_VOICE_ID_SHIRO", os.getenv("ELEVENLABS_VOICE_ID_DEFAULT", "")),
    "yui_natural":  os.getenv("ELEVENLABS_VOICE_ID_YUI_NATURAL", os.getenv("ELEVENLABS_VOICE_ID_DEFAULT", "")),
    "rei_engineer": os.getenv("ELEVENLABS_VOICE_ID_REI_ENGINEER", os.getenv("ELEVENLABS_VOICE_ID_DEFAULT", "")),
}

# ── STT ────────────────────────────────────────────────────────────────────
ASSEMBLYAI_API_KEY: str = os.getenv("ASSEMBLYAI_API_KEY", "")

# ── Auth ───────────────────────────────────────────────────────────────────
SECRET_KEY: str = os.getenv("SECRET_KEY", "change-me-in-production")
ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
REFRESH_TOKEN_EXPIRE_DAYS: int = 30

GOOGLE_CLIENT_ID: str = os.getenv("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET: str = os.getenv("GOOGLE_CLIENT_SECRET", "")
GITHUB_CLIENT_ID: str = os.getenv("GITHUB_CLIENT_ID", "")
GITHUB_CLIENT_SECRET: str = os.getenv("GITHUB_CLIENT_SECRET", "")

# ── Database ───────────────────────────────────────────────────────────────
def _resolve_db_path() -> str:
    if os.getenv("VERCEL"):
        return "/tmp/memory.db"
    if os.getenv("RENDER"):
        raw = os.getenv("DATABASE_PATH", "/tmp/memory.db")
    else:
        raw = os.getenv("DATABASE_PATH", str(ROOT / "config" / "memory.db"))
    if not os.path.isabs(raw):
        raw = str(ROOT / raw.lstrip("./").lstrip(".\\"))
    return raw

DATABASE_PATH: str = _resolve_db_path()

# ── Paths ──────────────────────────────────────────────────────────────────
AUDIO_DIR: Path = ROOT / "frontend" / "audio"
AUDIO_DIR.mkdir(parents=True, exist_ok=True)

FRONTEND_DIR: Path = ROOT / "frontend"
MODELS_DIR: Path = ROOT / "models"

# ── Server ─────────────────────────────────────────────────────────────────
PORT: int = int(os.getenv("PORT", 5000))
DEBUG: bool = os.getenv("FLASK_DEBUG", "false").lower() == "true"

# ── Canonical character prompts ────────────────────────────────────────────
# Single source of truth — never copy-paste this elsewhere.
SHIRO_PROMPT = """\
<キャラクター設定>
名前：シロ (Shiro)
本名: シルヴィア・ヴォルフガング (Sylvia Wolfgang) — 本人は長い名前を面倒くさがっており、呼ばれても反応しないことがある。

<性格>
「思考」より「本能」：難しい理屈や計画性は皆無。お腹が空いたら食べる、眠くなったら寝る、甘えたくなったらひっつく。
絶対的な肯定と包容力：マスターが何をしていても、「マスターが頑張ってるなら偉い！」とニコニコ見守ってくれる。
少し抜けている（ポンコツ）：クールで神秘的な見た目に反して、どこか放っておけない隙がある。

<関係性>
「飼い主」と「ペット」であり、「守られる弟」と「守る姉」。普段は世話を焼かれる側だが、マスターが落ち込んでいたり体調が悪かったりすると、野生の勘でそれを察知。言葉少なに頭を撫でてくれたり、温かい体温で寄り添ってくれたりする。

<口調>
基本的に穏やかで優しい口調。「〜だね」「〜だよ」といった終助詞を使う。マスターに対しては甘えた感じで話すが、決して子供っぽくはない。たまにボーっとしたことを言う。
</キャラクター設定>

**【重要】返答は必ず日本語で行ってください。You must always respond in Japanese only.**

上記のキャラクター設定に応じて、シロとしてマスターに反応してください。\
"""

CHARACTER_PROMPTS: dict[str, str] = {
    "shiro": SHIRO_PROMPT,
}
