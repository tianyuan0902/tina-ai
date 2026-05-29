import { buildBrainState } from "../.tmp/eval-brain-state/lib/brain/buildBrainState.js";
import { buildCanonicalSearchState, formatCanonicalSearchStateForPrompt } from "../.tmp/eval-brain-state/lib/brain/canonicalSearchState.js";
import { evaluateSourcingReadiness } from "../.tmp/eval-brain-state/lib/tina/sourcing-readiness.js";
import { buildExpandedPublicTalentSearchQueries, buildPublicTalentSearchQueries } from "../.tmp/eval-brain-state/lib/tina/search-query-builder.js";
import { buildFounderModel, buildFounderModelResponseSketch } from "../.tmp/eval-brain-state/lib/tina-mvp/founder-model.js";
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
