import type { CalibrationMemory, FeedbackEvent, RolePriority } from "@/lib/tina/types";

const initialMustHaves: RolePriority[] = [
  { id: "fintech", label: "Fintech experience", weight: 0.78, source: "initial_brain" },
  { id: "ai-product", label: "AI product shipping", weight: 0.86, source: "initial_brain" },
  { id: "customer-facing", label: "Customer-facing product judgment", weight: 0.72, source: "initial_brain" }
];

export function createInitialCalibrationMemory(roleId = "founding-ai-engineer"): CalibrationMemory {
  return {
    roleId,
    mustHaves: initialMustHaves,
    niceToHaves: [
      { id: "frontier-lab", label: "OpenAI or Anthropic signal", weight: 0.46, source: "initial_brain" }
    ],
    dealBreakers: ["Needs heavy structure before shipping"],
    preferredCompanies: ["Fintech infrastructure", "AI workflow startups"],
    rejectedPatterns: [],
    seniorityCalibration: "senior-to-staff builder who can own ambiguous zero-to-one work",
    updatedByFeedbackEvents: []
  };
}

export function updateCalibrationMemory(
  memory: CalibrationMemory,
  event: FeedbackEvent
): CalibrationMemory {
  const message = event.message.toLowerCase();
  let next = cloneMemory(memory);

  if (/fintech.*not required|not require.*fintech|fintech is optional|fintech optional/.test(message)) {
    next.mustHaves = next.mustHaves.filter((item) => item.id !== "fintech");
    next.niceToHaves = upsertPriority(next.niceToHaves, {
      id: "fintech-context",
      label: "Fintech context",
      weight: 0.28,
      source: "feedback"
    });
    next.rejectedPatterns = addUnique(next.rejectedPatterns, "Over-weighting fintech logos");
  }

  if (/distributed systems|systems/i.test(event.message)) {
    next.mustHaves = upsertPriority(next.mustHaves, {
      id: "distributed-systems",
      label: "Distributed systems depth",
      weight: 0.9,
      source: "feedback"
    });
  }

  if (/startup ownership|ownership|startup/i.test(event.message)) {
    next.mustHaves = upsertPriority(next.mustHaves, {
      id: "startup-ownership",
      label: "Startup ownership",
      weight: 0.92,
      source: "feedback"
    });
    next.seniorityCalibration = "builder-owner with startup pace, systems judgment, and low-structure execution";
  }

  if (event.signal === "disagree" || event.signal === "correct") {
    next.rejectedPatterns = addUnique(next.rejectedPatterns, "Treating initial assumptions as fixed requirements");
  }

  next.updatedByFeedbackEvents = addUnique(next.updatedByFeedbackEvents, event.id);
  return next;
}

function cloneMemory(memory: CalibrationMemory): CalibrationMemory {
  return {
    ...memory,
    mustHaves: [...memory.mustHaves],
    niceToHaves: [...memory.niceToHaves],
    dealBreakers: [...memory.dealBreakers],
    preferredCompanies: [...memory.preferredCompanies],
    rejectedPatterns: [...memory.rejectedPatterns],
    updatedByFeedbackEvents: [...memory.updatedByFeedbackEvents]
  };
}

function upsertPriority(priorities: RolePriority[], priority: RolePriority) {
  const without = priorities.filter((item) => item.id !== priority.id);
  return [...without, priority].sort((a, b) => b.weight - a.weight);
}

function addUnique(items: string[], item: string) {
  return Array.from(new Set([...items, item])).filter(Boolean);
}
