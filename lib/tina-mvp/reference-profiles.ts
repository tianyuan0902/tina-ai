export type ReferenceProfile = {
  label: string;
  url?: string;
  evidence: string;
  inferredSignals: string[];
  cultureCode: string[];
  risksToVerify: string[];
};

export type ReferenceProfileInsight = {
  profiles: ReferenceProfile[];
  peopleDnaSignals: string[];
  cultureCodeSignals: string[];
  mustTranslateIntoCriteria: string[];
  falsePositiveRisks: string[];
  diagnosticQuestion: string;
  sourceNote: string;
};

type ReferenceProfileMessage = {
  role: string;
  content: string;
  referenceProfileInsight?: ReferenceProfileInsight;
};

const URL_PATTERN = /https?:\/\/[^\s)]+/gi;

export function isReferenceProfileRequest(message: string) {
  const text = message.toLowerCase();
  const hasProfileLanguage = /\b(linkedin|profile|profiles|people like|person like|like this|these people|candidate example|reference candidate|look for people like|folks like)\b/.test(text);
  const hasProfileUrl = /\bhttps?:\/\/\S*(linkedin\.com\/in|github\.com|twitter\.com|x\.com|about|people|team)\S*/i.test(message);
  const hasPastedProfileShape = /\b(experience|about|headline|current|former|education|skills|founder|engineer|product|sales|operator)\b/i.test(message) && message.length > 220;
  return hasProfileUrl || (hasProfileLanguage && hasPastedProfileShape);
}

export function collectLatestReferenceProfileInsight(messages: ReferenceProfileMessage[]) {
  return [...messages].reverse().find((message) => message.referenceProfileInsight)?.referenceProfileInsight;
}

export function buildReferenceProfileInsight(messages: ReferenceProfileMessage[]): ReferenceProfileInsight | undefined {
  const latestFounder = [...messages].reverse().find((message) => message.role === "founder" && isReferenceProfileRequest(message.content));
  if (!latestFounder) return collectLatestReferenceProfileInsight(messages);

  return buildReferenceProfileInsightFromText(latestFounder.content);
}

export function buildReferenceProfileInsightFromText(message: string): ReferenceProfileInsight {
  const urls = Array.from(new Set(message.match(URL_PATTERN) || [])).slice(0, 5);
  const profileBlocks = splitProfileBlocks(message, urls);
  const profiles = (profileBlocks.length ? profileBlocks : [message])
    .slice(0, Math.max(1, urls.length || 3))
    .map((block, index) => buildReferenceProfile(block, urls[index]))
    .filter((profile) => profile.evidence || profile.url);
  const allSignals = unique(profiles.flatMap((profile) => profile.inferredSignals)).slice(0, 6);
  const cultureSignals = unique(profiles.flatMap((profile) => profile.cultureCode)).slice(0, 5);
  const risks = unique(profiles.flatMap((profile) => profile.risksToVerify)).slice(0, 5);

  return {
    profiles,
    peopleDnaSignals: allSignals.length ? allSignals : ["pattern unclear from public profile alone"],
    cultureCodeSignals: cultureSignals.length ? cultureSignals : ["needs more profile text to infer operating style"],
    mustTranslateIntoCriteria: translateSignalsIntoCriteria(allSignals, cultureSignals),
    falsePositiveRisks: risks.length ? risks : ["pedigree without proof of the operating behavior the founder likes"],
    diagnosticQuestion: buildDiagnosticQuestion(allSignals, cultureSignals),
    sourceNote: urls.length && message.replace(URL_PATTERN, "").trim().length < 120
      ? "I can use the public URL as a breadcrumb, but LinkedIn pages are often private or thin. Paste the headline/About/Experience if you want a sharper read."
      : "I'm using the profile text and links the founder shared as reference signal, not as verified candidate evidence."
  };
}

export function formatReferenceProfileInsightForPrompt(insight?: ReferenceProfileInsight) {
  if (!insight) return "";
  return [
    "Reference profile / people DNA input:",
    `Source note: ${insight.sourceNote}`,
    insight.profiles.length
      ? `Profiles: ${insight.profiles.map((profile) => `${profile.label}${profile.url ? ` (${profile.url})` : ""}: ${profile.evidence}`).join(" | ")}`
      : "",
    `People DNA signals: ${insight.peopleDnaSignals.join(", ")}`,
    `Culture-code signals: ${insight.cultureCodeSignals.join(", ")}`,
    `Translate into criteria: ${insight.mustTranslateIntoCriteria.join(", ")}`,
    `False positives to avoid: ${insight.falsePositiveRisks.join(", ")}`,
    `Best diagnostic question: ${insight.diagnosticQuestion}`,
    "Use this to diagnose what the founder actually values. Do not treat shared profiles as automatically good candidates. Convert subjective admiration into observable hiring criteria."
  ].filter(Boolean).join("\n");
}

export function buildReferenceProfileResponse(insight: ReferenceProfileInsight) {
  const topDna = insight.peopleDnaSignals.slice(0, 3).join(", ");
  const topCulture = insight.cultureCodeSignals.slice(0, 2).join(", ");
  const criteria = insight.mustTranslateIntoCriteria.slice(0, 3);
  const risks = insight.falsePositiveRisks.slice(0, 2);

  return [
    "Yes - this is exactly the kind of signal Tina should use.",
    `The useful question is not "find clones of this person." It is what these profiles reveal about your company's people DNA: ${topDna}${topCulture ? `, with ${topCulture}` : ""}.`,
    criteria.length
      ? `I'd turn that into search criteria like: ${criteria.join("; ")}.`
      : "I'd turn the admired traits into proof signals before sourcing against them.",
    risks.length
      ? `The thing to avoid is ${risks.join(" and ")}.`
      : "",
    insight.sourceNote,
    insight.diagnosticQuestion
  ].filter(Boolean).join("\n\n");
}

function buildReferenceProfile(block: string, url?: string): ReferenceProfile {
  const clean = block.replace(URL_PATTERN, "").replace(/\s+/g, " ").trim();
  const label = inferProfileLabel(clean, url);
  const inferredSignals = inferPeopleDnaSignals(clean);
  const cultureCode = inferCultureCode(clean);
  const risksToVerify = inferRisks(clean, inferredSignals);

  return {
    label,
    ...(url ? { url } : {}),
    evidence: compact(clean || url || "Profile link shared.", 180),
    inferredSignals,
    cultureCode,
    risksToVerify
  };
}

function splitProfileBlocks(message: string, urls: string[]) {
  if (!urls.length) {
    return message
      .split(/\n{2,}|(?:^|\n)\s*(?:profile|person|candidate)\s+\d+[:.)-]/i)
      .map((part) => part.trim())
      .filter((part) => part.length > 80);
  }

  const parts: string[] = [];
  let remaining = message;
  for (const url of urls) {
    const index = remaining.indexOf(url);
    if (index === -1) continue;
    const before = remaining.slice(0, index).trim();
    if (before.length > 80) parts.push(before);
    remaining = remaining.slice(index + url.length);
  }
  if (remaining.trim().length > 80) parts.push(remaining.trim());
  return parts;
}

function inferProfileLabel(text: string, url?: string) {
  const titleMatch = text.match(/\b(Head of [A-Z][A-Za-z ]+|VP [A-Z][A-Za-z ]+|Director of [A-Z][A-Za-z ]+|Staff [A-Z][A-Za-z ]+|Senior [A-Z][A-Za-z ]+|Founding [A-Z][A-Za-z ]+|Product Manager|Engineering Manager|Founder|Operator|Recruiter|Designer|Engineer)\b/);
  if (titleMatch) return compact(titleMatch[0], 48);
  if (url?.includes("linkedin.com/in/")) {
    const slug = url.split("linkedin.com/in/")[1]?.split(/[/?#]/)[0] || "LinkedIn profile";
    return slug.split("-").filter(Boolean).slice(0, 3).map(capitalize).join(" ") || "LinkedIn profile";
  }
  if (url?.includes("github.com/")) {
    const slug = url.split("github.com/")[1]?.split(/[/?#]/)[0] || "GitHub profile";
    return `${slug} on GitHub`;
  }
  return "Reference profile";
}

function inferPeopleDnaSignals(text: string) {
  const lower = text.toLowerCase();
  const signals: string[] = [];
  addIf(signals, /\b(founder|founding|0[-\s]?1|zero[-\s]?to[-\s]?one|early)\b/.test(lower), "early-stage ownership");
  addIf(signals, /\b(shipped|built|launched|owned|delivered|production)\b/.test(lower), "shipping proof");
  addIf(signals, /\b(customer|user|implementation|post-sales|support|success)\b/.test(lower), "customer proximity");
  addIf(signals, /\b(infra|platform|systems|backend|architecture|distributed|ml|ai)\b/.test(lower), "technical depth");
  addIf(signals, /\b(product|pm|roadmap|discovery|activation|onboarding)\b/.test(lower), "product judgment");
  addIf(signals, /\b(sales|revenue|gtm|closing|pipeline|enterprise)\b/.test(lower), "commercial ownership");
  addIf(signals, /\b(ops|operator|operations|process|scale|implementation)\b/.test(lower), "operating cadence");
  addIf(signals, /\b(manager|managed|lead|leader|hired|team|people)\b/.test(lower), "people leadership");
  addIf(signals, /\b(crypto|web3|protocol|solidity|smart contract|fintech|healthcare|regulated)\b/.test(lower), "domain scar tissue");
  return signals.length ? signals : ["profile admiration needs translation"];
}

function inferCultureCode(text: string) {
  const lower = text.toLowerCase();
  const signals: string[] = [];
  addIf(signals, /\b(ambiguous|ambiguity|messy|scrappy|startup|fast|pace)\b/.test(lower), "works in messy founder context");
  addIf(signals, /\b(ownership|autonomy|independent|self-directed|directly owned)\b/.test(lower), "acts without constant founder routing");
  addIf(signals, /\b(cross-functional|eng|product|design|sales|support)\b/.test(lower), "bridges functions without theater");
  addIf(signals, /\b(quality|bar|taste|judgment|craft)\b/.test(lower), "raises the company bar");
  addIf(signals, /\b(trust|morale|culture|values)\b/.test(lower), "carries cultural trust");
  return signals;
}

function inferRisks(text: string, signals: string[]) {
  const lower = text.toLowerCase();
  const risks: string[] = [];
  addIf(risks, /\b(google|meta|amazon|microsoft|apple|stripe|airbnb)\b/.test(lower), "big-company pedigree without startup operating proof");
  addIf(risks, signals.includes("people leadership") && !/\b(shipped|built|launched|owned)\b/.test(lower), "management title without proof of real ownership");
  addIf(risks, signals.includes("technical depth") && !/\b(customer|product|user|revenue)\b/.test(lower), "technical depth without customer judgment");
  addIf(risks, signals.includes("product judgment") && !/\b(shipped|launched|owned|built)\b/.test(lower), "product language without shipping evidence");
  addIf(risks, signals.includes("early-stage ownership") && /\b(advisor|consultant|mentor)\b/.test(lower), "advisor energy without operating accountability");
  return risks;
}

function translateSignalsIntoCriteria(peopleDna: string[], cultureCode: string[]) {
  const criteria: string[] = [];
  addIf(criteria, peopleDna.includes("early-stage ownership"), "owned ambiguous work before the function was mature");
  addIf(criteria, peopleDna.includes("shipping proof"), "can point to shipped work, not just strategy");
  addIf(criteria, peopleDna.includes("customer proximity"), "has direct customer/user context");
  addIf(criteria, peopleDna.includes("technical depth"), "has enough craft depth to earn trust");
  addIf(criteria, peopleDna.includes("commercial ownership"), "has carried a measurable business number");
  addIf(criteria, cultureCode.includes("acts without constant founder routing"), "reduces founder dependency");
  addIf(criteria, cultureCode.includes("bridges functions without theater"), "creates clarity across functions without adding process theater");
  addIf(criteria, cultureCode.includes("raises the company bar"), "raises quality without slowing the team down");
  return unique(criteria).slice(0, 5);
}

function buildDiagnosticQuestion(peopleDna: string[], cultureCode: string[]) {
  if (cultureCode.includes("acts without constant founder routing")) {
    return "What did you like most about them: their judgment, their pace, their taste, or the way they made the founder less central?";
  }
  if (peopleDna.includes("shipping proof")) {
    return "What kind of proof matters most here: shipped product, customer outcomes, technical depth, or team leadership?";
  }
  if (peopleDna.includes("commercial ownership")) {
    return "Is the admired trait the selling motion, the customer judgment, or the ability to create repeatability from founder-led wins?";
  }
  return "What do these people do that feels hard to describe but clearly works inside your company?";
}

function addIf(list: string[], condition: boolean, value: string) {
  if (condition && !list.includes(value)) list.push(value);
}

function unique(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function compact(value: string, max: number) {
  const clean = value.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 3).trim()}...`;
}

function capitalize(value: string) {
  return value ? `${value[0].toUpperCase()}${value.slice(1)}` : value;
}
