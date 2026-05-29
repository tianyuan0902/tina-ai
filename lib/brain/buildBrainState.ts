import type { BrainState, BrainSourceLaneStatus } from "./types";
import type { ProfileLead } from "../tina/profile-lead-types";
import type { SourcingReadiness } from "../tina/sourcing-readiness";
import type { TinaMvpMessage } from "../tina-mvp/types";

export type BrainLeadFeedback = {
  action?: "saved" | "rejected";
  preference?: "more_like_this" | "less_like_this";
};

export type BrainLeadWithFeedback = {
  lead: ProfileLead;
  status?: BrainLeadFeedback;
};

export type BuildBrainStateInput = {
  messages: TinaMvpMessage[];
  sourcingReadiness: SourcingReadiness;
  profileLeads?: ProfileLead[];
  feedback?: BrainLeadWithFeedback[];
  roleThesis?: string;
  seekSignals?: string[];
  avoidSignals?: string[];
  likelyTitles?: string[];
  sourceLaneHints?: string[];
};

const EMPTY_READ = "No signal yet. Tell Tina who you need.";

export function buildBrainState(input: BuildBrainStateInput): BrainState {
  const founderText = input.messages
    .filter((message) => message.role === "founder")
    .map((message) => message.content)
    .join(" ")
    .toLowerCase();
  const allText = input.messages.map((message) => message.content).join(" ").toLowerCase();
  const hasFounderSignal = /\w/.test(founderText);
  const leads = input.profileLeads || [];
  const feedback = input.feedback || [];
  const positiveFeedback = feedback.filter((item) => item.status?.action === "saved" || item.status?.preference === "more_like_this");
  const negativeFeedback = feedback.filter((item) => item.status?.action === "rejected" || item.status?.preference === "less_like_this");
  const missingSignals = normalizeMissingSignals(input.sourcingReadiness.missingSignals, founderText);
  const sourcingReadiness = mapReadiness(input.sourcingReadiness.readinessStatus);
  const seekSignals = deriveSeekSignals(founderText, input.seekSignals || [], positiveFeedback).slice(0, 3);
  const avoidSignals = deriveAvoidSignals(founderText, input.avoidSignals || [], negativeFeedback, missingSignals).slice(0, 3);
  const likelyTitles = deriveLikelyTitles(founderText, input.likelyTitles || []).slice(0, 4);
  const roleThesis = hasFounderSignal ? deriveRoleThesis(founderText, input.roleThesis || input.sourcingReadiness.searchThesis) : "";
  const searchShape = deriveSearchShape(founderText);
  const readinessScore = hasFounderSignal ? adjustedReadinessScore(input.sourcingReadiness.readinessScore, searchShape) : 0;
  const batchQualityScore = scoreBatchQuality(leads);
  const noveltyScore = scoreNovelty(leads);
  const confidenceScore = scoreLeadConfidence(leads);

  return {
    roleThesis,
    readinessScore,
    batchQualityScore,
    noveltyScore,
    confidenceScore,
    searchShape,
    seekSignals,
    avoidSignals,
    likelyTitles,
    sourceLanes: deriveSourceLanes({ text: allText, hints: input.sourceLaneHints || [], leads, likelyTitles, searchShape, hasFounderSignal }),
    missingSignals: hasFounderSignal ? missingSignals : [],
    calibrationQuestions: hasFounderSignal ? input.sourcingReadiness.followUpQuestions.slice(0, 2) : [],
    sourcingReadiness: hasFounderSignal ? sourcingReadiness : "not_ready",
    tinaRead: buildTinaRead({ hasFounderSignal, sourcingReadiness, missingSignals, roleThesis, leads, batchQualityScore, confidenceScore })
  };
}

function mapReadiness(status: SourcingReadiness["readinessStatus"]): BrainState["sourcingReadiness"] {
  if (status === "ready_to_source") return "ready";
  if (status === "low_confidence_search") return "calibration_batch";
  return "not_ready";
}

function adjustedReadinessScore(score: number, searchShape: BrainState["searchShape"]) {
  const missingShapeFields = Object.values(searchShape).filter((value) => value === 0).length;
  const cappedScore = missingShapeFields >= 3 ? Math.min(score, 78) : missingShapeFields >= 2 ? Math.min(score, 86) : score;

  return clampPercent(cappedScore);
}

function deriveRoleThesis(text: string, fallback: string) {
  if (/\b(founder|bottleneck|dependent|less dependent|pulling.*decision|every decision)\b/.test(text) && /\b(pm|product)\b/.test(text)) {
    return "Founding product hire who reduces founder dependency by turning messy context into clear decisions.";
  }

  return fallback || "Role thesis still forming.";
}

function deriveSeekSignals(text: string, seedSignals: string[], positiveFeedback: BrainLeadWithFeedback[]) {
  const signals = new Set<string>();
  const addIf = (condition: boolean, value: string) => {
    if (condition) signals.add(value);
  };

  addIf(/\b(shipped|launched|built|production|customer-facing|workflow)\b/.test(text) && /\b(ai|llm|agent|model)\b/.test(text), "shipped customer-facing AI");
  addIf(/\b(product|pm|customer|discovery|roadmap|taste)\b/.test(text), "product judgment");
  addIf(/\b(startup|founding|0 to 1|zero-to-one|pace|fast|ship)\b/.test(text), "startup pace");
  addIf(/\b(founder|dependent|bottleneck|make a call|keep.*moving)\b/.test(text), "independent judgment");
  addIf(/\b(solidity|smart contract|web3|defi|mainnet|protocol)\b/.test(text), "recent web3 shipping proof");

  evidenceSupported(seedSignals, text).forEach((signal) => signals.add(signal));
  positiveFeedback.flatMap((item) => feedbackSignalText(item.lead)).forEach((signal) => signals.add(signal));

  return Array.from(signals);
}

function deriveAvoidSignals(text: string, seedSignals: string[], negativeFeedback: BrainLeadWithFeedback[], missingSignals: string[]) {
  const signals = new Set<string>();
  const addIf = (condition: boolean, value: string) => {
    if (condition) signals.add(value);
  };

  addIf(/\b(process-heavy|roadmap admin|too corporate|committee|big-company)\b/.test(text), "process-heavy profile");
  addIf(/\b(prompt demos?|demo polish|research-only|title-shaped)\b/.test(text), "title signal without proof");
  addIf(missingSignals.includes("avoid signals"), "avoid signal still unclear");

  evidenceSupported(seedSignals, text).forEach((signal) => signals.add(signal));
  negativeFeedback.flatMap((item) => feedbackSignalText(item.lead)).forEach((signal) => signals.add(`less ${signal}`));

  return Array.from(signals);
}

function deriveLikelyTitles(text: string, seedTitles: string[]) {
  const titles = new Set<string>();
  const addIf = (condition: boolean, value: string) => {
    if (condition) titles.add(value);
  };

  addIf(/\b(founder|founding)\b/.test(text) && /\b(pm|product manager|product)\b/.test(text), "Founding PM");
  addIf(/\b(product operator|operator)\b/.test(text) && /\b(product|pm)\b/.test(text), "Product Operator");
  addIf(/\b(ai|llm|agent|model)\b/.test(text) && /\b(engineer|developer|technical)\b/.test(text), "AI Product Engineer");
  addIf(/\b(applied ai|customer-facing ai)\b/.test(text), "Applied AI Engineer");
  addIf(/\b(solidity|smart contract|web3|defi)\b/.test(text), "Solidity Engineer");
  addIf(/\b(chief of staff|founder office|bizops)\b/.test(text), "Founder’s Office");

  evidenceSupported(seedTitles, text).forEach((title) => titles.add(title));

  return Array.from(titles);
}

function deriveSearchShape(text: string): BrainState["searchShape"] {
  return {
    ownership: scoreEvidence(text, [
      /\b(own|owns|ownership|end-to-end|founder|bottleneck|accountable|independent|less dependent|make a call)\b/
    ]),
    ambiguityTolerance: scoreEvidence(text, [
      /\b(ambiguous|ambiguity|messy|0 to 1|zero-to-one|startup|founding|unclear|context|without.*process)\b/
    ]),
    productJudgment: scoreEvidence(text, [
      /\b(product|customer|workflow|pm|taste|roadmap|discovery|user|clarity)\b/
    ]),
    executionSpeed: scoreEvidence(text, [
      /\b(fast|speed|urgent|ship|shipped|shipping|move|moving|prototype|execution|deliver|pace)\b/
    ]),
    technicalDepth: scoreEvidence(text, [
      /\b(engineer|technical|ai|llm|ml|backend|infra|solidity|smart contract|smartcontract|systems|security|mainnet|github)\b/
    ])
  };
}

function scoreEvidence(text: string, patterns: RegExp[]) {
  if (!patterns.some((pattern) => pattern.test(text))) return 0;

  let score = 58;
  if (/\b(founder|founding|senior|staff|lead|head|principal)\b/.test(text)) score += 12;
  if (/\b(shipped|built|owned|customer|startup|messy|independent|mainnet|production)\b/.test(text)) score += 14;
  if (/\b(must|non-negotiable|need|clear yes|has to)\b/.test(text)) score += 6;

  return clampPercent(Math.min(92, score));
}

function deriveSourceLanes({
  text,
  hints,
  leads,
  likelyTitles,
  searchShape,
  hasFounderSignal
}: {
  text: string;
  hints: string[];
  leads: ProfileLead[];
  likelyTitles: string[];
  searchShape: BrainState["searchShape"];
  hasFounderSignal: boolean;
}): BrainState["sourceLanes"] {
  if (!hasFounderSignal) {
    return {
      publicWeb: "inactive",
      linkedinLike: "inactive",
      github: "inactive",
      startupAlumni: "inactive",
      blogsTalks: "inactive"
    };
  }

  const hintText = hints.join(" ").toLowerCase();
  const hasLeadSource = (source: ProfileLead["source"]) => leads.some((lead) => lead.source === source);
  const hasAnyLeads = leads.length > 0;
  const laneStatus = (active: boolean, planned: boolean): BrainSourceLaneStatus => active ? "active" : planned ? "planned" : "inactive";

  return {
    publicWeb: laneStatus(hasAnyLeads, hasFounderSignal),
    linkedinLike: laneStatus(hasLeadSource("linkedin"), hasFounderSignal && likelyTitles.length > 0),
    github: laneStatus(hasLeadSource("github"), searchShape.technicalDepth >= 60 || /\b(github|engineer|technical|solidity|ai)\b/.test(text)),
    startupAlumni: laneStatus(false, /\b(startup|founding|seed|series|founder-led)\b/.test(text)),
    blogsTalks: laneStatus(hasLeadSource("personal_site"), /\b(speaker|writing|blog|open source|github)\b/.test(text) || (searchShape.technicalDepth >= 70 && /\b(open source|github|technical)\b/.test(hintText)))
  };
}

function normalizeMissingSignals(missingSignals: string[], text: string) {
  const normalized = new Set<string>();

  if (/\b(founder|dependent|less dependent|bottleneck)\b/.test(text) && /\b(pm|product)\b/.test(text)) {
    normalized.add("team size or bottleneck");
  }

  missingSignals.forEach((signal) => normalized.add(signal));

  return Array.from(normalized).slice(0, 5);
}

function evidenceSupported(items: string[], text: string) {
  return items.filter((item) => {
    const words = item.toLowerCase().split(/\s+/).filter((word) => word.length > 3);
    return words.some((word) => text.includes(word));
  });
}

function feedbackSignalText(lead: ProfileLead) {
  const text = `${lead.title} ${lead.fitReason} ${lead.snippet} ${lead.tags.join(" ")}`.toLowerCase();
  const signals = new Set<string>();

  if (/\b(ai|llm|agent|model)\b/.test(text)) signals.add("AI product signal");
  if (/\b(product|pm|customer|workflow)\b/.test(text)) signals.add("product/customer signal");
  if (/\b(founder|founding|startup|0 to 1|zero-to-one)\b/.test(text)) signals.add("startup-native signal");
  if (/\b(github|open source|technical|engineer|solidity|mainnet)\b/.test(text)) signals.add("technical proof");

  return Array.from(signals).slice(0, 2);
}

function scoreBatchQuality(leads: ProfileLead[]) {
  if (!leads.length) return 0;

  const average = leads.reduce((sum, lead) => sum + confidenceScoreValue(lead.confidence), 0) / leads.length;
  const evidenceBoost = leads.reduce((sum, lead) => sum + leadEvidenceScore(lead), 0) / leads.length;
  const thinPenalty = leads.filter((lead) => isThinLead(lead)).length * 8;

  return clampPercent(average * 0.72 + evidenceBoost * 0.28 - thinPenalty);
}

function scoreNovelty(leads: ProfileLead[]) {
  if (!leads.length) return 0;
  const uniqueUrls = new Set(leads.map((lead) => lead.url).filter(Boolean));
  return clampPercent((uniqueUrls.size / leads.length) * 100);
}

function scoreLeadConfidence(leads: ProfileLead[]) {
  if (!leads.length) return 0;
  return clampPercent(leads.reduce((sum, lead) => sum + confidenceScoreValue(lead.confidence), 0) / leads.length);
}

function confidenceScoreValue(confidence: ProfileLead["confidence"]) {
  if (confidence === "high") return 92;
  if (confidence === "medium") return 66;
  return 34;
}

function leadEvidenceScore(lead: ProfileLead) {
  const text = `${lead.title} ${lead.snippet} ${lead.fitReason} ${lead.tags.join(" ")}`.toLowerCase();
  let score = 32;

  if (/\b(shipped|built|launched|owned|led|founding|founder|mainnet|production)\b/.test(text)) score += 22;
  if (/\b(customer|workflow|product|users|revenue|security|audit)\b/.test(text)) score += 18;
  if (/\b(startup|seed|series|early|0 to 1|zero-to-one)\b/.test(text)) score += 14;
  if (lead.calibration?.mustHaves?.length) score += 10;

  return clampPercent(score);
}

function isThinLead(lead: ProfileLead) {
  const text = `${lead.snippet} ${lead.fitReason}`.toLowerCase();
  return /\b(no clear|unclear|thin|not clear|missing)\b/.test(text) || text.length < 80;
}

function buildTinaRead({
  hasFounderSignal,
  sourcingReadiness,
  missingSignals,
  roleThesis,
  leads,
  batchQualityScore,
  confidenceScore
}: {
  hasFounderSignal: boolean;
  sourcingReadiness: BrainState["sourcingReadiness"];
  missingSignals: string[];
  roleThesis: string;
  leads: ProfileLead[];
  batchQualityScore: number;
  confidenceScore: number;
}) {
  if (!hasFounderSignal) return EMPTY_READ;

  if (leads.length) {
    if (batchQualityScore >= 75 && confidenceScore >= 70) return "This batch is tight enough to review for outreach.";
    return "This batch is useful for calibration, not outreach yet.";
  }

  if (sourcingReadiness === "ready") return "The search brief is strong enough to pull a first candidate batch.";
  if (sourcingReadiness === "calibration_batch") return "Enough signal for a first pass; Tina should filter hard and learn from the batch.";
  if (roleThesis) return `One blocker remains before sourcing: ${missingSignals[0] || "the role lane"}.`;
  return EMPTY_READ;
}

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}
