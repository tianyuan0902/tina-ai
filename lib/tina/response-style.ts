const bannedPhrases = [
  "That is useful calibration",
  "I would connect it back",
  "The more important signal is",
  "translate it into a profile",
  "before we translate",
  "operating style",
  "market reality for this direction",
  "Good correction",
  "I would tie it to the business need",
  "The better move is",
  "market snapshot for this direction",
  "calibration risks to test"
];

const replacements: Record<string, string> = {
  "That is useful calibration": "Got it",
  "I would connect it back": "I would tie it",
  "The more important signal is": "A stronger signal is",
  "translate it into a profile": "turn it into search criteria",
  "before we translate": "before we lock it",
  "operating style": "how they work",
  "market reality for this direction": "market read",
  "Good correction": "Got it",
  "I would tie it to the business need": "I would anchor it in the business need",
  "The better move is": "I would",
  "market snapshot for this direction": "market read",
  "calibration risks to test": "things to test"
};

export function applyTinaResponseStyle(raw: string, options: { maxSentences?: number } = {}) {
  let styled = raw.trim();

  for (const phrase of bannedPhrases) {
    styled = styled.replaceAll(phrase, replacements[phrase]);
  }

  styled = styled
    .replace(/\bRecommendation:\s*/gi, "")
    .replace(/\bIt is recommended that\b/gi, "I would")
    .replace(/\bAdditionally,\s*/gi, "")
    .replace(/\butilize\b/gi, "use")
    .replace(/\bleverage\b/gi, "use")
    .replace(/\bcandidate sourcing criteria\b/gi, "search criteria")
    .replace(/\bTina Brain\b/g, "I")
    .replace(/\bthe hiring manager sees\b/gi, "you see")
    .replace(/\s{2,}/g, " ");

  const sentences = styled
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  const maxSentences = options.maxSentences ?? 2;
  const questionIndex = sentences.findIndex((sentence) => sentence.endsWith("?"));
  const selected =
    questionIndex >= 0
      ? [...sentences.slice(0, Math.min(maxSentences - 1, questionIndex)), sentences[questionIndex]]
      : sentences.slice(0, maxSentences);

  return Array.from(new Set(selected)).join(" ");
}
