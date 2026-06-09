"""Single source of truth for emotion analysis."""

_POSITIVE = {"嬉しい", "楽しい", "幸せ", "好き", "ありがとう", "素晴らしい", "わくわく"}
_NEGATIVE = {"悲しい", "辛い", "嫌い", "疲れた", "困った", "不安"}
_SURPRISED = {"驚いた", "びっくり", "すごい", "信じられない"}

Emotion = str  # "neutral" | "happy" | "sad" | "surprised"


def analyze(text: str) -> Emotion:
    """Keyword-based emotion detection. Returns one of neutral/happy/sad/surprised."""
    if any(w in text for w in _SURPRISED):
        return "surprised"
    if any(w in text for w in _POSITIVE):
        return "happy"
    if any(w in text for w in _NEGATIVE):
        return "sad"
    return "neutral"
