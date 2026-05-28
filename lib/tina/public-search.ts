import type { ProfileLead, SourcingBatchMetadata } from "@/lib/tina/profile-lead-types";
import { buildPublicTalentSearchQueries, type PublicTalentSearchRefinement } from "@/lib/tina/search-query-builder";

type TavilyLikeResult = {
  title?: string;
  url?: string;
  content?: string;
  snippet?: string;
  query?: string;
};

const DEFAULT_PROFILE_BATCH_SIZE = 10;
const MAX_PROFILE_BATCH_SIZE = 10;

export type PublicProfileSearchOptions = {
  excludedUrls?: string[];
  refinement?: PublicTalentSearchRefinement;
};

export type PublicProfileSearchBatch = {
  profileLeads: ProfileLead[];
  metadata: SourcingBatchMetadata;
};

export async function searchPublicProfileLeads(
  hiringContext: string,
  requestedCount = DEFAULT_PROFILE_BATCH_SIZE,
  options: PublicProfileSearchOptions = {}
): Promise<ProfileLead[]> {
  return (await searchPublicProfileBatch(hiringContext, requestedCount, options)).profileLeads;
}

export async function searchPublicProfileBatch(
  hiringContext: string,
  requestedCount = DEFAULT_PROFILE_BATCH_SIZE,
  options: PublicProfileSearchOptions = {}
): Promise<PublicProfileSearchBatch> {
  const queries = buildPublicTalentSearchQueries(hiringContext, options.refinement);
  const batchSize = clampProfileBatchSize(requestedCount);
  const excludedUrls = new Set((options.excludedUrls || []).map(normalizeUrl).filter(Boolean));
  const requestedFunction = classifyRequestedRoleFunction(hiringContext);
  const results = process.env.TAVILY_API_KEY
    ? await searchWithTavily(queries)
    : mockPublicSearchResults(queries, hiringContext);
  const relevantResults = filterRelevantResults(results, hiringContext);
  const candidateLeads = dedupeResults(relevantResults.filter(isProfileLikeResult))
      .filter((result) => !excludedUrls.has(normalizeUrl(result.url || "")))
      .filter((result) => result.url && result.title)
      .slice(0, Math.max(batchSize * 3, 12))
      .map((result, index) => {
        const lead = mapToProfileLead(result, result.query || queries[index % queries.length], hiringContext, index);
        return {
          ...lead,
          validation: validateProfileLead(lead, requestedFunction)
        };
      });
  const validLeads = dedupeLeads(candidateLeads)
    .filter((lead) => lead.confidence !== "low")
    .filter((lead) => lead.validation?.roleFunctionMatch || lead.validation?.evidenceStrength === "strong")
    .slice(0, batchSize);
  const filtered = candidateLeads.filter((lead) => !validLeads.some((validLead) => validLead.id === lead.id));
  const filteredReasons = topValues(filtered.map((lead) => lead.validation?.filteredReason || "weak public evidence")).slice(0, 4);

  return {
    profileLeads: validLeads,
    metadata: {
      requestedCount: batchSize,
      returnedCount: validLeads.length,
      validCount: validLeads.length,
      filteredCount: filtered.length,
      filteredReasons
    }
  };
}

async function searchWithTavily(queries: string[]) {
  const settled = await Promise.allSettled(
    queries.map((query) => fetchTavilySearch(query))
  );

  return dedupeResults(
    settled.flatMap((result, index) => {
      if (result.status === "rejected") {
        console.error("[Tina public search] Tavily search failed:", result.reason);
        return [];
      }

      return (result.value.results || []).map((item: TavilyLikeResult) => ({
        title: item.title,
        url: item.url,
        content: item.content || item.snippet,
        query: queries[index]
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
    saved: false,
    calibration: buildCalibration(result, hiringContext, snippet, title)
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
  const numericMatch = message.match(/\b([1-9]|10)\b(?:\s+\w+){0,4}\s+(profiles?|people|leads?|candidates?|targets?)\b/i);
  const wordMatch = message.match(/\b(one|two|three|four|five)\b(?:\s+\w+){0,4}\s+(profiles?|people|leads?|candidates?|targets?)\b/i);
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
  if (index <= 2) return "medium";
  return "low";
}

function buildCalibration(result: TavilyLikeResult, hiringContext: string, snippet: string, title: string): NonNullable<ProfileLead["calibration"]> {
  const text = `${title} ${snippet}`.toLowerCase();
  const target = inferTargetLane(hiringContext);

  return {
    scope: scopeForTarget(target),
    roleTitle: inferRoleTitle(title),
    location: inferLocation(`${result.content || ""} ${result.snippet || ""}`),
    yearsExperience: inferYearsExperience(text, target),
    mustHaves: mustHavesForTarget(target),
    niceToHaves: niceToHavesForTarget(target),
    compRange: compRangeForTarget(target, hiringContext)
  };
}

function scopeForTarget(target: string) {
  const scopes: Record<string, string> = {
    ai: "Applied AI/product engineering in a startup environment",
    backend: "Backend/platform ownership with startup pace",
    product: "Product judgment, customer signal, and founder-context translation",
    operator: "Founder-adjacent operating leverage across messy priorities",
    design: "Product design under ambiguity with close engineering proximity",
    gtm: "Early GTM motion, customer learning, and revenue ownership",
    web3: "Solidity and smart contract delivery with recent mainnet or DeFi proof",
    general: "Broad startup ownership where the exact lane is still forming"
  };

  return scopes[target] || scopes.general;
}

function inferRoleTitle(title: string) {
  const cleaned = title
    .replace(/\s*-\s*LinkedIn\s*$/i, "")
    .replace(/\s*\|\s*LinkedIn\s*$/i, "")
    .trim();

  return cleaned || "Public profile lead";
}

function inferLocation(text: string) {
  const locations = [
    "San Francisco",
    "New York",
    "Seattle",
    "Austin",
    "Boston",
    "Los Angeles",
    "London",
    "Toronto",
    "Remote",
    "United States"
  ];
  const found = locations.find((location) => new RegExp(`\\b${location}\\b`, "i").test(text));

  return found || "Not clear from public snippet";
}

function inferYearsExperience(text: string, target: string) {
  const explicit = text.match(/\b([3-9]|1[0-9]|2[0-5])\+?\s*(yoe|years|yrs)\b/i);
  if (explicit) return `${explicit[1]}+ years`;
  if (/\b(founder|head of|staff|principal|director|vp|cto)\b/.test(text)) return "8+ years likely";
  if (/\b(senior|lead)\b/.test(text)) return "5-8 years likely";

  return target === "operator" ? "4-8 years likely" : "3-7 years likely";
}

function mustHavesForTarget(target: string) {
  const map: Record<string, string[]> = {
    ai: ["Shipped AI features", "Product judgment", "Reliability instincts"],
    backend: ["Systems ownership", "Production reliability", "Startup execution pace"],
    product: ["Customer signal", "Prioritization judgment", "Founder-context fluency"],
    operator: ["High trust", "Ambiguity tolerance", "Closes loops without process weight"],
    design: ["Product taste", "Customer empathy", "Engineering proximity"],
    gtm: ["Customer learning", "Founder-led selling comfort", "Pipeline ownership"],
    web3: ["Solidity depth", "Recent mainnet or DeFi work", "Security instincts"],
    general: ["High agency", "Ownership density", "Ambiguity tolerance"]
  };

  return map[target] || map.general;
}

function niceToHavesForTarget(target: string) {
  const map: Record<string, string[]> = {
    ai: ["Eval experience", "Customer-facing AI", "Startup or founding work"],
    backend: ["AI-adjacent systems", "Infra scaling", "Security judgment"],
    product: ["AI/product exposure", "Zero-to-one launches", "Technical fluency"],
    operator: ["Founder office", "BizOps", "Technical product context"],
    design: ["Design systems", "AI tool experience", "0-to-1 product work"],
    gtm: ["Fintech or AI market", "Outbound motion", "Founder network"],
    web3: ["Audit exposure", "Protocol engineering", "End-to-end delivery"],
    general: ["Domain familiarity", "Early-stage references", "Low-ego range"]
  };

  return map[target] || map.general;
}

function compRangeForTarget(target: string, hiringContext: string) {
  if (/\b(sf|san francisco|bay area|new york|nyc)\b/i.test(hiringContext)) {
    const highCost: Record<string, string> = {
      ai: "$180k-$300k base + equity",
      backend: "$170k-$260k base + equity",
      product: "$160k-$250k base + equity",
      operator: "$140k-$230k base + equity",
      design: "$150k-$230k base + equity",
      gtm: "$140k-$220k base + variable/equity",
      web3: "$180k-$300k base + equity/token upside",
      general: "$140k-$230k base + equity"
    };

    return highCost[target] || highCost.general;
  }

  const ranges: Record<string, string> = {
    ai: "$150k-$260k base + equity",
    backend: "$140k-$230k base + equity",
    product: "$140k-$230k base + equity",
    operator: "$120k-$200k base + equity",
    design: "$130k-$210k base + equity",
    gtm: "$120k-$200k base + variable/equity",
    web3: "$160k-$280k base + equity/token upside",
    general: "$120k-$210k base + equity"
  };

  return ranges[target] || ranges.general;
}

type RoleFunction = "engineering" | "product" | "design" | "gtm" | "operations" | "recruiting" | "people" | "finance" | "other";

function classifyRequestedRoleFunction(hiringContext: string): RoleFunction {
  const text = hiringContext.toLowerCase();

  if (/\b(account executive|ae|sales|gtm|growth|revenue|business development|bd)\b/.test(text)) return "gtm";
  if (/\b(recruiter|sourcer|talent acquisition|recruiting)\b/.test(text)) return "recruiting";
  if (/\b(people|hr|human resources|people ops|head of people)\b/.test(text)) return "people";
  if (/\b(finance|controller|fp&a|cfo|accounting)\b/.test(text)) return "finance";
  if (/\b(designer|design|ux|ui)\b/.test(text)) return "design";
  if (/\b(pm|product manager|founding pm|head of product|product lead|product operator)\b/.test(text)) return "product";
  if (/\b(chief of staff|founder office|operator|operations|bizops|business operations)\b/.test(text)) return "operations";
  if (/\b(engineer|developer|software|full-stack|full stack|backend|frontend|ml engineer|ai engineer|product engineer|founding engineer|solidity|smart contract|technical founder|github|built|shipped)\b/.test(text)) return "engineering";

  return "other";
}

function validateProfileLead(lead: ProfileLead, requestedFunction: RoleFunction): NonNullable<ProfileLead["validation"]> {
  const text = `${lead.title} ${lead.snippet} ${lead.fitReason} ${lead.tags.join(" ")} ${lead.url}`.toLowerCase();
  const evidenceStrength = classifyEvidenceStrength(text, lead);
  const actualFunction = classifyCandidateFunction(text);
  const roleFunctionMatch =
    requestedFunction === "other" ||
    actualFunction === requestedFunction ||
    (requestedFunction === "engineering" && hasClearEngineeringEvidence(text));

  if (roleFunctionMatch) {
    return { roleFunctionMatch, evidenceStrength };
  }

  return {
    roleFunctionMatch,
    evidenceStrength,
    filteredReason: filteredReasonFor(requestedFunction, actualFunction, evidenceStrength)
  };
}

function classifyCandidateFunction(text: string): RoleFunction {
  if (/\b(account executive|sales|gtm|revenue|business development|growth)\b/.test(text)) return "gtm";
  if (/\b(recruiter|sourcer|talent acquisition|recruiting)\b/.test(text)) return "recruiting";
  if (/\b(people ops|head of people|hr|human resources)\b/.test(text)) return "people";
  if (/\b(finance|controller|accounting|fp&a|cfo)\b/.test(text)) return "finance";
  if (/\b(product designer|designer|design lead|ux|ui)\b/.test(text)) return "design";
  if (/\b(product manager|founding pm|head of product|product lead|pm\b|product operator)\b/.test(text)) return "product";
  if (/\b(chief of staff|founder office|startup operator|business operations|bizops|operator)\b/.test(text)) return "operations";
  if (hasClearEngineeringEvidence(text)) return "engineering";

  return "other";
}

function hasClearEngineeringEvidence(text: string) {
  return /\b(engineer|developer|software|full-stack|full stack|backend|frontend|ml engineer|ai engineer|product engineer|founding engineer|solidity|smart contract|github|repo|code|coded|built|shipped|technical founder|architecture|infrastructure)\b/.test(text);
}

function classifyEvidenceStrength(text: string, lead: ProfileLead): "strong" | "medium" | "weak" {
  const strongSignals = /\b(shipped|built|launched|owned|github|repo|mainnet|production|founding engineer|product manager|head of product|engineer)\b/.test(text);
  const mediumSignals = /\b(product|customer|startup|founding|workflow|ai|ml|operator|design|sales)\b/.test(text);

  if (lead.confidence === "high" && strongSignals) return "strong";
  if (strongSignals || (lead.confidence !== "low" && mediumSignals)) return "medium";
  return "weak";
}

function filteredReasonFor(requestedFunction: RoleFunction, actualFunction: RoleFunction, evidenceStrength: "strong" | "medium" | "weak") {
  if (actualFunction !== "other") return `${actualFunction} profile, not ${requestedFunction}`;
  if (evidenceStrength === "weak") return "weak public evidence";
  return `unclear ${requestedFunction} evidence`;
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

  if (/\b(solidity|smart contract|smartcontract|web3|defi|protocol|mainnet)\b/i.test(hiringContext)) {
    return "Possible fit because the public result overlaps with Solidity, smart contract, DeFi, or protocol engineering language.";
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
  if (/\b(solidity|smart contract|smartcontract|web3|defi|protocol|mainnet)\b/.test(text)) tags.push("web3");

  return tags.slice(0, 4);
}

function dedupeResults(results: TavilyLikeResult[]) {
  const seen = new Set<string>();

  return results.filter((result) => {
    const key = normalizeUrl(result.url || "");
    if (!key || seen.has(key)) return false;
    seen.add(key);
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

function topValues(values: string[]) {
  const counts = values.filter(Boolean).reduce<Record<string, number>>((acc, value) => {
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});

  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([value]) => value);
}

function isProfileLikeResult(result: TavilyLikeResult) {
  const url = result.url || "";
  if (url.includes("linkedin.com/in/")) return true;

  if (url.includes("github.com/")) {
    try {
      const parsed = new URL(url);
      const parts = parsed.pathname.split("/").filter(Boolean);
      return parts.length === 1;
    } catch {
      return false;
    }
  }

  return false;
}

function normalizeUrl(url: string) {
  return url.trim().replace(/\/+$/, "").toLowerCase();
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
  const explicitProductRole = /\b(pm|product manager|founding pm|head of product|product lead)\b/.test(text);
  const explicitEngineeringRole = /\b(engineer|developer|solidity|smartcontract|smart contract engineer|protocol engineer|code|coding)\b/.test(text);

  if (/\b(operator|ops|operations|chief of staff|founder office)\b/.test(text)) return "operator";
  if (/\b(gtm|sales|account executive|ae|growth|revenue)\b/.test(text)) return "gtm";
  if (explicitProductRole) return "product";
  if (explicitEngineeringRole && /\b(solidity|smart contract|smartcontract|web3|defi|protocol|mainnet)\b/.test(text)) return "web3";
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
    web3: [/\b(solidity|smart contract|smartcontract|web3|defi|protocol|mainnet|ethereum)\b/, /\b(engineer|developer|security|audit)\b/],
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
