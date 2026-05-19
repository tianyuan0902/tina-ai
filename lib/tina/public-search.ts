import type { ProfileLead } from "@/lib/tina/profile-lead-types";
import { buildPublicTalentSearchQueries } from "@/lib/tina/search-query-builder";

type TavilyLikeResult = {
  title?: string;
  url?: string;
  content?: string;
  snippet?: string;
};

const DEFAULT_PROFILE_BATCH_SIZE = 3;
const MAX_PROFILE_BATCH_SIZE = 5;

export async function searchPublicProfileLeads(hiringContext: string, requestedCount = DEFAULT_PROFILE_BATCH_SIZE): Promise<ProfileLead[]> {
  const queries = buildPublicTalentSearchQueries(hiringContext);
  const batchSize = clampProfileBatchSize(requestedCount);
  const results = process.env.TAVILY_API_KEY
    ? await searchWithTavily(queries)
    : mockPublicSearchResults(queries, hiringContext);
  const relevantResults = filterRelevantResults(results, hiringContext);

  return dedupeLeads(
    relevantResults
      .filter((result) => result.url && result.title)
      .slice(0, batchSize)
      .map((result, index) => mapToProfileLead(result, queries[index % queries.length], hiringContext, index))
  );
}

async function searchWithTavily(queries: string[]) {
  const settled = await Promise.allSettled(
    queries.map((query) => fetchTavilySearch(query))
  );

  return dedupeResults(
    settled.flatMap((result) => {
      if (result.status === "rejected") {
        console.error("[Tina public search] Tavily search failed:", result.reason);
        return [];
      }

      return (result.value.results || []).map((item: TavilyLikeResult) => ({
        title: item.title,
        url: item.url,
        content: item.content || item.snippet
      }));
    })
  );
}

async function fetchTavilySearch(query: string) {
  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      api_key: process.env.TAVILY_API_KEY,
      query,
      max_results: 4,
      search_depth: "basic",
      include_answer: false,
      include_raw_content: false
    }),
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Tavily search failed with status ${response.status}`);
  }

  return (await response.json()) as { results?: TavilyLikeResult[] };
}

function mapToProfileLead(result: TavilyLikeResult, query: string, hiringContext: string, index: number): ProfileLead {
  const snippet = cleanSnippet(result.content || result.snippet || "");
  const title = cleanTitle(result.title || "Public profile lead");

  return {
    id: `lead-${hash(`${query}-${result.url || title}-${index}`)}`,
    title,
    snippet,
    url: result.url || "",
    source: inferSource(result.url || ""),
    query,
    fitReason: buildFitReason(hiringContext, snippet),
    confidence: confidenceForIndex(index),
    tags: buildTags(hiringContext, snippet),
    saved: false
  };
}

function mockPublicSearchResults(queries: string[], hiringContext: string): TavilyLikeResult[] {
  const isAI = /\b(ai|llm|model|agent|machine learning|ml)\b/i.test(hiringContext);
  const isOperator = /\b(operator|ops|operations|chief of staff)\b/i.test(hiringContext);

  if (isOperator) {
    return [
      {
        title: "Maya Rao - Startup Operator, Founder Office",
        url: "https://www.linkedin.com/in/maya-rao-operator",
        content: `Mock result for ${queries[0]}. Founder office and business operations background across seed to Series B teams.`
      },
      {
        title: "Alex Morgan - Chief of Staff / BizOps",
        url: "https://www.linkedin.com/in/alex-morgan-bizops",
        content: `Mock result for ${queries[1]}. Startup operator turning ambiguous founder priorities into operating cadence.`
      }
    ];
  }

  if (isAI) {
    return [
      {
        title: "Daniel Kim - AI Product Engineer at Scale AI",
        url: "https://www.linkedin.com/in/daniel-kim-ai-product",
        content: `Mock result for ${queries[0]}. AI product engineer with applied LLM workflow, eval, and customer-facing product experience.`
      },
      {
        title: "Maya Chen - Applied AI Engineer",
        url: "https://github.com/mayachen-ai",
        content: `Mock result for ${queries[3]}. Public repos show LLM applications, evaluation harnesses, and product prototypes.`
      },
      {
        title: "Sofia Martinez - AI Full Stack Builder",
        url: "https://sofia-martinez.dev",
        content: `Mock result for ${queries[4]}. Personal site describes AI-native product builds and fast customer iteration.`
      }
    ];
  }

  return [
    {
      title: "Leah Chen - Founding Engineer",
      url: "https://www.linkedin.com/in/leah-chen-founding-engineer",
      content: `Mock result for ${queries[0]}. Founding engineer background with product judgment and early-stage ownership.`
    },
    {
      title: "Ethan Park - Product-Minded Builder",
      url: "https://github.com/ethanpark",
      content: `Mock result for ${queries[3]}. Public projects suggest product taste and startup-oriented building.`
    }
  ];
}

function inferSource(url: string): ProfileLead["source"] {
  if (url.includes("linkedin.com/in")) return "linkedin";
  if (url.includes("github.com")) return "github";
  if (url.startsWith("https://")) return "personal_site";

  return "other";
}

export function getRequestedProfileCount(message: string) {
  const numericMatch = message.match(/\b([1-9]|10)\b(?=\s*(more\s+)?(profiles?|people|leads?|candidates?|targets?))/i);
  const wordMatch = message.match(/\b(one|two|three|four|five)\b(?=\s*(more\s+)?(profiles?|people|leads?|candidates?|targets?))/i);
  const wordCounts: Record<string, number> = {
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5
  };

  if (numericMatch) return clampProfileBatchSize(Number(numericMatch[1]));
  if (wordMatch) return clampProfileBatchSize(wordCounts[wordMatch[1].toLowerCase()]);

  return DEFAULT_PROFILE_BATCH_SIZE;
}

function clampProfileBatchSize(count: number) {
  if (!Number.isFinite(count)) return DEFAULT_PROFILE_BATCH_SIZE;
  return Math.max(1, Math.min(MAX_PROFILE_BATCH_SIZE, Math.floor(count)));
}

function confidenceForIndex(index: number): ProfileLead["confidence"] {
  if (index === 0) return "high";
  if (index === 1) return "medium";
  return "low";
}

function buildFitReason(hiringContext: string, snippet: string) {
  if (/\b(product manager|head of product|pm|customer)\b/i.test(hiringContext)) {
    return "Possible fit because the public result suggests product ownership or customer proximity.";
  }

  if (/\b(ai|llm|model|agent|machine learning|ml)\b/i.test(hiringContext)) {
    return "Possible fit because the public result overlaps with applied AI, product, or startup-building language.";
  }

  if (/\b(operator|ops|operations|chief of staff)\b/i.test(hiringContext)) {
    return "Possible fit because the public result points toward founder-adjacent operating work.";
  }

  if (snippet.toLowerCase().includes("founding")) return "Founding-stage language suggests early ambiguity and ownership may be present.";

  return "Possible fit based on public language, but needs manual review.";
}

function buildTags(hiringContext: string, snippet: string) {
  const text = `${hiringContext} ${snippet}`.toLowerCase();
  const tags = [];

  if (/\b(ai|llm|machine learning|ml|agent)\b/.test(text)) tags.push("AI");
  if (/\b(product|customer|workflow)\b/.test(text)) tags.push("product");
  if (/\b(startup|founding|early)\b/.test(text)) tags.push("startup");
  if (/\b(eval|quality|reliability)\b/.test(text)) tags.push("quality");
  if (/\b(operator|ops|operations)\b/.test(text)) tags.push("operator");

  return tags.slice(0, 4);
}

function dedupeResults(results: TavilyLikeResult[]) {
  const seen = new Set<string>();

  return results.filter((result) => {
    if (!result.url || seen.has(result.url)) return false;
    seen.add(result.url);
    return true;
  });
}

function dedupeLeads(leads: ProfileLead[]) {
  const seen = new Set<string>();

  return leads.filter((lead) => {
    const key = lead.url || lead.id;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function filterRelevantResults(results: TavilyLikeResult[], hiringContext: string) {
  const target = inferTargetLane(hiringContext);
  const scored = results
    .map((result) => ({ result, score: scoreResult(result, target) }))
    .sort((a, b) => b.score - a.score);
  const filtered = scored.filter((item) => item.score > 0).map((item) => item.result);

  return filtered.length ? filtered : results;
}

function inferTargetLane(hiringContext: string) {
  const text = hiringContext.toLowerCase();

  if (/\b(operator|ops|operations|chief of staff|founder office)\b/.test(text)) return "operator";
  if (/\b(gtm|sales|account executive|ae|growth|revenue)\b/.test(text)) return "gtm";
  if (/\b(pm|product manager|head of product|product lead)\b/.test(text)) return "product";
  if (/\b(design|designer)\b/.test(text)) return "design";
  if (/\b(ai|llm|machine learning|ml|model|agent)\b/.test(text)) return "ai";
  if (/\b(backend|infra|systems|platform)\b/.test(text)) return "backend";

  return "general";
}

function scoreResult(result: TavilyLikeResult, target: string) {
  const text = `${result.title || ""} ${result.content || ""} ${result.snippet || ""} ${result.url || ""}`.toLowerCase();

  const laneScores: Record<string, RegExp[]> = {
    ai: [/\b(ai|llm|machine learning|ml|model|agent|applied ai)\b/, /\b(product engineer|founding engineer|software engineer)\b/],
    backend: [/\b(backend|infrastructure|distributed systems|platform|systems engineer)\b/],
    product: [/\b(product manager|head of product|product lead|pm)\b/, /\b(customer|roadmap|product strategy)\b/],
    operator: [/\b(operator|operations|chief of staff|founder office|bizops|business operations)\b/],
    design: [/\b(product designer|founding designer|design lead|ux|ui)\b/],
    gtm: [/\b(gtm|sales|account executive|revenue|growth|go-to-market)\b/],
    general: [/\b(startup|founding|early stage|builder|operator)\b/]
  };

  const laneScore = (laneScores[target] || laneScores.general).reduce((score, pattern) => score + (pattern.test(text) ? 1 : 0), 0);
  const sourceBoost = laneScore > 0 && (result.url?.includes("linkedin.com/in") || result.url?.includes("github.com")) ? 0.25 : 0;

  return laneScore + sourceBoost;
}

function cleanTitle(value: string) {
  return cleanWhitespace(decodeEntities(value)).slice(0, 110);
}

function cleanSnippet(value: string) {
  const decoded = decodeEntities(value)
    .replace(/\(https?:\/\/[^)]+\)/g, "")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/\bN\/A\s+connections,?\s*/gi, "")
    .replace(/\bAbout\s+N\/A\b/gi, "")
    .replace(/\bN\/A\s+-\s+Present\s+N\/A\b/gi, "")
    .replace(/\bEducation\s+N\/A\b/gi, "")
    .replace(/\b\d+\s+connections\b/gi, "")
    .replace(/\b\d+\s+followers\b/gi, "");

  return truncate(cleanWhitespace(decoded), 190);
}

function cleanWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function decodeEntities(value: string) {
  return value
    .replace(/&#x2019;/g, "'")
    .replace(/&#x2018;/g, "'")
    .replace(/&#x201C;/g, '"')
    .replace(/&#x201D;/g, '"')
    .replace(/&#x2013;/g, "-")
    .replace(/&#x2014;/g, "-")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, " ");
}

function truncate(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength).replace(/\s+\S*$/, "")}...`;
}

function hash(value: string) {
  let hashValue = 0;
  for (let index = 0; index < value.length; index += 1) {
    hashValue = (hashValue * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hashValue.toString(36);
}
