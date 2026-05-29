import type { TinaMvpMessage } from "@/lib/tina-mvp/types";

export type SourcingReadinessStatus = "ready_to_source" | "needs_calibration" | "low_confidence_search";

export type SourcingReadiness = {
  readinessStatus: SourcingReadinessStatus;
  readinessScore: number;
  missingSignals: string[];
  blockingMissing: string[];
  usefulButNotBlocking: string[];
  searchThesis: string;
  followUpQuestions: string[];
};

type ReadinessDimension = {
  label: string;
  points: number;
  present: boolean;
  question: string;
};

export function evaluateSourcingReadiness(messages: TinaMvpMessage[] | string): SourcingReadiness {
  const text = typeof messages === "string"
    ? messages
    : messages
        .filter((message) => message.role === "founder" || message.role === "tina")
        .map((message) => message.content)
        .join("\n");
  const normalized = text.toLowerCase();
  const roleFamily = inferRoleFamily(normalized);
  const rolePresent = roleFamily !== "general";
  const locationPresent = hasLocationOrRemoteSignal(text);
  const proofPresent = hasProofDomainOrOutcomeSignal(text, roleFamily);
  const blockingMissing = [
    rolePresent ? "" : "role/function",
    needsLocationSignal(roleFamily, normalized) && !locationPresent ? "location or remote constraint" : "",
    proofPresent ? "" : "one proof signal, domain, or role outcome"
  ].filter(Boolean);
  const dimensions: ReadinessDimension[] = [
    {
      label: "role outcome",
      points: 20,
      present: /\b(solve|own|owns|responsible|outcome|first 30|first 60|first 90|problem|bottleneck|reduce|improve|ship|build|deliver|delivery|mainnet|production|clarity|customer|revenue|quality|execution)\b/i.test(text),
      question: "Which part is most ambiguous right now: the role, the problem, or the bar?"
    },
    {
      label: "target function/title",
      points: 16,
      present: roleFamily !== "general",
      question: "What role family should we bias toward: product, engineering, operator, design, GTM, or something else?"
    },
    {
      label: "must-have signals",
      points: 18,
      present: /\b(must|non-negotiable|required|has to|need.*(?:shipped|built|owned|led|customer|ai|technical|founder|startup|domain)|cannot compromise|clear yes)\b/i.test(text),
      question: "What are the 2-3 non-negotiable signals a strong profile must show?"
    },
    {
      label: "company lane",
      points: 14,
      present: /\b(startup|seed|series [abc]|early stage|vertical saas|devtools|marketplace|fintech|healthcare|ai company|founder-led|big company|faang|agency|consulting|company types?|from companies?|worked at|defi|web3|crypto|protocol|mainnet|smart contract|smartcontract)\b/i.test(text),
      question: "What company environments should we search from or avoid?"
    },
    {
      label: "seniority/level",
      points: 12,
      present: /\b(founding|senior|staff|principal|lead|head|director|vp|junior|mid-level|manager|ic|years|yoe|level)\b/i.test(text),
      question: "What level is realistic for this role: founding, senior IC, lead, head-of, or something lighter?"
    },
    {
      label: "avoid signals",
      points: 10,
      present: /\b(avoid|not|too corporate|too junior|too senior|process-heavy|roadmap admin|research-only|agency|consultant|big-company|no ats|wrong lane|less like this)\b/i.test(text),
      question: "What profile would look good on paper but be wrong here?"
    },
    {
      label: "location/constraints",
      points: 10,
      present: /\b(remote|hybrid|onsite|sf|san francisco|new york|nyc|austin|seattle|london|location|timezone|comp|salary|cash|equity|budget|industry|visa)\b/i.test(text) ||
        /\b(no location constraint|location flexible|remote ok|remote is fine)\b/i.test(text),
      question: "Any location, remote, compensation, or industry constraints that should shape the search?"
    }
  ];
  const readinessScore = dimensions.reduce((score, dimension) => score + (dimension.present ? dimension.points : 0), 0);
  const missingSignals = dimensions.filter((dimension) => !dimension.present).map((dimension) => dimension.label);
  const usefulButNotBlocking = missingSignals.filter((signal) => !blockingMissing.includes(signal) && signal !== "target function/title" && signal !== "location/constraints");
  const readinessStatus: SourcingReadinessStatus =
    blockingMissing.length
      ? "needs_calibration"
      : readinessScore >= 70
        ? "ready_to_source"
        : "low_confidence_search";

  return {
    readinessStatus,
    readinessScore,
    missingSignals: blockingMissing,
    blockingMissing,
    usefulButNotBlocking,
    searchThesis: buildSearchThesis(normalized, roleFamily),
    followUpQuestions: blockingMissing.length ? dimensions
      .filter((dimension) => isBlockingQuestion(dimension.label, blockingMissing))
      .map((dimension) => dimension.question)
      .slice(0, 1) : []
  };
}

function hasLocationOrRemoteSignal(text: string) {
  return /\b(remote|hybrid|onsite|sf|san francisco|bay area|new york|nyc|austin|seattle|london|chicago|peoria|us|u\.s\.|usa|united states|location|timezone|no location constraint|location flexible|remote ok|remote is fine)\b/i.test(text);
}

function hasProofDomainOrOutcomeSignal(text: string, roleFamily: string) {
  if (/\b(fintech|healthcare|ai|llm|ml|machine learning|regulated|security|infra|infrastructure|platform|backend|distributed|customer|workflow|startup|seed|series [abc]|shipped|built|owned|led|deliver|production|quality|fda|iso|mainnet|defi|web3|crypto|protocol|smart contract|smartcontract|solidity|company is called|company called)\b/i.test(text)) return true;
  if (/\b(solve|own|owns|responsible|outcome|problem|bottleneck|reduce|improve|ship|build|delivery|clarity|revenue|execution)\b/i.test(text)) return true;
  return roleFamily !== "general" && /\b(senior|founding|staff|principal|lead|head)\b/i.test(text);
}

function needsLocationSignal(roleFamily: string, text: string) {
  if (/\b(remote|anywhere|global|distributed|no location constraint|location flexible)\b/i.test(text)) return false;
  return roleFamily === "manufacturing operations" || /\b(local|onsite|in office|relocation)\b/i.test(text);
}

function isBlockingQuestion(label: string, blockingMissing: string[]) {
  if (label === "target function/title") return blockingMissing.includes("role/function");
  if (label === "location/constraints") return blockingMissing.includes("location or remote constraint");
  if (label === "role outcome" || label === "must-have signals" || label === "company lane") return blockingMissing.includes("one proof signal, domain, or role outcome");
  return false;
}

function inferRoleFamily(text: string) {
  if (/\b(ai|llm|ml|machine learning|model|agent|engineer|developer|backend|frontend|full stack|full-stack|infra|platform|solidity|smart contract|smartcontract|web3|defi|protocol)\b/.test(text)) return "engineering";
  if (/\b(pm|product manager|head of product|product lead|product operator|product)\b/.test(text)) return "product";
  if (/\b(operator|ops|operations|chief of staff|founder office|bizops)\b/.test(text)) return "operator";
  if (/\b(designer|design|ux|ui)\b/.test(text)) return "design";
  if (/\b(gtm|sales|account executive|growth|revenue|marketing)\b/.test(text)) return "gtm";

  return "general";
}

function buildSearchThesis(text: string, roleFamily: string) {
  if (/\b(founder|bottleneck|dependent|less dependent|routes through me)\b/.test(text) && roleFamily === "product") {
    return "Founder-adjacent product operator who can turn messy context into decisions without adding process theater.";
  }

  if (roleFamily === "engineering" && /\b(ai|llm|model|agent)\b/.test(text)) {
    return "Applied AI builder with product judgment, shipped workflow evidence, and startup pace.";
  }

  if (roleFamily === "engineering" && /\b(solidity|smart contract|smartcontract|web3|defi|protocol|mainnet)\b/.test(text)) {
    return "Solidity engineer with recent mainnet or DeFi proof, security instincts, and end-to-end delivery.";
  }

  if (roleFamily === "operator") {
    return "High-trust operator who can absorb messy founder context, make calls, and keep work moving.";
  }

  if (roleFamily === "product") {
    return "Product-minded operator who creates clarity from customer signal, not a roadmap administrator.";
  }

  if (roleFamily === "design") {
    return "Product designer who can shape ambiguous product direction close to engineering and customers.";
  }

  if (roleFamily === "gtm") {
    return "Early GTM builder with customer learning, founder-led sales instincts, and ownership under ambiguity.";
  }

  return "High-ownership startup candidate; the lane still needs sharper signal before sourcing heavily.";
}
