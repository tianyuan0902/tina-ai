import type { FeedbackEvent, TinaResponseBlock, UpdateImpact } from "@/lib/tina/types";

export function resolveAffectedBlocks(
  previousBlocks: TinaResponseBlock[],
  nextBlocks: TinaResponseBlock[],
  event: FeedbackEvent
): UpdateImpact[] {
  const affectedDependencies = getDependenciesFromFeedback(event);

  return nextBlocks
    .filter((block) => block.dependsOn.some((dependency) => affectedDependencies.includes(dependency)))
    .map((block) => {
      const previous = previousBlocks.find((item) => item.id === block.id);
      const changedFields = [
        previous?.content !== block.content ? "content" : "",
        previous?.confidence !== block.confidence ? "confidence" : "",
        previous?.sourceSignals.join("|") !== block.sourceSignals.join("|") ? "sourceSignals" : ""
      ].filter(Boolean);

      return {
        blockId: block.id,
        blockTitle: block.title,
        dependency: block.dependsOn.find((dependency) => affectedDependencies.includes(dependency)) ?? "hmFeedback",
        changedFields: changedFields.length ? changedFields : ["reviewed"],
        explanation: getImpactExplanation(block.id, event)
      };
    });
}

function getDependenciesFromFeedback(event: FeedbackEvent) {
  const message = event.message.toLowerCase();
  const dependencies = new Set<ReturnType<typeof allDependencies>[number]>(["hmFeedback"]);

  if (/fintech|required|must|nice-to-have|distributed systems|ownership/.test(message)) {
    dependencies.add("roleRequirements");
    dependencies.add("sourcingCriteria");
  }
  if (/candidate|profile|score|match/.test(message) || event.candidateId) {
    dependencies.add("candidateProfile");
  }
  if (/interview|screen|onsite|signal/.test(message)) {
    dependencies.add("interviewFeedback");
  }
  if (/market|comp|range|pool/.test(message)) {
    dependencies.add("marketData");
  }

  return Array.from(dependencies);
}

function allDependencies() {
  return ["roleRequirements", "candidateProfile", "marketData", "hmFeedback", "interviewFeedback", "sourcingCriteria"] as const;
}

function getImpactExplanation(blockId: string, event: FeedbackEvent) {
  if (/fintech.*not required/i.test(event.message) && blockId === "living-jd") {
    return "Removed fintech from the core JD and moved it to optional context.";
  }
  if (/distributed systems/i.test(event.message) && blockId === "candidate-scoring") {
    return "Raised candidates with systems depth and lowered domain-only matches.";
  }
  if (/startup ownership/i.test(event.message) && blockId === "search-logic") {
    return "Shifted search criteria toward owner-builders from low-structure startups.";
  }
  return "Recomputed because this block depends on the feedback signal.";
}
