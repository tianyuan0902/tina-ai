import type { SignalMap } from "@/lib/tina-mvp/signal-map";

export type HiringArtifactKind = "scorecard" | "interview_plan" | "candidate_archetype";

export type ScorecardRow = {
  competency: string;
  signal: string;
  strongEvidence: string;
  redFlag: string;
  ratingScale: string;
};

export type InterviewPlanStage = {
  stage: string;
  tests: string;
  prompt: string;
  evidence: string;
  interviewer: string;
};

export type CandidateArchetypeItem = {
  label: string;
  value: string;
};

export type HiringArtifact =
  | {
      kind: "scorecard";
      title: string;
      derivedFromThesisTitle: string;
      rows: ScorecardRow[];
    }
  | {
      kind: "interview_plan";
      title: string;
      derivedFromThesisTitle: string;
      stages: InterviewPlanStage[];
    }
  | {
      kind: "candidate_archetype";
      title: string;
      derivedFromThesisTitle: string;
      items: CandidateArchetypeItem[];
    };

export function inferHiringArtifactKind(message: string): HiringArtifactKind | undefined {
  if (/\b(scorecard|rubric|criteria)\b/i.test(message)) return "scorecard";
  if (/\b(interview plan|interview loop|interview process)\b/i.test(message)) return "interview_plan";
  if (/\b(candidate archetype|candidate profile|define archetype|best[-\s]?fit profile)\b/i.test(message)) return "candidate_archetype";
  return undefined;
}

export function buildHiringArtifact(signalMap: SignalMap, kind: HiringArtifactKind): HiringArtifact {
  if (kind === "interview_plan") return buildInterviewPlan(signalMap);
  if (kind === "candidate_archetype") return buildCandidateArchetype(signalMap);
  return buildScorecard(signalMap);
}

export function formatHiringArtifactForPrompt(artifact?: HiringArtifact) {
  if (!artifact) return "";
  if (artifact.kind === "scorecard") {
    return [
      "Hiring artifact: Scorecard",
      `Derived from thesis: ${artifact.derivedFromThesisTitle}`,
      ...artifact.rows.map((row) => `${row.competency}: ${row.signal}; strong evidence: ${row.strongEvidence}; red flag: ${row.redFlag}`)
    ].join("\n");
  }
  if (artifact.kind === "interview_plan") {
    return [
      "Hiring artifact: Interview plan",
      `Derived from thesis: ${artifact.derivedFromThesisTitle}`,
      ...artifact.stages.map((stage) => `${stage.stage}: tests ${stage.tests}; prompt ${stage.prompt}; evidence ${stage.evidence}`)
    ].join("\n");
  }
  return [
    "Hiring artifact: Candidate archetype",
    `Derived from thesis: ${artifact.derivedFromThesisTitle}`,
    ...artifact.items.map((item) => `${item.label}: ${item.value}`)
  ].join("\n");
}

function buildScorecard(signalMap: SignalMap): HiringArtifact {
  const mustProve = signalMap.mustProveSignals.slice(0, 4);
  const rows = mustProve.map((signal, index) => {
    const competency = competencyLabel(signal);
    return {
      competency,
      signal: shortCompleteSignal(signal),
      strongEvidence: strongEvidenceFor(signal),
      redFlag: shortCompleteSignal(signalMap.falsePositives[index] || signalMap.weakSignals[index] || "Looks right on paper but cannot carry the actual problem."),
      ratingScale: "1 = no proof, 3 = partial proof, 5 = owned it"
    };
  });

  return {
    kind: "scorecard",
    title: "Scorecard",
    derivedFromThesisTitle: signalMap.derivedFromThesisTitle,
    rows
  };
}

function buildInterviewPlan(signalMap: SignalMap): HiringArtifact {
  const probes = signalMap.interviewProbes.slice(0, 3);
  const mustProve = signalMap.mustProveSignals;
  const stages: InterviewPlanStage[] = [
    {
      stage: "Founder screen",
      tests: shortCompleteSignal(mustProve[0] || "Owns the real problem."),
      prompt: compactQuestion(probes[0] || "What was broken when you entered, and what changed because of you?"),
      evidence: "Specific decision, tradeoff, and outcome.",
      interviewer: "Founder"
    },
    {
      stage: "Work sample",
      tests: shortCompleteSignal(mustProve[1] || "Creates clarity under pressure."),
      prompt: compactQuestion(probes[1] || "Walk through the decision you would make with messy context."),
      evidence: "Clear judgment, not process theater.",
      interviewer: "Founder + functional lead"
    },
    {
      stage: "Operating depth",
      tests: shortCompleteSignal(mustProve[2] || "Can carry the role without hand-holding."),
      prompt: compactQuestion(probes[2] || "What would you refuse to solve in the first 30 days?"),
      evidence: "Knows what to own and what to push back on.",
      interviewer: "Team lead"
    },
    {
      stage: "Reference check",
      tests: "Whether the story happened in real life.",
      prompt: "Where did they reduce leadership load?",
      evidence: "Former manager confirms real ownership.",
      interviewer: "Founder"
    }
  ];

  return {
    kind: "interview_plan",
    title: "Interview Plan",
    derivedFromThesisTitle: signalMap.derivedFromThesisTitle,
    stages
  };
}

function buildCandidateArchetype(signalMap: SignalMap): HiringArtifact {
  const items: CandidateArchetypeItem[] = [
    {
      label: "Likely background",
      value: shortCompleteSignal(signalMap.bestCandidateArchetype)
    },
    {
      label: "Scar tissue",
      value: shortCompleteSignal(signalMap.mustProveSignals[0] || "Has owned the messy version before.")
    },
    {
      label: "False positive",
      value: shortCompleteSignal(signalMap.falsePositives[0] || signalMap.weakSignals[0] || "Title match without real ownership.")
    },
    {
      label: "Best source lane",
      value: sourceLaneFor(signalMap)
    },
    {
      label: "Risk to verify",
      value: shortCompleteSignal(signalMap.weakSignals[0] || "Looks polished but cannot carry the hard decision.")
    }
  ];

  return {
    kind: "candidate_archetype",
    title: "Candidate Archetype",
    derivedFromThesisTitle: signalMap.derivedFromThesisTitle,
    items
  };
}

function competencyLabel(signal: string) {
  const text = signal.toLowerCase();
  if (/decision|tradeoff|prioriti/.test(text)) return "Decision ownership";
  if (/founder|dependency|hand/.test(text)) return "Founder leverage";
  if (/rhythm|cadence|shipping|execution/.test(text)) return "Execution rhythm";
  if (/trust|morale|accountability|leadership/.test(text)) return "Team leadership";
  if (/customer|product|roadmap/.test(text)) return "Product judgment";
  if (/sales|customer conversation|deal/.test(text)) return "Market signal";
  if (/delivery|implementation|ops/.test(text)) return "Operating system";
  return "Ownership proof";
}

function shortCompleteSignal(value: string) {
  const direct = labelFor(value);
  if (direct) return direct;
  const clean = value
    .replace(/^has\s+/i, "")
    .replace(/^can\s+/i, "")
    .replace(/^is able to\s+/i, "")
    .replace(/[?.]$/g, "")
    .trim();
  const clause = clean.split(/\s+(?:who|with|without|while|when|where|because|so)\s+|[;,:—]/)[0]?.trim() || clean;
  const words = clause.split(/\s+/).filter(Boolean);
  if (words.length <= 12) return clause;
  return fallbackLabel(clause);
}

function compactQuestion(value: string) {
  const clean = value.replace(/[?]+$/g, "").trim();
  const direct = labelFor(clean);
  if (direct) return `${direct}?`;
  const words = clean.split(/\s+/).filter(Boolean);
  return words.length <= 14 ? `${clean}?` : `${fallbackLabel(clean)}?`;
}

function strongEvidenceFor(signal: string) {
  const label = shortCompleteSignal(signal);
  if (/decision|tradeoff|ownership/i.test(label)) return "Named decision, stakes, and result.";
  if (/rhythm|shipping|execution/i.test(label)) return "Before/after cadence improvement.";
  if (/trust|morale|leadership/i.test(label)) return "Team got faster and clearer.";
  if (/founder/i.test(label)) return "Founder became less central.";
  return "Specific story with measurable consequence.";
}

function sourceLaneFor(signalMap: SignalMap) {
  const thesis = signalMap.derivedFromThesisTitle;
  if (thesis === "Engineering Leadership Bottleneck") return "Early-stage eng leaders after founder-led teams.";
  if (thesis === "Founder-Led Sales Transition") return "First-sales builders from founder-led motions.";
  if (thesis === "Senior Ownership Gap") return "Senior operators with ambiguous ownership wins.";
  if (thesis === "Role Compression / Generalist Hire") return "Founder-adjacent operators who narrowed chaos.";
  if (thesis === "Urgent Hiring Triage") return "Crisis-capable leaders with fast stabilization proof.";
  if (thesis === "Product/Execution Ownership Gap") return "Product owners who shipped through founder ambiguity.";
  if (thesis === "Customer Ops / Implementation Gap") return "Customer operators who fixed delivery systems.";
  return "People who solved the real tension before.";
}

function labelFor(value: string) {
  const text = value.toLowerCase();
  if (/decision ownership|own(ed|s)? .*decision|technical decisions|product decisions/.test(text)) return "Owns hard decisions";
  if (/founder.*hand|founder.*central|founder.*depend|founder leverage|proxy/.test(text)) return "Reduces founder dependency";
  if (/engineering execution rhythm|shipping cadence|execution rhythm|operating cadence/.test(text)) return "Improves team rhythm";
  if (/trust|morale/.test(text)) return "Rebuilds trust and morale";
  if (/ambig/.test(text)) return "Works through ambiguity";
  if (/large team|mature company|big-company/.test(text)) return "Big-company manager";
  if (/architecture.*no people|architecture-only|people leadership/.test(text)) return "Architecture without leadership";
  if (/process-heavy|meetings.*speed|coordination layer/.test(text)) return "Process without speed";
  if (/senior ic|individual contributor/.test(text)) return "Senior IC, not leader";
  if (/product and engineering disagreed|product\/eng/.test(text)) return "Product/eng conflict";
  if (/customer discovery|customer signal/.test(text)) return "Reads customer signal";
  if (/product taste|product judgment/.test(text)) return "Sharp product judgment";
  if (/prioriti[sz]ation|tradeoff/.test(text)) return "Makes tradeoff calls";
  if (/startup pace|startup environment|messy startup/.test(text)) return "Startup operating proof";
  if (/shipped|shipping|built|build/.test(text)) return "Real shipping proof";
  if (/security|audit/.test(text)) return "Security-critical proof";
  if (/protocol|smart contract|solidity/.test(text)) return "Smart contract ownership";
  if (/repeatable customer conversation|sales motion/.test(text)) return "Repeatable sales motion";
  if (/customer delivery|implementation/.test(text)) return "Repeatable customer delivery";
  return "";
}

function fallbackLabel(value: string) {
  const text = value.toLowerCase();
  if (/ownership/.test(text)) return "Clear ownership proof";
  if (/judgment/.test(text)) return "Independent judgment";
  if (/lead/.test(text)) return "Leadership under pressure";
  if (/technical/.test(text)) return "Technical judgment";
  if (/product/.test(text)) return "Product judgment";
  if (/speed|fast/.test(text)) return "Speed without chaos";
  if (/customer/.test(text)) return "Customer-facing judgment";
  if (/sales/.test(text)) return "Scrappy sales proof";
  return value.split(/\s+/).filter(Boolean).slice(0, 12).join(" ");
}
