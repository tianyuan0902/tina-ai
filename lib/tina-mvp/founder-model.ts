import type { CanonicalSearchState } from "@/lib/brain/canonicalSearchState";
import type { TinaMvpMessage } from "@/lib/tina-mvp/types";

export type FounderModel = {
  founderProfile: "repeat_founder" | "first_time_founder" | "unknown";
  companyStage: string;
  likelyFailureMode: string;
  challengeLevel: "low" | "medium" | "high";
  assumptions: string[];
  language: string;
  responseAngle: string;
};

export function buildFounderModel(messages: TinaMvpMessage[], state?: CanonicalSearchState): FounderModel {
  const founderText = messages.filter((message) => message.role === "founder").map((message) => message.content).join(" ");
  const text = founderText.toLowerCase();
  const founderProfile = inferFounderProfile(text);
  const companyStage = inferCompanyStage(text);
  const roleTitle = state?.roleTitle && state.roleTitle !== "Role forming" ? state.roleTitle : "the role";

  if (founderProfile === "repeat_founder") {
    return {
      founderProfile,
      companyStage,
      likelyFailureMode: `Over-correcting from prior company pattern and hiring a ${roleTitle} for leverage before naming which decisions should leave the founder.`,
      challengeLevel: "medium",
      assumptions: [
        "They likely know the mechanics of hiring and need sharper tradeoff pressure, not basic education.",
        "They may be compressing prior-company scars into the current role spec.",
        "They can handle direct pushback if it is specific."
      ],
      language: "direct, compressed, peer-level",
      responseAngle: "pressure-test the role against founder leverage and decision ownership"
    };
  }

  if (founderProfile === "first_time_founder") {
    return {
      founderProfile,
      companyStage,
      likelyFailureMode: `Mistaking founder overwhelm for a ${roleTitle} need and hiring process before the company has enough product signal.`,
      challengeLevel: "medium",
      assumptions: [
        "They may need the invisible founder-work named before the role is accepted.",
        "They may benefit from examples that separate ownership, taste, and execution.",
        "Pushback should be warm and explanatory, not terse."
      ],
      language: "clear, reassuring, slightly more explanatory",
      responseAngle: "diagnose whether this is a product leadership gap, a prioritization problem, or normal early-stage founder load"
    };
  }

  return {
    founderProfile,
    companyStage,
    likelyFailureMode: `The founder context is thin, so the main risk is treating ${roleTitle} as the problem instead of the symptom.`,
    challengeLevel: "medium",
    assumptions: [
      "Use the founder's wording as signal, but do not overfit.",
      "Ask for context only when it changes the recommendation.",
      "Name the likely tradeoff before asking."
    ],
    language: "concise, observational, founder-native",
    responseAngle: "extract the business problem behind the role request"
  };
}

export function formatFounderModelForPrompt(model: FounderModel) {
  return [
    "Working founder model:",
    `Founder profile: ${model.founderProfile}`,
    `Company stage: ${model.companyStage}`,
    `Likely failure mode: ${model.likelyFailureMode}`,
    `Challenge level: ${model.challengeLevel}`,
    `Assumptions: ${model.assumptions.join(" | ")}`,
    `Language: ${model.language}`,
    `Response angle: ${model.responseAngle}`,
    "Use this model to shape challenge level, assumptions, examples, risks, and language. Do not mention the model."
  ].join("\n");
}

export function buildFounderModelResponseSketch(input: string) {
  const messages: TinaMvpMessage[] = [{ id: "founder-model-eval", role: "founder", content: input }];
  const model = buildFounderModel(messages);

  if (model.founderProfile === "repeat_founder") {
    return [
      "Third company changes the read: this probably is not a basic PM education problem.",
      "The risk is importing a PM pattern from a previous company before deciding which decisions should leave the founder at 40 people.",
      "I would pressure-test where founder leverage is breaking now: product taste, prioritization, execution drag, or too many decisions routing back through you."
    ].join(" ");
  }

  if (model.founderProfile === "first_time_founder") {
    return [
      "First startup plus a $3M raise makes me slower to accept PM as the answer.",
      "The risk is hiring process to soothe founder overload before there is enough product signal for a PM to manage.",
      "I would first separate normal founder load from an actual ownership gap: what is breaking because nobody owns it, not just because everything is moving fast?"
    ].join(" ");
  }

  return [
    "The founder context is still thin, so I would not treat the role label as the problem yet.",
    "The risk is filling the job title while the operating bottleneck stays unnamed.",
    "I would ask what changed recently that made this hire feel urgent."
  ].join(" ");
}

function inferFounderProfile(text: string): FounderModel["founderProfile"] {
  if (/\b(third|3rd|second|2nd|fourth|4th)\s+(company|startup)\b|\bserial founder\b|\bmy last company\b|\bprevious company\b/.test(text)) return "repeat_founder";
  if (/\b(first startup|first company|first-time founder|first time founder|my first startup)\b/.test(text)) return "first_time_founder";
  return "unknown";
}

function inferCompanyStage(text: string) {
  const headcount = text.match(/\b(\d{1,4})\s*(people|employees|person team|person company)\b/i)?.[1];
  const raised = text.match(/\braised\s*\$?(\d+(?:\.\d+)?)\s*([mk])?\b/i);
  const stage = text.match(/\b(pre[-\s]?seed|seed|series a|series b|series c)\b/i)?.[0];
  const parts = [
    headcount ? `${headcount} people` : "",
    raised ? `raised $${raised[1]}${raised[2] || ""}` : "",
    stage || ""
  ].filter(Boolean);

  return parts.length ? parts.join(", ") : "unknown";
}
