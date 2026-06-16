import type { CanonicalSearchState } from "@/lib/brain/canonicalSearchState";
import type { CurrentRead } from "@/lib/tina-mvp/current-read";
import type { SignalMap } from "@/lib/tina-mvp/signal-map";
import type { TinaMvpMessage } from "@/lib/tina-mvp/types";

export type CurrentThesisMemory = {
  statedRole?: string;
  currentDiagnosis: string;
  hiddenRootProblem: string;
  founderConstraints: string[];
  changedFromOriginalRequest: string[];
  roleShapeBeingConsidered: string;
  rejectedRiskyRoleShapes: string[];
  mustProveSignals: string[];
  unresolvedQuestions: string[];
  explicitUserFacts: string[];
};

export function buildCurrentThesisMemory(input: {
  messages: TinaMvpMessage[];
  currentRead: CurrentRead;
  canonicalSearchState?: CanonicalSearchState;
  signalMap?: SignalMap;
}): CurrentThesisMemory {
  const founderMessages = input.messages.filter((message) => message.role === "founder");
  const founderFacts = founderMessages.map((message) => cleanText(message.content)).filter(Boolean).slice(-8);
  const fullFounderText = founderMessages.map((message) => message.content).join(" ");
  const originalRole = firstStatedRole(founderMessages) || input.currentRead.statedRole || input.canonicalSearchState?.roleTitle;
  const diagnosis = input.currentRead.likelyArchetype || input.currentRead.thesisTitle;
  const thesisSignals = thesisSpecificSignals(diagnosis);

  return {
    ...(originalRole ? { statedRole: originalRole } : {}),
    currentDiagnosis: diagnosis,
    hiddenRootProblem: input.currentRead.hypothesis,
    founderConstraints: extractFounderConstraints(fullFounderText),
    changedFromOriginalRequest: changedFromOriginalRequest(originalRole, diagnosis, fullFounderText),
    roleShapeBeingConsidered: roleShapeFor(diagnosis, input.currentRead, input.canonicalSearchState),
    rejectedRiskyRoleShapes: uniqueStrings([
      ...(input.signalMap?.falsePositives || []),
      ...riskyShapesFor(diagnosis)
    ]).slice(0, 5),
    mustProveSignals: uniqueStrings([
      ...(input.signalMap?.mustProveSignals || []),
      ...thesisSignals,
      ...input.currentRead.calibratedScope
    ]).slice(0, 5),
    unresolvedQuestions: uniqueStrings(input.currentRead.openTensions).slice(0, 4),
    explicitUserFacts: founderFacts
  };
}

export function formatCurrentThesisMemoryForPrompt(memory: CurrentThesisMemory) {
  return [
    "Current thesis memory:",
    memory.statedRole ? `Original/stated role: ${memory.statedRole}` : "",
    `Current diagnosis: ${memory.currentDiagnosis}`,
    `Hidden/root problem: ${memory.hiddenRootProblem}`,
    memory.founderConstraints.length ? `Founder constraints: ${memory.founderConstraints.join(" | ")}` : "",
    memory.changedFromOriginalRequest.length ? `What changed from original request: ${memory.changedFromOriginalRequest.join(" | ")}` : "",
    `Role shape being considered: ${memory.roleShapeBeingConsidered}`,
    memory.rejectedRiskyRoleShapes.length ? `Rejected/risky role shapes: ${memory.rejectedRiskyRoleShapes.join(" | ")}` : "",
    memory.mustProveSignals.length ? `Must-prove signals: ${memory.mustProveSignals.join(" | ")}` : "",
    memory.unresolvedQuestions.length ? `Unresolved questions: ${memory.unresolvedQuestions.join(" | ")}` : "",
    memory.explicitUserFacts.length ? `Explicit user facts: ${memory.explicitUserFacts.join(" | ")}` : "",
    "Artifact grounding rule: artifacts must use Current diagnosis, Role shape, Rejected/risky shapes, and Must-prove signals above. Do not anchor artifacts on the original role title when the diagnosis has shifted. Do not invent facts not listed here."
  ].filter(Boolean).join("\n");
}

function firstStatedRole(messages: TinaMvpMessage[]) {
  const first = messages.find((message) => /\b(i need|we need|looking for|hire|hiring)\b/i.test(message.content));
  if (!first) return undefined;
  const match = first.content.match(/\b(?:i|we)\s+(?:think\s+)?need\s+(?:a|an|the)?\s*([^,.!?]{2,60})/i) ||
    first.content.match(/\b(?:looking for|hiring|hire)\s+(?:a|an|the)?\s*([^,.!?]{2,60})/i);
  return match?.[1] ? titleCase(cleanText(match[1])) : undefined;
}

function extractFounderConstraints(text: string) {
  const constraints: string[] = [];
  const lower = text.toLowerCase();
  if (/\b(remote|sf|san francisco|bay area|nyc|new york|peoria|chicago|austin|seattle|london)\b/.test(lower)) {
    constraints.push(cleanLocationConstraint(lower));
  }
  if (/\$\d|\b(comp|compensation|salary|budget|pay range|cash comp)\b/i.test(text)) {
    constraints.push("Compensation constraint was mentioned by founder.");
  }
  if (/\b(equity|cofounder|co-founder|contractor|agency|fractional|full[-\s]?time)\b/i.test(text)) {
    constraints.push("Equity or engagement model tradeoff was mentioned.");
  }
  if (/\b\d+\s+(?:pm|pms|engineers|people|reps|hires|roles|team members)\b/i.test(text)) {
    constraints.push("Team or hiring volume was stated.");
  }
  return uniqueStrings(constraints);
}

function changedFromOriginalRequest(originalRole: string | undefined, diagnosis: string, text: string) {
  const changes: string[] = [];
  const lower = text.toLowerCase();
  if (originalRole && !diagnosis.toLowerCase().includes(originalRole.toLowerCase())) {
    changes.push(`Shifted from title "${originalRole}" to "${diagnosis}".`);
  }
  if (diagnosis === "Founder Control / Product Delegation Gap") {
    changes.push("Founder-owned roadmap, weak PM pushback, or reactive planning became the real issue.");
  }
  if (diagnosis === "Recruiting System Before Recruiter") {
    changes.push("Recruiting system readiness matters more than a full-time recruiter title.");
  }
  if (diagnosis === "Support Load Root Cause") {
    changes.push("Support load points to product/onboarding loop before pure headcount.");
  }
  if (/\b(actually|not that|no,?|instead|changed my mind|not .* but)\b/i.test(lower)) {
    changes.push("Founder corrected or narrowed the original request.");
  }
  return uniqueStrings(changes).slice(0, 4);
}

function roleShapeFor(diagnosis: string, read: CurrentRead, state?: CanonicalSearchState) {
  if (diagnosis === "Founder Control / Product Delegation Gap") return "Interim senior product operator or product rhythm setter trusted with roadmap calls.";
  if (diagnosis === "Product/Execution Ownership Gap") return "Product owner who can make tradeoff calls and keep execution moving.";
  if (diagnosis === "Recruiting System Before Recruiter") return "Fractional recruiter or recruiting operator paired with a tighter hiring loop.";
  if (diagnosis === "Support Load Root Cause") return "Customer-facing operator who fixes repeated support demand, not just ticket volume.";
  if (diagnosis === "Engineering Leadership Bottleneck") return "Engineering leader who takes decision load from the founder.";
  if (diagnosis === "Founder-Led Sales Transition") return "First GTM builder who turns founder-led wins into repeatable motion.";
  return read.statedRole || state?.roleTitle || "The role shape is still being calibrated.";
}

function riskyShapesFor(diagnosis: string) {
  if (diagnosis === "Founder Control / Product Delegation Gap") {
    return [
      "Classic VP Product who needs cleaner authority than the company has.",
      "Senior PM who reports options back to the founder.",
      "Process-heavy product leader who adds planning without trust transfer."
    ];
  }
  if (diagnosis === "Recruiting System Before Recruiter") {
    return [
      "Full-time recruiter before role criteria and feedback loops exist.",
      "Coordinator who cannot shift founder or hiring-manager behavior."
    ];
  }
  if (diagnosis === "Support Load Root Cause") {
    return [
      "Support rep who clears tickets but leaves repeat demand untouched.",
      "Customer success hire who escalates every product gap."
    ];
  }
  return [];
}

function thesisSpecificSignals(diagnosis: string) {
  if (diagnosis === "Founder Control / Product Delegation Gap") {
    return [
      "Has taken roadmap authority from a founder without slowing the team down.",
      "Can create lightweight planning cadence in seed-stage chaos.",
      "Can coach existing PMs while owning hard priority calls."
    ];
  }
  if (diagnosis === "Recruiting System Before Recruiter") {
    return [
      "Can tighten intake and feedback loops before scaling sourcing.",
      "Can make hiring managers faster and more decisive.",
      "Can distinguish recruiter need from hiring-system gaps."
    ];
  }
  return [];
}

function cleanLocationConstraint(text: string) {
  if (/\bremote\b/.test(text)) return "Remote preference was stated.";
  if (/\b(sf|san francisco|bay area)\b/.test(text)) return "Bay Area / SF location was stated.";
  if (/\bnyc|new york\b/.test(text)) return "NYC location was stated.";
  if (/\bpeoria\b/.test(text)) return "Peoria location was stated.";
  return "Specific location was stated.";
}

function titleCase(value: string) {
  return value
    .split(/\s+/)
    .map((word) => word ? word[0].toUpperCase() + word.slice(1).toLowerCase() : "")
    .join(" ")
    .trim();
}

function cleanText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function uniqueStrings(values: string[]) {
  return [...new Set(values.map(cleanText).filter(Boolean))];
}
