import { updateCalibrationMemory } from "@/lib/tina/calibration-memory";
import { generateTinaResponseBlocks } from "@/lib/tina/brain";
import { resolveAffectedBlocks } from "@/lib/tina/dependency-resolver";
import { renderTinaResponseBlocks } from "@/lib/tina/response-renderer";
import type {
  CalibrationMemory,
  FeedbackEvent,
  RenderedTinaResponseBlock,
  TinaResponseBlock,
  UpdateImpact
} from "@/lib/tina/types";

export function createFeedbackEvent({
  roleId,
  candidateId,
  signal,
  message,
  weight = 1
}: {
  roleId: string;
  candidateId?: string;
  signal: FeedbackEvent["signal"];
  message: string;
  weight?: number;
}): FeedbackEvent {
  return {
    id: `feedback-${Date.now()}`,
    roleId,
    candidateId,
    source: "hiring_manager",
    signal,
    message,
    weight,
    createdAt: new Date().toISOString()
  };
}

export function applyFeedbackEvent({
  memory,
  previousBlocks,
  event
}: {
  memory: CalibrationMemory;
  previousBlocks: TinaResponseBlock[];
  event: FeedbackEvent;
}): {
  memory: CalibrationMemory;
  rawBlocks: TinaResponseBlock[];
  renderedBlocks: RenderedTinaResponseBlock[];
  impacts: UpdateImpact[];
} {
  const nextMemory = updateCalibrationMemory(memory, event);
  const rawBlocks = generateTinaResponseBlocks(nextMemory);
  const impacts = resolveAffectedBlocks(previousBlocks, rawBlocks, event);

  return {
    memory: nextMemory,
    rawBlocks,
    renderedBlocks: renderTinaResponseBlocks(rawBlocks),
    impacts
  };
}
