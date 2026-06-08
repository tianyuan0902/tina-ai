import type { CanonicalSearchState } from "@/lib/brain/canonicalSearchState";
import type { SignalMap } from "@/lib/tina-mvp/signal-map";

export type HiringArtifactKind = "scorecard" | "interview_plan" | "candidate_archetype" | "market_reality" | "sourcing_strategy";

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

export type MarketRealityArtifact = {
  roleShape: string;
  marketDifficulty: "Easy" | "Moderate" | "Hard" | "Rare";
  sourceLanes: string[];
  tradeoffs: string[];
  risks: string[];
  missingInputs: string[];
  nextMove: string;
  uncertaintyLabel: "directional" | "needs user input" | "based on role pattern";
};

export type SourcingStrategyArtifact = {
  targetProfile: string;
  searchLanes: string[];
  targetTitles: string[];
  mustHaveFilters: string[];
  avoidFilters: string[];
  searchLogic: string[];
  outreachAngle: string;
  missingConstraints: string[];
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
    }
  | {
      kind: "market_reality";
      title: string;
      derivedFromThesisTitle: string;
      marketReality: MarketRealityArtifact;
    }
  | {
      kind: "sourcing_strategy";
      title: string;
      derivedFromThesisTitle: string;
      sourcingStrategy: SourcingStrategyArtifact;
    };

type ArtifactProfile = {
  scorecard: ScorecardRow[];
  interviewStages?: InterviewPlanStage[];
  archetype: CandidateArchetypeItem[];
};

export function inferHiringArtifactKind(message: string): HiringArtifactKind | undefined {
  if (isSourcingStrategyArtifactRequest(message)) return "sourcing_strategy";
  if (isMarketRealityArtifactRequest(message)) return "market_reality";
  if (!isArtifactActionRequest(message)) return undefined;
  if (/\b(scorecard|rubric|criteria)\b/i.test(message)) return "scorecard";
  if (/\b(interview plan|interview loop)\b/i.test(message)) return "interview_plan";
  if (/\b(candidate archetype|candidate profile|define archetype|best[-\s]?fit profile)\b/i.test(message)) return "candidate_archetype";
  return undefined;
}

function isArtifactActionRequest(message: string) {
  return /\b(build|create|make|draft|generate|turn this into|define|write|give me|produce)\b/i.test(message);
}

export function isMarketRealityArtifactRequest(message: string) {
  return /\b(pressure[-\s]?test market|market reality|talent pool|market read|market map|source lanes|time[-\s]?to[-\s]?fill|ttf|comp|compensation|salary|equity|pool size)\b/i.test(message);
}

export function isSourcingStrategyArtifactRequest(message: string) {
  return /\b(build|create|make|draft|generate)?\s*(sourcing strategy|search strategy|sourcing plan|search plan)\b/i.test(message);
}

export function buildHiringArtifact(signalMap: SignalMap, kind: HiringArtifactKind, canonicalSearchState?: CanonicalSearchState): HiringArtifact {
  if (kind === "sourcing_strategy") return buildSourcingStrategy(signalMap, canonicalSearchState);
  if (kind === "market_reality") return buildMarketReality(signalMap, canonicalSearchState);
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
  if (artifact.kind === "market_reality") {
    const reality = artifact.marketReality;
    return [
      "Hiring artifact: Market Reality",
      `Derived from thesis: ${artifact.derivedFromThesisTitle}`,
      `Role shape: ${reality.roleShape}`,
      `Difficulty: ${reality.marketDifficulty} (${reality.uncertaintyLabel})`,
      `Likely source lanes: ${reality.sourceLanes.join("; ")}`,
      `Tradeoffs: ${reality.tradeoffs.join("; ")}`,
      `Risks: ${reality.risks.join("; ")}`,
      `Missing inputs: ${reality.missingInputs.join("; ")}`,
      `Next move: ${reality.nextMove}`
    ].join("\n");
  }
  if (artifact.kind === "sourcing_strategy") {
    const strategy = artifact.sourcingStrategy;
    return [
      "Hiring artifact: Sourcing Strategy",
      `Derived from thesis: ${artifact.derivedFromThesisTitle}`,
      `Target profile: ${strategy.targetProfile}`,
      `Search lanes: ${strategy.searchLanes.join("; ")}`,
      `Target titles: ${strategy.targetTitles.join("; ")}`,
      `Must-have filters: ${strategy.mustHaveFilters.join("; ")}`,
      `Avoid filters: ${strategy.avoidFilters.join("; ")}`,
      `Search logic: ${strategy.searchLogic.join("; ")}`,
      `Outreach angle: ${strategy.outreachAngle}`,
      `Missing constraints: ${strategy.missingConstraints.join("; ")}`
    ].join("\n");
  }
  return [
    "Hiring artifact: Candidate archetype",
    `Derived from thesis: ${artifact.derivedFromThesisTitle}`,
    ...artifact.items.map((item) => `${item.label}: ${item.value}`)
  ].join("\n");
}

function buildMarketReality(signalMap: SignalMap, canonicalSearchState?: CanonicalSearchState): HiringArtifact {
  const profile = marketProfileFor(signalMap, canonicalSearchState);
  return {
    kind: "market_reality",
    title: "Market Reality",
    derivedFromThesisTitle: signalMap.derivedFromThesisTitle,
    marketReality: profile
  };
}

function buildSourcingStrategy(signalMap: SignalMap, canonicalSearchState?: CanonicalSearchState): HiringArtifact {
  const strategy = normalizeSourcingStrategy(sourcingStrategyFor(signalMap, canonicalSearchState));
  return {
    kind: "sourcing_strategy",
    title: "Sourcing Strategy",
    derivedFromThesisTitle: signalMap.derivedFromThesisTitle,
    sourcingStrategy: strategy
  };
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

function marketProfileFor(signalMap: SignalMap, canonicalSearchState?: CanonicalSearchState): MarketRealityArtifact {
  const thesis = signalMap.derivedFromThesisTitle;
  const missingInputs = marketMissingInputs(thesis, canonicalSearchState);
  const uncertaintyLabel: MarketRealityArtifact["uncertaintyLabel"] = missingInputs.length ? "needs user input" : "based on role pattern";

  if (thesis === "Engineering Leadership Bottleneck") {
    return {
      roleShape: "Early-stage engineering leader who can take decision load from the founder.",
      marketDifficulty: "Hard",
      sourceLanes: [
        "Heads of Eng from founder-led startups",
        "EMs who owned product/eng tradeoffs",
        "Staff+ leads who already manage people",
        "Engineering leaders after messy rebuilds"
      ],
      tradeoffs: [
        "Widen title before lowering decision-ownership bar.",
        "Strong ICs are easier to find than true leaders.",
        "Big-company leaders may need too much structure."
      ],
      risks: [
        "Overvaluing architecture depth over decision ownership.",
        "Hiring a meeting layer instead of leverage.",
        "Expecting morale repair without authority transfer."
      ],
      missingInputs,
      nextMove: missingInputs.includes("location / remote flexibility") ? "Decide location flexibility before sourcing." : "Define the decisions this hire owns before sourcing.",
      uncertaintyLabel
    };
  }

  if (thesis === "Founder-Led Sales Transition") {
    return {
      roleShape: "First-sales builder who can turn founder-led wins into repeatable motion.",
      marketDifficulty: "Hard",
      sourceLanes: [
        "Early GTM hires after founder-led sales",
        "AEs who built before enablement existed",
        "Seed to Series A revenue builders",
        "Customer-facing founders turned operators"
      ],
      tradeoffs: [
        "Strong sellers are easier than true motion builders.",
        "Brand-led closers may struggle without leverage.",
        "Earlier-stage scar tissue matters more than title."
      ],
      risks: [
        "Hiring a polished AE who needs a machine.",
        "Confusing charisma with repeatability.",
        "Asking one hire to prove and manage the motion."
      ],
      missingInputs,
      nextMove: "Separate founder-only wins from repeatable wins.",
      uncertaintyLabel
    };
  }

  if (thesis === "Senior Ownership Gap") {
    return {
      roleShape: "Senior owner who can turn messy founder context into decisions.",
      marketDifficulty: "Moderate",
      sourceLanes: [
        "Senior operators from ambiguous startups",
        "Functional leads with true decision rights",
        "Ex-founder-adjacent owners",
        "Scale-up leads who owned undefined work"
      ],
      tradeoffs: [
        "Broader title search may improve quality.",
        "Seniority without decision rights is noise.",
        "Comp may rise if autonomy bar is high."
      ],
      risks: [
        "Mistaking polish for ownership.",
        "Hiring another escalation path.",
        "Keeping founder authority while asking for autonomy."
      ],
      missingInputs,
      nextMove: "Name the decisions this person must own independently.",
      uncertaintyLabel
    };
  }

  if (thesis === "Role Compression / Generalist Hire") {
    return {
      roleShape: "Founder-adjacent operator who can narrow a compressed role into one primary lane.",
      marketDifficulty: "Rare",
      sourceLanes: [
        "Early operators from very small teams",
        "Founder’s office profiles with owned outcomes",
        "Customer ops leaders with broad mandates",
        "Ex-founders or first business hires"
      ],
      tradeoffs: [
        "Loosen title, not accountability.",
        "Pick the primary lane before sourcing.",
        "The broader the role, the rarer the fit."
      ],
      risks: [
        "Hiring a smart helper instead of an owner.",
        "Asking one person to solve three jobs.",
        "Using generalist as a way to avoid org decisions."
      ],
      missingInputs,
      nextMove: "Pick the primary lane before opening the search.",
      uncertaintyLabel
    };
  }

  if (thesis === "Urgent Hiring Triage") {
    const leadershipCoverage = isLeadershipCoverageState(canonicalSearchState);
    return {
      roleShape: leadershipCoverage
        ? "Urgent leader who can stabilize a leadership gap without distorting the permanent role."
        : "Operational coverage hire who keeps customer and internal work from dropping.",
      marketDifficulty: leadershipCoverage ? "Hard" : "Moderate",
      sourceLanes: leadershipCoverage
        ? [
            "Operators with urgent leadership coverage proof",
            "Functional leads who stabilized messy gaps",
            "Founder’s office leaders with decision rights",
            "Interim leaders only if leadership is required"
          ]
        : [
            "Customer ops coordinators",
            "Implementation leads",
            "Customer success operators",
            "Ops generalists for dropped follow-ups"
          ],
      tradeoffs: [
        "Speed increases false-positive risk.",
        "Interim and permanent profiles may differ.",
        leadershipCoverage ? "Coverage now can hide the durable role shape." : "Coordinator profiles need clear decision boundaries."
      ],
      risks: [
        "Rushing into a permanent mis-hire.",
        "Solving panic while leaving the root problem.",
        leadershipCoverage ? "Overweighting availability over fit." : "Over-hiring seniority for coordination work."
      ],
      missingInputs,
      nextMove: leadershipCoverage
        ? "Define the 30-day leadership gap separately from the permanent hire."
        : "Separate coordination coverage from decision ownership.",
      uncertaintyLabel
    };
  }

  if (thesis === "Product/Execution Ownership Gap") {
    return {
      roleShape: "Product owner who can make tradeoff calls and keep engineering moving.",
      marketDifficulty: "Hard",
      sourceLanes: [
        "PMs from founder-led product teams",
        "Product-heavy builders from early startups",
        "Operators who owned product decisions",
        "PMs with messy customer signal experience"
      ],
      tradeoffs: [
        "Product judgment is rarer than roadmap ownership.",
        "Domain depth may trade off against founder-context fluency.",
        "Execution PMs may not solve decision ambiguity."
      ],
      risks: [
        "Hiring a roadmap secretary.",
        "Confusing stakeholder polish with judgment.",
        "Adding process before decision authority is clear."
      ],
      missingInputs,
      nextMove: "Decide which product decisions leave the founder’s plate.",
      uncertaintyLabel
    };
  }

  if (thesis === "Internal Technical Leadership Gap") {
    return {
      roleShape: "Technical owner who can turn existing team context into delegated decision-making.",
      marketDifficulty: "Moderate",
      sourceLanes: [
        "Internal technical leads with peer trust",
        "Staff engineers who led decisions without title",
        "Technical leads from founder-led startups",
        "Engineering managers with IC credibility"
      ],
      tradeoffs: [
        "Promotion may preserve context better than external hiring.",
        "External hires need authority clarity from day one.",
        "Technical depth trades off against people leverage."
      ],
      risks: [
        "Adding a senior title without decision rights.",
        "Overlooking the internal person already carrying context.",
        "Creating authority confusion on the team."
      ],
      missingInputs,
      nextMove: "Test whether the internal technical owner can lead with explicit authority.",
      uncertaintyLabel
    };
  }

  if (thesis === "Support Load Root Cause") {
    return {
      roleShape: "Customer-facing operator who can reduce support load by fixing the underlying loop.",
      marketDifficulty: "Moderate",
      sourceLanes: [
        "Support operators who reduced repeat demand",
        "Implementation leads with product feedback loops",
        "Customer ops owners at early B2B startups",
        "Post-sales operators who fixed onboarding"
      ],
      tradeoffs: [
        "Coverage helps today but may hide product friction.",
        "Root-cause ownership is rarer than ticket handling.",
        "Product fixes may matter more than more headcount."
      ],
      risks: [
        "Staffing around a broken product or onboarding loop.",
        "Hiring reps who clear queues but do not reduce demand.",
        "Treating urgency as proof that headcount is the answer."
      ],
      missingInputs,
      nextMove: "Separate immediate support coverage from the root cause creating repeat demand.",
      uncertaintyLabel
    };
  }

  return {
    roleShape: "High-ownership candidate who has solved the real operating tension before.",
    marketDifficulty: "Moderate",
    sourceLanes: [
      "People who owned similar ambiguity",
      "Early-stage operators with real decision rights",
      "Functional leads from messy startup environments"
    ],
    tradeoffs: [
      "Title match is less useful than problem match.",
      "Broader sourcing may improve signal quality.",
      "Too many constraints will shrink the useful pool."
    ],
    risks: [
      "Hiring for the visible title, not the real problem.",
      "Overweighting polish over ownership.",
      "Skipping the missing context that changes the search."
    ],
    missingInputs,
    nextMove: "Confirm the primary problem this hire must remove.",
    uncertaintyLabel
  };
}

function sourcingStrategyFor(signalMap: SignalMap, canonicalSearchState?: CanonicalSearchState): SourcingStrategyArtifact {
  const thesis = signalMap.derivedFromThesisTitle;
  const marketReality = marketProfileFor(signalMap, canonicalSearchState);
  const missingConstraints = marketMissingInputs(thesis, canonicalSearchState);
  const mustHaveFilters = signalMap.mustProveSignals.slice(0, 3).map(shortCompleteSignal);
  const avoidFilters = signalMap.falsePositives.slice(0, 3).map(negativeIndicatorFor);

  if (thesis === "Engineering Leadership Bottleneck") {
    return {
      targetProfile: "Engineering leader who has taken decision load from a technical founder.",
      searchLanes: [
        "EMs reporting directly to technical founders",
        "Early Heads of Eng from 10-50 person startups",
        "Staff+ leads who moved into people leadership",
        "Leaders who rebuilt messy execution rhythm"
      ],
      targetTitles: [
        "Head of Engineering",
        "Engineering Manager",
        "Director of Engineering",
        "Staff Engineering Lead",
        "Technical Lead Manager"
      ],
      mustHaveFilters,
      avoidFilters,
      searchLogic: [
        `"engineering manager" "founder-led" "startup"`,
        `"head of engineering" "10-50" "startup"`,
        `"staff engineer" "team lead" "shipping cadence"`
      ],
      outreachAngle: "A chance to turn founder-led engineering into a team that makes sharper decisions without adding bureaucracy.",
      missingConstraints
    };
  }

  if (thesis === "Founder-Led Sales Transition") {
    return {
      targetProfile: "First-sales builder who can turn founder magic into repeatable customer conversations.",
      searchLanes: [
        "First GTM hires after founder-led sales",
        "AEs who sold before enablement existed",
        "Seed to Series A revenue builders",
        "Customer-facing founders turned operators"
      ],
      targetTitles: ["Founding AE", "First Sales Hire", "GTM Lead", "Revenue Lead", "Head of Sales"],
      mustHaveFilters,
      avoidFilters,
      searchLogic: [
        `"founding AE" "founder-led sales"`,
        `"first sales hire" "seed" "startup"`,
        `"gtm lead" "built sales motion"`
      ],
      outreachAngle: "A chance to build the first real sales motion instead of inheriting someone else’s machine.",
      missingConstraints
    };
  }

  if (thesis === "Senior Ownership Gap") {
    if (!hasSpecifiedFunction(canonicalSearchState)) {
      return {
        targetProfile: "Directional senior owner; confirm the function before narrowing lanes.",
        searchLanes: [
          "Function-specific senior ICs or leads",
          "Operators who owned ambiguous decisions",
          "Team leads trusted with founder-level judgment",
          "Adjacent functional leads after function is clear"
        ],
        targetTitles: ["Senior IC", "Team Lead", "Functional Lead", "Senior Operator", "Owner"],
        mustHaveFilters,
        avoidFilters,
        searchLogic: [
          `"senior" "owned decisions" "startup"`,
          `"team lead" "ambiguous" "founder"`,
          `"functional lead" "ownership" "startup"`
        ],
        outreachAngle: "A role for someone who wants real authority, not another escalation path back to the founder.",
        missingConstraints: uniqueStrings(["function to seniorize", ...missingConstraints])
      };
    }

    return {
      targetProfile: "Senior owner who has turned messy founder context into clear decisions.",
      searchLanes: [
        "Senior operators with ambiguous mandates",
        "Functional leads with real decision rights",
        "Founder-adjacent owners",
        "Scale-up leads who owned undefined work"
      ],
      targetTitles: ["Senior Operator", "Business Operations Lead", "Strategy & Operations Lead", "Functional Lead", "Team Lead"],
      mustHaveFilters,
      avoidFilters,
      searchLogic: [
        `"owned ambiguous" "startup" "operator"`,
        `"business operations lead" "founder" "startup"`,
        `"chief of staff" "decision" "startup"`
      ],
      outreachAngle: "A role with real decision ownership, not a prettier version of status reporting.",
      missingConstraints
    };
  }

  if (thesis === "Role Compression / Generalist Hire") {
    return {
      targetProfile: "Founder-adjacent operator who can narrow a compressed role into the right primary lane.",
      searchLanes: [
        "Early operators from very small teams",
        "Ops generalists with owned outcomes",
        "Customer ops leads with broad mandates",
        "Ex-founders or first business hires"
      ],
      targetTitles: ["Generalist Operator", "Business Operations", "Special Projects Lead", "Customer Ops Lead", "First Business Hire"],
      mustHaveFilters,
      avoidFilters,
      searchLogic: [
        `"generalist operator" "owned" "startup"`,
        `"business operations" "early stage" "operator"`,
        `"special projects" "0 to 1" "startup"`
      ],
      outreachAngle: "A chance to own the messy center of the company, with enough clarity to avoid becoming a catch-all.",
      missingConstraints
    };
  }

  if (thesis === "Urgent Hiring Triage") {
    const leadershipCoverage = isLeadershipCoverageState(canonicalSearchState);
    return {
      targetProfile: leadershipCoverage
        ? "Urgent leadership coverage hire with clear temporary decision rights."
        : "Operational coverage person who keeps onboarding, follow-ups, and coordination from dropping.",
      searchLanes: leadershipCoverage
        ? [
            "Functional leads with crisis coverage proof",
            "Interim leaders only if authority is required",
            "Founder’s office leaders with decision rights",
            "Operators who stabilized urgent team gaps"
          ]
        : [
            "Customer ops coordinators",
            "Implementation coordinators",
            "Implementation leads",
            "CS ops / post-sales operators",
            "Ops generalists for dropped follow-ups"
          ],
      targetTitles: leadershipCoverage
        ? ["Interim Lead", "Operations Lead", "Functional Lead", "Special Projects Lead", "Crisis Operator"]
        : ["Customer Ops Coordinator", "Implementation Coordinator", "Implementation Lead", "Customer Success Operator", "Ops Generalist"],
      mustHaveFilters,
      avoidFilters,
      searchLogic: leadershipCoverage
        ? [
            `"interim lead" "urgent" "startup"`,
            `"functional lead" "stabilized" "startup"`,
            `"operations lead" "coverage" "startup"`
          ]
        : [
            `"customer ops coordinator" "onboarding"`,
            `"implementation coordinator" "follow-ups"`,
            `"customer success operator" "handoffs"`
          ],
      outreachAngle: leadershipCoverage
        ? "A focused urgent mandate with clear decision rights and clean boundaries."
        : "A practical coverage role where organized execution immediately lowers founder load.",
      missingConstraints
    };
  }

  if (thesis === "Product/Execution Ownership Gap") {
    return {
      targetProfile: "Product owner who can make tradeoff calls and keep engineering moving.",
      searchLanes: [
        "PMs from founder-led product teams",
        "Product-heavy builders from early startups",
        "Operators who owned product decisions",
        "PMs with messy customer signal experience"
      ],
      targetTitles: ["Product Manager", "Founding PM", "Product Lead", "Product Operator", "Growth/Product PM"],
      mustHaveFilters,
      avoidFilters,
      searchLogic: [
        `"founding PM" "customer signal" "startup"`,
        `"product lead" "founder-led" "tradeoffs"`,
        `"product manager" "shipped" "ambiguous"`
      ],
      outreachAngle: "A role for someone who wants real product judgment, not roadmap administration.",
      missingConstraints
    };
  }

  if (thesis === "Internal Technical Leadership Gap") {
    return {
      targetProfile: "Technical owner who can lead with existing context and explicit authority.",
      searchLanes: [
        "Internal technical leads with peer trust",
        "Staff engineers who owned technical decisions",
        "Technical leads from founder-led startups",
        "EMs with hands-on technical credibility"
      ],
      targetTitles: ["Staff Engineer", "Tech Lead", "Technical Lead Manager", "Engineering Manager", "Principal Engineer"],
      mustHaveFilters,
      avoidFilters,
      searchLogic: [
        `"staff engineer" "technical decisions" "startup"`,
        `"tech lead" "founder-led" "engineering"`,
        `"engineering manager" "hands-on" "startup"`
      ],
      outreachAngle: "A chance to own technical judgment with real authority, not just be the strongest engineer in the room.",
      missingConstraints
    };
  }

  if (thesis === "Support Load Root Cause") {
    return {
      targetProfile: "Customer-facing operator who reduces support load by fixing the loop behind it.",
      searchLanes: [
        "Support operators who reduced repeat demand",
        "Implementation leads with product feedback loops",
        "Customer ops owners at early B2B startups",
        "Post-sales operators who fixed onboarding"
      ],
      targetTitles: ["Implementation Lead", "Customer Operations Lead", "Solutions Lead", "Post-Sales Operations", "Customer Success Operations"],
      mustHaveFilters,
      avoidFilters,
      searchLogic: [
        `"implementation lead" "complex product" "startup"`,
        `"customer operations" "delivery" "workflow"`,
        `"solutions lead" "implementation" "B2B"`
      ],
      outreachAngle: "A chance to fix why customers need help, not just answer more tickets.",
      missingConstraints
    };
  }

  return {
    targetProfile: marketReality.roleShape,
    searchLanes: marketReality.sourceLanes,
    targetTitles: ["Operator", "Functional Lead", "Special Projects Lead", "Senior IC", "Team Lead"],
    mustHaveFilters,
    avoidFilters,
    searchLogic: [
      `"owned ambiguous work" "startup"`,
      `"founder-led" "operator" "decision"`,
      `"startup" "owned outcomes" "early stage"`
    ],
    outreachAngle: "A role with real ownership over the problem, not just the title.",
    missingConstraints
  };
}

function normalizeSourcingStrategy(strategy: SourcingStrategyArtifact): SourcingStrategyArtifact {
  const seen = new Set<string>();
  const addUnique = (values: string[], fallback: string[]) => {
    const output: string[] = [];
    for (const value of uniqueStrings([...values, ...fallback].map(cleanArtifactPhrase))) {
      const key = normalizeComparable(value);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      output.push(value);
    }
    return output;
  };

  const targetProfile = cleanArtifactPhrase(strategy.targetProfile);
  seen.add(normalizeComparable(targetProfile));

  return {
    targetProfile,
    searchLanes: addUnique(strategy.searchLanes, ["Adjacent proven owners"]),
    targetTitles: addUnique(strategy.targetTitles, ["Functional Lead"]),
    mustHaveFilters: addUnique(strategy.mustHaveFilters, ["Proof of owning the real problem"]),
    avoidFilters: addUnique(strategy.avoidFilters.map(negativeIndicatorFor), ["Title match without real ownership"]),
    searchLogic: uniqueStrings(strategy.searchLogic.map(cleanSearchQuery)).slice(0, 3),
    outreachAngle: cleanArtifactPhrase(strategy.outreachAngle),
    missingConstraints: uniqueStrings(strategy.missingConstraints.map(cleanArtifactPhrase))
  };
}

function cleanArtifactPhrase(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeComparable(value: string) {
  return cleanArtifactPhrase(value).toLowerCase().replace(/[^\w\s]/g, "").replace(/\s+/g, " ");
}

function cleanSearchQuery(value: string) {
  return cleanArtifactPhrase(value).replace(/public profiles?|named candidates?|searching public profiles/gi, "").trim();
}

function hasSpecifiedFunction(state?: CanonicalSearchState) {
  const text = [state?.roleTitle, state?.roleFamily].filter(Boolean).join(" ").toLowerCase();
  if (!text || /forming|unknown|unclear|other/.test(text)) return false;
  return /\b(engineering|product|design|gtm|sales|operations|manufacturing|recruiting|people|finance|legal|customer|implementation|success|marketing)\b/.test(text);
}

function isLeadershipCoverageState(state?: CanonicalSearchState) {
  const text = [
    state?.roleTitle,
    state?.roleFamily,
    state?.mustHaveSignals?.join(" "),
    state?.niceToHaveSignals?.join(" "),
    state?.lastUpdatedReason
  ].filter(Boolean).join(" ").toLowerCase();
  return /\b(head|vp|chief|executive|leadership|transformation|turnaround|decision rights|authority)\b/.test(text);
}

function marketMissingInputs(thesisTitle: string, state?: CanonicalSearchState) {
  const base: string[] = [];
  if (!state?.location || /forming/i.test(state.location)) base.push("location / remote flexibility");
  if (!state?.compensation || /forming/i.test(state.compensation)) base.push("comp range");
  if (!state?.seniority || /forming/i.test(state.seniority)) base.push("seniority tolerance");
  if (!state?.sourceCompanyLanes?.length) base.push("company stage");

  const thesis = thesisTitle.toLowerCase();
  if (thesis.includes("engineering leadership")) {
    base.push("reporting line", "founder decision rights / authority transfer");
  } else if (thesis.includes("founder-led sales")) {
    base.push("sales cycle type", "founder involvement in closing");
  } else if (thesis.includes("senior ownership")) {
    base.push("decision authority", "reporting line");
  } else if (thesis.includes("role compression")) {
    base.push("primary lane", "full-time vs fractional");
  } else if (thesis.includes("urgent")) {
    base.push("urgency", "full-time vs interim / fractional", "must-have vs nice-to-have signals");
    if (isOperationalCoverageState(state)) base.push("decision authority needed");
  } else if (thesis.includes("product")) {
    base.push("founder involvement", "must-have vs nice-to-have signals");
  } else if (thesis.includes("customer ops")) {
    base.push("implementation complexity", "founder escalation threshold");
  }

  return uniqueStrings(base).slice(0, 7);
}

function isOperationalCoverageState(state?: CanonicalSearchState) {
  const text = [
    state?.roleTitle,
    state?.roleFamily,
    state?.mustHaveSignals?.join(" "),
    state?.niceToHaveSignals?.join(" "),
    state?.lastUpdatedReason
  ].filter(Boolean).join(" ").toLowerCase();
  if (/\b(head|vp|chief|executive|leadership|transformation|turnaround)\b/.test(text)) return false;
  return /\b(onboarding|follow[-\s]?ups?|coordination|nothing drops|internal coordination|customer ops|implementation|support|success|ops)\b/.test(text);
}

function uniqueStrings(values: string[]) {
  return [...new Set(values.filter(Boolean))];
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

  if (thesis === "Support Load Root Cause") {
    return {
      scorecard: withRating([
        {
          competency: "Root-cause judgment",
          signal: "Separates queue volume from product friction.",
          strongEvidence: "Reduced repeat demand with a real fix.",
          redFlag: "Only adds coverage to the queue."
        },
        {
          competency: "Feedback loop",
          signal: "Turns support patterns into product learning.",
          strongEvidence: "Changed onboarding or product behavior.",
          redFlag: "Escalates patterns without closing the loop."
        },
        {
          competency: "Customer judgment",
          signal: "Protects trust while reducing founder escalation.",
          strongEvidence: "Kept customers while changing the workflow.",
          redFlag: "Manages tone but not the underlying issue."
        }
      ]),
      archetype: [
        { label: "Likely background", value: "Customer-facing operator who reduced repeat support demand." },
        { label: "Scar tissue", value: "Has fixed product or onboarding loops behind support volume." },
        { label: "False positive", value: "Friendly support rep who only clears tickets." },
        { label: "Best source lane", value: "Support ops, implementation, or customer ops owners." },
        { label: "Risk to verify", value: "Can they fix the loop, not just staff it?" }
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
  if (thesis === "Internal Technical Leadership Gap") return "Technical leads with delegated decision proof.";
  if (thesis === "Role Compression / Generalist Hire") return "Founder-adjacent operators who narrowed chaos.";
  if (thesis === "Urgent Hiring Triage") return "Crisis-capable leaders with fast stabilization proof.";
  if (thesis === "Product/Execution Ownership Gap") return "Product owners who shipped through founder ambiguity.";
  if (thesis === "Support Load Root Cause") return "Customer operators who reduced repeat support demand.";
  if (thesis === "Recruiting System Before Recruiter") return "Recruiting partners who fixed hiring loops before adding volume.";
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
