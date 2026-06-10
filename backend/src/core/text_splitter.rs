/// Splits AI-generated text into chunks suitable for incremental TTS
/// synthesis: prefer whole sentences, but break overly long sentences at
/// natural "breath" points (commas) so audio doesn't lag too far behind text.
const SENTENCE_ENDINGS: &[char] = &['。', '！', '？', '\n'];
const BREATH_POINTS: &[char] = &['、', ','];
const MAX_CHUNK_CHARS: usize = 60;

pub fn split(text: &str) -> Vec<String> {
    let sentences = split_keep_delimiters(text, SENTENCE_ENDINGS);

    sentences
        .into_iter()
        .flat_map(|sentence| {
            if sentence.chars().count() > MAX_CHUNK_CHARS {
                split_keep_delimiters(&sentence, BREATH_POINTS)
            } else {
                vec![sentence]
            }
        })
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .collect()
}

/// Splits `text` on any of `delimiters`, keeping the delimiter attached to
/// the preceding chunk.
fn split_keep_delimiters(text: &str, delimiters: &[char]) -> Vec<String> {
    let mut chunks = Vec::new();
    let mut current = String::new();

    for ch in text.chars() {
        current.push(ch);
        if delimiters.contains(&ch) {
            chunks.push(std::mem::take(&mut current));
        }
    }
    if !current.is_empty() {
        chunks.push(current);
    }

    chunks
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn splits_on_sentence_endings() {
        assert_eq!(split("こんにちは。元気ですか？"), vec!["こんにちは。", "元気ですか？"]);
    }

    #[test]
    fn splits_long_sentences_on_breath_points() {
        let long = "あ".repeat(70) + "、" + &"い".repeat(10) + "。";
        let result = split(&long);
        assert!(result.len() >= 2);
    }
}
