import type { TinaMvpMessage } from "@/lib/tina-mvp/types";

export type FounderLanguageIntent =
  | "hiring_problem"
  | "example_shapes"
  | "profile_feedback"
  | "state_correction"
  | "scope_pushback"
  | "product_strategy_correction"
  | "concept_translation"
  | "product_logic"
  | "market_or_sourcing"
  | "unclear";

export type FounderLanguageInterpretation = {
  rawText: string;
  normalizedText: string;
  likelyIntent: FounderLanguageIntent;
  confidence: "low" | "medium" | "high";
  possibleMishearings: string[];
  interpretedEntities: string[];
  stateCorrections: string[];
  shouldAskClarifyingQuestion: boolean;
};

export function interpretFounderLanguage(message: string, priorMessages: TinaMvpMessage[] = []): FounderLanguageInterpretation {
  const rawText = message.trim();
  let normalizedText = rawText;
  const lower = rawText.toLowerCase();
  const possibleMishearings: string[] = [];
  const interpretedEntities: string[] = [];
  const stateCorrections: string[] = [];
  let likelyIntent: FounderLanguageIntent = "hiring_problem";
  let confidence: FounderLanguageInterpretation["confidence"] = rawText ? "medium" : "low";

  if (/\b(funded|funder|funding|founded|founder)\s+(recorder|recorders|recuriter|recuiter)\b/i.test(rawText)) {
    normalizedText = normalizedText.replace(/\b(funded|funder|funding|founded|founder)\s+(recorder|recorders|recuriter|recuiter)\b/gi, "founding recruiter");
    possibleMishearings.push("founding recruiter");
    interpretedEntities.push("role: founding recruiter");
    confidence = "medium";
  }

  if (/\b(complicated|overbuilt|overbuild|too much|too complex|don['’]?t need (?:a )?platform|no platform|not a platform|just need an agent|codex agent)\b/i.test(rawText)) {
    likelyIntent = "scope_pushback";
    confidence = "high";
    interpretedEntities.push("founder pushback: simplify scope");
    stateCorrections.push("reduce architecture; focus on the smallest useful agent/workflow");
    normalizedText = `${normalizedText}\nSignal: founder is pushing back on overbuilding; simplify immediately and do not defend a complex plan.`;
  }

  if (/\b(go back to pass 1|back to pass 1|decision engine|decisions engine|core product|product drift|moved too far|go back to.*decisions)\b/i.test(rawText)) {
    likelyIntent = "product_strategy_correction";
    confidence = "high";
    interpretedEntities.push("product strategy correction: return to decision engine");
    stateCorrections.push("audit whether the core diagnosis/decision read works before adding more features");
    normalizedText = `${normalizedText}\nSignal: founder is worried the product drifted from the hiring decision engine; recenter on the core decision read before new features.`;
  }

  if (/\b(too perfect|mvp too complicated|mvp.*complicated|overpolished|too polished|prove the whole|entire vision)\b/i.test(rawText)) {
    likelyIntent = "scope_pushback";
    confidence = "high";
    interpretedEntities.push("MVP scope concern");
    stateCorrections.push("separate long-term vision from MVP proof point");
    normalizedText = `${normalizedText}\nSignal: founder is worried the MVP is becoming too complex or too perfect; identify the smallest proof point and what to cut.`;
  }

  if (/\bwhat is\b.*\b(commit after enough evidence|threshold|working thesis|current read|signal map|market reality)\b/i.test(rawText)) {
    likelyIntent = "concept_translation";
    interpretedEntities.push("request: translate product concept into behavior");
    normalizedText = `${normalizedText}\nSignal: founder wants the concept translated into practical product behavior, not more jargon.`;
  }

  if (/\b(binary|agree to disagree|strongly agree|strongly disagree|0 to 5|0-5|scale|middle point|somewhere in the middle|rate people|scoring)\b/i.test(rawText)) {
    likelyIntent = "product_logic";
    interpretedEntities.push("request: explain scoring logic");
    normalizedText = `${normalizedText}\nSignal: founder is asking for product logic: how scaled answers map to axes, confidence, and archetype output.`;
  }

  if (/\b(when (?:the )?founder says?|when users? says?|tina should|bot should|response should|chat should|conversation should|tone should|should not act|it should help them think|natural|human tone)\b/i.test(rawText)) {
    likelyIntent = "product_logic";
    confidence = "high";
    interpretedEntities.push("product feedback: Tina conversation behavior");
    stateCorrections.push("treat this as product/tone feedback about Tina, not a live hiring request");
    normalizedText = `${normalizedText}\nSignal: founder is giving product feedback about Tina's conversation behavior; do not treat this as a live hiring request.`;
  }

  if (/\brecuriter\b/i.test(rawText)) {
    normalizedText = normalizedText.replace(/\brecuriter\b/gi, "recruiter");
    possibleMishearings.push("recruiter");
  }

  if (/\b(show me|give me|need to see|want to see|what good looks like|people-ish|people like that|someone like that|examples?)\b/i.test(rawText)) {
    likelyIntent = "example_shapes";
    interpretedEntities.push("request: example shapes");
  }

  if (/\b(not (a )?people hire|not people|sales person|salesperson|gtm person)\b/i.test(rawText)) {
    likelyIntent = "state_correction";
    stateCorrections.push("role family should be sales/GTM, not people");
    normalizedText = `${normalizedText}\nCorrection: this is sales/GTM, not a people hire.`;
  }

  if (/\b(sf|bay area)\s+or\s+remote\b/i.test(rawText) || /\bremote\b.*\b(sf|bay area)\b/i.test(rawText)) {
    stateCorrections.push("location is loose: Remote US with Bay Area plus");
    interpretedEntities.push("location: Remote US; Bay Area plus");
    normalizedText = `${normalizedText}\nConstraint: location is loose, Remote US with Bay Area as a plus.`;
  }

  if (hasRecruiterContext(priorMessages, rawText) && /\b(i have nothing|we have nothing|have nothing|no system|no process|no pipeline|no hiring process|no recruiting process|from scratch|zero|nothing yet|that'?s why i need (?:a )?recruiter|need (?:a )?recruiter to help)\b/i.test(rawText)) {
    likelyIntent = "state_correction";
    confidence = "high";
    interpretedEntities.push("operating state: no recruiting system");
    stateCorrections.push("treat as recruiting system before recruiter");
    normalizedText = `${normalizedText}\nSignal: no recruiting system, no candidate pipeline, or no hiring process exists yet.`;
  }

  if (/\b(too corporate|too senior|too junior|too generic|more scrappy|not that kind|closer|wrong)\b/i.test(rawText)) {
    likelyIntent = "profile_feedback";
    interpretedEntities.push("shape feedback");
  }

  if (/\b(market|comp|compensation|salary|location mix|time to fill|source|sourcing|linkedin|public profiles?|real profiles?|candidates?)\b/i.test(rawText)) {
    likelyIntent = likelyIntent === "example_shapes" ? "example_shapes" : "market_or_sourcing";
  }

  const normalizedLower = normalizedText.toLowerCase();
  const hasLikelyRole = /\b(recruiter|sales|gtm|engineer|pm|product manager|ops|operator|designer|marketing|support|people|head of|vp|cto|cofounder)\b/.test(normalizedLower);
  const shouldAskClarifyingQuestion = confidence === "low" && !hasLikelyRole;

  return {
    rawText,
    normalizedText,
    likelyIntent,
    confidence,
    possibleMishearings: unique(possibleMishearings),
    interpretedEntities: unique(interpretedEntities),
    stateCorrections: unique(stateCorrections),
    shouldAskClarifyingQuestion
  };
}

export function applyFounderLanguageAdapter(messages: TinaMvpMessage[]) {
  return messages.map((message, index) => {
    if (message.role !== "founder") return message;

    const interpretation = interpretFounderLanguage(message.content, messages.slice(0, index));
    if (interpretation.normalizedText === message.content.trim()) return message;

    return {
      ...message,
      content: interpretation.normalizedText
    };
  });
}

export function formatFounderLanguageInterpretationForPrompt(interpretation?: FounderLanguageInterpretation) {
  if (!interpretation || interpretation.normalizedText === interpretation.rawText) return "";

  return [
    "Founder language interpretation:",
    `Raw founder text: ${interpretation.rawText}`,
    `Normalized interpretation: ${interpretation.normalizedText}`,
    `Likely intent: ${interpretation.likelyIntent}`,
    `Confidence: ${interpretation.confidence}`,
    interpretation.possibleMishearings.length ? `Possible mishearing: ${interpretation.possibleMishearings.join(", ")}` : "",
    interpretation.interpretedEntities.length ? `Interpreted signals: ${interpretation.interpretedEntities.join("; ")}` : "",
    interpretation.stateCorrections.length ? `State corrections: ${interpretation.stateCorrections.join("; ")}` : "",
    "Use the normalized interpretation for reasoning, but respond naturally to the founder. If confidence is low, say what you are reading it as and ask one plain question."
  ].filter(Boolean).join("\n");
}

function hasRecruiterContext(messages: TinaMvpMessage[], latestText: string) {
  return `${messages.map((message) => message.content).join("\n")} ${latestText}`.match(/\b(found(?:ing)? recruiter|first recruiter|recruiter|recruiting|head of talent|talent partner|talent acquisition|candidate pipeline|hiring pipeline|hiring process|hiring system)\b/i);
}

function unique(values: string[]) {
  return Array.from(new Set(values));
}
