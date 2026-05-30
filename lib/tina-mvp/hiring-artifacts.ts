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

type ArtifactProfile = {
  scorecard: ScorecardRow[];
  interviewStages?: InterviewPlanStage[];
  archetype: CandidateArchetypeItem[];
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
  const profile = artifactProfileFor(signalMap);
  const rows = profile?.scorecard || buildGenericScorecardRows(signalMap);

  return {
    kind: "scorecard",
    title: "Scorecard",
    derivedFromThesisTitle: signalMap.derivedFromThesisTitle,
    rows
  };
}

function buildInterviewPlan(signalMap: SignalMap): HiringArtifact {
  const profile = artifactProfileFor(signalMap);
  if (profile?.interviewStages) {
    return {
      kind: "interview_plan",
      title: "Interview Plan",
      derivedFromThesisTitle: signalMap.derivedFromThesisTitle,
      stages: profile.interviewStages
    };
  }

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
  const profile = artifactProfileFor(signalMap);
  const items = profile?.archetype || buildGenericArchetypeItems(signalMap);

  return {
    kind: "candidate_archetype",
    title: "Candidate Archetype",
    derivedFromThesisTitle: signalMap.derivedFromThesisTitle,
    items
  };
}

function buildGenericScorecardRows(signalMap: SignalMap): ScorecardRow[] {
  const mustProve = signalMap.mustProveSignals.slice(0, 4);
  const used = new Set<string>();
  return mustProve.map((signal, index) => {
    const competency = uniqueCompetency(competencyLabel(signal), used);
    const redFlagSource = signalMap.falsePositives[index] || signalMap.weakSignals[index] || "Looks right on paper but cannot carry the actual problem.";
    return {
      competency,
      signal: shortCompleteSignal(signal),
      strongEvidence: strongEvidenceFor(signal),
      redFlag: negativeIndicatorFor(redFlagSource),
      ratingScale: "1 = no proof, 3 = partial proof, 5 = owned it"
    };
  });
}

function buildGenericArchetypeItems(signalMap: SignalMap): CandidateArchetypeItem[] {
  return [
    {
      label: "Likely background",
      value: keepCompleteSentence(signalMap.bestCandidateArchetype)
    },
    {
      label: "Scar tissue",
      value: shortCompleteSignal(signalMap.mustProveSignals[0] || "Has owned the messy version before.")
    },
    {
      label: "False positive",
      value: negativeIndicatorFor(signalMap.falsePositives[0] || signalMap.weakSignals[0] || "Title match without real ownership.")
    },
    {
      label: "Best source lane",
      value: sourceLaneFor(signalMap)
    },
    {
      label: "Risk to verify",
      value: negativeIndicatorFor(signalMap.weakSignals[0] || "Looks polished but cannot carry the hard decision.")
    }
  ];
}

function artifactProfileFor(signalMap: SignalMap): ArtifactProfile | undefined {
  const thesis = signalMap.derivedFromThesisTitle;
  if (thesis === "Engineering Leadership Bottleneck") {
    return {
      scorecard: withRating([
        {
          competency: "Decision ownership",
          signal: "Owns technical calls without founder approval.",
          strongEvidence: "Named hard calls and business impact.",
          redFlag: "Turns decisions into meetings."
        },
        {
          competency: "Execution rhythm",
          signal: "Makes engineering move faster, not busier.",
          strongEvidence: "Clear before/after delivery cadence.",
          redFlag: "Adds process without speed."
        },
        {
          competency: "People leadership",
          signal: "Raises accountability without breaking trust.",
          strongEvidence: "Team got clearer and calmer.",
          redFlag: "Only managed in mature systems."
        },
        {
          competency: "Founder leverage",
          signal: "Removes founder from routine decisions.",
          strongEvidence: "Founder dependency visibly dropped.",
          redFlag: "Escalates every messy call upward."
        }
      ]),
      interviewStages: [
        {
          stage: "Founder screen",
          tests: "Decision ownership.",
          prompt: "Tell me about a call you took from a founder.",
          evidence: "Clear stakes, decision, and aftermath.",
          interviewer: "Founder"
        },
        {
          stage: "Eng deep dive",
          tests: "Technical judgment under ambiguity.",
          prompt: "Walk through a product/eng conflict you resolved.",
          evidence: "Specific tradeoff and delivery impact.",
          interviewer: "Senior engineer"
        },
        {
          stage: "Team leadership",
          tests: "Accountability without morale damage.",
          prompt: "How did you reset a slow team?",
          evidence: "Trust improved while pace increased.",
          interviewer: "Engineering peer"
        },
        {
          stage: "Reference check",
          tests: "Whether founder leverage was real.",
          prompt: "What decisions stopped escalating?",
          evidence: "Former founder confirms reduced dependency.",
          interviewer: "Founder"
        }
      ],
      archetype: [
        { label: "Likely background", value: "Early-stage eng leader after founder-led engineering." },
        { label: "Scar tissue", value: "Has inherited slow delivery and rebuilt decision rhythm." },
        { label: "False positive", value: "Process-heavy EM from a cleaner company." },
        { label: "Best source lane", value: "Heads of Eng or EMs from 10-50 person startups." },
        { label: "Risk to verify", value: "Can they own decisions, not just coordinate them?" }
      ]
    };
  }

  if (thesis === "Role Compression / Generalist Hire") {
    return {
      scorecard: withRating([
        {
          competency: "Lane judgment",
          signal: "Can name the primary job inside the chaos.",
          strongEvidence: "Shows what they refused to own.",
          redFlag: "Says yes to every loose task."
        },
        {
          competency: "Ownership clarity",
          signal: "Turns broad asks into owned outcomes.",
          strongEvidence: "Created clear boundaries and results.",
          redFlag: "Becomes a smart helper, not an owner."
        },
        {
          competency: "Founder judgment",
          signal: "Knows when to absorb versus push back.",
          strongEvidence: "Protected founder time with better calls.",
          redFlag: "Escalates ambiguity back to the founder."
        },
        {
          competency: "Operating range",
          signal: "Handles adjacent work without losing the plot.",
          strongEvidence: "Balanced multiple lanes with clear priority.",
          redFlag: "Creates motion without durable outcomes."
        }
      ]),
      interviewStages: [
        {
          stage: "Founder screen",
          tests: "Whether they can narrow the role.",
          prompt: "Which part of this role would you not own?",
          evidence: "Healthy pushback and clear tradeoffs.",
          interviewer: "Founder"
        },
        {
          stage: "Scope exercise",
          tests: "Role compression judgment.",
          prompt: "Split this messy role into must-own and later.",
          evidence: "Prioritizes one lane without hand-waving.",
          interviewer: "Founder + operator"
        },
        {
          stage: "Operating story",
          tests: "Generalist range with outcomes.",
          prompt: "Tell me where you wore many hats and narrowed them.",
          evidence: "Specific outcomes, not busyness.",
          interviewer: "Operator"
        }
      ],
      archetype: [
        { label: "Likely background", value: "Founder-adjacent operator who has narrowed messy roles." },
        { label: "Scar tissue", value: "Has said no when the company wanted one hire to do three jobs." },
        { label: "False positive", value: "Helpful chief-of-staff type with no true ownership." },
        { label: "Best source lane", value: "Early operators from small teams with ambiguous mandates." },
        { label: "Risk to verify", value: "Do they create decisions or just absorb tasks?" }
      ]
    };
  }

  if (thesis === "Customer Ops / Implementation Gap") {
    return {
      scorecard: withRating([
        {
          competency: "Delivery system",
          signal: "Turns messy delivery into repeatable motion.",
          strongEvidence: "Reduced escalations with a clearer system.",
          redFlag: "Good with customers but weak on mechanics."
        },
        {
          competency: "Problem diagnosis",
          signal: "Separates product gaps from process gaps.",
          strongEvidence: "Named the root cause before fixing it.",
          redFlag: "Blames process for every product issue."
        },
        {
          competency: "Customer judgment",
          signal: "Protects trust during messy implementation.",
          strongEvidence: "Kept customers while changing the workflow.",
          redFlag: "Escalates every edge case to the founder."
        }
      ]),
      archetype: [
        { label: "Likely background", value: "Customer-facing operator who fixed delivery chaos." },
        { label: "Scar tissue", value: "Has lived through messy implementations and founder escalations." },
        { label: "False positive", value: "Relationship manager who cannot fix the machine." },
        { label: "Best source lane", value: "Implementation or customer ops leads from complex products." },
        { label: "Risk to verify", value: "Can they diagnose product versus process?" }
      ]
    };
  }

  return undefined;
}

function withRating(rows: Omit<ScorecardRow, "ratingScale">[]): ScorecardRow[] {
  return rows.map((row) => ({ ...row, ratingScale: "1 = no proof, 3 = partial proof, 5 = owned it" }));
}

function uniqueCompetency(base: string, used: Set<string>) {
  if (!used.has(base)) {
    used.add(base);
    return base;
  }
  const alternatives = ["Operating proof", "Judgment proof", "Execution proof", "Founder leverage", "Role fit"];
  const next = alternatives.find((item) => !used.has(item)) || `${base} proof`;
  used.add(next);
  return next;
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

function negativeIndicatorFor(value: string) {
  const text = value.toLowerCase();
  if (/managed a large team|mature company|big-company/.test(text)) return "Only proven in a cleaner company.";
  if (/architecture|technical calls|senior ic|individual contributor/.test(text)) return "Strong technically, weak on team ownership.";
  if (/process-heavy|meetings|coordination layer/.test(text)) return "Creates process without clearer decisions.";
  if (/title match|matching title|looks right/.test(text)) return "Title matches, operating proof does not.";
  if (/polished|interview language|vocabulary/.test(text)) return "Sounds sharp but lacks ownership proof.";
  if (/status upward|reports status|escalation/.test(text)) return "Reports problems instead of owning them.";
  if (/wearing many hats|many hats/.test(text)) return "Busy generalist with no clear lane.";
  if (/relationship management|customer success/.test(text)) return "Customer-friendly but cannot fix delivery.";
  if (/available quickly|willing to help/.test(text)) return "Available, but not proven in the failure mode.";
  if (/helper|chief-of-staff/.test(text)) return "Helpful, but not accountable for outcomes.";
  if (/sales|pipeline|logo|seller/.test(text)) return "Can sell with support, not build the motion.";
  return shortNegativePhrase(value);
}

function shortNegativePhrase(value: string) {
  const clean = value.replace(/[?.]$/g, "").trim();
  if (/^(has|can|is able to)\b/i.test(clean)) return "Claim sounds positive but lacks proof.";
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length <= 12) return clean;
  return "Looks relevant but misses the real signal.";
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

function keepCompleteSentence(value: string) {
  const clean = value.replace(/\s+/g, " ").trim();
  if (clean.length <= 140) return clean;
  return fallbackLabel(clean);
}
