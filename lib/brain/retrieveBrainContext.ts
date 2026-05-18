import { readFileSync } from "node:fs";
import path from "node:path";

export type RetrievedBrainChunk = {
  id: string;
  file: string;
  content: string;
  score: number;
};

const BRAIN_FILES = [
  "hiring_principles.md",
  "talent_archetypes.md",
  "sourcing_failure_modes.md",
  "founder_patterns.md",
  "examples_good_bad.md"
];

const IMPORTANT_TERMS = new Set([
  "ai",
  "ambiguity",
  "archetype",
  "backend",
  "candidate",
  "contract",
  "corporate",
  "crypto",
  "defi",
  "engineer",
  "faang",
  "founder",
  "gtm",
  "hire",
  "hiring",
  "infra",
  "ownership",
  "pedigree",
  "product",
  "protocol",
  "recruiting",
  "security",
  "solidity",
  "sourcing",
  "startup",
  "smart",
  "smartcontract",
  "technical",
  "web3"
]);

export function retrieveBrainContext(latestUserMessage: string, maxChunks = 4) {
  const queryTerms = tokenize(latestUserMessage);
  const chunks = BRAIN_FILES.flatMap(readBrainChunks);
  const scored = chunks
    .filter((chunk) => !normalize(chunk.content).startsWith("bad"))
    .map((chunk) => ({
      ...chunk,
      score: scoreChunk(chunk.content, queryTerms)
    }))
    .filter((chunk) => chunk.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxChunks);

  const selected = scored.length ? scored : chunks.slice(0, 2);

  return {
    chunks: selected,
    context: selected.map((chunk) => `Source: ${chunk.file}\n${chunk.content}`).join("\n\n---\n\n")
  };
}

function readBrainChunks(file: string): RetrievedBrainChunk[] {
  const content = readFileSync(path.join(process.cwd(), "lib", "brain", file), "utf8").trim();
  return content
    .split(/\n\s*\n/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk, index) => ({
      id: `${file}:${index + 1}`,
      file,
      content: chunk,
      score: 0
    }));
}

function scoreChunk(content: string, queryTerms: string[]) {
  const normalized = normalize(content);
  const chunkTerms = tokenize(content);
  let score = 0;

  for (const term of queryTerms) {
    if (normalized.includes(term)) score += IMPORTANT_TERMS.has(term) ? 3 : 1;
  }

  if (queryTerms.includes("smart") && queryTerms.includes("contract") && normalized.includes("smart contract")) {
    score += 8;
  }

  if (queryTerms.includes("smartcontract") && normalized.includes("smart contract")) {
    score += 8;
  }

  if (queryTerms.includes("corporate") && normalized.includes("too corporate")) {
    score += 6;
  }

  if (queryTerms.includes("faang") && normalized.includes("faang")) {
    score += 6;
  }

  if (normalized.startsWith("good")) {
    score += 4;
  }

  if (normalized.startsWith("bad")) {
    score -= 10;
  }

  return score + sharedTermCount(queryTerms, chunkTerms);
}

function sharedTermCount(a: string[], b: string[]) {
  const bTerms = new Set(b);
  return a.filter((term) => bTerms.has(term)).length;
}

function tokenize(value: string) {
  return normalize(value)
    .split(" ")
    .filter((term) => term.length > 2);
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .replace(/\bsmartcontract\b/g, "smartcontract smart contract")
    .replace(/[-_/]/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
