import type { CanonicalSearchState } from "@/lib/brain/canonicalSearchState";
import type { CurrentRead } from "@/lib/tina-mvp/current-read";
import type { SignalMap } from "@/lib/tina-mvp/signal-map";

export type ExampleShape = {
  id: string;
  name: string;
  solves: string;
  fails: string;
  recognize: string;
};

export type ExampleShapeSet = {
  title: string;
  intro: string;
  derivedFromThesisTitle: string;
  shapes: ExampleShape[];
};

export type ExampleShapeFeedback = {
  positiveSignals: string[];
  negativeSignals: string[];
  mustHaveEvidence: string[];
  falsePositives: string[];
  recommendedNextStep: string;
};

export function isExampleShapeRequest(message: string) {
  return /\b(show me|send me|give me|show|find|pull|bring me)\b.*\b(people-ish|peopleish|examples?|what good looks like|right shape|kinda like the right shape|someone like this|someone like that|people who feel|people that feel)\b/i.test(message) ||
    /\b(i need to see it|need to see it|too abstract|just want to react|react to something|not perfect|people-ish examples?|peopleish examples?)\b/i.test(message) ||
    isCategoryComparisonRequest(message);
}

export function isExampleShapeFeedback(message: string) {
  return /\b(more like|less like|closer|wrong|too senior|too junior|too corporate|too generic|not that kind|not that|like the|dislike|thumbs up|thumbs down)\b/i.test(message);
}

export function buildExampleShapes(
  currentRead?: CurrentRead,
  canonicalSearchState?: CanonicalSearchState,
  signalMap?: SignalMap,
  message = ""
): ExampleShapeSet {
  const thesisTitle = currentRead?.likelyArchetype || currentRead?.thesisTitle || signalMap?.derivedFromThesisTitle || "Unknown / Needs Clarification";
  const normalizedTitle = thesisTitle.toLowerCase();
  const roleText = `${canonicalSearchState?.roleTitle || ""} ${canonicalSearchState?.roleFamily || ""}`.toLowerCase();

  if (isCategoryComparisonRequest(message)) {
    return buildComparisonShapes(message, thesisTitle);
  }

  if (normalizedTitle.includes("founder-led sales") || /\b(sales|gtm|ae|revenue)\b/.test(roleText)) {
    return {
      title: "Founder-led sales shapes",
      intro: "Yeah. I’ll show shapes, not candidates yet. React to these.",
      derivedFromThesisTitle: thesisTitle,
      shapes: [
        {
          id: "founding-ae-first-sales",
          name: "Founding AE / first sales hire",
          solves: "Turns founder-led demos into repeatable early deals.",
          fails: "Falls short if the product story still needs founder magic.",
          recognize: "Has sold before playbooks existed and built proof from messy founder wins."
        },
        {
          id: "first-gtm-builder",
          name: "First GTM builder",
          solves: "Builds the early motion: messaging, pipeline, demos, handoff.",
          fails: "Gets stretched if asked to manage a team too soon.",
          recognize: "Has created the first repeatable sales motion from scratch."
        },
        {
          id: "too-senior-vp-sales",
          name: "Too-senior VP Sales false positive",
          solves: "Scales a machine after the motion already works.",
          fails: "Breaks when asked to discover the motion personally.",
          recognize: "Managed reps and forecasts, but did not create founder-to-sales handoff."
        }
      ]
    };
  }

  if (normalizedTitle.includes("engineering leadership")) {
    return {
      title: "Engineering leadership shapes",
      intro: "Yeah. I’ll show shapes, not candidates yet. React to these.",
      derivedFromThesisTitle: thesisTitle,
      shapes: [
        {
          id: "early-head-of-eng",
          name: "Early Head of Eng",
          solves: "Moves decisions out of the founder’s head.",
          fails: "Fails if authority stays with the founder.",
          recognize: "Has owned technical priorities and team rhythm in a messy startup."
        },
        {
          id: "staff-lead-operator",
          name: "Staff+ technical lead",
          solves: "Raises technical judgment without adding management weight.",
          fails: "Falls short if people leadership is the real bottleneck.",
          recognize: "Has led through influence and made hard architecture tradeoffs."
        },
        {
          id: "process-em-false-positive",
          name: "Process-heavy EM false positive",
          solves: "Adds rituals and reporting.",
          fails: "Creates meetings without improving speed or ownership.",
          recognize: "Talks process first, with thin examples of decision ownership."
        }
      ]
    };
  }

  if (normalizedTitle.includes("product") || /\b(pm|product)\b/.test(roleText)) {
    return {
      title: "Product ownership shapes",
      intro: "Yeah. I’ll show shapes, not candidates yet. React to these.",
      derivedFromThesisTitle: thesisTitle,
      shapes: [
        {
          id: "senior-product-operator",
          name: "Senior product operator",
          solves: "Turns messy customer signal into decisions and shipped work.",
          fails: "Fails if the founder will not delegate product calls.",
          recognize: "Has made tradeoff calls without hiding behind roadmap process."
        },
        {
          id: "founder-adjacent-pm",
          name: "Founder-adjacent PM",
          solves: "Reduces founder bottleneck while preserving taste.",
          fails: "Gets stuck if trust is too low to hand over calls.",
          recognize: "Has worked closely with founders and still owned outcomes."
        },
        {
          id: "roadmap-pm-false-positive",
          name: "Roadmap PM false positive",
          solves: "Organizes work once priorities are already clear.",
          fails: "Does not create clarity when priorities are unstable.",
          recognize: "Strong process language, weak examples of independent judgment."
        }
      ]
    };
  }

  return {
    title: "Calibration shapes",
    intro: "Yeah. I’ll show shapes, not candidates yet. React to these.",
    derivedFromThesisTitle: thesisTitle,
    shapes: [
      {
        id: "ownership-carrier",
        name: "Ownership carrier",
        solves: "Takes a messy lane and makes real calls.",
        fails: "Struggles if the lane is actually three jobs.",
        recognize: "Has owned ambiguous work without waiting for clean process."
      },
      {
        id: "operator-builder",
        name: "Operator-builder",
        solves: "Creates operating rhythm without adding theater.",
        fails: "Can become too broad if the problem needs depth.",
        recognize: "Has closed loops across product, customers, and internal teams."
      },
      {
        id: "title-match-false-positive",
        name: "Title-match false positive",
        solves: "Looks right on paper.",
        fails: "Does not carry the actual missing judgment.",
        recognize: "Has the title, but thin proof of solving this specific problem."
      }
    ]
  };
}

function isCategoryComparisonRequest(message: string) {
  return /\b(compare|difference between|choosing between|choose between|which one|which lane|which shape|versus|vs\.?)\b/i.test(message) &&
    /\b(archetypes?|shapes?|categories?|lanes?|profiles?|roles?|hire|pm|operator|sales|gtm|engineer|leader|generalist)\b/i.test(message);
}

function buildComparisonShapes(message: string, thesisTitle: string): ExampleShapeSet {
  const text = message.toLowerCase();
  const namedOptions = normalizeComparisonOptions(extractNamedComparisonOptions(message), message);

  if (namedOptions.length >= 2) {
    return {
      title: "Comparison shapes",
      intro: "Yeah. I’ll compare those exact shapes, not candidates yet. React to what feels closest.",
      derivedFromThesisTitle: thesisTitle,
      shapes: namedOptions.slice(0, 3).map((option) => shapeForNamedOption(option))
    };
  }

  if (/\b(pm|product)\b/.test(text) && /\b(operator|ops|generalist)\b/.test(text)) {
    return {
      title: "Product vs operator shapes",
      intro: "Yeah. I’ll compare the shapes, not candidates yet. React to what feels closer.",
      derivedFromThesisTitle: thesisTitle,
      shapes: [
        {
          id: "product-decision-owner",
          name: "Product decision owner",
          solves: "Turns customer ambiguity into product calls.",
          fails: "Fails if the issue is company-wide operating drag.",
          recognize: "Has owned messy product tradeoffs without hiding behind process."
        },
        {
          id: "product-ops-generalist",
          name: "Product/Ops generalist",
          solves: "Connects product, customers, and internal execution.",
          fails: "Gets too broad if one lane needs deep ownership.",
          recognize: "Has closed loops across teams when no clean owner existed."
        },
        {
          id: "roadmap-process-false-positive",
          name: "Roadmap/process false positive",
          solves: "Makes plans look organized.",
          fails: "Does not change who makes hard calls.",
          recognize: "Strong roadmap language, weak decision-transfer proof."
        }
      ]
    };
  }

  if (/\b(head of eng|engineering leader|engineering manager|vp engineering|em\b)\b/.test(text) && /\b(staff|principal|senior ic|tech lead)\b/.test(text)) {
    return {
      title: "Engineering leader vs Staff+ shapes",
      intro: "Yeah. I’ll compare the shapes, not candidates yet. React to what feels closer.",
      derivedFromThesisTitle: thesisTitle,
      shapes: [
        {
          id: "engineering-leader-shape",
          name: "Engineering leader",
          solves: "Owns team cadence, decisions, and accountability.",
          fails: "Fails if there is no team to lead.",
          recognize: "Has improved team rhythm and technical judgment together."
        },
        {
          id: "staff-plus-owner-shape",
          name: "Staff+ technical owner",
          solves: "Raises technical quality without management weight.",
          fails: "Falls short if people leadership is the bottleneck.",
          recognize: "Has carried hard technical calls through influence."
        },
        {
          id: "senior-ic-title-false-positive",
          name: "Senior IC false positive",
          solves: "Adds individual output.",
          fails: "Does not move decisions out of the founder’s hands.",
          recognize: "Impressive build proof, thin operating ownership."
        }
      ]
    };
  }

  return {
    title: "Comparison shapes",
    intro: "Yeah. I’ll compare the shapes, not candidates yet. React to what feels closer.",
    derivedFromThesisTitle: thesisTitle,
    shapes: [
      {
        id: "direct-owner",
        name: "Direct owner",
        solves: "Owns the core problem end to end.",
        fails: "Gets narrow if the problem spans teams.",
        recognize: "Clear accountability for one hard outcome."
      },
      {
        id: "cross-functional-operator",
        name: "Cross-functional operator",
        solves: "Moves messy work across teams.",
        fails: "Can become vague without a primary lane.",
        recognize: "Has created motion without formal authority."
      },
      {
        id: "title-match-false-positive",
        name: "Title-match false positive",
        solves: "Looks right in a search.",
        fails: "Does not match the real operating tension.",
        recognize: "Strong label, weak problem-specific proof."
      }
    ]
  };
}

function extractNamedComparisonOptions(message: string) {
  const normalized = message
    .replace(/[?!.]/g, " ")
    .replace(/\b(should i|should we|do we|are we|is it|maybe|compare|choosing between|choose between|which one|which option|options?|shapes?|roles?|hire|hiring|the)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!/\b(vs|versus|or|between)\b/i.test(normalized)) return [];

  return normalized
    .split(/\s*(?:vs\.?|versus|,|\/|\bor\b|\bbetween\b|\band\b)\s*/i)
    .map((option) => option.trim())
    .filter((option) => option.length >= 3)
    .filter((option) => !/^(a|an|to|for|of|with|and|or)$/i.test(option))
    .map(cleanOptionLabel)
    .filter(Boolean)
    .filter((option, index, options) => options.findIndex((candidate) => candidate.toLowerCase() === option.toLowerCase()) === index);
}

function cleanOptionLabel(option: string) {
  return option
    .replace(/\b(first eng)\b/i, "first engineer")
    .replace(/\b(cofounder)\b/i, "cofounder")
    .replace(/\b(co-founder)\b/i, "cofounder")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\w/, (letter) => letter.toUpperCase());
}

function normalizeComparisonOptions(options: string[], message: string) {
  if (/\bco[-\s]?founder\b/i.test(message) && /\bfirst engineer|first technical hire|founding engineer\b/i.test(message) && /\bagency|studio|dev shop\b/i.test(message)) {
    return ["Technical Cofounder", "First Technical Hire / Founding Engineer", "Agency / Studio"];
  }

  return options.map(normalizeComparisonOptionLabel);
}

function normalizeComparisonOptionLabel(option: string) {
  const lower = option.toLowerCase();
  if (/\bco[-\s]?founder\b/.test(lower)) return "Technical Cofounder";
  if (/\bfirst engineer|first technical hire|founding engineer|first builder\b/.test(lower)) return "First Technical Hire / Founding Engineer";
  if (/\bagency|studio|dev shop\b/.test(lower)) return "Agency / Studio";
  return option;
}

function shapeForNamedOption(option: string): ExampleShape {
  const lower = option.toLowerCase();
  const id = lower.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "comparison-option";

  if (/\bcofounder|co-founder\b/.test(lower)) {
    return {
      id,
      name: option,
      solves: "Carries company-level technical and product risk.",
      fails: "Too heavy if you only need scoped execution.",
      recognize: "Wants ownership, equity, and real company-building authority."
    };
  }

  if (/\bfirst engineer|first technical hire|first builder|founding engineer\b/.test(lower)) {
    return {
      id,
      name: option,
      solves: "Builds the first real product system hands-on.",
      fails: "Falls short if the business needs cofounder judgment.",
      recognize: "Has shipped 0-to-1 without needing a team around them."
    };
  }

  if (/\bagency|dev shop|studio|contractor\b/.test(lower)) {
    return {
      id,
      name: option,
      solves: "Gets a scoped build moving quickly.",
      fails: "Does not create internal technical ownership.",
      recognize: "Clear delivery scope, low long-term company ownership."
    };
  }

  return {
    id,
    name: option,
    solves: "Solves one version of the operating gap.",
    fails: "Misses if the real problem is a different lane.",
    recognize: "Has proof of owning this exact kind of work."
  };
}

export function buildExampleShapeResponse(exampleShapes: ExampleShapeSet) {
  return exampleShapes.intro;
}

export function buildExampleShapeFeedback(
  message: string,
  currentRead?: CurrentRead
): ExampleShapeFeedback {
  const text = message.toLowerCase();
  const founderLedSales = (currentRead?.likelyArchetype || currentRead?.thesisTitle || "").toLowerCase().includes("founder-led sales") ||
    /\b(founding ae|sales|gtm|executive|vp sales)\b/.test(text);

  if (founderLedSales) {
    const wantsFoundingAe = /\b(founding ae|first sales|sales builder|more like|closer)\b/.test(text);
    const lessExecutive = /\b(less executive|too senior|vp|corporate|big company|late-stage|not.*vp)\b/.test(text);

    return {
      positiveSignals: wantsFoundingAe
        ? ["Founder-led selling experience", "First sales hire pattern", "Built early repeatable motion"]
        : ["Early GTM ownership", "Hands-on selling proof"],
      negativeSignals: lessExecutive
        ? ["Late-stage VP profile", "Manager of managers", "Needs a working sales machine"]
        : ["Too polished", "Too far from founder-led selling"],
      mustHaveEvidence: ["Sold before playbooks existed", "Converted founder wins into repeatable demos", "Can carry the story without flattening it"],
      falsePositives: ["Corporate VP Sales", "Enterprise sales manager", "Generic operator with no selling proof"],
      recommendedNextStep: "Turn this into a sourcing brief biased toward founding AE / first GTM builder, not a late-stage VP Sales."
    };
  }

  return {
    positiveSignals: ["Closer to the working shape", "Evidence of owning the real problem"],
    negativeSignals: ["Wrong level or environment", "Title match without proof"],
    mustHaveEvidence: ["Solved this problem in a messy startup context", "Made judgment calls without clean process"],
    falsePositives: ["Impressive title with weak problem fit", "Too corporate for the current operating mess"],
    recommendedNextStep: "Turn the reactions into a sourcing brief before looking at real profiles."
  };
}

export function buildExampleShapeFeedbackResponse(feedback: ExampleShapeFeedback) {
  return [
    "Got it. I’ll treat that as calibration signal, not a final answer.",
    `Positive signals: ${feedback.positiveSignals.join(", ")}.`,
    `Avoid: ${feedback.negativeSignals.join(", ")}.`,
    feedback.recommendedNextStep
  ].join("\n\n");
}
