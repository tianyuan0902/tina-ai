import { buildBrainState } from "../.tmp/eval-brain-state/lib/brain/buildBrainState.js";
import { buildCanonicalSearchState, formatCanonicalSearchStateForPrompt } from "../.tmp/eval-brain-state/lib/brain/canonicalSearchState.js";
import { evaluateSourcingReadiness } from "../.tmp/eval-brain-state/lib/tina/sourcing-readiness.js";
import { buildExpandedPublicTalentSearchQueries, buildPublicTalentSearchQueries } from "../.tmp/eval-brain-state/lib/tina/search-query-builder.js";
import { actionButtonsForCurrentRead, buildCurrentRead, buildCurrentReadResponseSketch, currentReadTitle } from "../.tmp/eval-brain-state/lib/tina-mvp/current-read.js";
import { buildExampleShapeFeedback, buildExampleShapes, isExampleShapeRequest } from "../.tmp/eval-brain-state/lib/tina-mvp/example-shapes.js";
import { buildFounderModel, buildFounderModelResponseSketch } from "../.tmp/eval-brain-state/lib/tina-mvp/founder-model.js";
import { buildHiringArtifact } from "../.tmp/eval-brain-state/lib/tina-mvp/hiring-artifacts.js";
import { buildReferenceProfileInsightFromText, buildReferenceProfileResponse, formatReferenceProfileInsightForPrompt, isReferenceProfileRequest } from "../.tmp/eval-brain-state/lib/tina-mvp/reference-profiles.js";
import { buildSignalMap, buildSignalMapResponse } from "../.tmp/eval-brain-state/lib/tina-mvp/signal-map.js";
import { buildWorkingThesis, buildWorkingThesisResponseSketch, formatWorkingThesisForPrompt } from "../.tmp/eval-brain-state/lib/tina-mvp/working-thesis.js";
import { TINA_SYSTEM_PROMPT } from "../.tmp/eval-brain-state/lib/tina-mvp/system-prompt.js";

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

const readinessCases = [
  {
    name: "AI infra SF fintech is first-pass useful",
    input: "Find me a senior AI infrastructure engineer in San Francisco fintech.",
    assert(readiness) {
      expectIncludes(["low_confidence_search", "ready_to_source"], readiness.readinessStatus, "AI infra SF fintech should be ready for a calibration batch or sourcing");
      expectEqual(readiness.blockingMissing.length, 0, "AI infra SF fintech should not have blocking missing fields");
      expectNotIncludes(readiness.missingSignals, /role outcome|must-have signals|avoid signals|company lane/i, "non-blocking gaps should not become blockers");
      expectEqual(readiness.followUpQuestions.length, 0, "AI infra SF fintech should not ask intake questions before acting");
    }
  },
  {
    name: "short AI infra shorthand does not block on avoid signals",
    input: "Senior AI Infrastructure Engineer · San Francisco · fintech",
    assert(readiness) {
      expectIncludes(["low_confidence_search", "ready_to_source"], readiness.readinessStatus, "short AI infra shorthand should be useful enough for a first pass");
      expectEqual(readiness.blockingMissing.length, 0, "short AI infra shorthand should not have blockers");
      expectNotIncludes(readiness.missingSignals, /avoid signals|source company lanes/i, "avoid signals and company lanes should be useful but not blocking");
    }
  },
  {
    name: "vague PM still asks one question",
    input: "Find me a PM.",
    assert(readiness) {
      expectEqual(readiness.readinessStatus, "needs_calibration", "vague PM should still need calibration");
      expectAtLeast(readiness.blockingMissing.length, 1, "vague PM should have a true blocker");
      expectEqual(readiness.followUpQuestions.length, 1, "vague PM should ask only one sharp question");
    }
  },
  {
    name: "smart contract bridge US is calibration not discovery",
    input: "Find me a smart contract engineer in US, my company is called bridge.xyz.",
    assert(readiness) {
      expectIncludes(["low_confidence_search", "ready_to_source"], readiness.readinessStatus, "smart contract + company + geography should be enough for calibration");
      expectEqual(readiness.blockingMissing.length, 0, "smart contract bridge request should not restart discovery with blockers");
      expectEqual(readiness.followUpQuestions.length, 0, "smart contract bridge request should not ask intake questions from readiness");
    }
  }
];

for (const testCase of readinessCases) {
  const readiness = evaluateSourcingReadiness([{ id: `founder-${testCase.name}`, role: "founder", content: testCase.input }]);
  testCase.assert(readiness);
  console.log(`PASS ${testCase.name}`);
}

if (!/do not ask permission for the obvious next recruiting move/i.test(TINA_SYSTEM_PROMPT)) {
  throw new Error("system prompt should tell Tina not to ask permission for obvious recruiting moves.");
}
if (!/Hiring Decision Engine/i.test(TINA_SYSTEM_PROMPT)) {
  throw new Error("system prompt should position Tina as a Hiring Decision Engine.");
}
if (!/not an AI recruiter, ATS, sourcing assistant, or intake form/i.test(TINA_SYSTEM_PROMPT)) {
  throw new Error("system prompt should explicitly distinguish Tina from recruiting/sourcing tools.");
}
if (!/Hiring is only one possible outcome/i.test(TINA_SYSTEM_PROMPT)) {
  throw new Error("system prompt should say hiring is only one possible outcome.");
}
if (!/Help the founder think\. The task is secondary/i.test(TINA_SYSTEM_PROMPT)) {
  throw new Error("system prompt should make helping the founder think primary.");
}
if (!/Every response should contain at least one observation the founder is unlikely to have articulated themselves/i.test(TINA_SYSTEM_PROMPT)) {
  throw new Error("system prompt should require opinion density in every response.");
}
if (!/Once you have extracted a meaningful signal, do not keep rephrasing that same signal/i.test(TINA_SYSTEM_PROMPT)) {
  throw new Error("system prompt should require thesis progression after meaningful signals.");
}
if (!/Treat the current team as signal/i.test(TINA_SYSTEM_PROMPT)) {
  throw new Error("system prompt should treat current team and trusted people as signal.");
}
if (!/people DNA/i.test(TINA_SYSTEM_PROMPT)) {
  throw new Error("system prompt should teach Tina to decode people DNA.");
}
if (!/LinkedIn\/profile links/i.test(TINA_SYSTEM_PROMPT)) {
  throw new Error("system prompt should handle shared LinkedIn/profile references.");
}

const referenceProfileMessage = [
  "Look for people like this LinkedIn profile: https://www.linkedin.com/in/example-product-operator",
  "Headline: Founding Product Lead at early fintech.",
  "Experience: built onboarding from zero to launch, worked directly with customers, owned product tradeoffs with engineering, shipped fast in a messy startup."
].join("\n");
if (!isReferenceProfileRequest(referenceProfileMessage)) {
  throw new Error("reference profile request should be detected.");
}
const referenceInsight = buildReferenceProfileInsightFromText(referenceProfileMessage);
expectIncludes(referenceInsight.peopleDnaSignals, /early-stage ownership|shipping proof|customer proximity|product judgment/i, "reference profiles should infer people DNA signals");
expectIncludes(referenceInsight.mustTranslateIntoCriteria, /owned ambiguous work|shipped work|customer/i, "reference profiles should translate admiration into criteria");
expectIncludes(referenceInsight.falsePositiveRisks, /product language|pedigree|proof/i, "reference profiles should name false-positive risks");
expectIncludes([formatReferenceProfileInsightForPrompt(referenceInsight)], /Reference profile \/ people DNA input/i, "reference profile prompt context should be formatted");
expectIncludes([buildReferenceProfileResponse(referenceInsight)], /people DNA|search criteria|false/i, "reference profile response should be diagnostic, not generic sourcing");
console.log("PASS reference profile people DNA");
if (!/role thesis, a lightweight scorecard, and an interview plan/i.test(TINA_SYSTEM_PROMPT)) {
  throw new Error("system prompt should move high-signal conversations into role thesis, scorecard, and interview plan.");
}
if (!/Problem → Organization → Human → Candidate/i.test(TINA_SYSTEM_PROMPT)) {
  throw new Error("system prompt should encode the new reasoning model.");
}
if (!/diagnose before sourcing/i.test(TINA_SYSTEM_PROMPT)) {
  throw new Error("system prompt should require diagnosis before sourcing.");
}
if (!/what happens if nobody is hired/i.test(TINA_SYSTEM_PROMPT)) {
  throw new Error("system prompt should explore whether a hire is actually needed.");
}
if (!/Adaptive advisor engine/i.test(TINA_SYSTEM_PROMPT)) {
  throw new Error("system prompt should include the adaptive advisor engine.");
}
if (!/generate a working founder model/i.test(TINA_SYSTEM_PROMPT)) {
  throw new Error("system prompt should require a working founder model before responding.");
}
if (!/Chat is the short bridge; structured artifacts carry the detail/i.test(TINA_SYSTEM_PROMPT)) {
  throw new Error("system prompt should keep chat brief and move detail into structured artifacts.");
}
if (!/short confirmation after Tina proposes an artifact/i.test(TINA_SYSTEM_PROMPT)) {
  throw new Error("system prompt should turn artifact confirmations into concise artifact generation.");
}
if (!/Founder → Problem → Role reasoning/i.test(TINA_SYSTEM_PROMPT)) {
  throw new Error("system prompt should reason Founder → Problem → Role.");
}
if (!/challenge level, assumptions, examples, risks, and language/i.test(TINA_SYSTEM_PROMPT)) {
  throw new Error("system prompt should say founder model affects challenge, assumptions, examples, risks, and language.");
}
for (const modeName of ["Discovery mode", "Calibration mode", "Execution mode", "Market Reality mode", "Sourcing mode"]) {
  if (!TINA_SYSTEM_PROMPT.includes(modeName)) {
    throw new Error(`system prompt should define ${modeName}.`);
  }
}
if (!/assess founder clarity, problem clarity, role clarity, hiring confidence, and market reality/i.test(TINA_SYSTEM_PROMPT)) {
  throw new Error("system prompt should assess clarity and market reality before choosing behavior.");
}
if (!/Challenge ambiguity, not the founder/i.test(TINA_SYSTEM_PROMPT)) {
  throw new Error("system prompt should challenge ambiguity, not founders.");
}
if (!/best, world-class, elite, top-tier, 10x, or rockstar/i.test(TINA_SYSTEM_PROMPT)) {
  throw new Error("system prompt should handle subjective quality language.");
}
if (!/Ask only when the answer would materially change your recommendation/i.test(TINA_SYSTEM_PROMPT)) {
  throw new Error("system prompt should require questions to materially change recommendations.");
}
if (!/most ambiguous word, assumption, or requirement/i.test(TINA_SYSTEM_PROMPT)) {
  throw new Error("system prompt should make the ambiguous word or assumption the focal point.");
}
if (!/what does it reveal, what ambiguity remains, what tradeoff was exposed, and what assumption surfaced/i.test(TINA_SYSTEM_PROMPT)) {
  throw new Error("system prompt should require interpreting founder answers before workflow progress.");
}
if (!/agreement is not permission to switch into process/i.test(TINA_SYSTEM_PROMPT)) {
  throw new Error("system prompt should keep agreement turns advisory, not process-driven.");
}
if (!/before pulling real public profiles, location or remote\/geography must be aligned/i.test(TINA_SYSTEM_PROMPT)) {
  throw new Error("system prompt should require location alignment before public profile pulls.");
}
if (!/suggest likely seniority and directional comp/i.test(TINA_SYSTEM_PROMPT)) {
  throw new Error("system prompt should propose seniority and comp before sourcing when location is missing.");
}
if (!/Founders often say they want autonomy, then struggle to give it away/i.test(TINA_SYSTEM_PROMPT)) {
  throw new Error("system prompt should include founder-psychology autonomy insight.");
}
if (!/Alignment.*nobody owns the final decision/is.test(TINA_SYSTEM_PROMPT)) {
  throw new Error("system prompt should include non-obvious alignment insight.");
}
if (!/reports information back to you instead of taking work off your plate/i.test(TINA_SYSTEM_PROMPT)) {
  throw new Error("system prompt should include non-obvious independent PM insight.");
}
if (!/Do not default to "what success looks like"/i.test(TINA_SYSTEM_PROMPT)) {
  throw new Error("system prompt should ban default success-looking questions.");
}
if (!/messy founder language as real calibration input/i.test(TINA_SYSTEM_PROMPT)) {
  throw new Error("system prompt should treat messy founder language as calibration input.");
}
if (!/examples to react to, not finalists/i.test(TINA_SYSTEM_PROMPT)) {
  throw new Error("system prompt should label early profiles as examples to react to.");
}
if (!/remote US with Bay Area as a plus/i.test(TINA_SYSTEM_PROMPT)) {
  throw new Error("system prompt should preserve loose SF-or-remote constraints.");
}
if (!/Observation → Risk → One Sharp Question/i.test(TINA_SYSTEM_PROMPT)) {
  throw new Error("system prompt should require observation, risk, then one sharp question before asking.");
}
if (!/role \+ domain\/company \+ geography/i.test(TINA_SYSTEM_PROMPT)) {
  throw new Error("system prompt should treat role + domain/company + geography as calibration, not discovery.");
}
if (!/plausibly about profiles, candidates, people, roles, sourcing/i.test(TINA_SYSTEM_PROMPT)) {
  throw new Error("system prompt should treat plausible sourcing and candidate asks as in-scope.");
}
if (!/never sound like an intake form/i.test(TINA_SYSTEM_PROMPT)) {
  throw new Error("system prompt should explicitly avoid intake-form behavior.");
}
if (!/Default response shape/i.test(TINA_SYSTEM_PROMPT)) {
  throw new Error("system prompt should define a default human response shape.");
}
if (!/Start with a human acknowledgement or direct read/i.test(TINA_SYSTEM_PROMPT)) {
  throw new Error("system prompt should tell Tina to start with a human acknowledgement or direct read.");
}
if (/ask briefly why it is relevant|How is this relevant\?/i.test(TINA_SYSTEM_PROMPT)) {
  throw new Error("system prompt should not tell Tina to challenge relevance for plausible hiring asks.");
}
if (/I’d kick off with a focused scorecard/i.test(TINA_SYSTEM_PROMPT)) {
  throw new Error("system prompt should not encourage scorecard/process mode on agreement.");
}
if (!/when the founder says they do not know yet/i.test(TINA_SYSTEM_PROMPT)) {
  throw new Error("system prompt should have a natural move for founder uncertainty.");
}
if (!/when the founder says the search has been hard/i.test(TINA_SYSTEM_PROMPT)) {
  throw new Error("system prompt should have a natural move for hard-search moments.");
}
if (/Not surprising/i.test(TINA_SYSTEM_PROMPT)) {
  throw new Error("system prompt should not include the dismissive 'Not surprising' phrase.");
}
if (!/"Next move:"/i.test(TINA_SYSTEM_PROMPT)) {
  throw new Error("system prompt should explicitly ban the mechanical Next move label.");
}
if (!/What location\?|What level\?|What compensation\?/i.test(TINA_SYSTEM_PROMPT)) {
  throw new Error("system prompt should explicitly avoid transactional intake questions.");
}
console.log("PASS advisor tone prompt guard");

const founderModelA = buildFounderModel([{ id: "founder-model-a", role: "founder", content: "Third company. 40 people. Need a PM." }]);
const founderModelB = buildFounderModel([{ id: "founder-model-b", role: "founder", content: "This is my first startup. We raised $3M and I think I need a PM." }]);
const founderResponseA = buildFounderModelResponseSketch("Third company. 40 people. Need a PM.");
const founderResponseB = buildFounderModelResponseSketch("This is my first startup. We raised $3M and I think I need a PM.");
const overlap = responseOverlap(founderResponseA, founderResponseB);

expectEqual(founderModelA.founderProfile, "repeat_founder", "third company should build repeat founder model");
expectEqual(founderModelA.companyStage, "40 people", "third company case should capture company size");
expectEqual(founderModelB.founderProfile, "first_time_founder", "first startup should build first-time founder model");
expectIncludes([founderModelB.companyStage], /raised \$3m/i, "first startup case should capture raise");
expectAtMost(overlap, 0.5, "founder-model response overlap should not exceed 50%");
expectIncludes([founderResponseA], /previous company|founder leverage|40 people|routing back/i, "repeat founder response should use repeat-founder failure mode");
expectIncludes([founderResponseB], /first startup|\$3M|founder overload|product signal/i, "first-time founder response should use first-time-founder failure mode");
console.log("PASS founder model response differentiation");

const pmThesisMessages = [
  { id: "pm-thesis-1", role: "founder", content: "I need a PM." },
  { id: "pm-thesis-2", role: "founder", content: "Priorities." },
  { id: "pm-thesis-3", role: "founder", content: "Mostly me." },
  { id: "pm-thesis-4", role: "founder", content: "I need them to run themselves." },
  { id: "pm-thesis-5", role: "founder", content: "Sounds great." }
];
const pmWorkingThesis = buildWorkingThesis(pmThesisMessages);
const pmCurrentRead = buildCurrentRead({ messages: pmThesisMessages });
const pmCurrentReadActions = actionButtonsForCurrentRead(pmCurrentRead).map((action) => action.label);
const pmWorkingThesisPrompt = formatWorkingThesisForPrompt(pmWorkingThesis);
const pmWorkingThesisSketch = buildWorkingThesisResponseSketch(pmThesisMessages);

expectIncludes([pmWorkingThesis.currentHypothesis], /senior independent|independent thinker|coordinator/i, "working thesis should update toward senior independent product thinker");
expectIncludes(pmWorkingThesis.evidence, /I need a PM/i, "working thesis should track initial PM evidence");
expectIncludes(pmWorkingThesis.evidence, /Mostly me/i, "working thesis should track founder bottleneck evidence");
expectIncludes(pmWorkingThesis.evidence, /run themselves/i, "working thesis should track autonomy evidence");
expectIncludes(pmWorkingThesis.resolvedSignals, /prioritization|founder|independent|accepted/i, "working thesis should track resolved signals");
expectIncludes(pmWorkingThesis.openTensions, /location|authority|decision/i, "working thesis should track unresolved tensions");
expectIncludes([pmWorkingThesis.latestInsight], /Agreement added no new evidence|advance/i, "agreement should advance instead of rediagnose");
expectNotIncludes([pmWorkingThesisSketch], /founder leverage.*founder leverage|autonomy.*autonomy|judgment.*judgment/i, "agreement response sketch should not repeat the same diagnosis");
expectIncludes([pmWorkingThesisSketch], /role shape|search lane|concrete/i, "agreement response sketch should move to a concrete next step");
expectIncludes([pmWorkingThesisPrompt], /Do not repeat the latest insight/i, "working thesis prompt should prevent repeated insights");
expectIncludes([pmWorkingThesisPrompt], /If the thesis is stable, move to recommendation/i, "working thesis prompt should move stable thesis forward");
expectEqual(pmCurrentRead.mode, "execution", "multi-turn PM conversation should progress from diagnosis into execution");
expectEqual(pmCurrentReadActions.join(" | "), "Build signal map | Create interview plan | Turn into sourcing brief | Build search lanes", "execution actions should replace diagnostic buttons once enough signal exists");
console.log("PASS working thesis progression");

const currentReadScenarios = [
  {
    name: "VP Sales",
    messages: [
      { id: "vp-sales-1", role: "founder", content: "I think we need a VP Sales." },
      { id: "vp-sales-2", role: "founder", content: "Founder-led sales is working but I can't keep closing every deal." }
    ],
    archetype: "Founder-Led Sales Transition",
    expectedNextBestMove: /Separate founder-only wins from repeatable wins/i,
    expectedActions: "Separate founder-only wins | Build signal map | Define sales handoff | Build scorecard"
  },
  {
    name: "Head of Eng",
    messages: [
      { id: "head-eng-1", role: "founder", content: "Engineering feels slow. Product keeps waiting on eng. I think we need a Head of Engineering." },
      { id: "head-eng-2", role: "founder", content: "The team is 8 engineers. The founder still makes most technical and product priority calls." }
    ],
    archetype: "Engineering Leadership Bottleneck",
    expectedNextBestMove: /Define the 3 decisions this hire must own without founder approval/i,
    expectedRisk: /coordination layer, not leverage/i,
    expectedActions: "Define decision ownership | Build signal map | Compare Head of Eng vs EM vs Staff+ Lead | Build scorecard"
  },
  {
    name: "Someone More Senior",
    messages: [
      { id: "senior-1", role: "founder", content: "I need someone more senior." },
      { id: "senior-2", role: "founder", content: "The team keeps escalating decisions and I need them to run themselves." }
    ],
    archetype: "Senior Ownership Gap",
    expectedNextBestMove: /Define the decisions this person must own independently/i,
    expectedActions: "Define decision ownership | Build signal map | Calibrate seniority | Build scorecard"
  },
  {
    name: "Generalist",
    messages: [
      { id: "generalist-1", role: "founder", content: "I need a generalist." },
      { id: "generalist-2", role: "founder", content: "Honestly they need to do ops, customer stuff, founder office, kind of all of it." }
    ],
    archetype: "Role Compression / Generalist Hire",
    expectedNextBestMove: /Pick the primary lane/i,
    expectedActions: "Split the role | Build signal map | Pick primary lane | Compare archetypes"
  },
  {
    name: "Hire Fast",
    messages: [
      { id: "fast-1", role: "founder", content: "We need to hire fast." },
      { id: "fast-2", role: "founder", content: "Our lead left and I need coverage ASAP." }
    ],
    archetype: "Urgent Hiring Triage",
    expectedNextBestMove: /Define the 30-day coverage problem/i,
    expectedActions: "Define 30-day coverage | Build signal map | Split interim vs permanent | Build triage plan"
  }
];
let committedThesisCount = 0;
let concreteMoveCount = 0;
for (const scenario of currentReadScenarios) {
  const read = buildCurrentRead({ messages: scenario.messages });
  const responseSketch = buildCurrentReadResponseSketch(scenario.messages);
  const actions = actionButtonsForCurrentRead(read).map((action) => action.label);
  expectEqual(read.likelyArchetype, scenario.archetype, `${scenario.name} should map to controlled archetype`);
  expectEqual(read.thesisTitle, scenario.archetype, `${scenario.name} should store thesisTitle as controlled archetype`);
  expectEqual(currentReadTitle(read), scenario.archetype, `${scenario.name} title should use controlled archetype`);
  expectNotIncludes([read.thesisTitle], /\b(i think|need|find|can't|every deal|asap|software engineer|founder'?s office)\b/i, `${scenario.name} should not use raw or stale fallback title`);
  expectAtLeast(read.calibratedScope.length, 1, `${scenario.name} should expose calibrated scope for Current Read UI`);
  expectAtLeast(read.evidence.length, 1, `${scenario.name} should carry evidence for thesis state`);
  expectAtLeast(read.openTensions.length, 1, `${scenario.name} should carry open tensions for thesis state`);
  expectIncludes([read.nextBestMove], scenario.expectedNextBestMove, `${scenario.name} next best move should be action-oriented`);
  if (scenario.expectedRisk) expectIncludes([read.risk], scenario.expectedRisk, `${scenario.name} risk should be practical, not generic`);
  expectIncludes([responseSketch], /Here’s what I think is really going on:/i, `${scenario.name} should commit a clear thesis by turn 2`);
  expectIncludes([responseSketch], /The next best move:/i, `${scenario.name} should include concrete next best move`);
  expectNotIncludes([responseSketch, read.nextBestMove], /How ready are you|What would make this hire|What location\?|What level\?|What compensation\?|What companies\?/i, `${scenario.name} should not ask a broad discovery/intake question after medium confidence`);
  expectNotIncludes([read.mode], /^execution$|^sourcing$/, `${scenario.name} should not show Market Intel before execution`);
  if (read.mode === "discovery" || read.mode === "thesis") {
    expectEqual(actions.join(" | "), "Pressure-test role shape | Clarify ownership gap | Compare role archetypes", `${scenario.name} discovery/thesis actions should be mode-aware`);
  }
  if (read.mode === "calibration") {
    expectEqual(actions.join(" | "), scenario.expectedActions, `${scenario.name} calibration actions should match next best move`);
  }
  expectNotIncludes(actions, /Source candidates|Refine Talent Pool/i, `${scenario.name} should not show sourcing buttons before execution`);
  if (read.mode === "thesis" || read.mode === "calibration") committedThesisCount += 1;
  if (read.nextBestMove.length > 20) concreteMoveCount += 1;
}
expectAtLeast(committedThesisCount, 4, "current read should state a thesis by turn 2 in at least 4/5 scenarios");
expectAtLeast(concreteMoveCount, 4, "current read should give a concrete next best move in at least 4/5 scenarios");
console.log("PASS current read thesis commitment scenarios");

const longFounderReadCases = [
  {
    name: "VP Product does not stay unknown",
    messages: [
      { id: "vp-product-1", role: "founder", content: "I think we need a VP Product." },
      { id: "vp-product-2", role: "founder", content: "Priorities are messy and engineering keeps waiting on product decisions." },
      { id: "vp-product-3", role: "founder", content: "Mostly I am still the final call on what matters." }
    ],
    expected: "Product/Execution Ownership Gap",
    nextMove: /product decisions|founder approval/i
  },
  {
    name: "VP Product with existing PMs becomes founder control",
    messages: [
      { id: "vp-product-control-1", role: "founder", content: "I think we need a VP Product." },
      { id: "vp-product-control-2", role: "founder", content: "We already have PMs, but I still own the roadmap." },
      { id: "vp-product-control-3", role: "founder", content: "Priorities churn every week and trust is low because I keep overriding decisions." }
    ],
    expected: "Founder Control / Product Delegation Gap",
    nextMove: /roadmap|priority decisions|founder/i
  },
  {
    name: "Head of Ops first-time founder becomes cadence delegation",
    messages: [
      { id: "ops-cadence-1", role: "founder", content: "I think I need a Head of Ops. This is my first startup." },
      { id: "ops-cadence-2", role: "founder", content: "We do not really have an operating cadence yet. I keep everything in my head." },
      { id: "ops-cadence-3", role: "founder", content: "People wait for me to translate what matters each week." }
    ],
    expected: "Operating Cadence / Founder Delegation Gap",
    nextMove: /weekly operating cadence|decisions.*founder|founder translation/i
  },
  {
    name: "People leader first-time managers becomes feedback cadence",
    messages: [
      { id: "people-cadence-1", role: "founder", content: "I think we need a people leader." },
      { id: "people-cadence-2", role: "founder", content: "Most of our managers are first-time managers and feedback gets delayed." },
      { id: "people-cadence-3", role: "founder", content: "I keep cushioning the hard conversations because I do not want people to quit." }
    ],
    expected: "Manager Enablement / Feedback Cadence Gap",
    nextMove: /feedback cadence|founder.*cushion|manager/i
  },
  {
    name: "High-agency product operator becomes product ops archetype",
    messages: [
      { id: "product-ops-1", role: "founder", content: "I want someone like this high-agency product operator profile." },
      { id: "product-ops-2", role: "founder", content: "They were great because they could move between customer problems, ops, and product without needing a perfect job description." },
      { id: "product-ops-3", role: "founder", content: "I care more about the people DNA and culture code than their exact title." }
    ],
    expected: "Product/Ops Generalist Archetype",
    nextMove: /proof signals|culture code|operating pattern/i
  },
  {
    name: "ML PhD onboarding becomes workflow before AI",
    messages: [
      { id: "workflow-ai-1", role: "founder", content: "I think we need an ML PhD for onboarding." },
      { id: "workflow-ai-2", role: "founder", content: "Activation is weak because the workflow is complex and we do not have much data yet." },
      { id: "workflow-ai-3", role: "founder", content: "Our existing engineers can use APIs, but nobody owns the customer journey." }
    ],
    expected: "Workflow Ownership Before AI Hire",
    nextMove: /workflow owner|activation|AI depth/i
  },
  {
    name: "First recruiter commits to system before recruiter",
    messages: [
      { id: "recruiter-1", role: "founder", content: "I think we need our first recruiter." },
      { id: "recruiter-2", role: "founder", content: "We only have a few roles open, but interviews are slow and I keep changing what good looks like." },
      { id: "recruiter-3", role: "founder", content: "Candidate flow is not the only issue. The team is not calibrated." }
    ],
    expected: "Recruiting System Before Recruiter",
    nextMove: /hiring plan|interview process|fractional recruiting/i
  },
  {
    name: "Recruiter next-step language does not become capital allocation",
    messages: [
      { id: "recruiter-next-1", role: "founder", content: "I think we need our first recruiter." },
      { id: "recruiter-next-2", role: "founder", content: "We have five important hires this year and interview loops are slow." },
      { id: "recruiter-next-3", role: "founder", content: "What should we do next?" }
    ],
    expected: "Recruiting System Before Recruiter",
    nextMove: /hiring plan|interview process|fractional recruiting|decision/i
  },
  {
    name: "Support reps hold root cause under urgency",
    messages: [
      { id: "support-1", role: "founder", content: "We need more support reps." },
      { id: "support-2", role: "founder", content: "Customers keep asking the same questions after onboarding and the queue is growing." },
      { id: "support-3", role: "founder", content: "It is urgent. I need this fixed fast." }
    ],
    expected: "Support Load Root Cause",
    nextMove: /support coverage|root cause|repeat demand|product\/support loop/i
  },
  {
    name: "Staff engineer can become internal technical leadership",
    messages: [
      { id: "staff-1", role: "founder", content: "I think we need a Staff Engineer." },
      { id: "staff-2", role: "founder", content: "We have one existing technical lead everyone trusts, but decisions still come back to me." },
      { id: "staff-3", role: "founder", content: "Maybe we need to clarify whether they can own the technical direction." }
    ],
    expected: "Internal Technical Leadership Gap",
    nextMove: /internal technical|explicit authority|promote|external hire/i
  }
];

for (const testCase of longFounderReadCases) {
  const read = buildCurrentRead({ messages: testCase.messages });
  expectEqual(read.thesisTitle, testCase.expected, `${testCase.name} should use the committed controlled thesis`);
  expectEqual(read.likelyArchetype, testCase.expected, `${testCase.name} likely archetype should match thesis`);
  expectIncludes([read.nextBestMove], testCase.nextMove, `${testCase.name} next move should match the diagnosis`);
  expectIncludes([read.stability], /committed|revising/i, `${testCase.name} should be committed or revising after enough evidence`);
}

const supportRootCauseCase = longFounderReadCases.find((testCase) => testCase.name === "Support reps hold root cause under urgency");
if (!supportRootCauseCase) throw new Error("support root cause long founder case is missing");
const committedSupportRead = buildCurrentRead({ messages: supportRootCauseCase.messages.slice(0, 2) });
const urgentSupportRead = buildCurrentRead({
  messages: supportRootCauseCase.messages,
  previousRead: { ...committedSupportRead, stability: "committed" }
});
expectEqual(urgentSupportRead.thesisTitle, "Support Load Root Cause", "urgency should not collapse support root cause into urgent hiring triage");

const committedOpsCadenceRead = buildCurrentRead({
  messages: [
    { id: "ops-persist-1", role: "founder", content: "I think I need a Head of Ops. This is my first startup." },
    { id: "ops-persist-2", role: "founder", content: "There is no operating cadence and I keep everything in my head." }
  ]
});
const urgentOpsCadenceRead = buildCurrentRead({
  messages: [
    { id: "ops-persist-1", role: "founder", content: "I think I need a Head of Ops. This is my first startup." },
    { id: "ops-persist-2", role: "founder", content: "There is no operating cadence and I keep everything in my head." },
    { id: "ops-persist-3", role: "founder", content: "I still need a Head of Ops ASAP." }
  ],
  previousRead: { ...committedOpsCadenceRead, stability: "committed" }
});
expectEqual(urgentOpsCadenceRead.thesisTitle, "Operating Cadence / Founder Delegation Gap", "repeated Head of Ops urgency should not collapse cadence thesis");
expectNotEqual(urgentOpsCadenceRead.thesisTitle, "Engineering Leadership Bottleneck", "ops cadence should not be classified as technical leadership without engineering evidence");

const committedProductOpsRead = buildCurrentRead({
  messages: [
    { id: "product-ops-persist-1", role: "founder", content: "I want someone like this high-agency product operator profile." },
    { id: "product-ops-persist-2", role: "founder", content: "They move between customer problems, ops, and product. I care about the people DNA." }
  ]
});
const seniorProductOpsRead = buildCurrentRead({
  messages: [
    { id: "product-ops-persist-1", role: "founder", content: "I want someone like this high-agency product operator profile." },
    { id: "product-ops-persist-2", role: "founder", content: "They move between customer problems, ops, and product. I care about the people DNA." },
    { id: "product-ops-persist-3", role: "founder", content: "Maybe they need to be more senior." }
  ],
  previousRead: { ...committedProductOpsRead, stability: "committed" }
});
expectEqual(seniorProductOpsRead.thesisTitle, "Product/Ops Generalist Archetype", "seniority should stay a constraint inside the product/ops archetype thesis");
expectNotEqual(seniorProductOpsRead.thesisTitle, "Founder-Led Sales Transition", "product/operator generalist should not become sales without sales ownership evidence");
expectNotEqual(seniorProductOpsRead.thesisTitle, "Senior Ownership Gap", "more senior should not steal a sharper product/ops diagnosis");

const committedFounderControlRead = buildCurrentRead({
  messages: [
    { id: "founder-control-persist-1", role: "founder", content: "I think we need a VP Product." },
    { id: "founder-control-persist-2", role: "founder", content: "We have PMs, but I own the roadmap and priority churn is killing trust." }
  ]
});
const urgentFounderControlRead = buildCurrentRead({
  messages: [
    { id: "founder-control-persist-1", role: "founder", content: "I think we need a VP Product." },
    { id: "founder-control-persist-2", role: "founder", content: "We have PMs, but I own the roadmap and priority churn is killing trust." },
    { id: "founder-control-persist-3", role: "founder", content: "It is urgent, I just need the VP Product now." }
  ],
  previousRead: { ...committedFounderControlRead, stability: "committed" }
});
expectEqual(urgentFounderControlRead.thesisTitle, "Founder Control / Product Delegation Gap", "urgency should not erase founder control diagnosis");

const newArchetypeActionCases = [
  { read: committedOpsCadenceRead, expected: "Map operating cadence | Build signal map | Define delegated decisions | Compare ops archetypes" },
  { read: buildCurrentRead({ messages: longFounderReadCases[3].messages }), expected: "Design feedback cadence | Build signal map | Clarify founder role | Compare people support" },
  { read: committedProductOpsRead, expected: "Decode reference profile | Build signal map | Define culture code | Compare generalist lanes" },
  { read: buildCurrentRead({ messages: longFounderReadCases[5].messages }), expected: "Map workflow owner | Build signal map | Separate AI vs workflow | Build scorecard" },
  { read: committedFounderControlRead, expected: "Define product authority | Build signal map | Compare VP Product vs PM lead | Build scorecard" }
];
for (const actionCase of newArchetypeActionCases) {
  const actions = actionButtonsForCurrentRead({ ...actionCase.read, mode: "calibration" }).map((action) => action.label).join(" | ");
  expectEqual(actions, actionCase.expected, `${actionCase.read.thesisTitle} should have thesis-specific right-rail actions`);
}
console.log("PASS long founder diagnosis commitment");

const engineeringSignalMap = buildSignalMap(buildCurrentRead({ messages: currentReadScenarios[1].messages }));
expectEqual(engineeringSignalMap.derivedFromThesisTitle, "Engineering Leadership Bottleneck", "signal map should derive from thesis title");
expectIncludes(engineeringSignalMap.mustProveSignals, /decision ownership|execution rhythm|morale/i, "engineering leadership signal map should focus on bottleneck evidence");
expectIncludes(engineeringSignalMap.falsePositives, /process-heavy EM|Senior IC/i, "engineering leadership signal map should include thesis-specific false positives");
expectIncludes(engineeringSignalMap.interviewProbes, /founder|product and engineering|operating rhythm/i, "engineering leadership signal map should include thesis-specific probes");
expectIncludes([engineeringSignalMap.bestCandidateArchetype], /founder-led decisions|delegated technical/i, "engineering leadership signal map should identify best candidate archetype");

const productSignalMap = buildSignalMap(buildCurrentRead({ messages: pmThesisMessages }));
expectEqual(productSignalMap.derivedFromThesisTitle, "Senior Ownership Gap", "PM progression signal map should derive from the evolved ownership thesis");
expectIncludes(productSignalMap.mustProveSignals, /founder direction|judgment calls|founder dependency/i, "PM progression signal map should focus on ownership evidence");
expectNotIncludes(productSignalMap.mustProveSignals, /generic Head of Engineering|large team/i, "PM progression signal map should not use unrelated generic criteria");
const productSignalMapResponse = buildSignalMapResponse(productSignalMap);
expectAtMost(productSignalMapResponse.split(/\s+/).filter(Boolean).length, 90, "signal map chat response should stay concise");
expectNotIncludes([productSignalMapResponse], /Weak signals:\n-|False positives:\n-|Interview probes:\n-/i, "signal map chat response should not become a long report");

const founderDelegationSignalMap = buildSignalMap(committedFounderControlRead);
expectEqual(founderDelegationSignalMap.derivedFromThesisTitle, "Founder Control / Product Delegation Gap", "VP Product founder-control signal map should derive from committed thesis");
expectIncludes(founderDelegationSignalMap.mustProveSignals, /roadmap|planning cadence|priority churn|founder/i, "VP Product signal map should focus on roadmap ownership and founder decision transfer");
expectIncludes(founderDelegationSignalMap.interviewProbes, /roadmap|planning trust|founder input/i, "VP Product signal map should test planning cadence and founder transfer");

const capitalSignalMap = buildSignalMap({ thesisTitle: "Capital Allocation Diagnosis" });
expectIncludes([capitalSignalMap.bestCandidateArchetype], /not a hiring profile|operating bottleneck/i, "$500K allocation should not produce a hiring-role rubric");
expectNotIncludes([...capitalSignalMap.mustProveSignals, ...capitalSignalMap.falsePositives], /scorecard|candidate|interview/i, "$500K signal map should stay capital-diagnosis oriented");

const bannedSignalMapItems = [
  ...engineeringSignalMap.mustProveSignals,
  ...engineeringSignalMap.weakSignals,
  ...engineeringSignalMap.falsePositives,
  ...engineeringSignalMap.interviewProbes,
  ...productSignalMap.mustProveSignals,
  ...productSignalMap.weakSignals,
  ...productSignalMap.falsePositives,
  ...productSignalMap.interviewProbes,
  ...founderDelegationSignalMap.mustProveSignals,
  ...founderDelegationSignalMap.weakSignals,
  ...founderDelegationSignalMap.falsePositives,
  ...founderDelegationSignalMap.interviewProbes
];
expectNotIncludes(bannedSignalMapItems, /specific example|was broken|title match|strong communicator|has experience|leadership experience|managed .*team|good operator/i, "signal map items should not render banned weak phrases");
console.log("PASS signal map thesis-specific criteria");

const customerOpsSignalMap = buildSignalMap({ thesisTitle: "Support Load Root Cause" });
expectNotIncludes(
  [
    ...customerOpsSignalMap.mustProveSignals,
    ...customerOpsSignalMap.weakSignals,
    ...customerOpsSignalMap.falsePositives,
    ...customerOpsSignalMap.interviewProbes,
    customerOpsSignalMap.bestCandidateArchetype
  ],
  /morale|engineering rhythm|product and engineering/i,
  "support load signal map should not leak engineering leadership signals"
);
expectNotIncludes(customerOpsSignalMap.interviewProbes, /\.\.\.|^(How|What|Tell)\s*$/i, "support load probes should be complete questions");
expectNotIncludes([customerOpsSignalMap.bestCandidateArchetype], /\.\.\./i, "signal map best profile should not be truncated");
console.log("PASS signal map cleanup checks");

const artifactScenarios = [
  { name: "VP Sales", signalMap: buildSignalMap(buildCurrentRead({ messages: currentReadScenarios[0].messages })), expected: /sales motion|founder|repeatable|customer/i },
  { name: "Head of Eng", signalMap: engineeringSignalMap, expected: /decision|rhythm|leadership|founder/i },
  { name: "More Senior", signalMap: buildSignalMap(buildCurrentRead({ messages: currentReadScenarios[2].messages })), expected: /ownership|founder|judgment|decision/i },
  { name: "Generalist", signalMap: buildSignalMap(buildCurrentRead({ messages: currentReadScenarios[3].messages })), expected: /primary lane|generalist|compressed|clarity/i },
  { name: "Hire Fast", signalMap: buildSignalMap(buildCurrentRead({ messages: currentReadScenarios[4].messages })), expected: /stabilize|coverage|urgent|30/i }
];

for (const scenario of artifactScenarios) {
  const scorecard = buildHiringArtifact(scenario.signalMap, "scorecard");
  const interviewPlan = buildHiringArtifact(scenario.signalMap, "interview_plan");
  const archetype = buildHiringArtifact(scenario.signalMap, "candidate_archetype");
  const marketReality = buildHiringArtifact(scenario.signalMap, "market_reality");
  const sourcingStrategy = buildHiringArtifact(scenario.signalMap, "sourcing_strategy");
  expectEqual(scorecard.derivedFromThesisTitle, scenario.signalMap.derivedFromThesisTitle, `${scenario.name} scorecard should derive from signal map`);
  expectEqual(marketReality.derivedFromThesisTitle, scenario.signalMap.derivedFromThesisTitle, `${scenario.name} market reality should derive from signal map`);
  expectEqual(sourcingStrategy.derivedFromThesisTitle, scenario.signalMap.derivedFromThesisTitle, `${scenario.name} sourcing strategy should derive from signal map`);
  expectAtMost(scorecard.rows.length, 5, `${scenario.name} scorecard should stay compact`);
  expectAtMost(interviewPlan.stages.length, 4, `${scenario.name} interview plan should stay compact`);
  expectEqual(archetype.items.length, 5, `${scenario.name} candidate archetype should have five bullets`);
  expectAtLeast(marketReality.marketReality.sourceLanes.length, 3, `${scenario.name} market reality should include source lanes`);
  expectAtLeast(marketReality.marketReality.tradeoffs.length, 3, `${scenario.name} market reality should include tradeoffs`);
  expectAtLeast(marketReality.marketReality.risks.length, 3, `${scenario.name} market reality should include risks`);
  expectIncludes(marketReality.marketReality.missingInputs, /location|seniority|compensation|company\/stage lane/i, `${scenario.name} market reality should ask for missing inputs instead of inventing`);
  expectAtLeast(sourcingStrategy.sourcingStrategy.searchLanes.length, 3, `${scenario.name} sourcing strategy should include search lanes`);
  expectAtLeast(sourcingStrategy.sourcingStrategy.targetTitles.length, 3, `${scenario.name} sourcing strategy should include adjacent titles`);
  expectAtLeast(sourcingStrategy.sourcingStrategy.mustHaveFilters.length, 3, `${scenario.name} sourcing strategy should include must-have filters`);
  expectAtLeast(sourcingStrategy.sourcingStrategy.avoidFilters.length, 3, `${scenario.name} sourcing strategy should include avoid filters`);
  expectAtMost(sourcingStrategy.sourcingStrategy.searchLogic.length, 3, `${scenario.name} sourcing strategy should keep search logic to max 3 examples`);
  expectAtLeast(sourcingStrategy.sourcingStrategy.outreachAngle.length, 20, `${scenario.name} sourcing strategy should include an outreach angle`);
  expectIncludes(sourcingStrategy.sourcingStrategy.missingConstraints, /location|seniority|compensation|company\/stage lane/i, `${scenario.name} sourcing strategy should ask for missing constraints instead of inventing`);
  expectIncludes(
    [
      ...scorecard.rows.flatMap((row) => [row.competency, row.signal, row.strongEvidence, row.redFlag, row.ratingScale]),
      ...interviewPlan.stages.flatMap((stage) => [stage.stage, stage.tests, stage.prompt, stage.evidence, stage.interviewer]),
      ...archetype.items.flatMap((item) => [item.label, item.value]),
      marketReality.marketReality.roleShape,
      ...marketReality.marketReality.sourceLanes,
      ...marketReality.marketReality.tradeoffs,
      ...marketReality.marketReality.risks,
      marketReality.marketReality.nextMove,
      sourcingStrategy.sourcingStrategy.targetProfile,
      ...sourcingStrategy.sourcingStrategy.searchLanes,
      ...sourcingStrategy.sourcingStrategy.targetTitles,
      ...sourcingStrategy.sourcingStrategy.mustHaveFilters,
      ...sourcingStrategy.sourcingStrategy.avoidFilters,
      ...sourcingStrategy.sourcingStrategy.searchLogic,
      sourcingStrategy.sourcingStrategy.outreachAngle
    ],
    scenario.expected,
    `${scenario.name} artifacts should stay thesis-specific`
  );
  expectNotIncludes(
    [
      ...scorecard.rows.flatMap((row) => [row.signal, row.strongEvidence, row.redFlag]),
      ...interviewPlan.stages.flatMap((stage) => [stage.tests, stage.prompt, stage.evidence]),
      ...archetype.items.map((item) => item.value),
      ...marketReality.marketReality.sourceLanes,
      ...marketReality.marketReality.tradeoffs,
      ...marketReality.marketReality.risks,
      marketReality.marketReality.nextMove,
      sourcingStrategy.sourcingStrategy.targetProfile,
      ...sourcingStrategy.sourcingStrategy.searchLanes,
      ...sourcingStrategy.sourcingStrategy.targetTitles,
      ...sourcingStrategy.sourcingStrategy.mustHaveFilters,
      ...sourcingStrategy.sourcingStrategy.avoidFilters,
      ...sourcingStrategy.sourcingStrategy.searchLogic,
      sourcingStrategy.sourcingStrategy.outreachAngle
    ],
    /\.\.\.|Searching public profiles|public profiles|named candidates|Talent Pool/i,
    `${scenario.name} artifacts should avoid truncation and candidate sourcing language`
  );
  expectNotIncludes(
    [
      marketReality.marketReality.roleShape,
      ...marketReality.marketReality.sourceLanes,
      ...marketReality.marketReality.tradeoffs,
      ...marketReality.marketReality.risks,
      marketReality.marketReality.nextMove
    ],
    /\b(SF|NYC|Remote 100%|\$[0-9]|weeks?|wks)\b/i,
    `${scenario.name} market reality should not invent location, comp, or TTF`
  );
}
const headEngSourcingStrategy = buildHiringArtifact(engineeringSignalMap, "sourcing_strategy");
expectIncludes(headEngSourcingStrategy.sourcingStrategy.searchLanes, /EMs reporting directly to technical founders|Early Heads of Eng|Staff\+ leads/i, "Head of Eng sourcing strategy should include thesis-specific adjacent lanes");
expectIncludes(headEngSourcingStrategy.sourcingStrategy.targetTitles, /Engineering Manager|Staff Engineering Lead|Technical Lead Manager/i, "Head of Eng sourcing strategy should include adjacent leadership titles");
expectNotIncludes(headEngSourcingStrategy.sourcingStrategy.searchLogic, /public profiles|candidate|LinkedIn profile/i, "Sourcing strategy should not perform candidate sourcing");
console.log("PASS hiring artifacts derive from signal map");

const artifactQualityScenarios = [
  {
    name: "Head of Eng 10-turn",
    banned: /chief-of-staff|one hire to do three jobs|customer ops/i,
    messages: [
      { id: "head-10-1", role: "founder", content: "Engineering feels slow. Product keeps waiting on eng. I think we need a Head of Engineering." },
      { id: "head-10-2", role: "founder", content: "The team is 8 engineers. The founder still makes most technical and product priority calls." },
      { id: "head-10-3", role: "tina", content: "This is an engineering leadership bottleneck." },
      { id: "head-10-4", role: "founder", content: "That sounds right." },
      { id: "head-10-5", role: "tina", content: "Define the decisions this hire owns." },
      { id: "head-10-6", role: "founder", content: "They need to own architecture tradeoffs and team pace." },
      { id: "head-10-7", role: "tina", content: "That makes this about decision ownership." },
      { id: "head-10-8", role: "founder", content: "Build signal map." },
      { id: "head-10-9", role: "tina", content: "Signal Map is ready." },
      { id: "head-10-10", role: "founder", content: "Build scorecard and define candidate archetype." }
    ]
  },
  {
    name: "Generalist 10-turn",
    banned: /morale|engineering rhythm|technical calls|product\/eng conflict/i,
    messages: [
      { id: "gen-10-1", role: "founder", content: "I need a generalist." },
      { id: "gen-10-2", role: "founder", content: "Honestly they need to do ops, customer stuff, founder office, kind of all of it." },
      { id: "gen-10-3", role: "tina", content: "This is role compression." },
      { id: "gen-10-4", role: "founder", content: "Yes, everything is falling on me." },
      { id: "gen-10-5", role: "tina", content: "Pick the primary lane first." },
      { id: "gen-10-6", role: "founder", content: "The primary lane is customer ops and founder special projects." },
      { id: "gen-10-7", role: "tina", content: "This needs a narrow owner, not a magical generalist." },
      { id: "gen-10-8", role: "founder", content: "Build signal map." },
      { id: "gen-10-9", role: "tina", content: "Signal Map is ready." },
      { id: "gen-10-10", role: "founder", content: "Build scorecard and define candidate archetype." }
    ]
  }
];

for (const scenario of artifactQualityScenarios) {
  const read = buildCurrentRead({ messages: scenario.messages });
  const signalMap = buildSignalMap(read);
  const scorecard = buildHiringArtifact(signalMap, "scorecard");
  const archetype = buildHiringArtifact(signalMap, "candidate_archetype");
  const competencyNames = scorecard.rows.map((row) => row.competency);
  expectEqual(new Set(competencyNames).size, competencyNames.length, `${scenario.name} scorecard competencies should be distinct`);
  expectNotIncludes(scorecard.rows.map((row) => row.redFlag), /Improves|Owns|Rebuilds|Sharp|Real shipping|Startup operating|Reduces/i, `${scenario.name} red flags should not be positive signals`);
  expectNotIncludes(scorecard.rows.flatMap((row) => [row.competency, row.signal, row.strongEvidence, row.redFlag]), scenario.banned, `${scenario.name} scorecard should not leak another scenario`);
  expectNotIncludes(archetype.items.map((item) => item.value), scenario.banned, `${scenario.name} archetype should not leak another scenario`);
  expectNotIncludes(archetype.items.map((item) => item.value), /\.\.\.|incomplete phrase/i, `${scenario.name} archetype should not be truncated`);
  expectEqual(new Set(archetype.items.map((item) => item.value)).size, archetype.items.length, `${scenario.name} archetype fields should not repeat`);
}
console.log("PASS hiring artifact quality checks");

const headEngMarketReality = buildHiringArtifact(engineeringSignalMap, "market_reality");
expectIncludes(headEngMarketReality.marketReality.missingInputs, /comp range/i, "Head of Eng market reality should ask for comp");
expectIncludes(headEngMarketReality.marketReality.missingInputs, /location \/ remote flexibility/i, "Head of Eng market reality should ask for location flexibility");
expectIncludes(headEngMarketReality.marketReality.missingInputs, /seniority tolerance/i, "Head of Eng market reality should ask for seniority tolerance");
expectIncludes(headEngMarketReality.marketReality.missingInputs, /reporting line/i, "Head of Eng market reality should ask for reporting line");
expectIncludes(headEngMarketReality.marketReality.missingInputs, /founder decision rights|authority transfer/i, "Head of Eng market reality should ask for authority transfer");

const urgentCoverageState = {
  roleTitle: "Customer Ops Coordinator",
  roleFamily: "operations",
  seniority: "Seniority forming",
  location: "Location forming",
  mustHaveSignals: ["onboarding", "follow-ups", "internal coordination", "nothing drops"],
  niceToHaveSignals: [],
  exclusions: [],
  sourceCompanyLanes: [],
  compensation: "Comp forming",
  talentPoolSize: "Forming",
  timeToFill: "Not estimated yet",
  candidateProfiles: [],
  calibrationStatus: "forming",
  evidenceLevel: "conversation",
  lastUpdatedReason: "Founder needs onboarding, follow-ups, internal coordination, and making sure nothing drops."
};
const urgentCoverageMarketReality = buildHiringArtifact(buildSignalMap(buildCurrentRead({ messages: currentReadScenarios[4].messages })), "market_reality", urgentCoverageState);
expectIncludes(urgentCoverageMarketReality.marketReality.sourceLanes, /customer ops coordinators/i, "urgent coverage should include customer ops coordinators");
expectIncludes(urgentCoverageMarketReality.marketReality.sourceLanes, /implementation leads/i, "urgent coverage should include implementation leads");
expectIncludes(urgentCoverageMarketReality.marketReality.sourceLanes, /customer success operators/i, "urgent coverage should include customer success operators");
expectIncludes(urgentCoverageMarketReality.marketReality.sourceLanes, /founder.?s office|ops generalists/i, "urgent coverage should include founder's office / ops generalists");
expectNotIncludes(urgentCoverageMarketReality.marketReality.sourceLanes, /senior operators|fractional leaders|interim leaders/i, "urgent operational coverage should not default to senior/fractional/interim leaders");

const moreSeniorSourcingStrategy = buildHiringArtifact(buildSignalMap(buildCurrentRead({ messages: currentReadScenarios[2].messages })), "sourcing_strategy");
expectIncludes([moreSeniorSourcingStrategy.sourcingStrategy.targetProfile], /directional|confirm the function/i, "More Senior sourcing should stay directional until function is clear");
expectIncludes(moreSeniorSourcingStrategy.sourcingStrategy.missingConstraints, /function to seniorize/i, "More Senior sourcing should ask for the function before narrow lanes");
expectNotIncludes(
  [
    moreSeniorSourcingStrategy.sourcingStrategy.targetProfile,
    ...moreSeniorSourcingStrategy.sourcingStrategy.searchLanes,
    ...moreSeniorSourcingStrategy.sourcingStrategy.targetTitles,
    ...moreSeniorSourcingStrategy.sourcingStrategy.searchLogic
  ],
  /Chief of Staff|Founder.?s Office/i,
  "More Senior sourcing should not default to Chief of Staff or Founder's Office without function evidence"
);

const generalistSourcingStrategy = buildHiringArtifact(buildSignalMap(buildCurrentRead({ messages: currentReadScenarios[3].messages })), "sourcing_strategy");
expectDistinct(generalistSourcingStrategy.sourcingStrategy.searchLanes, "Generalist search lanes should be distinct");
expectDistinct(generalistSourcingStrategy.sourcingStrategy.targetTitles, "Generalist target titles should be distinct");
expectDistinct(generalistSourcingStrategy.sourcingStrategy.mustHaveFilters, "Generalist must-have filters should be distinct");
expectDistinct(generalistSourcingStrategy.sourcingStrategy.avoidFilters, "Generalist avoid filters should be distinct");
expectNotIncludes(
  [
    generalistSourcingStrategy.sourcingStrategy.targetProfile,
    ...generalistSourcingStrategy.sourcingStrategy.searchLanes,
    ...generalistSourcingStrategy.sourcingStrategy.targetTitles,
    ...generalistSourcingStrategy.sourcingStrategy.mustHaveFilters,
    ...generalistSourcingStrategy.sourcingStrategy.avoidFilters,
    ...generalistSourcingStrategy.sourcingStrategy.searchLogic
  ],
  /Rebuilds trust and morale|engineering rhythm|Head of Engineering/i,
  "Generalist sourcing should not leak Head of Eng signals"
);

const hireFastSourcingStrategy = buildHiringArtifact(buildSignalMap(buildCurrentRead({ messages: currentReadScenarios[4].messages })), "sourcing_strategy");
expectIncludes(hireFastSourcingStrategy.sourcingStrategy.searchLanes, /customer ops coordinators/i, "Hire Fast sourcing should bias toward customer ops coordinators");
expectIncludes(hireFastSourcingStrategy.sourcingStrategy.searchLanes, /implementation coordinators|implementation leads/i, "Hire Fast sourcing should include implementation coverage");
expectIncludes(hireFastSourcingStrategy.sourcingStrategy.searchLanes, /customer success operators|post-sales operators/i, "Hire Fast sourcing should include CS/post-sales operators");
expectNotIncludes(
  [
    ...hireFastSourcingStrategy.sourcingStrategy.searchLanes,
    ...hireFastSourcingStrategy.sourcingStrategy.targetTitles,
    ...hireFastSourcingStrategy.sourcingStrategy.searchLogic
  ],
  /senior operators|fractional leaders|interim leaders|functional leads|Chief of Staff/i,
  "Hire Fast sourcing should not over-level coverage work into leadership by default"
);
expectNotIncludes(
  [
    ...headEngMarketReality.marketReality.sourceLanes,
    ...urgentCoverageMarketReality.marketReality.sourceLanes,
    ...headEngMarketReality.marketReality.tradeoffs,
    ...urgentCoverageMarketReality.marketReality.tradeoffs,
    ...headEngMarketReality.marketReality.risks,
    ...urgentCoverageMarketReality.marketReality.risks
  ],
  /public profiles|named candidates|Searching public profiles/i,
  "market reality should not source or show candidates"
);
console.log("PASS market reality polish checks");

const canonicalCases = [
  {
    name: "plant manager Peoria canonical state",
    messages: [{ id: "founder-plant", role: "founder", content: "This is a Plant Manager in Peoria, Illinois for healthcare manufacturing." }],
    assert(state) {
      expectEqual(state.roleTitle, "Plant Manager", "plant manager should preserve title");
      expectEqual(state.roleFamily, "manufacturing operations", "plant manager should be manufacturing operations");
      expectEqual(state.location, "Peoria, IL", "Peoria should normalize to Peoria, IL");
    }
  },
  {
    name: "senior software engineer canonical state",
    messages: [{ id: "founder-sse", role: "founder", content: "Actually I mean Senior Software Engineer, not Founder Office." }],
    assert(state) {
      expectEqual(state.roleTitle, "Senior Software Engineer", "senior software engineer title should be canonical");
      expectEqual(state.roleFamily, "engineering", "senior software engineer should be engineering");
      expectNotEqual(state.roleFamily, "operations", "senior software engineer should not become founder office");
    }
  },
  {
    name: "head of engineering leadership canonical state",
    messages: [
      { id: "founder-head-eng", role: "founder", content: "I need a Head of Engineering." },
      { id: "founder-head-eng-context", role: "founder", content: "Technical decisions keep coming back to me and shipping is slowing down." }
    ],
    assert(state) {
      const context = `Canonical search state:\n${formatCanonicalSearchStateForPrompt(state)}`;
      const queries = buildPublicTalentSearchQueries(context).join("\n");
      const read = buildCurrentRead({ messages: [
        { id: "founder-head-eng", role: "founder", content: "I need a Head of Engineering." },
        { id: "founder-head-eng-context", role: "founder", content: "Technical decisions keep coming back to me and shipping is slowing down." }
      ], canonicalSearchState: state });

      expectEqual(state.roleTitle, "Head of Engineering", "Head of Engineering should preserve leadership title");
      expectEqual(state.roleFamily, "engineering", "Head of Engineering should stay in engineering family");
      expectIncludes(state.mustHaveSignals, /engineering leadership|technical judgment|team operating cadence/i, "engineering leadership should use leadership signals");
      expectIncludes(state.sourceCompanyLanes, /engineering leadership|technical leaders|scaled engineering/i, "engineering leadership should use leadership source lanes");
      expectEqual(read.thesisTitle, "Engineering Leadership Bottleneck", "current read should preserve engineering leadership thesis");
      expectIncludes(read.calibratedScope, /Head of Engineering|engineering leadership|technical judgment|team operating cadence/i, "Current Read scope should use leadership classification");
      expectIncludes([queries], /Head of Engineering|VP Engineering|Director of Engineering|Engineering Manager/i, "queries should target engineering leadership titles");
      expectNotIncludes([queries], /"software engineer"|"founding engineer"|"product engineer"|"full-stack engineer"/i, "engineering leadership queries should not fall back to IC software roles");
    }
  },
  {
    name: "VP Engineering canonical state",
    messages: [{ id: "founder-vp-eng", role: "founder", content: "We need a VP Engineering who can stabilize technical leadership." }],
    assert(state) {
      expectEqual(state.roleTitle, "VP Engineering", "VP Engineering should preserve leadership title");
      expectEqual(state.roleFamily, "engineering", "VP Engineering should classify as engineering");
      expectIncludes(state.mustHaveSignals, /engineering leadership|technical judgment|team operating cadence/i, "VP Engineering should use leadership signals");
    }
  },
  {
    name: "Engineering Manager canonical state",
    messages: [{ id: "founder-eng-manager", role: "founder", content: "Looking for an Engineering Manager for a founder-led technical team." }],
    assert(state) {
      expectEqual(state.roleTitle, "Engineering Manager", "Engineering Manager should preserve management title");
      expectEqual(state.roleFamily, "engineering", "Engineering Manager should classify as engineering");
      expectIncludes(state.mustHaveSignals, /engineering leadership|technical judgment|team operating cadence/i, "Engineering Manager should use leadership signals");
    }
  },
  {
    name: "AI infrastructure engineer canonical state",
    messages: [{ id: "founder-infra", role: "founder", content: "I need a senior AI infrastructure engineer, not an AI Product Engineer." }],
    assert(state) {
      expectEqual(state.roleTitle, "Senior AI Infrastructure Engineer", "AI infrastructure should preserve senior infrastructure title");
      expectEqual(state.roleFamily, "engineering", "AI infrastructure should be engineering");
      expectNotEqual(state.roleTitle, "AI Product Engineer", "AI infra should not become product engineer");
    }
  },
  {
    name: "role correction wins",
    messages: [
      { id: "founder-pm", role: "founder", content: "I need a PM." },
      { id: "tina-pm", role: "tina", content: "Sounds like a product lane." },
      { id: "founder-correction", role: "founder", content: "Actually I mean Senior Software Engineer." }
    ],
    assert(state) {
      expectEqual(state.roleTitle, "Senior Software Engineer", "latest correction should update role title");
      expectEqual(state.roleFamily, "engineering", "latest correction should update role family");
    }
  },
  {
    name: "synthetic candidates labeled",
    messages: [{ id: "founder-synthetic", role: "founder", content: "Find me engineers." }],
    profileLeads: [profileLeadFixture({ evidenceLevel: "synthetic", url: "https://example.com/synthetic" })],
    assert(state) {
      expectEqual(state.evidenceLevel, "synthetic", "synthetic lead should set canonical evidence level");
      expectEqual(state.candidateProfiles[0].evidenceLevel, "synthetic", "candidate should remain synthetic");
    }
  },
  {
    name: "public candidates without verification labeled",
    messages: [{ id: "founder-public", role: "founder", content: "Find me engineers." }],
    profileLeads: [profileLeadFixture({ url: "https://www.linkedin.com/in/public-lead", evidenceLevel: undefined })],
    assert(state) {
      expectEqual(state.candidateProfiles[0].evidenceLevel, "unverified_lead", "public lead without verification should be unverified");
    }
  },
  {
    name: "correction replaces plant manager with software engineer",
    messages: [
      { id: "founder-plant-a", role: "founder", content: "I need a Plant Manager in Peoria, Illinois for a manufacturing facility." },
      { id: "tina-plant-a", role: "tina", content: "Plant manager in Peoria means manufacturing operations." },
      { id: "founder-engineer-a", role: "founder", content: "Actually I mean Senior Software Engineer in San Francisco." }
    ],
    assert(state) {
      expectEqual(state.roleTitle, "Senior Software Engineer", "correction should replace Plant Manager");
      expectEqual(state.roleFamily, "engineering", "correction should replace manufacturing operations");
      expectEqual(state.location, "San Francisco", "correction should replace Peoria");
    }
  },
  {
    name: "AI infrastructure sourcing context stays engineering",
    messages: [
      { id: "founder-plant-b", role: "founder", content: "I need a Plant Manager in Peoria, Illinois for a manufacturing facility." },
      { id: "founder-infra-b", role: "founder", content: "Find me a senior AI infrastructure engineer in San Francisco." },
      { id: "founder-pull-b", role: "founder", content: "Pull 5 public profiles." }
    ],
    assert(state) {
      const context = `Canonical search state:\n${formatCanonicalSearchStateForPrompt(state)}`;
      expectEqual(state.roleFamily, "engineering", "AI infrastructure search should be engineering");
      expectIncludes([context], /canonical role family:\s*engineering/i, "sourcing context should carry engineering family");
      expectIncludes([context], /senior ai infrastructure engineer/i, "sourcing context should carry infrastructure title");
      expectIncludes([context], /San Francisco/i, "sourcing context should carry San Francisco location");
      expectNotIncludes([context], /canonical role family:\s*manufacturing operations|Peoria/i, "sourcing context should not carry stale operations location");
    }
  },
  {
    name: "material role change clears stale profiles",
    messages: [
      { id: "founder-plant-c", role: "founder", content: "I need a Plant Manager in Peoria, Illinois for a manufacturing facility." },
      { id: "founder-engineer-c", role: "founder", content: "Actually I mean Senior Software Engineer in San Francisco." }
    ],
    profileLeads: [
      profileLeadFixture({
        id: "plant-lead",
        title: "Sam Plant - Plant Manager",
        snippet: "Peoria Illinois manufacturing plant leadership and FDA quality operations.",
        tags: ["manufacturing", "operations"],
        evidenceLevel: "unverified_lead"
      })
    ],
    assert(state) {
      expectEqual(state.roleFamily, "engineering", "role correction should be engineering");
      expectEqual(state.candidateProfiles.length, 0, "old manufacturing profile should not remain current");
    }
  },
  {
    name: "AI infrastructure search expands adjacent title lanes",
    messages: [
      { id: "founder-ai-infra-search", role: "founder", content: "Find me a senior AI infrastructure engineer in San Francisco. Pull 5 public profiles." }
    ],
    assert(state) {
      const context = `Canonical search state:\n${formatCanonicalSearchStateForPrompt(state)}`;
      const queries = [
        ...buildPublicTalentSearchQueries(context),
        ...buildExpandedPublicTalentSearchQueries(context, "adjacent"),
        ...buildExpandedPublicTalentSearchQueries(context, "domain")
      ].join("\n");

      expectIncludes([queries], /AI Infrastructure Engineer/i, "queries should include exact AI infrastructure title");
      expectIncludes([queries], /ML Infrastructure Engineer/i, "queries should include ML infrastructure adjacent title");
      expectIncludes([queries], /ML Platform Engineer/i, "queries should include ML platform adjacent title");
      expectIncludes([queries], /AI Platform Engineer/i, "queries should include AI platform adjacent title");
      expectIncludes([queries], /Staff Software Engineer/i, "queries should include staff software adjacent lane");
      expectIncludes([queries], /site:github\.com/i, "queries should include GitHub/technical footprint lane");
      expectNotIncludes([queries], /account executive|sales|gtm|chief of staff|recruiter/i, "queries should not target GTM/operator/recruiting lanes");
    }
  },
  {
    name: "pull profiles uses canonical AI infra search context",
    messages: [
      { id: "founder-ai-infra-role", role: "founder", content: "Find me a senior AI infrastructure engineer in San Francisco fintech." },
      { id: "founder-ai-infra-pull", role: "founder", content: "Pull 5 public profiles." }
    ],
    assert(state) {
      const context = `Canonical search state:\n${formatCanonicalSearchStateForPrompt(state)}`;
      const queries = buildPublicTalentSearchQueries(context).join("\n");

      expectEqual(state.roleTitle, "Senior AI Infrastructure Engineer", "profile pull should preserve AI infrastructure title");
      expectEqual(state.roleFamily, "engineering", "profile pull should preserve engineering family");
      expectEqual(state.location, "San Francisco", "profile pull should preserve San Francisco location");
      expectIncludes([queries], /AI Infrastructure Engineer|ML Infrastructure Engineer|ML Platform Engineer/i, "profile pull should generate profile search lanes, not archetypes only");
      expectNotIncludes([queries], /operations|plant manager|Peoria|account executive|sales/i, "profile pull should not use stale operations or GTM lanes");
    }
  },
  {
    name: "product profile search keeps requested location",
    messages: [
      { id: "founder-product-location", role: "founder", content: "Find me a product manager in San Francisco with fintech experience. Send me a list of good candidates." }
    ],
    assert(state) {
      const context = `Canonical search state:\n${formatCanonicalSearchStateForPrompt(state)}`;
      const queries = buildPublicTalentSearchQueries(context).join("\n");

      expectEqual(state.roleFamily, "product", "product search should stay product");
      expectEqual(state.location, "San Francisco", "product search should preserve San Francisco");
      expectIncludes([queries], /San Francisco/i, "product sourcing queries should include requested location");
      expectIncludes([queries], /product manager|founding product manager|head of product/i, "product sourcing queries should target product profiles");
    }
  },
  {
    name: "product eng profile ask overrides stale infra state",
    messages: [
      { id: "founder-ai-infra-first", role: "founder", content: "Find me a senior AI infrastructure engineer in San Francisco." },
      { id: "tina-ai-infra-first", role: "tina", content: "I’d start with AI infrastructure and ML platform engineers." },
      { id: "founder-product-eng", role: "founder", content: "Can you find me a few profiles of product eng in SF from top schools and companies first?" }
    ],
    assert(state) {
      const context = `Canonical search state:\n${formatCanonicalSearchStateForPrompt(state)}`;
      const queries = buildPublicTalentSearchQueries(context).join("\n");

      expectEqual(state.roleTitle, "Product Engineer", "latest product eng wording should become Product Engineer");
      expectEqual(state.roleFamily, "engineering", "Product Engineer should remain an engineering role family");
      expectEqual(state.location, "San Francisco", "SF should normalize to San Francisco");
      expectIncludes([queries], /product engineer/i, "sourcing queries should target product engineers");
      expectNotIncludes([queries], /AI Infrastructure Engineer/i, "latest product eng request should not keep stale AI infra title");
    }
  },
  {
    name: "smart contract bridge scope stays light",
    messages: [
      { id: "founder-smart-contract-bridge", role: "founder", content: "Find me a smart contract engineer in US, my company is called bridge.xyz." }
    ],
    assert(state) {
      expectEqual(state.roleTitle, "Smart Contract Engineer", "smart contract request should set role title");
      expectEqual(state.roleFamily, "engineering", "smart contract engineer should be engineering");
      expectEqual(state.location, "United States", "US should normalize to United States");
      expectNotIncludes(state.mustHaveSignals, /shipping proof|technical ownership/i, "scope chips should not invent strong proof signals");
    }
  },
  {
    name: "founder-led sales calibration lane stays GTM",
    messages: [
      { id: "founder-sales-1", role: "founder", content: "We need a VP Sales." },
      { id: "founder-sales-2", role: "founder", content: "Founder still closes most deals." },
      { id: "founder-sales-3", role: "founder", content: "Sales motion is not repeatable." },
      { id: "founder-sales-4", role: "founder", content: "Remote US, Bay Area plus." },
      { id: "founder-sales-5", role: "founder", content: "Show me 3 calibration profiles." }
    ],
    assert(state) {
      const context = [
        `Canonical search state:\n${formatCanonicalSearchStateForPrompt(state)}`,
        "Current Read: Founder-Led Sales Transition",
        "Founder still closes most deals.",
        "Sales motion is not repeatable.",
        "Remote US, Bay Area plus."
      ].join("\n");
      const queries = buildPublicTalentSearchQueries(context).join("\n");
      const positiveQueryText = queries.replace(/-"[^"]+"/g, "");
      const refinedQueries = buildPublicTalentSearchQueries(context, {
        positivePatterns: [
          "first GTM hires",
          "founder-led sales builders",
          "built repeatable motion from founder selling"
        ],
        negativePatterns: [
          "late-stage VP Sales",
          "enterprise sales managers",
          "people who only managed reps after process existed"
        ],
        updatedSearchThesis: "Bias toward first GTM hires and founder-led sales builders. Avoid late-stage VP Sales and enterprise sales managers."
      }).join("\n");
      const positiveRefinedQueryText = refinedQueries.replace(/-"[^"]+"/g, "");

      expectEqual(state.roleFamily, "gtm", "founder-led sales request should be GTM");
      expectIncludes([queries], /first GTM|founding AE|early sales lead|sales builder|player-coach|founder-led sales|repeatable sales/i, "sales-transition queries should target first-GTM lanes");
      expectIncludes([queries], /Remote US|Bay Area/i, "sales-transition queries should preserve remote US / Bay Area constraint");
      expectNotIncludes([positiveQueryText], /founder office|startup operator|product operator|AI operator/i, "sales-transition queries should not drift into operator lanes");
      expectIncludes([refinedQueries], /first GTM|founding AE|sales builder|founder-led sales|repeatable sales/i, "feedback refinement should stay in founder-led sales lanes");
      expectNotIncludes([positiveRefinedQueryText], /founder office|startup operator|product operator|AI operator/i, "feedback refinement should not reintroduce generic operator lanes");
    }
  },
  {
    name: "messy founder sales language updates canonical state",
    messages: [
      { id: "messy-sales-1", role: "founder", content: "I think I need like a sales person. Maybe VP sales? I don’t know. I’m tired of doing all the calls myself and it’s kind of becoming a mess." },
      { id: "messy-sales-2", role: "founder", content: "Not that predictable honestly. Some deals happen because I know the customer or I can explain the vision. If someone else does it, it feels flat." },
      { id: "messy-sales-3", role: "founder", content: "Maybe demos can survive without me? The product story maybe not. Can you just show me a few people who feel kinda like the right shape? I need to see it, otherwise this is too abstract." },
      { id: "messy-sales-4", role: "founder", content: "Ugh no, not people hire. Sales person. Maybe SF or remote, I don’t care that much. Just not some big company VP who needs a whole machine already working." },
      { id: "messy-sales-5", role: "founder", content: "Yeah that’s right. Now show me like 3 people-ish examples. I don’t need perfect. I just want to react to something." }
    ],
    assert(state) {
      const context = [
        `Canonical search state:\n${formatCanonicalSearchStateForPrompt(state)}`,
        "Current Read: Founder-Led Sales Transition",
        "Founder-dependent sales; demos may survive without founder; product story may not.",
        "Need examples to react to, not finalists."
      ].join("\n");
      const queries = buildPublicTalentSearchQueries(context).join("\n");
      const positiveQueryText = queries.replace(/-"[^"]+"/g, "");

      expectEqual(state.roleFamily, "gtm", "messy correction should become sales/GTM");
      expectIncludes([state.roleTitle], /Sales|GTM/i, "messy correction should keep a sales title");
      expectEqual(state.location, "Remote US / Bay Area plus", "SF or remote loose constraint should not become SF-only");
      expectIncludes(state.exclusions, /late-stage VP|people\/recruiting|founder office/i, "messy correction should exclude people/corporate/operator drift");
      expectIncludes([queries], /first GTM|founding AE|early sales lead|sales builder|founder-led sales|repeatable sales/i, "messy sales queries should target calibration sales builders");
      expectIncludes([queries], /Remote US|Bay Area/i, "messy sales queries should preserve loose location constraint");
      expectNotIncludes([positiveQueryText], /people hire|recruiter|founder office|startup operator|product operator|AI operator/i, "messy sales queries should not drift into people/operator lanes");

      const naturalShapeRequest = "Can you just show me a few people who feel kinda like the right shape? I need to see it, otherwise this is too abstract.";
      const read = buildCurrentRead({ messages: [
        { id: "shape-1", role: "founder", content: "I think I need like a sales person. Maybe VP sales? I don’t know. I’m tired of doing all the calls myself." },
        { id: "shape-2", role: "founder", content: naturalShapeRequest }
      ], canonicalSearchState: state });
      const shapes = buildExampleShapes(read, state);
      const feedback = buildExampleShapeFeedback("More like founding AE, less executive.", read);

      expectEqual(isExampleShapeRequest(naturalShapeRequest), true, "natural shape request should route to example shapes");
      expectIncludes([shapes.title], /sales/i, "sales shape request should produce sales-oriented example shapes");
      expectIncludes(shapes.shapes.map((shape) => shape.name), /Founding AE|First GTM|VP Sales false positive/i, "sales shapes should include founder-led sales archetypes");
      expectNotIncludes(shapes.shapes.map((shape) => shape.name), /named|LinkedIn|profile/i, "example shapes should not be named profiles");
      expectIncludes(feedback.positiveSignals, /Founder-led selling|First sales|repeatable/i, "shape feedback should store positive sales signals");
      expectIncludes(feedback.negativeSignals, /Late-stage VP|Manager of managers|working sales machine/i, "shape feedback should store negative executive signals");
    }
  },
  {
    name: "no existing team does not become leadership bottleneck",
    messages: [
      { id: "no-team-1", role: "founder", content: "I think I need a Head of Engineering, but honestly we have no existing engineering team yet. This would be the first technical hire." }
    ],
    assert(state) {
      const read = buildCurrentRead({ messages: this.messages, canonicalSearchState: state });
      expectNotEqual(read.thesisTitle, "Engineering Leadership Bottleneck", "no existing team should disqualify leadership bottleneck");
      expectNotIncludes([read.hypothesis, read.observation, read.nextBestMove], /leadership bottleneck/i, "no existing team read should not phrase as leadership bottleneck");
    }
  },
  {
    name: "not X becomes explicit exclusion",
    messages: [
      { id: "not-x-1", role: "founder", content: "Ugh no, not people hire. Sales person. Not founder office either. Maybe SF or remote, I don't care that much." }
    ],
    assert(state) {
      expectEqual(state.roleFamily, "gtm", "not people hire plus sales should become GTM");
      expectIncludes(state.exclusions, /people\/recruiting/i, "negated people lane should be excluded");
      expectIncludes(state.exclusions, /founder-office|generic operator/i, "negated founder-office lane should be excluded");
      expectEqual(state.location, "Remote US / Bay Area plus", "loose SF/remote should stay loose");
    }
  },
  {
    name: "category choice produces comparison shapes",
    messages: [
      { id: "compare-1", role: "founder", content: "I am choosing between a PM and an operator. Can you compare the shapes?" }
    ],
    assert(state) {
      const request = this.messages[0].content;
      const read = buildCurrentRead({ messages: this.messages, canonicalSearchState: state });
      const shapes = buildExampleShapes(read, state, undefined, request);

      expectEqual(isExampleShapeRequest(request), true, "category choice should route to example shapes");
      expectIncludes([shapes.title], /Product vs operator|Comparison/i, "category choice should produce comparison shapes");
      expectIncludes(shapes.shapes.map((shape) => shape.name), /Product|operator|false positive/i, "comparison shapes should show the categories, not market fields");
    }
  }
];

for (const testCase of canonicalCases) {
  const state = buildCanonicalSearchState({ messages: testCase.messages, profileLeads: testCase.profileLeads });
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

function expectNotIncludes(values, pattern, message) {
  const matched = values.some((value) => pattern instanceof RegExp ? pattern.test(value) : value === pattern);
  if (matched) fail(message, values, `not ${pattern.toString()}`);
}

function expectDistinct(values, message) {
  const normalized = values.map((value) => String(value).toLowerCase().replace(/[^\w\s]/g, "").replace(/\s+/g, " ").trim());
  const unique = new Set(normalized);
  if (unique.size !== normalized.length) fail(message, values, "all distinct");
}

function fail(message, actual, expected) {
  throw new Error(`${message}. Expected ${expected}, got ${JSON.stringify(actual)}.`);
}

function responseOverlap(a, b) {
  const aTokens = significantTokens(a);
  const bTokens = significantTokens(b);
  const intersection = [...aTokens].filter((token) => bTokens.has(token)).length;
  const denominator = Math.max(1, Math.min(aTokens.size, bTokens.size));
  return intersection / denominator;
}

function significantTokens(value) {
  const stop = new Set(["the", "and", "for", "that", "this", "with", "from", "before", "there", "where", "what", "need", "role", "pm", "would", "should", "into", "not", "you", "your", "they", "them", "because", "enough"]);
  return new Set(
    value
      .toLowerCase()
      .replace(/[^a-z0-9$ ]/g, " ")
      .split(/\s+/)
      .filter((token) => token.length > 3 && !stop.has(token))
  );
}

function profileLeadFixture(overrides = {}) {
  return {
    id: "lead-fixture",
    title: "Taylor Example - Senior Software Engineer",
    snippet: "Public profile mentions software engineering and shipped systems.",
    url: "https://www.linkedin.com/in/taylor-example",
    source: "linkedin",
    query: "site:linkedin.com/in software engineer",
    fitReason: "Possible fit because the public result overlaps with engineering proof.",
    confidence: "medium",
    tags: ["engineering", "systems"],
    saved: false,
    ...overrides
  };
}
