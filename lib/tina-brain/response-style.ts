const MAX_SENTENCES = 4;

export function shortTinaReply(sentences: string[]) {
  return sentences
    .map((sentence) => sentence.trim())
    .filter(Boolean)
    .slice(0, MAX_SENTENCES)
    .join(" ");
}

export function operatorTinaReply({
  conclusion,
  bullets,
  next,
  confidence
}: {
  conclusion: string;
  bullets?: string[];
  next?: string;
  confidence?: "Low" | "Medium" | "High";
}) {
  const lines = [`Read: ${conclusion}`];

  if (bullets?.length) {
    lines.push(...bullets.slice(0, 4).map((bullet) => `- ${bullet}`));
  }

  if (next) lines.push(`Next: ${next}`);
  if (confidence) lines.push(`Confidence: ${confidence}`);

  return lines.join("\n");
}

export function conversationalTinaReply(parts: string[]) {
  return parts
    .map((part) => part.trim())
    .filter(Boolean)
    .join("\n\n");
}
