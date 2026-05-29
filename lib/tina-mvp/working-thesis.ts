import type { CanonicalSearchState } from "@/lib/brain/canonicalSearchState";
import type { TinaMvpMessage } from "@/lib/tina-mvp/types";

export type WorkingThesis = {
  currentHypothesis: string;
  confidence: "low" | "medium" | "high";
  evidence: string[];
  resolvedSignals: string[];
  openTensions: string[];
  alternativeExplanations: string[];
  latestInsight: string;
  nextBestQuestion?: string;
};

const EMPTY_THESIS: WorkingThesis = {
  currentHypothesis: "The hiring problem is still too thin to name.",
  confidence: "low",
  evidence: [],
  resolvedSignals: [],
  openTensions: ["the actual business problem behind the role"],
  alternativeExplanations: ["This may be a role request, a founder bottleneck, or a temporary operating gap."],
  latestInsight: "No meaningful founder signal has been provided yet.",
  nextBestQuestion: "What is breaking that makes this hire feel necessary now?"
};

export function buildWorkingThesis(messages: TinaMvpMessage[], state?: CanonicalSearchState): WorkingThesis {
  const founderMessages = messages.filter((message) => message.role === "founder");
  if (!founderMessages.length) return EMPTY_THESIS;

  const founderText = founderMessages.map((message) => message.content).join(" ");
  const latestFounder = founderMessages[founderMessages.length - 1]?.content || "";
  const text = founderText.toLowerCase();
  const latestText = latestFounder.toLowerCase();
  const role = state?.roleTitle && state.roleTitle !== "Role forming" ? state.roleTitle : inferRoleLabel(text);
  const evidence = collectEvidence(founderMessages);
  const resolvedSignals = collectResolvedSignals(text, role);
  const openTensions = collectOpenTensions(text, state);
  const alternativeExplanations = collectAlternativeExplanations(text, role);
  const confidence = resolvedSignals.length >= 4 ? "high" : resolvedSignals.length >= 2 ? "medium" : "low";
  const currentHypothesis = inferCurrentHypothesis(text, role);
  const latestInsight = inferLatestInsight(latestText, role);
  const nextBestQuestion = inferNextBestQuestion(latestText, text, openTensions);

  return {
    currentHypothesis,
    confidence,
    evidence,
    resolvedSignals,
    openTensions,
    alternativeExplanations,
    latestInsight,
    ...(nextBestQuestion ? { nextBestQuestion } : {})
  };
}

export function formatWorkingThesisForPrompt(thesis: WorkingThesis) {
  return [
    "Working thesis progression:",
    `Current hypothesis: ${thesis.currentHypothesis}`,
    `Confidence: ${thesis.confidence}`,
    `Evidence: ${formatList(thesis.evidence)}`,
    `Resolved signals: ${formatList(thesis.resolvedSignals)}`,
    `Open tensions: ${formatList(thesis.openTensions)}`,
    `Alternative explanations: ${formatList(thesis.alternativeExplanations)}`,
    `Latest insight: ${thesis.latestInsight}`,
    thesis.nextBestQuestion ? `Next best question or move: ${thesis.nextBestQuestion}` : "Next best question or move: move to recommendation if the thesis is stable.",
    "Use this as the live conversation thesis. Do not repeat the latest insight in different words. Build on the current hypothesis. If the founder gives new evidence, update the thesis. If the thesis is stable, move to recommendation, role shape, search lane, or the next concrete step. If the founder says sounds good, sounds great, yes, or similar agreement, do not restate the diagnosis."
  ].join("\n");
}

export function buildWorkingThesisWithAssistant(
  messages: TinaMvpMessage[],
  assistantContent: string,
  state?: CanonicalSearchState
) {
  return buildWorkingThesis([
    ...messages,
    { id: "tina-working-thesis-response", role: "tina", content: assistantContent }
  ], state);
}

export function buildWorkingThesisResponseSketch(messages: TinaMvpMessage[]) {
  const thesis = buildWorkingThesis(messages);
  const latestFounder = [...messages].reverse().find((message) => message.role === "founder")?.content || "";

  if (isAgreement(latestFounder)) {
    return [
      "Good, then I would stop diagnosing and turn this into the role shape.",
      "The hire is a senior product thinker who can take founder decision load without adding process theater.",
      "I would anchor the search on people who have owned ambiguous priorities with real authority, then align location and comp before pulling profiles."
    ].join(" ");
  }

  return [
    thesis.currentHypothesis,
    thesis.latestInsight,
    thesis.nextBestQuestion || "The next move is to turn the thesis into a role shape or search lane."
  ].join(" ");
}

function collectEvidence(founderMessages: TinaMvpMessage[]) {
  return founderMessages
    .map((message) => message.content.trim())
    .filter(Boolean)
    .slice(-5);
}

function collectResolvedSignals(text: string, role: string) {
  const signals: string[] = [];
  if (/\b(pm|product manager|head of product|product lead)\b/.test(text) || /product/i.test(role)) signals.push("role direction is product");
  if (/\bpriorit(y|ies|ization)|alignment\b/.test(text)) signals.push("pain is prioritization or alignment");
  if (/\bmostly me|founder|less dependent|bottleneck|my plate\b/.test(text)) signals.push("founder is currently carrying too much decision load");
  if (/\brun themselves|autonom(y|ous)|independent|without me|own it\b/.test(text)) signals.push("hire needs independent judgment and authority");
  if (/\bno one|nobody|not good enough|not enough|no internal|haven't started|hasn['’]?t started\b/.test(text)) signals.push("internal fallback is weak or unavailable");
  if (/\bsounds good|sounds great|makes sense|yes|yeah|ok|okay\b/.test(text)) signals.push("founder has accepted the current thesis");
  return signals.slice(0, 6);
}

function collectOpenTensions(text: string, state?: CanonicalSearchState) {
  const tensions: string[] = [];
  if (!/\b(sf|san francisco|nyc|new york|remote|us|u\.s\.|united states|bay area|chicago|peoria|austin|seattle|london)\b/i.test(text) && state?.location === "Location forming") {
    tensions.push("location or remote constraint before sourcing");
  }
  if (!/\b(senior|lead|staff|principal|head|director|vp)\b/i.test(text) && state?.seniority === "Seniority forming") {
    tensions.push("how much seniority and authority the role needs");
  }
  if (/\bautonom|run themselves|less dependent|mostly me|founder\b/i.test(text)) {
    tensions.push("whether the founder is ready to give away real decision authority");
  }
  if (/\bpriority|priorities|alignment\b/i.test(text)) {
    tensions.push("whether the bottleneck is product judgment, team trust, or decision rights");
  }
  if (!tensions.length) tensions.push("the exact operating problem this hire should change");
  return Array.from(new Set(tensions)).slice(0, 4);
}

function collectAlternativeExplanations(text: string, role: string) {
  const alternatives: string[] = [];
  if (/\bpm|product manager|product/i.test(`${text} ${role}`)) {
    alternatives.push("This could be a PM hire, but it could also be a founder decision-load problem.");
    alternatives.push("If the team lacks trust or authority, hiring a process-heavy PM may not fix the bottleneck.");
  } else {
    alternatives.push("This may be a hiring need, a temporary ownership gap, or a role-design problem.");
  }
  if (/\bpriorit|alignment\b/i.test(text)) alternatives.push("Prioritization pain can come from unclear strategy, not just missing headcount.");
  if (/\bautonom|run themselves|less dependent\b/i.test(text)) alternatives.push("The hard part may be transferring authority, not finding a qualified person.");
  return alternatives.slice(0, 4);
}

function inferCurrentHypothesis(text: string, role: string) {
  if (/\brun themselves|autonom(y|ous)|independent|without me|own it\b/.test(text)) {
    return `This is not a junior ${role} or coordinator search; it requires a senior independent thinker who can absorb ambiguity and make decisions without routing everything back to the founder.`;
  }
  if (/\bmostly me|less dependent|founder bottleneck|my plate\b/.test(text)) {
    return `The ${role} request is moving toward a founder leverage problem: decisions are still routing through the founder, so the hire needs judgment and real ownership.`;
  }
  if (/\bpriorit(y|ies|ization)|alignment\b/.test(text)) {
    return `This is less about generic ${role} coverage and more about a prioritization or decision-rights bottleneck.`;
  }
  if (/\bpm|product manager|head of product|product lead\b/.test(text) || /product/i.test(role)) {
    return `The ${role} title is probably a placeholder; the real question is what work should stop depending on the founder.`;
  }
  return `The current hypothesis is that ${role} may be a symptom of an unresolved ownership or operating gap.`;
}

function inferLatestInsight(latestText: string, role: string) {
  if (isAgreement(latestText)) {
    return "Agreement added no new evidence; Tina should advance the accepted thesis into role shape, search lane, or concrete next step.";
  }
  if (/\brun themselves|autonom(y|ous)|independent|without me|own it\b/.test(latestText)) {
    return "The phrase about running themselves makes authority transfer the hard part, not basic role competence.";
  }
  if (/\bmostly me|less dependent|founder bottleneck|my plate\b/.test(latestText)) {
    return "The founder is still the routing layer; the hire needs to remove decisions, not just manage communication.";
  }
  if (/\bpriorit(y|ies|ization)|alignment\b/.test(latestText)) {
    return "Prioritization and alignment usually mean nobody owns the final call strongly enough.";
  }
  if (/\bnot enough|not good enough|no one|nobody|no internal\b/.test(latestText)) {
    return "The absence of an internal fallback raises the bar; this cannot be solved with a lightweight coordinator profile.";
  }
  return `The latest answer should be interpreted against the ${role} hypothesis before moving the workflow forward.`;
}

function inferNextBestQuestion(latestText: string, allText: string, openTensions: string[]) {
  if (isAgreement(latestText)) return undefined;
  if (/\brun themselves|autonom(y|ous)|independent|without me|own it\b/.test(latestText)) {
    return "Move from diagnosis to role shape or search lane; do not ask another autonomy question.";
  }
  if (!/\b(sf|san francisco|nyc|new york|remote|us|u\.s\.|united states|bay area|chicago|peoria|austin|seattle|london)\b/i.test(allText)) {
    return "Where should this search live: SF/Bay Area, NYC, remote US, or somewhere else?";
  }
  return openTensions[0] ? `Clarify ${openTensions[0]}.` : undefined;
}

function inferRoleLabel(text: string) {
  if (/\bhead of product\b/.test(text)) return "Head of Product";
  if (/\bpm|product manager|product lead\b/.test(text)) return "PM";
  if (/\bengineer|developer\b/.test(text)) return "Engineer";
  return "the hire";
}

function isAgreement(text: string) {
  return /^\s*(sounds good|sounds great|great|yes|yeah|yep|makes sense|ok|okay|love it|that works)\s*[.!?]*\s*$/i.test(text);
}

function formatList(items: string[]) {
  return items.length ? items.join(" | ") : "none yet";
}
