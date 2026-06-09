import type { CanonicalSearchState } from "@/lib/brain/canonicalSearchState";
import type { TinaMvpMessage } from "@/lib/tina-mvp/types";
import type { WorkingThesis } from "@/lib/tina-mvp/working-thesis";

export type CurrentReadMode = "discovery" | "thesis" | "calibration" | "execution" | "sourcing";

export type CurrentReadArchetype =
  | "Founder-Led Sales Transition"
  | "Engineering Leadership Bottleneck"
  | "Senior Ownership Gap"
  | "Internal Technical Leadership Gap"
  | "Role Compression / Generalist Hire"
  | "Urgent Hiring Triage"
  | "Product/Execution Ownership Gap"
  | "Operating Cadence / Founder Delegation Gap"
  | "Manager Enablement / Feedback Cadence Gap"
  | "Product/Ops Generalist Archetype"
  | "Workflow Ownership Before AI Hire"
  | "Founder Control / Product Delegation Gap"
  | "Support Load Root Cause"
  | "Recruiting System Before Recruiter"
  | "Marketing Positioning Gap"
  | "AI Prioritization Gap"
  | "Capital Allocation Diagnosis"
  | "Unknown / Needs Clarification";

export type CurrentRead = {
  mode: CurrentReadMode;
  thesisTitle: CurrentReadArchetype;
  observation: string;
  hypothesis: string;
  risk: string;
  confidence: "low" | "medium" | "high";
  stability: "emerging" | "committed" | "revising";
  whatWouldChangeMyMind: string;
  nextBestMove: string;
  calibratedScope: string[];
  evidence: string[];
  openTensions: string[];
  statedRole?: string;
  likelyArchetype?: CurrentReadArchetype;
};

export type CurrentReadAction = {
  label: string;
  prompt: string;
};

const UNKNOWN_READ: CurrentRead = {
  mode: "discovery",
  thesisTitle: "Unknown / Needs Clarification",
  observation: "No real founder signal yet.",
  hypothesis: "The hiring problem is still unclear.",
  risk: "A vague role can turn into a very expensive guess.",
  confidence: "low",
  stability: "emerging",
  whatWouldChangeMyMind: "One concrete description of what is breaking today.",
  nextBestMove: "Name what changed that makes this hire feel necessary now.",
  calibratedScope: [],
  evidence: [],
  openTensions: ["the actual business problem behind the role"],
  likelyArchetype: "Unknown / Needs Clarification"
};

export function buildCurrentRead(input: {
  messages: TinaMvpMessage[];
  canonicalSearchState?: CanonicalSearchState;
  workingThesis?: WorkingThesis;
  previousRead?: CurrentRead;
}): CurrentRead {
  const founderMessages = input.messages.filter((message) => message.role === "founder");
  if (!founderMessages.length) return UNKNOWN_READ;

  const founderText = founderMessages.map((message) => message.content).join(" ");
  const latestFounder = founderMessages[founderMessages.length - 1]?.content || "";
  const text = founderText.toLowerCase();
  const latestText = latestFounder.toLowerCase();
  const meaningfulSignals = countMeaningfulSignals(text, founderMessages.length);
  const roleFamily = input.canonicalSearchState?.roleFamily || "other";
  const statedRole = cleanStatedRole(input.canonicalSearchState?.roleTitle || "");
  const inferredArchetype = inferArchetype(text, latestText, roleFamily);
  const likelyArchetype = stabilizeArchetype(inferredArchetype, latestText, input.previousRead);
  const openTensions = collectCurrentReadTensions(text, input.canonicalSearchState);
  const confidence = inferConfidence(meaningfulSignals, input.workingThesis?.confidence);
  const stability = inferStability(likelyArchetype, input.previousRead, confidence, meaningfulSignals, latestText);
  const mode = inferCurrentReadMode(text, latestText, meaningfulSignals, input.canonicalSearchState);
  const baseRead = buildReadForArchetype(likelyArchetype, text, statedRole);
  const read = applyCalibrationProgression(baseRead, likelyArchetype, text, mode, confidence);

  return {
    mode,
    thesisTitle: likelyArchetype,
    observation: read.observation,
    hypothesis: read.hypothesis,
    risk: read.risk,
    confidence,
    stability,
    whatWouldChangeMyMind: read.whatWouldChangeMyMind,
    nextBestMove: read.nextBestMove,
    calibratedScope: collectCalibratedScope(text, input.canonicalSearchState, likelyArchetype),
    evidence: founderMessages.map((message) => message.content.trim()).filter(Boolean).slice(-5),
    openTensions,
    ...(statedRole ? { statedRole } : {}),
    likelyArchetype
  };
}

export function formatCurrentReadForPrompt(read: CurrentRead) {
  return [
    "Current Read:",
    `Mode: ${read.mode}`,
    `Thesis title: ${read.thesisTitle}`,
    `Observation: ${read.observation}`,
    `Hypothesis: ${read.hypothesis}`,
    `Risk: ${read.risk}`,
    `Confidence: ${read.confidence}`,
    `Stability: ${read.stability}`,
    `What would change my mind: ${read.whatWouldChangeMyMind}`,
    `Next best move: ${read.nextBestMove}`,
    read.statedRole ? `Stated role: ${read.statedRole}` : "",
    read.likelyArchetype ? `Likely archetype: ${read.likelyArchetype}` : "",
    read.calibratedScope.length ? `Calibrated scope: ${read.calibratedScope.join(" | ")}` : "",
    read.evidence.length ? `Evidence: ${read.evidence.join(" | ")}` : "",
    read.openTensions.length ? `Open tensions: ${read.openTensions.join(" | ")}` : "",
    "Thesis commitment rule: commit when evidence is sufficient, not when a fixed number of turns has passed. A committed read needs a likely root problem, at least two supporting signals, one named risk, what would change your mind, and a next move more specific than “clarify more”. Use this shape when the conversation needs crystallizing: “Here’s what I think is really going on: … This is probably not: … It is more likely: … The next best move: …”. If you cannot form a thesis yet, say exactly which missing signal prevents it.",
    "Thesis persistence rule: urgency can change the plan, but it should not erase the diagnosis. Tina can update her read, but she should not collapse her read just because the founder repeats urgency.",
    "Progression rule: when mode is calibration with medium or high confidence, state the committed thesis, name the practical risk, and recommend one concrete next move. Ask at most one narrow question only if it directly changes that next move.",
    "Progression rule: when mode is execution or confidence is high, stop asking broad clarifying questions. Produce a compact role thesis, a lightweight scorecard, and an interview plan. Ask only for one missing constraint if it would materially change the plan."
  ].filter(Boolean).join("\n");
}

export function currentReadTitle(read?: CurrentRead) {
  return read?.thesisTitle || read?.likelyArchetype || "Unknown / Needs Clarification";
}

export function actionButtonsForCurrentRead(read?: Pick<CurrentRead, "mode" | "likelyArchetype" | "nextBestMove">, hasTasteSignal = false): CurrentReadAction[] {
  if (!read || read.mode === "discovery" || read.mode === "thesis") {
    return [
      { label: "Pressure-test role shape", prompt: "Pressure-test the role shape for this hiring thesis." },
      { label: "Clarify ownership gap", prompt: "Clarify the ownership gap behind this hire." },
      { label: "Compare role archetypes", prompt: "Compare the likely role archetypes for this problem." }
    ];
  }

  if (read.mode === "calibration") {
    if (read.likelyArchetype === "Engineering Leadership Bottleneck") {
      return [
        { label: "Define decision ownership", prompt: "Define the 3 decisions this engineering leader must own without founder approval." },
        { label: "Build signal map", prompt: "Build signal map for this engineering leadership bottleneck." },
        { label: "Compare Head of Eng vs EM vs Staff+ Lead", prompt: "Compare whether this thesis needs a Head of Engineering, Engineering Manager, or Staff-plus technical lead." },
        { label: "Build scorecard", prompt: "Build a lightweight scorecard for this engineering leadership bottleneck." }
      ];
    }

    if (read.likelyArchetype === "Founder-Led Sales Transition") {
      return [
        { label: "Separate founder-only wins", prompt: "Separate founder-only sales wins from repeatable wins." },
        { label: "Build signal map", prompt: "Build signal map for this founder-led sales transition." },
        { label: "Define sales handoff", prompt: "Define what a first sales leader must take off the founder." },
        { label: "Build scorecard", prompt: "Build a lightweight scorecard for this founder-led sales transition." }
      ];
    }

    if (read.likelyArchetype === "Senior Ownership Gap") {
      return [
        { label: "Define decision ownership", prompt: "Define the decisions this senior hire must own without founder approval." },
        { label: "Build signal map", prompt: "Build signal map for this senior ownership gap." },
        { label: "Calibrate seniority", prompt: "Calibrate the seniority level needed for this ownership gap." },
        { label: "Build scorecard", prompt: "Build a lightweight scorecard for this senior ownership gap." }
      ];
    }

    if (read.likelyArchetype === "Role Compression / Generalist Hire") {
      return [
        { label: "Split the role", prompt: "Split this compressed generalist role into cleaner responsibility lanes." },
        { label: "Build signal map", prompt: "Build signal map for this role compression problem." },
        { label: "Pick primary lane", prompt: "Pick the primary lane this hire should actually solve first." },
        { label: "Compare archetypes", prompt: "Compare the likely archetypes for this role-compression problem." }
      ];
    }

    if (read.likelyArchetype === "Urgent Hiring Triage") {
      return [
        { label: "Define 30-day coverage", prompt: "Define what must be covered in the next 30 days before shaping the permanent hire." },
        { label: "Build signal map", prompt: "Build signal map for this urgent hiring triage." },
        { label: "Split interim vs permanent", prompt: "Separate the urgent coverage problem from the permanent role shape." },
        { label: "Build triage plan", prompt: "Build a hiring triage plan for this urgent gap." }
      ];
    }

    if (read.likelyArchetype === "Product/Execution Ownership Gap") {
      return [
        { label: "Define decision ownership", prompt: "Define which product decisions this hire must own without founder approval." },
        { label: "Build signal map", prompt: "Build signal map for this product ownership gap." },
        { label: "Compare PM archetypes", prompt: "Compare product archetypes for this ownership gap." },
        { label: "Build scorecard", prompt: "Build a lightweight scorecard for this product ownership gap." }
      ];
    }

    if (read.likelyArchetype === "Operating Cadence / Founder Delegation Gap") {
      return [
        { label: "Map operating cadence", prompt: "Map the operating cadence this founder needs before shaping a Head of Ops role." },
        { label: "Build signal map", prompt: "Build signal map for this operating cadence and founder delegation gap." },
        { label: "Define delegated decisions", prompt: "Define which operating decisions must leave the founder's head." },
        { label: "Compare ops archetypes", prompt: "Compare Head of Ops, ops lead, and founder-office operator for this gap." }
      ];
    }

    if (read.likelyArchetype === "Manager Enablement / Feedback Cadence Gap") {
      return [
        { label: "Design feedback cadence", prompt: "Design the manager feedback cadence needed before hiring a people leader." },
        { label: "Build signal map", prompt: "Build signal map for this manager enablement and feedback cadence gap." },
        { label: "Clarify founder role", prompt: "Clarify what feedback the founder must stop cushioning." },
        { label: "Compare people support", prompt: "Compare people leader, manager coach, and fractional people ops support." }
      ];
    }

    if (read.likelyArchetype === "Product/Ops Generalist Archetype") {
      return [
        { label: "Decode reference profile", prompt: "Decode the product/operator profile into hiring criteria." },
        { label: "Build signal map", prompt: "Build signal map for this product/ops generalist archetype." },
        { label: "Define culture code", prompt: "Define the culture-code signals this person must carry." },
        { label: "Compare generalist lanes", prompt: "Compare product operator, founder's office, and ops generalist lanes." }
      ];
    }

    if (read.likelyArchetype === "Workflow Ownership Before AI Hire") {
      return [
        { label: "Map workflow owner", prompt: "Map the workflow owner needed before hiring an AI specialist." },
        { label: "Build signal map", prompt: "Build signal map for this workflow ownership before AI hire thesis." },
        { label: "Separate AI vs workflow", prompt: "Separate what needs AI depth from what needs workflow ownership." },
        { label: "Build scorecard", prompt: "Build a lightweight scorecard for the workflow owner." }
      ];
    }

    if (read.likelyArchetype === "Founder Control / Product Delegation Gap") {
      return [
        { label: "Define product authority", prompt: "Define the product decisions the founder must delegate." },
        { label: "Build signal map", prompt: "Build signal map for this founder control and product delegation gap." },
        { label: "Compare VP Product vs PM lead", prompt: "Compare VP Product, Head of Product, and senior PM lead for this thesis." },
        { label: "Build scorecard", prompt: "Build a lightweight scorecard for product delegation." }
      ];
    }

    if (read.likelyArchetype === "Recruiting System Before Recruiter") {
      return [
        { label: "Map hiring loop", prompt: "Map the hiring loop that needs to exist before a full-time recruiter." },
        { label: "Build signal map", prompt: "Build signal map for this recruiting system gap." },
        { label: "Compare fractional vs full-time", prompt: "Compare fractional recruiting help versus a full-time recruiter." },
        { label: "Build scorecard", prompt: "Build a lightweight scorecard for this recruiting system gap." }
      ];
    }

    if (read.likelyArchetype === "Support Load Root Cause") {
      return [
        { label: "Separate coverage vs root cause", prompt: "Separate immediate support coverage from the root cause creating support load." },
        { label: "Build signal map", prompt: "Build signal map for this support load root cause." },
        { label: "Map feedback loop", prompt: "Map the product/support feedback loop behind this support load." },
        { label: "Build scorecard", prompt: "Build a lightweight scorecard for this support load root cause." }
      ];
    }

    if (read.likelyArchetype === "Internal Technical Leadership Gap") {
      return [
        { label: "Clarify internal owner", prompt: "Clarify whether the existing technical person can become the owner." },
        { label: "Build signal map", prompt: "Build signal map for this internal technical leadership gap." },
        { label: "Compare promote vs hire", prompt: "Compare promoting an internal technical lead versus hiring externally." },
        { label: "Build scorecard", prompt: "Build a lightweight scorecard for this internal technical leadership gap." }
      ];
    }

    return [
      { label: "Define scorecard", prompt: "Define a lightweight scorecard for this hiring thesis." },
      { label: "Build signal map", prompt: "Build signal map for this hiring thesis." },
      { label: "Build candidate archetype", prompt: "Build the candidate archetype for this hiring thesis." },
      { label: "Set must-have signals", prompt: "Set the must-have signals for this hire." }
    ];
  }

  const executionActions: CurrentReadAction[] = [
    { label: "Build signal map", prompt: "Build signal map for this hiring thesis." },
    { label: "Create interview plan", prompt: "Create an interview plan for this hiring thesis." },
    { label: "Source against this thesis", prompt: "Source against this hiring thesis." },
    { label: "Build search lanes", prompt: "Build search lanes for this hiring thesis." }
  ];

  if (read.mode === "execution") return executionActions;

  return [
    { label: "Source against this thesis", prompt: "Source against this hiring thesis." },
    ...(hasTasteSignal ? [{ label: "Find people like this", prompt: "Find people like the strongest saved or selected profiles." }] : []),
    { label: "Refine Talent Pool", prompt: "Refine this search based on my Talent Pool feedback. Find another batch." }
  ];
}

function applyCalibrationProgression(
  read: ReturnType<typeof buildReadForArchetype>,
  archetype: CurrentReadArchetype,
  text: string,
  mode: CurrentReadMode,
  confidence: CurrentRead["confidence"]
) {
  if (mode !== "calibration" || confidence === "low") return read;

  const founderStillOwnsDecisions = /\b(founder|mostly me|i still|still makes|comes? back to me|waiting on me|my call|approval|priority calls?|product priority|technical calls?)\b/i.test(text);

  if (archetype === "Engineering Leadership Bottleneck") {
    return {
      ...read,
      hypothesis: founderStillOwnsDecisions
        ? "This is likely an engineering leadership bottleneck, but the real issue is decision ownership."
        : read.hypothesis,
      risk: founderStillOwnsDecisions
        ? "Hiring a Head of Engineering without transferring decision authority creates a coordination layer, not leverage."
        : "A Head of Engineering who cannot own technical tradeoffs will become a meeting layer over the same founder bottleneck.",
      whatWouldChangeMyMind: "Evidence that the team has clear technical decision rights and only lacks people-management bandwidth.",
      nextBestMove: "Define the 3 decisions this hire must own without founder approval."
    };
  }

  if (archetype === "Founder-Led Sales Transition") {
    return {
      ...read,
      risk: "If you hire a VP before the repeatable part of founder-led sales is named, they may professionalize the wrong motion.",
      nextBestMove: "Separate founder-only wins from repeatable wins before choosing first sales leader versus true VP."
    };
  }

  if (archetype === "Senior Ownership Gap") {
    return {
      ...read,
      risk: "If authority does not move with the hire, seniority becomes expensive reassurance rather than actual leverage.",
      nextBestMove: "Define the decisions this person must own independently, then calibrate seniority around that authority."
    };
  }

  if (archetype === "Role Compression / Generalist Hire") {
    return {
      ...read,
      risk: "If the role stays compressed, you will screen for range and then blame the hire for not being three people.",
      nextBestMove: "Pick the primary lane this hire must solve first, then treat the rest as tradeoffs."
    };
  }

  if (archetype === "Urgent Hiring Triage") {
    return {
      ...read,
      risk: "Panic can make the temporary gap look like the permanent role.",
      nextBestMove: "Define the 30-day coverage problem separately from the permanent hire."
    };
  }

  if (archetype === "Product/Execution Ownership Gap") {
    return {
      ...read,
      risk: "If decision rights stay with the founder, the PM becomes a narrator of work instead of an owner of tradeoffs.",
      nextBestMove: "Define which product decisions this hire must own without founder approval."
    };
  }

  if (archetype === "Operating Cadence / Founder Delegation Gap") {
    return {
      ...read,
      risk: "If the founder keeps operating rhythm in their head, a Head of Ops becomes a reminder system instead of leverage.",
      nextBestMove: "Write down the weekly cadence and decisions this person must own without founder translation."
    };
  }

  if (archetype === "Manager Enablement / Feedback Cadence Gap") {
    return {
      ...read,
      risk: "A people leader cannot create manager accountability if the founder keeps softening the hard feedback.",
      nextBestMove: "Define the feedback cadence managers must run before deciding whether this needs a people leader or manager coach."
    };
  }

  if (archetype === "Product/Ops Generalist Archetype") {
    return {
      ...read,
      risk: "Admiring a high-agency operator can turn into a vague generalist search unless the operating pattern is named.",
      nextBestMove: "Translate the admired profile into proof signals: judgment, pace, customer proximity, and cross-functional ownership."
    };
  }

  if (archetype === "Workflow Ownership Before AI Hire") {
    return {
      ...read,
      risk: "Hiring ML depth before the workflow is owned can produce technical sophistication on top of a confused user journey.",
      nextBestMove: "Assign ownership of the onboarding workflow, then decide which parts actually need AI depth."
    };
  }

  if (archetype === "Founder Control / Product Delegation Gap") {
    return {
      ...read,
      risk: "A VP Product will not create leverage if roadmap authority still lives with the founder.",
      nextBestMove: "Define the product decisions the founder will no longer own before shaping the VP Product search."
    };
  }

  if (archetype === "Recruiting System Before Recruiter") {
    return {
      ...read,
      risk: "A recruiter will not fix unclear roles, slow founder feedback, or an uncalibrated interview loop.",
      nextBestMove: "Define the repeatable hiring loop before deciding fractional help versus a full-time recruiter."
    };
  }

  if (archetype === "Support Load Root Cause") {
    return {
      ...read,
      risk: "Adding reps may clear the queue while leaving the product, onboarding, or implementation problem untouched.",
      nextBestMove: "Separate temporary support coverage from the root cause creating the support load."
    };
  }

  if (archetype === "Internal Technical Leadership Gap") {
    return {
      ...read,
      risk: "Hiring externally before testing the internal technical owner can create a heavier layer instead of clearer leadership.",
      nextBestMove: "Clarify whether the existing technical lead can own decisions with explicit authority."
    };
  }

  return read;
}

export function buildCurrentReadResponseSketch(messages: TinaMvpMessage[]) {
  const read = buildCurrentRead({ messages });

  if (read.mode === "discovery") {
    return `I cannot commit yet because ${read.whatWouldChangeMyMind.toLowerCase()}. ${read.nextBestMove}`;
  }

  return [
    "Here’s what I think is really going on:",
    read.hypothesis,
    "This is probably not:",
    wrongAssumptionFor(read),
    "It is more likely:",
    read.likelyArchetype || "Unknown / Needs Clarification",
    "The next best move:",
    read.nextBestMove
  ].join(" ");
}

function inferCurrentReadMode(
  text: string,
  latestText: string,
  meaningfulSignals: number,
  state?: CanonicalSearchState
): CurrentReadMode {
  if (isPlanningArtifactRequest(latestText)) return "execution";
  if (!isOperatingPullPhrase(latestText) && /\b(source|pull|find|show|get|build).*\b(profiles?|candidates?|people|leads?|list)\b/i.test(latestText)) return "sourcing";
  if (state?.candidateProfiles?.length) return "sourcing";
  if (/\b(scorecard|search lane|search plan|pull|source|candidates?|profiles?|ready|execute|go ahead)\b/i.test(text)) return "execution";
  if (meaningfulSignals >= 5) return "execution";
  if (meaningfulSignals >= 3) return "calibration";
  if (meaningfulSignals >= 2) return "thesis";
  return "discovery";
}

function isOperatingPullPhrase(text: string) {
  return /\bpull(?:ing)?\s+(people|engineers?|team|folks|resources?)\s+off\b/i.test(text) ||
    /\btake\s+(people|engineers?|team|folks|resources?)\s+off\b/i.test(text);
}

function isPlanningArtifactRequest(text: string) {
  return /\b(hiring thesis|must[-\s]?have signals?|signal map|scorecard|candidate archetype|interview plan|criteria|rubric|role shape|tradeoffs?)\b/i.test(text);
}

function inferArchetype(text: string, latestText: string, roleFamily: string): CurrentReadArchetype {
  if (/\b(\$500k|500k|500,000|capital allocation|budget allocation|what should i do next|what should we do next)\b/i.test(text)) return "Capital Allocation Diagnosis";
  if (isWorkflowBeforeAiHire(text)) return "Workflow Ownership Before AI Hire";
  if (isManagerEnablementGap(text)) return "Manager Enablement / Feedback Cadence Gap";
  if (isFounderControlProductGap(text)) return "Founder Control / Product Delegation Gap";
  if (isOperatingCadenceFounderDelegationGap(text)) return "Operating Cadence / Founder Delegation Gap";
  if (isProductOpsGeneralistArchetype(text)) return "Product/Ops Generalist Archetype";
  if (/\b(recruiter|recruiting|sourcer|talent acquisition)\b/i.test(text)) return "Recruiting System Before Recruiter";
  if (/\b(vp marketing|head of marketing|marketing leader|growth is slow|positioning|icp|acquisition channel|demand gen)\b/i.test(text)) return "Marketing Positioning Gap";
  if (/\b(ai team|build an ai|ai roadmap|customers.*ai|existing roadmap|shiny object)\b/i.test(text)) return "AI Prioritization Gap";
  if (/\b(vp sales|head of sales|sales leader|ae\b|account executive|gtm|revenue)\b/i.test(text) || roleFamily === "gtm") return "Founder-Led Sales Transition";
  if (/\b(head of eng|head of engineering|engineering manager|eng leader|engineering leadership|cto|vp engineering)\b/i.test(text)) return "Engineering Leadership Bottleneck";
  if (/\b(staff engineer|tech lead|technical lead|existing technical|promote|promotion|level up|clarify.*technical|internal.*technical)\b/i.test(text) && /\b(existing|already|internal|promote|team|lead)\b/i.test(text)) return "Internal Technical Leadership Gap";
  if (/\b(more senior|senior person|adult in the room|experienced|too junior|not senior enough|run themselves|autonomy|independent)\b/i.test(text)) return "Senior Ownership Gap";
  if (/\b(generalist|chief of staff|founder.?s office|operator|wear many hats|do everything|all of it)\b/i.test(text)) return "Role Compression / Generalist Hire";
  if (/\b(customer ops|implementation|support|support reps?|success|onboarding|customer success|deployment|tickets?|queue|handoffs?)\b/i.test(text)) return "Support Load Root Cause";
  if (/\b(vp product|chief product|cpo|pm|product manager|head of product|product lead|priorities|prioritization|alignment|product execution|ship)\b/i.test(text) || roleFamily === "product") return "Product/Execution Ownership Gap";
  if (/\b(urgent|asap|fast|yesterday|panic|lost|left|need now|quickly)\b/i.test(text) || /\b(urgent|asap|fast|panic|need now|quickly)\b/i.test(latestText)) return "Urgent Hiring Triage";
  if (roleFamily === "engineering") return "Engineering Leadership Bottleneck";
  return "Unknown / Needs Clarification";
}

function isOperatingCadenceFounderDelegationGap(text: string) {
  return /\b(head of ops|operations leader|ops lead|operator|operating cadence|cadence|operating rhythm|everything in (my|the founder'?s) head|keeps? everything in (my|the founder'?s) head)\b/i.test(text) &&
    /\b(first[-\s]?time founder|first startup|founder keeps|in my head|founder'?s head|no cadence|no operating cadence|delegat|handoff|operating rhythm)\b/i.test(text) &&
    !/\b(engineering|technical|head of eng|vp engineering|staff engineer)\b/i.test(text);
}

function isManagerEnablementGap(text: string) {
  return /\b(people leader|head of people|people ops|manager enablement|manager training|first[-\s]?time managers?|new managers?|feedback cadence|delayed feedback|hard conversations?|performance feedback)\b/i.test(text) &&
    /\b(first[-\s]?time managers?|delayed feedback|feedback.*late|cushion|cushions|soften|hard conversations?|manager cadence|founder.*feedback)\b/i.test(text);
}

function isProductOpsGeneralistArchetype(text: string) {
  return /\b(product.?ops|product\/ops|product operator|operator profile|high[-\s]?agency|people like this|profile like this|reference profile|culture code|people dna|look for people like)\b/i.test(text) &&
    /\b(product|operator|ops|generalist|high[-\s]?agency|customer|workflow)\b/i.test(text) &&
    !/\b(sales|revenue|ae\b|account executive|quota|pipeline)\b/i.test(text);
}

function isWorkflowBeforeAiHire(text: string) {
  return /\b(ml phd|phd|machine learning|ai hire|ai team|ai engineer|model|llm)\b/i.test(text) &&
    /\b(onboarding|activation|workflow|workflow complexity|low data|not enough data|apis?|existing engineers?|engineers can use|customer journey)\b/i.test(text);
}

function isFounderControlProductGap(text: string) {
  return /\b(vp product|chief product|cpo|head of product|product leader)\b/i.test(text) &&
    /\b(founder owns|i own|roadmap|priority churn|priorities keep changing|low trust|pms? exist|existing pms?|don'?t trust|trust is low|founder control|delegat)\b/i.test(text);
}

function stabilizeArchetype(inferred: CurrentReadArchetype, latestText: string, previousRead?: CurrentRead): CurrentReadArchetype {
  if (!previousRead || previousRead.thesisTitle === "Unknown / Needs Clarification") return inferred;
  if (previousRead.stability !== "committed") return inferred;
  if (isExplicitCorrection(latestText)) return inferred;
  if (isConcreteContradictoryEvidence(latestText, previousRead.thesisTitle, inferred)) return inferred;
  if (inferred === "Urgent Hiring Triage" && previousRead.thesisTitle !== "Urgent Hiring Triage") return previousRead.thesisTitle;
  if (inferred === "Senior Ownership Gap" && previousRead.thesisTitle !== "Senior Ownership Gap") return previousRead.thesisTitle;
  if (isRepeatedOriginalRequest(latestText) || isConstraintOnlyUpdate(latestText)) return previousRead.thesisTitle;
  if (/^(yes|sure|ok|okay|sounds good|sounds great|great|makes sense|asap|urgent|need now)$/i.test(latestText.trim())) return previousRead.thesisTitle;
  return inferred;
}

function isExplicitCorrection(text: string) {
  return /\b(actually|no,|not that|i mean|switch|changed|different role|new role)\b/i.test(text);
}

function isRepeatedOriginalRequest(text: string) {
  return /\b(i still need|we still need|just hire|just need|need this|need them|need someone|hire now|find someone|source|pull candidates)\b/i.test(text) &&
    !/\b(actually|i mean|different|not|instead|new role)\b/i.test(text);
}

function isConstraintOnlyUpdate(text: string) {
  return /\b(asap|urgent|fast|quickly|senior|more senior|junior|remote|sf|nyc|comp|salary|budget|full[-\s]?time|fractional|interim|location|speed)\b/i.test(text) &&
    !/\b(actually|i mean|different|not|instead|new role|engineering|product|sales|support|people|ops|ai)\b/i.test(text);
}

function isConcreteContradictoryEvidence(latestText: string, previous: CurrentReadArchetype, inferred: CurrentReadArchetype) {
  if (previous === inferred) return false;
  if (inferred === "Unknown / Needs Clarification" || inferred === "Urgent Hiring Triage" || inferred === "Senior Ownership Gap") return false;
  if (previous === "Operating Cadence / Founder Delegation Gap" && /\b(engineering|technical|sales|revenue|product roadmap|people manager|support tickets|ai)\b/i.test(latestText)) return true;
  if (previous === "Founder Control / Product Delegation Gap" && /\b(not product|engineering|sales|support|people|ops cadence)\b/i.test(latestText)) return true;
  if (previous === "Workflow Ownership Before AI Hire" && /\b(research|model architecture|training data|ml platform|deep learning|phd required)\b/i.test(latestText)) return true;
  return /\b(actually|i mean|different|not that|instead)\b/i.test(latestText);
}

function inferStability(
  archetype: CurrentReadArchetype,
  previousRead: CurrentRead | undefined,
  confidence: CurrentRead["confidence"],
  meaningfulSignals: number,
  latestText: string
): CurrentRead["stability"] {
  if (previousRead?.thesisTitle && previousRead.thesisTitle !== archetype && previousRead.thesisTitle !== "Unknown / Needs Clarification") return "revising";
  if (archetype === "Unknown / Needs Clarification") return "emerging";
  if (confidence === "high" && meaningfulSignals >= 3) return "committed";
  if (confidence === "medium" && meaningfulSignals >= 2 && !/\b(maybe|not sure|don't know|unsure)\b/i.test(latestText)) return "committed";
  return "emerging";
}

function buildReadForArchetype(archetype: CurrentReadArchetype, text: string, statedRole: string) {
  switch (archetype) {
    case "Founder-Led Sales Transition":
      return {
        observation: "Founder-led sales usually breaks when the founder is still the best closer but no longer the best repeatable system.",
        hypothesis: "This is likely a transition from founder instinct to a repeatable GTM motion, not just a VP Sales search.",
        risk: "Hiring a polished sales leader too early can add process before the company knows what actually closes.",
        whatWouldChangeMyMind: "Evidence that the sales motion is already repeatable and the issue is pure management capacity.",
        nextBestMove: "Separate founder-only wins from repeatable wins, then decide whether this is a hands-on first sales leader or a true VP."
      };
    case "Engineering Leadership Bottleneck":
      return {
        observation: "Engineering leadership gaps often look like hiring gaps, but the real pain is usually decision latency and quality control.",
        hypothesis: "This is likely an engineering leadership bottleneck: the team needs stronger technical judgment and operating cadence, not just another senior IC.",
        risk: "If the role is shaped too broadly, you will hire someone who manages meetings but does not raise the technical bar.",
        whatWouldChangeMyMind: "Evidence that technical decisions are healthy and the real issue is raw execution bandwidth.",
        nextBestMove: "Name whether the bottleneck is architecture, people leadership, shipping discipline, or founder dependency."
      };
    case "Senior Ownership Gap":
      return {
        observation: "When founders ask for someone more senior, they usually mean they are tired of being the backstop for judgment.",
        hypothesis: "This is a senior ownership gap: the company needs someone who can carry ambiguity and make calls without pulling the founder into every decision.",
        risk: "You may overpay for years of experience and still get someone who escalates instead of owns.",
        whatWouldChangeMyMind: "Evidence that the current team has judgment but lacks authority or context.",
        nextBestMove: "Define the decisions this person must own independently, then calibrate seniority and comp around that authority."
      };
    case "Role Compression / Generalist Hire":
      return {
        observation: "Generalist hires are often a sign that several jobs are being compressed into one person because the founder has not chosen the real constraint.",
        hypothesis: "This is probably a role-compression problem: you need to decide which problem deserves the hire, not find one person for every loose end.",
        risk: "The search will attract impressive generalists who still disappoint because the job is secretly three jobs.",
        whatWouldChangeMyMind: "Evidence that one operating lane clearly dominates the need.",
        nextBestMove: "Pick the primary lane first: founder leverage, operations cleanup, customer work, GTM, or product execution."
      };
    case "Urgent Hiring Triage":
      return {
        observation: "Urgency changes the hire: the right answer may be interim coverage or scope reduction, not a perfect permanent search.",
        hypothesis: "This is urgent hiring triage: stabilize the gap first, then decide whether the permanent role should look different.",
        risk: "Moving fast can lock the company into the wrong seniority or wrong shape because panic feels like clarity.",
        whatWouldChangeMyMind: "Evidence that the role is already well-defined and the only issue is candidate supply.",
        nextBestMove: "Separate the next 30-day coverage problem from the permanent hire."
      };
    case "Product/Execution Ownership Gap":
      return {
        observation: "Product problems often get labeled as PM needs when the real issue is who has the authority to make tradeoffs stick.",
        hypothesis: "This is likely a product/execution ownership gap: priorities and decisions are not leaving the founder cleanly enough.",
        risk: "A process-heavy PM may add updates and meetings without actually taking decision load off the founder.",
        whatWouldChangeMyMind: "Evidence that product judgment is strong and the issue is mostly project throughput.",
        nextBestMove: "Clarify whether this person must own product taste, execution discipline, customer signal, or founder leverage."
      };
    case "Operating Cadence / Founder Delegation Gap":
      return {
        observation: "When the operating rhythm lives in the founder's head, hiring ops capacity does not automatically create delegation.",
        hypothesis: "This is likely an operating cadence and founder delegation gap: the company needs repeatable rhythm and decision ownership before a classic Head of Ops layer.",
        risk: "A Head of Ops can become a translation layer for the founder's brain instead of the person who makes the company run without it.",
        whatWouldChangeMyMind: "Evidence that weekly cadence, decision rights, and handoffs are already explicit and the only gap is senior ops capacity.",
        nextBestMove: "Define the weekly operating cadence and the decisions this person owns without founder translation."
      };
    case "Manager Enablement / Feedback Cadence Gap":
      return {
        observation: "People problems in first-time manager teams often look like a people-leader hire when the real gap is feedback cadence.",
        hypothesis: "This is likely a manager enablement and feedback cadence gap: managers need a sharper operating rhythm for hard conversations, not just HR coverage.",
        risk: "A people leader will get pulled into cushioning feedback unless the founder and managers agree who owns the hard conversations.",
        whatWouldChangeMyMind: "Evidence that managers already give timely direct feedback and the gap is policy, compliance, or people operations capacity.",
        nextBestMove: "Define the feedback cadence managers must run and what the founder will stop cushioning."
      };
    case "Product/Ops Generalist Archetype":
      return {
        observation: "A founder admiring a high-agency product/operator is usually describing a company gene, not a clean job title.",
        hypothesis: "This is likely a product/ops generalist archetype: the search should decode the behaviors that make the reference profile work inside this company.",
        risk: "Searching for a clone will overfit pedigree and miss the actual culture code: judgment, pace, customer proximity, and ownership.",
        whatWouldChangeMyMind: "Evidence that the admired profile maps to one narrow function rather than a cross-functional operating pattern.",
        nextBestMove: "Translate the admired person into proof signals and false positives before sourcing."
      };
    case "Workflow Ownership Before AI Hire":
      return {
        observation: "Asking for ML depth on an onboarding problem can hide the simpler issue: nobody owns the workflow tightly enough yet.",
        hypothesis: "This is likely workflow ownership before AI hire: activation and process complexity need a clear owner before a specialized ML PhD.",
        risk: "A deep AI hire may build sophistication around a workflow that still lacks product ownership, data volume, and operational clarity.",
        whatWouldChangeMyMind: "Evidence that the workflow is already owned, data is sufficient, and the technical uncertainty truly requires ML research depth.",
        nextBestMove: "Name the onboarding workflow owner and the activation decision they must own before hiring AI depth."
      };
    case "Founder Control / Product Delegation Gap":
      return {
        observation: "When PMs exist but roadmap churn continues, the gap is usually not more product capacity; it is product authority.",
        hypothesis: "This is likely founder control and product delegation gap: the founder still owns the roadmap, so PMs cannot stabilize priorities.",
        risk: "A VP Product becomes a polished messenger unless the founder actually transfers roadmap decision rights.",
        whatWouldChangeMyMind: "Evidence that PMs already hold roadmap authority and the churn comes from market change rather than founder override.",
        nextBestMove: "Define which roadmap and priority decisions the founder will no longer own."
      };
    case "Internal Technical Leadership Gap":
      return {
        observation: "A Staff Engineer request can be a signal that the company already has technical talent but not a clear technical owner.",
        hypothesis: "This is likely an internal technical leadership gap: clarify or level up the existing technical owner before assuming an external hire is the answer.",
        risk: "An external senior hire may add authority confusion if the internal technical lead is already carrying the real context.",
        whatWouldChangeMyMind: "Evidence that nobody internal can own technical judgment even with explicit decision rights.",
        nextBestMove: "Compare promote/clarify versus external hire before shaping the search."
      };
    case "Support Load Root Cause":
      return {
        observation: "Support load often looks like a staffing problem when it is really a product, onboarding, or feedback-loop problem.",
        hypothesis: "This is likely a support load root cause: add coverage if needed, but diagnose why customers keep needing help.",
        risk: "More support reps can hide the broken loop and teach the company to staff around product friction.",
        whatWouldChangeMyMind: "Evidence that the product and onboarding are healthy and the only issue is raw ticket volume.",
        nextBestMove: "Separate immediate queue coverage from the product/support loop creating repeat demand."
      };
    case "Recruiting System Before Recruiter":
      return {
        observation: "A first recruiter only helps if the company already has a hiring system for them to run.",
        hypothesis: "This is likely recruiting system before recruiter: probably not a full-time recruiter yet unless volume and calibration are already real.",
        risk: "A recruiter hired too early becomes a scheduling layer around unclear roles and slow founder decisions.",
        whatWouldChangeMyMind: "Evidence of sustained hiring volume, calibrated roles, and a founder who is mostly blocked by sourcing throughput.",
        nextBestMove: "Build the hiring plan and calibrated interview process first, then decide between fractional recruiting help and a full-time hire."
      };
    case "Marketing Positioning Gap":
      return {
        observation: "Slow growth before ICP, positioning, and channel proof is usually a strategy problem wearing a marketing-title costume.",
        hypothesis: "This is likely a positioning or PMF clarity gap, not a VP Marketing scale-up search yet.",
        risk: "A senior marketer may scale guesses before the company knows who it is for or which channel works.",
        whatWouldChangeMyMind: "Evidence that ICP, message, and one acquisition motion already work and the gap is leadership capacity.",
        nextBestMove: "Decide whether the next hire must discover ICP/positioning or scale a channel that already works."
      };
    case "AI Prioritization Gap":
      return {
        observation: "AI can be strategic, but a team is the wrong starting point if the customer pull and roadmap tradeoff are unclear.",
        hypothesis: "This is likely a product prioritization problem, not an AI team design problem yet.",
        risk: "Building an AI team without demand or a roadmap can steal capacity from the existing product promises.",
        whatWouldChangeMyMind: "Evidence that customers are asking for a specific AI workflow and it beats the current roadmap priorities.",
        nextBestMove: "Define the customer problem AI would solve and what existing roadmap work you would stop to fund it."
      };
    case "Capital Allocation Diagnosis":
      return {
        observation: "A budget number is not a strategy; it only becomes useful once the business bottleneck is named.",
        hypothesis: "Tina should diagnose the company stage, runway, PMF, team shape, and bottleneck before recommending any allocation.",
        risk: "Allocating money before diagnosis creates fake precision and can turn runway into scattered bets.",
        whatWouldChangeMyMind: "Clear context on stage, revenue, runway, team size, PMF, founder strengths, biggest bottleneck, and growth objective.",
        nextBestMove: "Ask for stage, revenue, runway, team size, PMF signal, founder strengths, biggest bottleneck, and the next growth objective before allocating the money."
      };
    default:
      return {
        observation: statedRole ? `${statedRole} is a role label, but the actual operating problem is still thin.` : "The role label is not enough signal yet.",
        hypothesis: "Tina should not commit beyond the fact that there is an unresolved hiring or ownership problem.",
        risk: "A vague role can turn into a very expensive guess.",
        whatWouldChangeMyMind: "One concrete answer about what is breaking and who owns it today.",
        nextBestMove: "Ask for the pressure point behind the hire before shaping the role."
      };
  }
}

function countMeaningfulSignals(text: string, founderMessageCount: number) {
  const patterns = [
    /\b(priorit|alignment|bottleneck|ship|conversion|reliability|onboarding|sales|revenue|pipeline|customers?)\b/i,
    /\b(founder|mostly me|my plate|less dependent|run themselves|autonomy|independent|own)\b/i,
    /\b(senior|head|vp|lead|experienced|more senior|first startup|third company|people|raised|\$)\b/i,
    /\b(urgent|asap|fast|hard|panic|lost|left|not enough|no one|nobody)\b/i,
    /\b(sf|san francisco|remote|nyc|us|fintech|web3|ai|healthcare|manufacturing|b2b|saas)\b/i
  ];
  return patterns.reduce((count, pattern) => count + (pattern.test(text) ? 1 : 0), 0) + Math.max(0, founderMessageCount - 1);
}

function inferConfidence(meaningfulSignals: number, thesisConfidence?: WorkingThesis["confidence"]) {
  if (thesisConfidence === "high" || meaningfulSignals >= 4) return "high";
  if (thesisConfidence === "medium" || meaningfulSignals >= 2) return "medium";
  return "low";
}

function collectCalibratedScope(text: string, state: CanonicalSearchState | undefined, archetype: CurrentReadArchetype) {
  const scope = [
    state?.roleTitle && state.roleTitle !== "Role forming" ? state.roleTitle : "",
    state?.location && state.location !== "Location forming" ? state.location : "",
    state?.seniority && state.seniority !== "Seniority forming" ? state.seniority : "",
    ...(state?.mustHaveSignals || [])
  ].filter(Boolean);

  if (!scope.length && archetype !== "Unknown / Needs Clarification") scope.push(archetype);
  if (/\bautonomy|independent|run themselves|mostly me|founder\b/i.test(text)) scope.push("decision ownership");
  if (/\bpriorit|alignment\b/i.test(text)) scope.push("prioritization clarity");
  if (/\burgent|asap|fast\b/i.test(text)) scope.push("speed pressure");

  return Array.from(new Set(scope)).slice(0, 5);
}

function collectCurrentReadTensions(text: string, state?: CanonicalSearchState) {
  const tensions: string[] = [];
  if (state?.location === "Location forming") tensions.push("location / remote constraint");
  if (state?.seniority === "Seniority forming") tensions.push("seniority and authority level");
  if (/\bautonomy|independent|run themselves|mostly me|founder\b/i.test(text)) tensions.push("founder readiness to give away decisions");
  if (/\bpriorit|alignment\b/i.test(text)) tensions.push("decision rights vs execution bandwidth");
  if (/\bfast|urgent|asap|left|lost\b/i.test(text)) tensions.push("short-term coverage vs permanent role shape");
  if (!tensions.length) tensions.push("the real problem behind the role");
  return Array.from(new Set(tensions)).slice(0, 4);
}

function cleanStatedRole(roleTitle: string) {
  if (!roleTitle || /forming/i.test(roleTitle)) return "";
  return roleTitle;
}

function wrongAssumptionFor(read: CurrentRead) {
  if (read.likelyArchetype === "Role Compression / Generalist Hire") return "that one impressive generalist can cleanly absorb every loose end";
  if (read.likelyArchetype === "Urgent Hiring Triage") return "that the fastest permanent hire is automatically the safest move";
  if (read.likelyArchetype === "Founder-Led Sales Transition") return "that a classic sales executive is the answer before the motion is repeatable";
  if (read.likelyArchetype === "Engineering Leadership Bottleneck") return "that adding another senior engineer will fix leadership latency";
  if (read.likelyArchetype === "Product/Execution Ownership Gap") return "that a PM title alone solves founder decision load";
  if (read.likelyArchetype === "Operating Cadence / Founder Delegation Gap") return "that a Head of Ops can run what still only exists in the founder's head";
  if (read.likelyArchetype === "Manager Enablement / Feedback Cadence Gap") return "that a people leader can replace manager feedback cadence";
  if (read.likelyArchetype === "Product/Ops Generalist Archetype") return "that the goal is to clone a profile instead of decode the operating pattern";
  if (read.likelyArchetype === "Workflow Ownership Before AI Hire") return "that ML depth is the first answer before workflow ownership is clear";
  if (read.likelyArchetype === "Founder Control / Product Delegation Gap") return "that a VP Product fixes roadmap churn without founder delegation";
  if (read.likelyArchetype === "Recruiting System Before Recruiter") return "that recruiter capacity is the bottleneck before the hiring plan is calibrated";
  if (read.likelyArchetype === "Support Load Root Cause") return "that adding support reps automatically fixes the customer problem";
  if (read.likelyArchetype === "Internal Technical Leadership Gap") return "that an external senior engineer is the only way to create technical leadership";
  if (read.likelyArchetype === "Marketing Positioning Gap") return "that a VP Marketing can scale ICP and channels that are not proven yet";
  if (read.likelyArchetype === "AI Prioritization Gap") return "that an AI team is the right first move before customer pull and roadmap tradeoffs are clear";
  if (read.likelyArchetype === "Capital Allocation Diagnosis") return "that the $500K should be allocated before the company bottleneck is diagnosed";
  return "that the stated role title is the whole problem";
}
