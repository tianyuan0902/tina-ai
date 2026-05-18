import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

export type RetrievedBrainChunk = {
  id: string;
  file: string;
  content: string;
  score: number;
};

const KNOWLEDGE_BASE_DIR = path.join(process.cwd(), "knowledge_base");
const MIN_RELEVANCE_SCORE = 8;

const IMPORTANT_TERMS = new Set([
  "ai",
  "adaptability",
  "ambiguity",
  "archetype",
  "autonomy",
  "backend",
  "candidate",
  "chaos",
  "clarity",
  "compatibility",
  "contract",
  "corporate",
  "crypto",
  "decision",
  "differentiated",
  "defi",
  "emotional",
  "engineer",
  "environment",
  "faang",
  "fail",
  "failed",
  "failure",
  "founder",
  "founding",
  "gtm",
  "hire",
  "hiring",
  "infra",
  "interview",
  "interviewer",
  "judgment",
  "learning",
  "matching",
  "ownership",
  "operator",
  "pedigree",
  "pm",
  "product",
  "protocol",
  "recruiting",
  "roadmap",
  "security",
  "senior",
  "signal",
  "signals",
  "solidity",
  "sourcing",
  "startup",
  "stress",
  "smart",
  "smartcontract",
  "taste",
  "technical",
  "trust",
  "web3"
]);

const DOMAIN_GUARDS = [
  {
    name: "smart-contract",
    query: /\b(smartcontract|smart contract|solidity|web3|crypto|defi|onchain|on-chain|protocol)\b/i,
    chunk: /\b(smartcontract|smart contract|solidity|web3|crypto|defi|onchain|on-chain|protocol)\b/i
  },
  {
    name: "ai-product",
    query: /\b(ai|llm|model|prompt|eval|workflow|agent)\b/i,
    chunk: /\b(ai|llm|model|prompt|eval|workflow|agent)\b/i
  },
  {
    name: "product",
    query: /\b(pm|product manager|roadmap|customer|customers|discovery|product)\b/i,
    chunk: /\b(pm|product manager|roadmap|customer|customers|discovery|product)\b/i
  },
  {
    name: "backend",
    query: /\b(backend|systems|infrastructure|infra|architecture|reliability)\b/i,
    chunk: /\b(backend|systems|infrastructure|infra|architecture|reliability)\b/i
  },
  {
    name: "operator",
    query: /\b(operator|operations|chaos|process|cross-functional|execution)\b/i,
    chunk: /\b(operator|operations|chaos|process|cross-functional|execution)\b/i
  }
];

export function retrieveBrainContext(latestUserMessage: string, maxChunks = 4) {
  const queryTerms = tokenize(latestUserMessage);
  const chunks = getKnowledgeBaseFiles().flatMap(readBrainChunks);
  const scored = chunks
    .filter((chunk) => !normalize(chunk.content).startsWith("bad"))
    .map((chunk) => ({
      ...chunk,
      score: scoreChunk(chunk.content, latestUserMessage, queryTerms)
    }))
    .filter((chunk) => chunk.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxChunks);
  const topScore = scored[0]?.score ?? 0;
  const selected =
    topScore >= MIN_RELEVANCE_SCORE
      ? scored.filter((chunk) => chunk.score >= Math.max(MIN_RELEVANCE_SCORE, topScore * 0.7))
      : [];

  return {
    chunks: selected,
    context: selected.map((chunk) => `Source: ${chunk.file}\n${chunk.content}`).join("\n\n---\n\n")
  };
}

function getKnowledgeBaseFiles() {
  return walkMarkdownFiles(KNOWLEDGE_BASE_DIR).sort();
}

function walkMarkdownFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const fullPath = path.join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) return walkMarkdownFiles(fullPath);
    if (stat.isFile() && entry.endsWith(".md")) return [fullPath];

    return [];
  });
}

function readBrainChunks(filePath: string): RetrievedBrainChunk[] {
  const content = readFileSync(filePath, "utf8").trim();
  const file = path.relative(KNOWLEDGE_BASE_DIR, filePath);
  const shouldKeepWholeFile = file.startsWith("live_qa/") || file.startsWith("examples/");
  const chunks = shouldKeepWholeFile ? [content] : splitIntoChunks(content);

  return chunks
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .filter((chunk) => !/^#+\s.+$/.test(chunk))
    .map((chunk, index) => ({
      id: `${file}:${index + 1}`,
      file,
      content: chunk,
      score: 0
    }));
}

function splitIntoChunks(content: string) {
  return content.split(/\n\s*\n(?=#+\s|Question:|Tina Answer:|Key Pattern:|Why It Matters:|- |\w)/);
}

function scoreChunk(content: string, query: string, queryTerms: string[]) {
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

  if (/\b(startup|hire|hires|hiring)\b/i.test(query) && /\b(fail|fails|failed|failure|amazing)\b/i.test(query) &&
      /\b(high pressure emotional system|incompatibility in motion|calibration failures|not competency)\b/i.test(content)) {
    score += 10;
  }

  if (/\b(ai|technical|skills|execution)\b/i.test(query) && /\b(less differentiated|differentiated|differentiation|levels)\b/i.test(query) &&
      /\b(judgment|taste|adaptability|context synthesis|emotional regulation)\b/i.test(content)) {
    score += 10;
  }

  if (/\b(felt off|something off|interviewed perfectly)\b/i.test(query) &&
      /\b(inconsistency|underneath the words|compressed pattern recognition|confidence.*judgment)\b/i.test(content)) {
    score += 8;
  }

  if (normalized.startsWith("good")) {
    score += 4;
  }

  if (normalized.startsWith("bad")) {
    score -= 10;
  }

  score += sharedTermCount(queryTerms, chunkTerms);

  if (hasConflictingDomain(query, content)) {
    score -= 18;
  }

  score += exclusiveDomainAdjustment(query, content);

  return score;
}

function exclusiveDomainAdjustment(query: string, content: string) {
  let adjustment = 0;

  if (/\b(smartcontract|smart contract|solidity|web3|crypto|defi|onchain|on-chain|protocol)\b/i.test(content) &&
      !/\b(smartcontract|smart contract|solidity|web3|crypto|defi|onchain|on-chain|protocol)\b/i.test(query)) {
    adjustment -= 24;
  }

  if (/\b(ai|llm|prompt|eval|model behavior|agent)\b/i.test(content) &&
      !/\b(ai|llm|prompt|eval|model|agent)\b/i.test(query)) {
    adjustment -= 14;
  }

  if (/\b(backend|systems|infrastructure|architecture)\b/i.test(content) &&
      !/\b(backend|systems|infrastructure|infra|architecture|reliability)\b/i.test(query)) {
    adjustment -= 10;
  }

  return adjustment;
}

function hasConflictingDomain(query: string, content: string) {
  const queryDomains = DOMAIN_GUARDS.filter((domain) => domain.query.test(query)).map((domain) => domain.name);
  const chunkDomains = DOMAIN_GUARDS.filter((domain) => domain.chunk.test(content)).map((domain) => domain.name);

  if (!queryDomains.length || !chunkDomains.length) return false;
  if (chunkDomains.some((domain) => queryDomains.includes(domain))) return false;

  return chunkDomains.some((domain) => !queryDomains.includes(domain));
}

function sharedTermCount(a: string[], b: string[]) {
  const bTerms = new Set(b);
  return a.filter((term) => IMPORTANT_TERMS.has(term) && bTerms.has(term)).length;
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
