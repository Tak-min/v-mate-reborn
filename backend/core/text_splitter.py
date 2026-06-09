"""Splits AI response text into streaming-friendly chunks."""

_SENTENCE_END = frozenset("。！？.!?")
_BREATH = frozenset("、,…")


class TextSplitter:
    def __init__(self, chunk_size: int = 50):
        self.chunk_size = chunk_size

    def split(self, text: str) -> list[str]:
        if not text:
            return []
        sentences = self._by_sentences(text)
        chunks: list[str] = []
        buf = ""
        for sentence in sentences:
            if len(sentence) > self.chunk_size:
                sub = self._by_breath(sentence)
                for s in sub:
                    if buf and len(buf + s) > self.chunk_size:
                        if buf.strip():
                            chunks.append(buf.strip())
                        buf = s
                    else:
                        buf += s
            else:
                if buf and len(buf + sentence) > self.chunk_size:
                    if buf.strip():
                        chunks.append(buf.strip())
                    buf = sentence
                else:
                    buf += sentence
        if buf.strip():
            chunks.append(buf.strip())
        return chunks

    def _by_sentences(self, text: str) -> list[str]:
        result, cur = [], ""
        for ch in text:
            cur += ch
            if ch in _SENTENCE_END:
                result.append(cur)
                cur = ""
        if cur:
            result.append(cur)
        return result

    def _by_breath(self, text: str) -> list[str]:
        result, cur = [], ""
        for ch in text:
            cur += ch
            if ch in _BREATH or len(cur) >= self.chunk_size:
                if cur.strip():
                    result.append(cur)
                cur = ""
        if cur:
            result.append(cur)
        return result
