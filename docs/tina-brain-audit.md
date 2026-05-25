# Tina Brain Audit

Date: 2026-05-24

## Scope

This audit inspected Tina's current local brain, prompt wiring, retrieval logic, chat route, evals, and supporting markdown/brain files before adding more product features.

No system prompt rewrite, knowledge restructuring, deletion, or product feature work was done.

## Executive Read

Tina's brain has a strong center of gravity: founder psychology, calibration, startup operating fit, and operator archetypes. The best files help Tina translate messy founder language into sharper hiring judgment.

The main risk is not absence of knowledge. It is uneven retrievability. Some high-value concepts exist in compact files, but certain obvious founder questions do not retrieve them reliably. Outreach, DEI/inclusive hiring, recruiter/hiring-manager collaboration, Talent Pool mechanics, and Living JD evolution are underbuilt compared with calibration and founder psychology.

## Current Brain Inventory

Total `knowledge_base` markdown files: 82.

Folder counts:

| Area | Files | Contribution |
| --- | ---: | --- |
| `knowledge_base/calibration` | 11 | Core Tina calibration judgment: ambiguity, role definition, market feedback, interview signal, talent bar, compensation/speed tradeoffs. |
| `knowledge_base/calibration_cases` | 1 | Compact startup hiring failure cases. |
| `knowledge_base/examples` | 1 | Example response pattern for founder calibration. |
| `knowledge_base/failure_modes` | 4 | Guardrails against shallow matching, fake clarity, desperation, and workflow-first recruiting. |
| `knowledge_base/founder_notes` | 1 | Short founder psychology orientation. |
| `knowledge_base/founder_psychology` | 14 | Strongest emotional/operating layer: trust, founder bottlenecks, dependency, mirror hiring, context density. |
| `knowledge_base/live_qa` | 8 | Retrieval-friendly answer examples for common hiring asks. |
| `knowledge_base/market_compensation` | 4 | Compensation source interpretation and tradeoff guidance. |
| `knowledge_base/operator_archetypes` | 18 | Candidate/operator types, startup fit, product-thinking builders, ownership, high agency. |
| `knowledge_base/patterns` | 5 | Meta-patterns for Tina reasoning and voice. |
| `knowledge_base/principles` | 6 | Foundational principles: ambiguity, calibration vs matching, signal extraction, voice. |
| `knowledge_base/startup_dynamics` | 8 | Startup operating system dynamics: speed, context fragmentation, energy, decision latency. |
| `knowledge_base/writing_samples` | 1 | Tina-style writing samples. |

All current `knowledge_base` files:

- `knowledge_base/calibration/calibration_vs_matching_atomic.md`
- `knowledge_base/calibration/candidate_examples_as_instruments.md`
- `knowledge_base/calibration/core_retrieval_patterns.md`
- `knowledge_base/calibration/founder_signal_clarity.md`
- `knowledge_base/calibration/interview_inconsistency_detection.md`
- `knowledge_base/calibration/judgment_under_pressure.md`
- `knowledge_base/calibration/market_feedback_as_calibration.md`
- `knowledge_base/calibration/market_positioning.md`
- `knowledge_base/calibration/role_definition_quality.md`
- `knowledge_base/calibration/strong_candidate_signals.md`
- `knowledge_base/calibration/talent_bar_calibration.md`
- `knowledge_base/calibration_cases/startup_hiring_failure_modes.md`
- `knowledge_base/examples/example_founder_calibration.md`
- `knowledge_base/failure_modes/calibration_not_competency.md`
- `knowledge_base/failure_modes/desperation_scope_vs_bar.md`
- `knowledge_base/failure_modes/fake_clarity.md`
- `knowledge_base/failure_modes/workflow_over_judgment.md`
- `knowledge_base/founder_notes/founder_psychology.md`
- `knowledge_base/founder_psychology/autonomy_vs_reassurance.md`
- `knowledge_base/founder_psychology/autonomy_vs_visibility.md`
- `knowledge_base/founder_psychology/context_density.md`
- `knowledge_base/founder_psychology/delegation_under_uncertainty.md`
- `knowledge_base/founder_psychology/executive_calibration.md`
- `knowledge_base/founder_psychology/founder_anxiety_dynamics.md`
- `knowledge_base/founder_psychology/founder_dependency_loops.md`
- `knowledge_base/founder_psychology/founder_intuition_patterns.md`
- `knowledge_base/founder_psychology/founder_loneliness.md`
- `knowledge_base/founder_psychology/founder_mirror_hiring.md`
- `knowledge_base/founder_psychology/founder_understands_dynamics.md`
- `knowledge_base/founder_psychology/pedigree_as_certainty_shortcut.md`
- `knowledge_base/founder_psychology/trust_generation.md`
- `knowledge_base/founder_psychology/trust_under_scaling.md`
- `knowledge_base/live_qa/ai_product_engineer.md`
- `knowledge_base/live_qa/founder_minded_technical.md`
- `knowledge_base/live_qa/founding_pm.md`
- `knowledge_base/live_qa/senior_backend_engineer.md`
- `knowledge_base/live_qa/smart_contract_engineer.md`
- `knowledge_base/live_qa/startup_energy.md`
- `knowledge_base/live_qa/startup_operator.md`
- `knowledge_base/live_qa/too_corporate.md`
- `knowledge_base/market_compensation/compensation_source_map.md`
- `knowledge_base/market_compensation/equal_pay_for_equal_work.md`
- `knowledge_base/market_compensation/leetcode_compensation_india.md`
- `knowledge_base/market_compensation/levels_fyi.md`
- `knowledge_base/operator_archetypes/clarity_creation.md`
- `knowledge_base/operator_archetypes/clarity_creator.md`
- `knowledge_base/operator_archetypes/founder_adjacent_operators.md`
- `knowledge_base/operator_archetypes/founding_pm.md`
- `knowledge_base/operator_archetypes/high_agency_operators.md`
- `knowledge_base/operator_archetypes/high_agency_vs_polish.md`
- `knowledge_base/operator_archetypes/high_range_startup_operator.md`
- `knowledge_base/operator_archetypes/independent_operator_mismatch.md`
- `knowledge_base/operator_archetypes/independent_operator_patterns.md`
- `knowledge_base/operator_archetypes/ownership_without_authority.md`
- `knowledge_base/operator_archetypes/product_taste_under_ambiguity.md`
- `knowledge_base/operator_archetypes/product_thinking_engineers.md`
- `knowledge_base/operator_archetypes/shipping_velocity_vs_depth.md`
- `knowledge_base/operator_archetypes/signal_interpreter.md`
- `knowledge_base/operator_archetypes/smartcontract_engineer.md`
- `knowledge_base/operator_archetypes/startup_energy_patterns.md`
- `knowledge_base/operator_archetypes/startup_native_builders.md`
- `knowledge_base/operator_archetypes/startup_operator.md`
- `knowledge_base/patterns/ai_shifts_differentiation_to_judgment.md`
- `knowledge_base/patterns/compress_complexity_for_founders.md`
- `knowledge_base/patterns/judgment_is_indirect.md`
- `knowledge_base/patterns/signal_over_answers.md`
- `knowledge_base/patterns/vibes_as_pattern_recognition.md`
- `knowledge_base/principles/ambiguity_tolerance.md`
- `knowledge_base/principles/calibration_vs_matching.md`
- `knowledge_base/principles/emotional_operating_compatibility.md`
- `knowledge_base/principles/hiring_philosophy.md`
- `knowledge_base/principles/signal_extraction.md`
- `knowledge_base/principles/tina_voice.md`
- `knowledge_base/startup_dynamics/context_fragmentation.md`
- `knowledge_base/startup_dynamics/decision_latency.md`
- `knowledge_base/startup_dynamics/each_hire_changes_company.md`
- `knowledge_base/startup_dynamics/humans_change_each_other.md`
- `knowledge_base/startup_dynamics/organizational_energy.md`
- `knowledge_base/startup_dynamics/startup_pressure_systems.md`
- `knowledge_base/startup_dynamics/startups_as_emotional_systems.md`
- `knowledge_base/startup_dynamics/wide_operating_range.md`
- `knowledge_base/writing_samples/tina_voice_samples.md`

## What Major Knowledge Areas Contribute

### Calibration

The calibration folder is the practical center of Tina's recruiting judgment. It teaches Tina to separate title matching from actual operating need, treat candidate examples as calibration instruments, recognize weak pipeline quality as a clarity problem, and reason about market feedback. `core_retrieval_patterns.md` adds the newest compact Q/A chunks across the major product directions: founder ambiguity, role calibration, archetypes, sourcing, interview signal, compensation, Living JD, calibration drift, and quality vs speed.

Best files:

- `calibration/core_retrieval_patterns.md`: highest breadth, strong chunk format, but some chunks do not retrieve reliably yet.
- `calibration/talent_bar_calibration.md`: strong for weak pipeline/quality problems.
- `calibration/founder_signal_clarity.md`: strong founder-market signal framing.
- `calibration/interview_inconsistency_detection.md` and `calibration/judgment_under_pressure.md`: useful for interview signal and "something feels off" cases.
- `calibration/role_definition_quality.md`: useful for role clarity and pipeline quality.

### Founder Psychology

This is Tina's most distinctive brain area. It gives Tina the ability to understand founder bottlenecks, trust, context density, mirror hiring, anxiety, autonomy, and delegation without sounding therapeutic or corporate.

Best files:

- `founder_psychology/founder_dependency_loops.md`: strong for founder bottleneck conversations.
- `founder_psychology/founder_mirror_hiring.md`: strong for "I need someone who thinks like me."
- `founder_psychology/context_density.md`, `founder_loneliness.md`, `trust_under_scaling.md`: strong for founder depth and scaling pain.
- `founder_psychology/autonomy_vs_visibility.md` and `founder_anxiety_dynamics.md`: important for strong-people disengagement.

### Operator Archetypes

This is the candidate mapping layer. It covers startup-native builders, high-agency operators, founding PMs, startup operators, product-thinking engineers, smart contract engineers, ownership without authority, and polish vs agency.

Best files:

- `operator_archetypes/startup_native_builders.md`: important for AI/product/design startup-fit cases.
- `operator_archetypes/high_agency_operators.md`: useful cross-cutting archetype.
- `operator_archetypes/clarity_creation.md`: critical for founder PM/operator asks.
- `operator_archetypes/founding_pm.md`: richer than most files and strong for PM calibration.
- `operator_archetypes/startup_operator.md`: richer archetype file for founder-leverage/operator searches.
- `operator_archetypes/product_thinking_engineers.md` and `shipping_velocity_vs_depth.md`: strong for AI builder vs researcher tradeoffs.
- `operator_archetypes/signal_interpreter.md`: promising recruiter/hiring-partner concept, but currently isolated.

### Startup Dynamics

This area helps Tina reason about why teams slow down, why context fragments, why one hire changes the company, and why environment fit is real. It is useful for moving Tina beyond role templates.

Best files:

- `startup_dynamics/context_fragmentation.md`
- `startup_dynamics/decision_latency.md`
- `startup_dynamics/organizational_energy.md`
- `startup_dynamics/wide_operating_range.md`
- `startup_dynamics/startup_pressure_systems.md`

### Failure Modes

This is a good guardrail layer. It keeps Tina away from ATS/workflow thinking, generic matching, fake clarity, and desperation hiring.

Best files:

- `failure_modes/workflow_over_judgment.md`: important product-philosophy guardrail.
- `failure_modes/fake_clarity.md`: useful for title/JD clarity illusions.
- `failure_modes/desperation_scope_vs_bar.md`: useful for over-scoped or under-resourced searches.
- `failure_modes/calibration_not_competency.md`: useful for avoiding shallow competency framing.

### Live QA and Writing Samples

The `live_qa` files are compact examples that help Tina answer common role asks in voice. They are easy to retrieve because retrieval keeps whole `live_qa` files intact.

Strongest examples:

- `live_qa/ai_product_engineer.md`
- `live_qa/founding_pm.md`
- `live_qa/smart_contract_engineer.md`
- `live_qa/startup_operator.md`
- `live_qa/too_corporate.md`

Risk: examples can overpower general reasoning if retrieved for adjacent but not exact topics. Example: a Living JD query retrieved `live_qa/ai_product_engineer.md` and `market_compensation/levels_fyi.md` instead of Living JD-specific material.

### Market Compensation

The compensation files are useful but currently source-oriented rather than scenario-oriented. They teach Tina to treat compensation sources as directional, separate salary/equity/bonus, and reason about remote/global pay. They do not yet fully cover founder-facing tradeoff patterns such as "below-market cash, high scope, early equity" or "senior title expectations with mid-level budget."

### Principles and Patterns

These files contain Tina's philosophical base: ambiguity tolerance, signal extraction, voice, emotional compatibility, and judgment. They are useful, but several are short and semantically broad, which makes retrieval uneven unless the exact terms are present.

## Supporting Brain/Docs Outside `knowledge_base`

Additional markdown and code brain files exist outside the current retrieval path:

- `lib/brain/*.md`: legacy/static brain notes such as `founder_patterns.md`, `hiring_principles.md`, `sourcing_failure_modes.md`, and `talent_archetypes.md`.
- `lib/tina-brain/*.ts`: older or parallel hardcoded brain modules for archetypes, calibration engine, response style, market tradeoffs, sample candidates, and interview signals.
- `evals/*.md`: response quality, rhythm, and conversation momentum evals.
- `evals/evals:retrieval_quality/*.md`: retrieval quality cases.

Important: `retrieveBrainContext.ts` currently reads only `knowledge_base/**/*.md`. The `lib/brain/*.md` notes and `lib/tina-brain/*.ts` brain modules are not part of local Tina Brain retrieval unless the app calls them somewhere else.

## Prompt and Chat Wiring

`lib/tina-mvp/system-prompt.ts` is actively used by `app/api/tina-mvp/chat/route.ts`.

The chat route builds the OpenAI instructions from:

1. `TINA_SYSTEM_PROMPT`
2. extra normal-chat instruction
3. optional Live JD instruction
4. retrieved Tina Brain context from `retrieveBrainContext(latestUserMessage.content)`
5. optional company context from Tavily

The route preserves full conversation history by mapping all clean founder/Tina messages into the OpenAI input. Retrieval, however, only uses the latest founder message, not the full conversation.

Public profile sourcing is handled separately before OpenAI:

- `isPublicProfileSearchRequest()` detects requests for public profiles/leads.
- `searchPublicProfileLeads()` uses Tavily when `TAVILY_API_KEY` exists.
- If Tavily is absent, `public-search.ts` falls back to mock profile-like results.
- `ProfileLead` is defined in `lib/tina/profile-lead-types.ts`.
- `TinaMvpMessage` supports `profileLeads`.

## Retrieval Logic Check

`lib/brain/retrieveBrainContext.ts`:

- recursively reads all markdown files in `knowledge_base`
- splits files into chunks unless file path starts with `live_qa/` or `examples/`
- scores chunks through keyword overlap plus hand-tuned boosts
- requires top score >= `MIN_RELEVANCE_SCORE` of 8
- returns only chunks within 70% of the top score
- logs retrieved chunks in development through the chat route

Strengths:

- Simple and transparent.
- Works well for exact founder-intuition cases covered by evals.
- Good domain guards reduce cross-contamination between smart contract, AI product, backend, operator, product, and compensation topics.
- Development logging makes failures visible.

Risks:

- Retrieval uses only the latest user message, so multi-turn context can be lost for retrieval even though OpenAI receives the full conversation.
- Some important concepts exist but do not retrieve because wording does not match the scoring boosts.
- Chunk splitting can create duplicate retrieval from the same file, especially when a file has multiple short chunks sharing query terms.
- The 70% cutoff can exclude relevant secondary files when one file scores much higher.
- Some high-value concepts are trapped in broad files instead of dedicated retrieval-friendly files.
- `core_retrieval_patterns.md` contains several important chunks, but not all of them are easy to retrieve by natural founder wording.

## Retrieval Eval Result

Command run:

```bash
npm run eval:retrieval
```

Result:

```text
All retrieval evals passed.
```

Notable eval notes:

- AI Product Engineer passed, but missed `ambiguity_tolerance.md`.
- Candidate "perfect on paper but feels off" passed, but missed `interview_inconsistency_detection.md` and `judgment_under_pressure.md`.
- Founder bottleneck passed with only `founder_dependency_loops.md`; it missed `trust_generation.md`, `delegation_under_uncertainty.md`, and `clarity_creation.md`.
- Founder "A players leave" passed, but missed `emotional_operating_compatibility.md`, `founder_anxiety_dynamics.md`, and `autonomy_vs_visibility.md`.
- Founding Designer passed, but retrieved only `product_taste_under_ambiguity.md` from expected files.
- Startup Generalist passed, but missed `ambiguity_tolerance.md`, `clarity_creation.md`, and `independent_operator_patterns.md`.

Interpretation: the eval suite is useful but lenient. A case can pass when only one expected file appears. That is enough for a smoke test, not enough for confidence that Tina's best judgment is consistently retrieved.

## Spot Retrieval Checks

Additional manual retrieval probes:

| Query | Retrieval Result | Audit Read |
| --- | --- | --- |
| "How should we build a Talent Pool of potential candidates?" | Retrieved calibration/pipeline quality files. | Useful but not Talent Pool-specific. |
| "Write an outreach message for a founding PM" | No context. | Clear missing area. |
| "How do we handle DEI and inclusive hiring for this search?" | Retrieved weakly related calibration/voice files. | Missing knowledge. |
| "Our calibration keeps drifting after each candidate" | No context. | Existing `core_retrieval_patterns.md` chunk is not retrievable enough. |
| "We need a living JD for a founding AI engineer" | Retrieved AI product/live QA and compensation files. | Live JD knowledge exists but is not findable as a distinct concept. |
| "Should we hire fast or wait for higher candidate quality?" | Retrieved quality/speed tradeoff plus unrelated founder psychology. | Partial coverage. |
| "How should the recruiter and hiring manager work together?" | Retrieved desperation/workflow guardrails. | Missing workflow collaboration guidance. |
| "Where should we source startup-native product engineers?" | Retrieved startup-native/operator files. | Good partial answer, but lacks sourcing strategy depth. |

## Strongest Knowledge Areas

1. Founder psychology under uncertainty.
2. Calibration vs matching.
3. Startup fit vs big-company fit.
4. High-agency/operator archetypes.
5. Interview signal and founder intuition.
6. Product-thinking technical builders.
7. Startup dynamics: context fragmentation, decision latency, organizational energy.
8. Guardrails against ATS/workflow/product bloat.

## Weak, Duplicate, Generic, or Conflicting Knowledge

### Duplicate or Overlapping

- `operator_archetypes/clarity_creation.md` and `operator_archetypes/clarity_creator.md` overlap heavily. One is a principle-style chunk, the other an archetype. Both are useful, but the distinction should be sharpened later.
- `calibration/calibration_vs_matching_atomic.md` and `principles/calibration_vs_matching.md` cover similar ground.
- `founder_notes/founder_psychology.md` is a broad short note that overlaps with the richer `founder_psychology/` folder.
- `knowledge_base/examples/example_founder_calibration.md`, `knowledge_base/live_qa/smart_contract_engineer.md`, and `lib/brain/examples_good_bad.md` all include the smart-contract example pattern.
- `operator_archetypes/startup_operator.md`, `operator_archetypes/high_range_startup_operator.md`, and `operator_archetypes/high_agency_operators.md` are related enough that retrieval may not consistently choose the right level of specificity.

### Weak or Thin

- Sourcing strategy has only one compact chunk in `core_retrieval_patterns.md` and indirect support in calibration files.
- Talent Pool / potential candidates is mostly represented in product code and mock candidates, not a deep knowledge base.
- Living JD exists as a route instruction and one chunk in `core_retrieval_patterns.md`, but not as a dedicated brain file.
- Candidate quality vs speed exists as one chunk and scattered language.
- Outreach/message strategy is almost absent.
- DEI and inclusive hiring are effectively absent.
- Recruiter/hiring manager collaboration is barely represented, mostly through `signal_interpreter.md` and code types.

### Generic Risk

Several short files use strong Tina phrasing but remain abstract. They may help tone, but they do not always provide concrete examples, interview questions, search lanes, outreach language, or tradeoff handling.

### Conflict Risk

No severe conceptual conflict was found. The main tension is product-directional:

- Tina should not be an ATS/workflow engine.
- But the user direction includes recruiter/hiring manager workflows, Talent Pool, sourcing, and outreach.

This is not a contradiction if those areas are framed as judgment workflows, calibration loops, and sourcing intelligence rather than process automation.

## Missing Knowledge Areas by Product Direction

| Area | Current Coverage | Gap |
| --- | --- | --- |
| Founder hiring ambiguity | Strong | Good enough for now. |
| Role calibration | Strong | Could use more role-specific examples later. |
| Candidate archetypes | Strong | Need clearer hierarchy and less overlap later. |
| Sourcing strategy | Medium-weak | Needs dedicated sourcing strategy patterns. |
| Talent Pool / potential candidates | Weak | Needs files on profile review, candidate lanes, yes/no calibration, and saved pools. |
| Living JD | Weak | Needs a dedicated retrieval-friendly file. |
| Interview calibration | Medium | Good signal concepts, but needs interview-loop and debrief patterns. |
| Compensation tradeoffs | Medium | Good sources, needs founder-scenario tradeoff chunks. |
| Startup fit vs big-company fit | Strong | Good current coverage. |
| Calibration drift | Weak | Exists in `core_retrieval_patterns.md`, but retrieval misses it. |
| Candidate quality vs speed | Medium-weak | Exists, but should be expanded into more patterns. |
| Recruiter/hiring manager workflows | Weak | Needs judgment-centered collaboration, not ATS process. |
| DEI and inclusive hiring | Missing | Needs careful, non-generic, legally cautious guidance. |
| Outreach / sourcing message strategy | Missing | Needs founder-native outreach strategy and examples. |

## Prompt and Style Risks

The current system prompt is strong and aligned with Tina's product direction. It explicitly blocks generic assistant behavior, ATS/dashboard/workflow framing, long consultant language, and over-formatting.

Risks to watch:

- The prompt has many avoided phrases. This can help, but over time it may create brittle style constraints if every new weak answer leads to another banned phrase.
- The prompt says not to use some phrases that are still present in eval examples or older knowledge, such as repeated "One risk I'd watch for." That means old examples may pull against newer voice guidance.
- The chat route adds a normal-chat instruction that says "if the user asks for a sourcing strategy, give 2-3 sharp moves," but the knowledge base does not yet provide enough sourcing intelligence to make that consistently strong.
- Live JD is handled by a route instruction, not much brain. Tina can draft a JD, but the brain may not help it evolve a Living JD as calibration changes.

## Recommended Files to Add or Improve

Do not add these yet. This is the recommended next brain work.

Add:

- `knowledge_base/sourcing/sourcing_strategy_patterns.md`
- `knowledge_base/sourcing/outreach_message_strategy.md`
- `knowledge_base/talent_pool/profile_review_calibration.md`
- `knowledge_base/talent_pool/potential_candidate_lanes.md`
- `knowledge_base/calibration/calibration_drift.md`
- `knowledge_base/calibration/candidate_quality_vs_speed.md`
- `knowledge_base/living_jd/living_jd_patterns.md`
- `knowledge_base/interview/interview_loop_calibration.md`
- `knowledge_base/interview/debrief_signal_patterns.md`
- `knowledge_base/collaboration/recruiter_hiring_manager_judgment_loops.md`
- `knowledge_base/inclusive_hiring/dei_inclusive_calibration.md`
- `knowledge_base/market_compensation/founder_compensation_tradeoffs.md`

Improve:

- Add more retrieval terms to `core_retrieval_patterns.md` chunks for "drift", "living JD", "outreach", "Talent Pool", "potential candidates", "inclusive", and "recruiter/hiring manager".
- Split or clarify `clarity_creation.md` vs `clarity_creator.md`.
- Decide whether `founder_notes/founder_psychology.md` is still useful or only a duplicate index.
- Convert the best `lib/brain/*.md` notes into `knowledge_base` only if they are still strategically relevant.

## Top 10 Highest-Impact Brain Improvements

1. Add a dedicated calibration drift file with examples of market learning vs founder anxiety vs shiny-profile pull.
2. Add a dedicated Living JD file that explains how the JD should evolve from role ambiguity, candidate feedback, market reality, and founder tradeoffs.
3. Add Talent Pool knowledge around yes/no profile review, candidate lanes, why Tina surfaced someone, and how profile feedback changes calibration.
4. Add sourcing strategy knowledge that starts from work pattern, adjacent companies, candidate environments, and search-lane tradeoffs.
5. Add outreach/message strategy that helps founders write specific, high-signal outreach without sounding generic or over-selling.
6. Add DEI/inclusive hiring knowledge that treats inclusion as calibration quality, signal design, and search-lane expansion, not corporate slogans.
7. Add recruiter/hiring-manager collaboration knowledge framed as judgment alignment and feedback loops, not process administration.
8. Add interview loop calibration files for debrief quality, interviewer drift, signal disagreement, and "polished but thin" candidates.
9. Add compensation tradeoff scenarios for early-stage founders: cash vs equity, title inflation, remote geography, seniority expectations, and scarce talent markets.
10. Tighten retrieval evals so key cases require more than one expected file when the answer needs multiple judgment layers.

## What Not To Touch Yet

- Do not rewrite `lib/tina-mvp/system-prompt.ts` yet. It is aligned enough; the brain has bigger gaps than the prompt.
- Do not delete or restructure `knowledge_base` yet. First add missing retrieval-friendly files and improve eval coverage.
- Do not add a vector database yet. The current keyword retrieval is simple and inspectable; the next issue is better content and evals.
- Do not build new product features before the brain supports the core Talent Pool, sourcing, Living JD, outreach, and interview-calibration behaviors.
- Do not migrate the old `lib/tina-brain` engine into the MVP chat path yet. It may contain useful ideas, but the active MVP path is simpler and clearer.
- Do not make Tina into an ATS, scheduler, dashboard, or workflow automation tool. Keep the product direction as recruiting intelligence and founder judgment.

## Bottom Line

Tina's current brain is strongest when the founder says something emotionally or operationally messy: "I need someone who thinks like me," "the team is slow," "this candidate looks good but feels off," or "our pipeline is weak." That is the product's real edge.

Before building more features, the brain should get stronger around the product surfaces the app is moving toward: Talent Pool, sourcing, outreach, Living JD, interview calibration, compensation tradeoffs, and inclusive hiring. The next brain pass should add small retrieval-friendly files, not a broad rewrite.
