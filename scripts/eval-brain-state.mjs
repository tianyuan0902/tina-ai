import { buildBrainState } from "../.tmp/eval-brain-state/lib/brain/buildBrainState.js";
import { evaluateSourcingReadiness } from "../.tmp/eval-brain-state/lib/tina/sourcing-readiness.js";

const cases = [
  {
    name: "founding PM founder dependency",
    input: "I need a founding PM but really someone who makes the team less dependent on me.",
    assert(state) {
      expectAtLeast(state.searchShape.ownership, 60, "ownership should be high");
      expectAtLeast(state.searchShape.ambiguityTolerance, 60, "ambiguity tolerance should be high");
      expectAtLeast(state.searchShape.productJudgment, 60, "product judgment should be medium/high");
      expectAtMost(state.searchShape.technicalDepth, 50, "technical depth should stay low/medium");
      expectIncludes(state.missingSignals, /team size|bottleneck/i, "missing signals should include team size or bottleneck");
      expectNotEqual(state.sourcingReadiness, "ready", "sourcing should not be fully ready");
    }
  },
  {
    name: "vague PM request",
    input: "Find me a PM.",
    assert(state) {
      expectAtMost(state.readinessScore, 45, "readiness should be low");
      expectAtLeast(state.missingSignals.length, 1, "missing signals should be populated");
      expectEqual(state.sourcingReadiness, "not_ready", "sourcing readiness should be not_ready");
    }
  },
  {
    name: "founding AI product engineer",
    input: "We need a founding AI product engineer who shipped customer-facing AI workflows at startup pace.",
    assert(state) {
      expectAtLeast(state.searchShape.productJudgment, 60, "product judgment should be high");
      expectAtLeast(state.searchShape.executionSpeed, 60, "execution speed should be high");
      expectAtLeast(state.searchShape.technicalDepth, 60, "technical depth should be medium/high");
      expectIncludes(state.seekSignals, /shipped.*AI|customer-facing|product/i, "seek signals should include shipped AI/product/customer-facing signal");
      expectIncludes(["calibration_batch", "ready"], state.sourcingReadiness, "sourcing should be calibration_batch or ready");
    }
  }
];

for (const testCase of cases) {
  const messages = [{ id: `founder-${testCase.name}`, role: "founder", content: testCase.input }];
  const sourcingReadiness = evaluateSourcingReadiness(messages);
  const state = buildBrainState({ messages, sourcingReadiness });
  testCase.assert(state);
  console.log(`PASS ${testCase.name}`);
}

function expectEqual(actual, expected, message) {
  if (actual !== expected) fail(message, actual, expected);
}

function expectNotEqual(actual, expected, message) {
  if (actual === expected) fail(message, actual, `not ${expected}`);
}

function expectAtLeast(actual, expected, message) {
  if (actual < expected) fail(message, actual, `>= ${expected}`);
}

function expectAtMost(actual, expected, message) {
  if (actual > expected) fail(message, actual, `<= ${expected}`);
}

function expectIncludes(values, pattern, message) {
  const matched = values.some((value) => pattern instanceof RegExp ? pattern.test(value) : value === pattern);
  if (!matched) fail(message, values, pattern.toString());
}

function fail(message, actual, expected) {
  throw new Error(`${message}. Expected ${expected}, got ${JSON.stringify(actual)}.`);
}
