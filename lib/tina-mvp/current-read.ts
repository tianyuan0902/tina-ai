import type { CanonicalSearchState } from "@/lib/brain/canonicalSearchState";
import type { TinaMvpMessage } from "@/lib/tina-mvp/types";
import type { WorkingThesis } from "@/lib/tina-mvp/working-thesis";

export type CurrentReadMode = "discovery" | "thesis" | "calibration" | "execution" | "sourcing";

export type CurrentReadArchetype =
  | "Founder-Led Sales Transition"
  | "Engineering Leadership Bottleneck"
  | "Senior Ownership Gap"
  | "Role Compression / Generalist Hire"
  | "Urgent Hiring Triage"
  | "Product/Execution Ownership Gap"
  | "Customer Ops / Implementation Gap"
  | "Unknown / Needs Clarification";

export type CurrentRead = {
  mode: CurrentReadMode;
  observation: string;
  hypothesis: string;
  risk: string;
  confidence: "low" | "medium" | "high";
  whatWouldChangeMyMind: string;
  nextBestMove: string;
  statedRole?: string;
  likelyArchetype?: CurrentReadArchetype;
};

const UNKNOWN_READ: CurrentRead = {
  mode: "discovery",
  observation: "No real founder signal yet.",
  hypothesis: "The hiring problem is still unnamed.",
  risk: "If Tina commits too early, the product will turn a vague role label into a fake search plan.",
  confidence: "low",
  whatWouldChangeMyMind: "One concrete description of what is breaking today.",
  nextBestMove: "Ask what changed that makes this hire feel necessary now.",
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
  const likelyArchetype = inferArchetype(text, roleFamily);
  const confidence = inferConfidence(meaningfulSignals, input.workingThesis?.confidence);
  const mode = inferCurrentReadMode(text, latestText, meaningfulSignals, input.canonicalSearchState);
  const read = buildReadForArchetype(likelyArchetype, text, statedRole);

  return {
    mode,
    observation: read.observation,
    hypothesis: read.hypothesis,
    risk: read.risk,
    confidence,
    whatWouldChangeMyMind: read.whatWouldChangeMyMind,
    nextBestMove: read.nextBestMove,
    ...(statedRole ? { statedRole } : {}),
    likelyArchetype
  };
}

export function formatCurrentReadForPrompt(read: CurrentRead) {
  return [
    "Current Read:",
    `Mode: ${read.mode}`,
    `Observation: ${read.observation}`,
    `Hypothesis: ${read.hypothesis}`,
    `Risk: ${read.risk}`,
    `Confidence: ${read.confidence}`,
    `What would change my mind: ${read.whatWouldChangeMyMind}`,
    `Next best move: ${read.nextBestMove}`,
    read.statedRole ? `Stated role: ${read.statedRole}` : "",
    read.likelyArchetype ? `Likely archetype: ${read.likelyArchetype}` : "",
    "Thesis commitment rule: after 1-2 meaningful founder answers, state what you think is really going on. Use this shape when the conversation needs crystallizing: “Here’s what I think is really going on: … This is probably not: … It is more likely: … The next best move: …”. If you cannot form a thesis yet, say exactly which missing signal prevents it. Do not keep circling discovery once this read has medium or high confidence."
  ].filter(Boolean).join("\n");
}

export function currentReadTitle(read?: CurrentRead) {
  return read?.likelyArchetype || "Unknown / Needs Clarification";
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
  if (/\b(source|pull|find|show|get|build).*\b(profiles?|candidates?|people|leads?|list)\b/i.test(latestText)) return "sourcing";
  if (state?.candidateProfiles?.length) return "sourcing";
  if (/\b(scorecard|search lane|search plan|pull|source|candidates?|profiles?|ready|execute|go ahead)\b/i.test(text)) return "execution";
  if (meaningfulSignals >= 3) return "calibration";
  if (meaningfulSignals >= 2) return "thesis";
  return "discovery";
}

function inferArchetype(text: string, roleFamily: string): CurrentReadArchetype {
  if (/\b(vp sales|head of sales|sales leader|ae\b|account executive|gtm|revenue)\b/i.test(text) || roleFamily === "gtm") return "Founder-Led Sales Transition";
  if (/\b(head of eng|head of engineering|engineering manager|eng leader|engineering leadership|cto|vp engineering)\b/i.test(text)) return "Engineering Leadership Bottleneck";
  if (/\b(more senior|senior person|adult in the room|experienced|too junior|not senior enough|run themselves|autonomy|independent)\b/i.test(text)) return "Senior Ownership Gap";
  if (/\b(generalist|chief of staff|founder.?s office|operator|wear many hats|do everything|all of it)\b/i.test(text)) return "Role Compression / Generalist Hire";
  if (/\b(urgent|asap|fast|yesterday|panic|lost|left|need now|quickly)\b/i.test(text)) return "Urgent Hiring Triage";
  if (/\b(pm|product manager|head of product|product lead|priorities|prioritization|alignment|product execution|ship)\b/i.test(text) || roleFamily === "product") return "Product/Execution Ownership Gap";
  if (/\b(customer ops|implementation|support|success|onboarding|customer success|deployment)\b/i.test(text)) return "Customer Ops / Implementation Gap";
  if (roleFamily === "engineering") return "Engineering Leadership Bottleneck";
  return "Unknown / Needs Clarification";
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
    case "Customer Ops / Implementation Gap":
      return {
        observation: "Customer implementation gaps are usually where product promises meet operational reality.",
        hypothesis: "This is likely a customer ops or implementation ownership gap, not a generic operations hire.",
        risk: "Hiring too generic an operator can hide the real need: someone who can translate messy customer work into repeatable delivery.",
        whatWouldChangeMyMind: "Evidence that customers are healthy and the issue is internal process only.",
        nextBestMove: "Name whether the pain is onboarding, deployment, support load, or product feedback loops."
      };
    default:
      return {
        observation: statedRole ? `${statedRole} is a role label, but the actual operating problem is still thin.` : "The role label is not enough signal yet.",
        hypothesis: "Tina should not commit beyond the fact that there is an unresolved hiring or ownership problem.",
        risk: "Committing now would turn a vague request into fake conviction.",
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
  return "that the stated role title is the whole problem";
}
