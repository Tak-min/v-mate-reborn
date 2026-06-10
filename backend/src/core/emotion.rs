use serde::Serialize;

/// Emotional tone inferred from a piece of generated text, used to drive
/// the VRM's facial expression and reaction animation.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Emotion {
    Neutral,
    Happy,
    Sad,
    Surprised,
    Angry,
}

impl Emotion {
    pub fn as_str(&self) -> &'static str {
        match self {
            Emotion::Neutral => "neutral",
            Emotion::Happy => "happy",
            Emotion::Sad => "sad",
            Emotion::Surprised => "surprised",
            Emotion::Angry => "angry",
        }
    }
}

const HAPPY: &[&str] = &["嬉しい", "楽しい", "幸せ", "うれしい", "たのしい", "好き", "ありがとう", "笑", "わーい", "やった"];
const SAD: &[&str] = &["悲しい", "辛い", "つらい", "寂しい", "さみしい", "泣", "残念", "ごめん"];
const SURPRISED: &[&str] = &["驚", "えっ", "まさか", "本当に", "ほんとに", "すごい", "びっくり"];
const ANGRY: &[&str] = &["怒", "イライラ", "ムカ", "許せない", "腹立"];

/// Lightweight keyword-based sentiment analysis tuned for short Japanese
/// chat responses. Counts keyword hits per category and returns the
/// strongest signal, defaulting to `Neutral`.
pub fn analyze(text: &str) -> Emotion {
    let counts = [
        (Emotion::Happy, count_hits(text, HAPPY)),
        (Emotion::Sad, count_hits(text, SAD)),
        (Emotion::Surprised, count_hits(text, SURPRISED)),
        (Emotion::Angry, count_hits(text, ANGRY)),
    ];

    counts
        .into_iter()
        .filter(|(_, c)| *c > 0)
        .max_by_key(|(_, c)| *c)
        .map(|(emotion, _)| emotion)
        .unwrap_or(Emotion::Neutral)
}

fn count_hits(text: &str, keywords: &[&str]) -> usize {
    keywords.iter().filter(|kw| text.contains(*kw)).count()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detects_happy() {
        assert_eq!(analyze("今日はとても嬉しいことがあったよ！"), Emotion::Happy);
    }

    #[test]
    fn defaults_to_neutral() {
        assert_eq!(analyze("今日の天気は晴れです。"), Emotion::Neutral);
    }
}
