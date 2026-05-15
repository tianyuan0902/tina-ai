"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowUp, Bookmark, Bot, MessageCircle, Paperclip, Plus, Send, ThumbsDown, ThumbsUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CandidateProfileCard } from "@/components/tina/candidate-profile-card";
import { LiveWorkspace } from "@/components/tina/live-workspace";
import {
  applyCandidateFeedback,
  applyFounderMessage,
  createKickoffBrief,
  createSeedState,
  seedHiringNeed
} from "@/lib/tina-brain/calibration-engine";
import { generateRenderedTinaResponse, scoreCandidates } from "@/lib/tina/brain";
import { createInitialCalibrationMemory } from "@/lib/tina/calibration-memory";
import { applyFeedbackEvent, createFeedbackEvent } from "@/lib/tina/feedback-engine";
import { renderConversationalTinaAnswer } from "@/lib/tina/response-renderer";
import { applyTinaResponseStyle } from "@/lib/tina/response-style";
import type {
  CalibrationMemory,
  FeedbackEvent,
  RenderedTinaResponseBlock,
  TinaResponseBlock,
  UpdateImpact
} from "@/lib/tina/types";
import type { FeedbackDirection, TinaState } from "@/lib/types";
import { cn } from "@/lib/utils";

const leadingQuestions = [
  "We need a founding AI engineer...",
  "We're hiring our first Head of Product...",
  "Help me calibrate a senior product designer role..."
];

const recentConversations = [
  ["Founding AI Engineer", "Just now"],
  ["Head of Product", "Yesterday"],
  ["Senior Product Designer", "May 8"],
  ["Early Sales Hire", "May 6"],
  ["Head of People", "May 2"]
];

export function KickoffChat({ initialNeed }: { initialNeed?: string }) {
  const [state, setState] = useState<TinaState>(() => createInitialKickoffState(initialNeed));
  const [dynamic, setDynamic] = useState<DynamicDemoState>(() => createDynamicDemoState());
  const [draft, setDraft] = useState("");
  const [hasAsked, setHasAsked] = useState(Boolean(initialNeed));
  const [contextDepth, setContextDepth] = useState(() => getContextDepth(initialNeed || ""));
  const [showDebug, setShowDebug] = useState(false);
  const developerMode = false;
  const scrollRef = useRef<HTMLDivElement>(null);
  const consumedInitialNeedRef = useRef(Boolean(initialNeed?.trim()));

  const brief = useMemo(() => createKickoffBrief(state), [state]);
  const shouldShowStructuredResponse = false;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    window.localStorage.setItem("tina_latest_state", JSON.stringify(state));
    window.localStorage.setItem("tina_latest_brief", JSON.stringify(brief));
  }, [state, brief]);

  useEffect(() => {
    if (consumedInitialNeedRef.current) return;

    const params = new URLSearchParams(window.location.search);
    const pendingNeed = (params.get("need") || window.localStorage.getItem("tina_pending_need") || "").trim();
    if (!pendingNeed) return;

    consumedInitialNeedRef.current = true;
    window.localStorage.removeItem("tina_pending_need");
    setState((current) => applyFounderMessage(current, pendingNeed));
    setHasAsked(true);
    setContextDepth(getContextDepth(pendingNeed));
  }, []);

  function sendMessage() {
    const value = draft.trim();
    if (!value) return;
    setState((current) => applyFounderMessage(current, value));
    setHasAsked(true);
    setContextDepth((current) => current + getContextDepth(value));
    setDraft("");
  }

  function handleFeedback(profileId: string, direction: FeedbackDirection, reason: string) {
    setState((current) => applyCandidateFeedback(current, profileId, direction, reason));
  }

  function submitStructuredFeedback(signal: FeedbackEvent["signal"], message: string) {
    if (!message.trim()) return;

    const event = createFeedbackEvent({
      roleId: dynamic.memory.roleId,
      signal,
      message: message.trim()
    });
    const result = applyFeedbackEvent({
      memory: dynamic.memory,
      previousBlocks: dynamic.rawBlocks,
      event
    });
    const nextScores = scoreCandidates(result.memory);
    const livingJd = result.rawBlocks.find((block) => block.id === "living-jd")?.content;
    const searchLogic = result.rawBlocks.find((block) => block.id === "search-logic")?.content;
    const recommendation = result.rawBlocks.find((block) => block.id === "recommendation-summary")?.content;
    const riskFlags = result.rawBlocks.find((block) => block.id === "risk-flags")?.content;

    setDynamic({
      memory: result.memory,
      rawBlocks: result.rawBlocks,
      renderedBlocks: result.renderedBlocks,
      impacts: result.impacts,
      feedbackEvents: [...dynamic.feedbackEvents, event],
      status: "Got it — I’ll stop treating fintech as a requirement. I’d shift the search toward distributed systems + startup ownership, and use fintech only as a possible bonus signal."
    });

    setState((current) => ({
      ...current,
      profiles: current.profiles.map((profile) => {
        const score = nextScores.find((item) => item.candidateId === profile.id);
        return score ? { ...profile, profileMatch: score.score } : profile;
      }),
      workspace: {
        ...current.workspace,
        livingJdDraft: livingJd ?? current.workspace.livingJdDraft,
        recommendedSourcingDirection: searchLogic ?? current.workspace.recommendedSourcingDirection,
        suggestedNextMove: recommendation ?? current.workspace.suggestedNextMove,
        tradeoffsToMonitor: riskFlags
          ? [riskFlags, ...current.workspace.tradeoffsToMonitor.filter((item) => item !== riskFlags)].slice(0, 4)
          : current.workspace.tradeoffsToMonitor,
        openAssumptions: [
          "Fintech is optional context, not a hard screen.",
          "Distributed systems and startup ownership now carry more weight.",
          ...current.workspace.openAssumptions
        ].slice(0, 5)
      }
    }));
  }

  return (
    <div className="grid min-h-screen bg-[#fbfaf7] text-[#191714] lg:grid-cols-[20%_80%] xl:grid-cols-[20%_50%_30%]">
      <LeftRail />

      <main className="min-w-0 px-5 py-10 md:px-8">
        <section className="mx-auto max-w-4xl">
          <div className="mb-5">
            <h1 className="text-3xl font-semibold tracking-normal text-[#191714]">
              Hiring kickoff
            </h1>
            <p className="mt-2 text-lg text-[#5c554e]">Start with a messy hiring need.</p>
          </div>

          <section className="flex min-h-[52vh] flex-col rounded-2xl border border-[#e5ded3] bg-[#fffdf8] shadow-[0_24px_80px_rgba(49,42,34,0.06)]">
            <div className="border-b border-[#eee7dc] px-8 py-4">
              <div className="flex flex-wrap gap-3">
                {leadingQuestions.map((question) => (
                  <button
                    key={question}
                    type="button"
                    onClick={() => {
                      setState((current) => applyFounderMessage(current, question));
                      setHasAsked(true);
                      setContextDepth((current) => current + getContextDepth(question));
                    }}
                    className="min-h-10 rounded-xl bg-[#f2ede5] px-4 py-2 text-sm leading-5 text-[#3f3933] transition hover:bg-[#ebe3d8]"
                  >
                    {question}
                  </button>
                ))}
              </div>
            </div>
            <div ref={scrollRef} className="min-h-[330px] flex-1 overflow-y-auto px-8 py-8">
              <div className="grid gap-6">
                {state.messages.map((message, index) => {
                  const isLatestTinaMessage = message.role === "tina" && index === state.messages.length - 1;
                  if (shouldShowStructuredResponse && isLatestTinaMessage) return null;

                  return (
                    <MessageBubble
                      key={message.id}
                      role={message.role}
                      content={message.content}
                      showSnapshot={false}
                      state={state}
                    />
                  );
                })}
                {shouldShowStructuredResponse ? (
                  <StructuredResponseDemo
                    dynamic={dynamic}
                    developerMode={developerMode}
                    showDebug={developerMode && showDebug}
                    onToggleDebug={() => setShowDebug((current) => !current)}
                    onSubmitFeedback={submitStructuredFeedback}
                  />
                ) : null}
              </div>
            </div>
            <div className="border-t border-[#eee7dc] p-5">
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Reply to Tina..."
                className="min-h-20 w-full resize-none border-0 bg-transparent text-base leading-7 text-[#191714] outline-none placeholder:text-[#8d857c]"
              />
              <div className="flex items-center justify-between">
                <button type="button" className="text-[#7a7168]" aria-label="Attach context">
                  <Paperclip className="h-5 w-5" />
                </button>
                <Button
                  type="button"
                  onClick={sendMessage}
                  size="icon"
                  className="h-11 w-11 rounded-full bg-[#b7aa99] text-white hover:bg-[#9f927f]"
                  aria-label="Send"
                >
                  <ArrowUp className="h-5 w-5" />
                </Button>
              </div>
            </div>
          </section>

          <p className="mt-4 text-sm text-[#8a8178]">
            Tina uses local mock market data and hiring research for this prototype.
          </p>

          <section className="mt-8">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[#191714]">Calibration profiles</p>
                <p className="text-sm text-[#7a7168]">Sample archetypes, not sourced candidates.</p>
              </div>
              <Button asChild variant="outline" className="rounded-xl bg-[#fffdf8]">
                <Link href="/brief">
                  Generate brief
                  <Send className="h-4 w-4" />
                </Link>
              </Button>
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
              {state.profiles.map((profile) => (
                <CandidateProfileCard
                  key={profile.id}
                  profile={profile}
                  onFeedback={handleFeedback}
                />
              ))}
            </div>
          </section>
        </section>
      </main>

      <div className="hidden px-5 py-7 xl:block">
        <LiveWorkspace workspace={state.workspace} />
      </div>
    </div>
  );
}

type DynamicDemoState = {
  memory: CalibrationMemory;
  rawBlocks: TinaResponseBlock[];
  renderedBlocks: RenderedTinaResponseBlock[];
  impacts: UpdateImpact[];
  feedbackEvents: FeedbackEvent[];
  status: string;
};

function createInitialKickoffState(initialNeed?: string): TinaState {
  const cleanedNeed = initialNeed?.trim();
  const baseState = createSeedState(cleanedNeed || seedHiringNeed);

  return cleanedNeed ? applyFounderMessage(baseState, cleanedNeed) : baseState;
}

function createDynamicDemoState(): DynamicDemoState {
  const memory = createInitialCalibrationMemory();
  const response = generateRenderedTinaResponse(memory);
  return {
    memory,
    rawBlocks: response.rawBlocks,
    renderedBlocks: response.renderedBlocks,
    impacts: [],
    feedbackEvents: [],
    status: ""
  };
}

function StructuredResponseDemo({
  dynamic,
  developerMode,
  showDebug,
  onToggleDebug,
  onSubmitFeedback
}: {
  dynamic: DynamicDemoState;
  developerMode: boolean;
  showDebug: boolean;
  onToggleDebug: () => void;
  onSubmitFeedback: (signal: FeedbackEvent["signal"], message: string) => void;
}) {
  return null;

  const [activeSignal, setActiveSignal] = useState<FeedbackEvent["signal"]>("correct");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [feedbackText, setFeedbackText] = useState(
    "Fintech is not required. Distributed systems and startup ownership matter more."
  );
  const changedIds = new Set(dynamic.impacts.map((impact) => impact.blockId));
  const primaryBlocks = ["role-direction", "living-jd", "candidate-scoring", "search-logic", "recommendation-summary", "risk-flags"];
  const conversationalAnswer = dynamic.status || renderConversationalTinaAnswer(dynamic.rawBlocks);
  const blockById = new Map(dynamic.renderedBlocks.map((block) => [block.id, block]));
  const toggleExpanded = (key: string) => setExpanded((current) => ({ ...current, [key]: !current[key] }));

  const changedSummary = [
    "Living JD updated",
    "Candidate scoring adjusted",
    "Search criteria changed",
    "Fintech moved from requirement to optional signal"
  ];

  return (
    <div className="grid gap-4">
      <div className="flex gap-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#191714] text-white">
          <Bot className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-[#191714]">Tina</p>
            {developerMode ? (
              <button
                type="button"
                onClick={onToggleDebug}
                className="text-xs font-medium text-[#8a8178] hover:text-[#191714]"
              >
                {showDebug ? "Hide mechanics" : "Show mechanics"}
              </button>
            ) : null}
          </div>

          <div className="mt-3 max-w-3xl whitespace-pre-line text-[15px] leading-7 text-[#191714]">
            {conversationalAnswer}
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <InsightToggle label="View market snapshot" open={expanded.market} onClick={() => toggleExpanded("market")} />
            <InsightToggle label="View sourcing logic" open={expanded.sourcing} onClick={() => toggleExpanded("sourcing")} />
            <InsightToggle label="View calibration assumptions" open={expanded.assumptions} onClick={() => toggleExpanded("assumptions")} />
            {dynamic.impacts.length ? (
              <InsightToggle label="View what changed" open={expanded.changed} onClick={() => toggleExpanded("changed")} />
            ) : null}
          </div>

          {expanded.market ? (
            <ExpandableInsight>
              <p>{blockById.get("recommendation-summary")?.styledContent}</p>
            </ExpandableInsight>
          ) : null}

          {expanded.sourcing ? (
            <ExpandableInsight>
              <p>{blockById.get("search-logic")?.styledContent}</p>
            </ExpandableInsight>
          ) : null}

          {expanded.assumptions ? (
            <ExpandableInsight>
              <p>{blockById.get("risk-flags")?.styledContent}</p>
            </ExpandableInsight>
          ) : null}

          {expanded.changed && dynamic.impacts.length ? (
            <ExpandableInsight tone="green">
              <ul className="grid gap-1">
                {changedSummary.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <p className="mt-3 text-[#4f6842]">
                {dynamic.impacts.slice(0, 1).map((impact) => impact.explanation).join(" ")}
              </p>
            </ExpandableInsight>
          ) : null}
        </div>
      </div>

      <div className="ml-0 rounded-2xl border border-[#e5ded3] bg-[#fbfaf7] p-4 md:ml-13">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-[#191714]">Give Tina feedback</p>
        </div>
        <div className="mt-3 grid grid-cols-4 gap-2">
          {(["agree", "disagree", "refine", "correct"] as const).map((signal) => (
            <button
              key={signal}
              type="button"
              onClick={() => setActiveSignal(signal)}
              className={cn(
                "rounded-lg border px-3 py-2 text-xs font-semibold capitalize transition",
                activeSignal === signal
                  ? "border-[#9f927f] bg-[#f2ede5] text-[#191714]"
                  : "border-[#e5ded3] bg-[#fffdf8] text-[#6c645c]"
              )}
            >
              {signal}
            </button>
          ))}
        </div>
        <textarea
          value={feedbackText}
          onChange={(event) => setFeedbackText(event.target.value)}
          className="mt-3 min-h-20 w-full resize-none rounded-lg border border-[#ddd2c3] bg-[#fffdf8] px-3 py-2 text-sm leading-6 text-[#191714] outline-none focus:border-[#9c8f7c]"
        />
        <Button
          type="button"
          onClick={() => onSubmitFeedback(activeSignal, feedbackText)}
          className="mt-3"
        >
          Submit feedback
        </Button>
      </div>

      {developerMode && showDebug ? (
        <div className="rounded-2xl border border-[#e5ded3] bg-[#fffdf8] p-5 shadow-[0_16px_48px_rgba(49,42,34,0.04)]">
          <div className="flex flex-col gap-3 border-b border-[#eee7dc] pb-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-semibold text-[#191714]">Response mechanics</p>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-[#6c645c]">
                Raw blocks stay available for debugging, but Tina only shows the styled answer by default.
              </p>
            </div>
        {dynamic.status ? (
          <span className="rounded-full bg-[#edf3e7] px-3 py-1.5 text-xs font-semibold text-[#4f6842]">
            {dynamic.status}
          </span>
        ) : null}
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            <ResponseColumn
              title="Raw Tina Brain output"
              blocks={dynamic.rawBlocks.filter((block) => primaryBlocks.includes(block.id))}
              mode="raw"
              changedIds={changedIds}
            />
            <ResponseColumn
              title="Styled Tina output"
              blocks={dynamic.renderedBlocks.filter((block) => primaryBlocks.includes(block.id))}
              mode="styled"
              changedIds={changedIds}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ResponseColumn({
  title,
  blocks,
  mode,
  changedIds
}: {
  title: string;
  blocks: Array<TinaResponseBlock | RenderedTinaResponseBlock>;
  mode: "raw" | "styled";
  changedIds: Set<string>;
}) {
  return (
    <div className="rounded-xl border border-[#eee7dc] bg-[#fbfaf7] p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#8b8176]">{title}</p>
      <div className="mt-3 grid gap-3">
        {blocks.map((block) => (
          <div
            key={`${mode}-${block.id}`}
            className={cn(
              "rounded-lg border bg-[#fffdf8] p-3",
              changedIds.has(block.id) ? "border-[#93a77d] shadow-[0_0_0_2px_rgba(147,167,125,0.18)]" : "border-[#e5ded3]"
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-semibold text-[#191714]">{block.title}</p>
              <span className="text-xs text-[#8b8176]">{Math.round(block.confidence * 100)}%</span>
            </div>
            <p className="mt-2 whitespace-pre-line text-sm leading-6 text-[#4f4943]">
              {mode === "styled" && "styledContent" in block ? block.styledContent : block.content}
            </p>
            {changedIds.has(block.id) ? (
              <p className="mt-2 rounded-full bg-[#edf3e7] px-2.5 py-1 text-xs font-semibold text-[#4f6842]">
                Updated
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function InsightToggle({
  label,
  open,
  onClick
}: {
  label: string;
  open: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border border-[#e5ded3] bg-[#fffdf8] px-3 py-1.5 text-xs font-medium text-[#5f574f] transition hover:border-[#cdbfac] hover:text-[#191714]"
    >
      {label} {open ? "−" : "+"}
    </button>
  );
}

function ExpandableInsight({
  children,
  tone = "neutral"
}: {
  children: ReactNode;
  tone?: "neutral" | "green";
}) {
  return (
    <div
      className={cn(
        "mt-3 max-w-3xl rounded-xl border p-4 text-sm leading-6",
        tone === "green"
          ? "border-[#d8e0cf] bg-[#f4f8ef] text-[#33452f]"
          : "border-[#eee7dc] bg-[#fffdf8] text-[#4f4943]"
      )}
    >
      {children}
    </div>
  );
}

function LeftRail() {
  return (
    <aside className="hidden min-h-screen border-r border-[#e7dfd5] bg-[#fbfaf7] px-6 py-8 lg:flex lg:flex-col">
      <Link href="/" className="block">
        <p className="text-4xl font-semibold tracking-normal text-[#191714]">Tina</p>
        <p className="mt-4 max-w-[160px] text-sm leading-6 text-[#6c645c]">
          Hiring intelligence before the search begins.
        </p>
      </Link>

      <Button asChild variant="outline" className="mt-12 justify-start rounded-xl border-0 bg-[#f4eee5] shadow-none">
        <Link href="/kickoff">
          <Plus className="h-4 w-4" />
          New conversation
        </Link>
      </Button>

      <div className="mt-8">
        <p className="mb-3 px-3 text-sm text-[#6c645c]">Recent conversations</p>
        <div className="grid gap-1">
          {recentConversations.map(([title, date], index) => (
            <Link
              key={title}
              href="/kickoff"
              className={cn(
                "flex gap-3 rounded-xl px-3 py-3 text-sm transition hover:bg-[#f4eee5]",
                index === 0 && "bg-[#f4eee5]"
              )}
            >
              <MessageCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#6c645c]" />
              <span>
                <span className="block font-medium text-[#191714]">{title}</span>
                <span className="mt-1 block text-xs text-[#6c645c]">{date}</span>
              </span>
            </Link>
          ))}
        </div>
      </div>

      <div className="mt-auto rounded-2xl border border-[#e5ded3] bg-[#fffdf8] p-4">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-full bg-[linear-gradient(145deg,#d8b89b,#6f4c36)]" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-[#191714]">Sarah Chen</p>
            <p className="text-xs text-[#6c645c]">Fintech Co</p>
          </div>
        </div>
      </div>
    </aside>
  );
}

function MessageBubble({
  role,
  content,
  showSnapshot,
  state
}: {
  role: "tina" | "founder";
  content: string;
  showSnapshot?: boolean;
  state: TinaState;
}) {
  const displayContent = role === "tina" ? applyTinaResponseStyle(content) : content;

  if (role === "founder") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[540px] rounded-2xl bg-[#f2ede5] px-6 py-4 text-sm leading-6 text-[#191714]">
          {displayContent}
          <p className="mt-3 text-right text-xs text-[#7a7168]">9:41 AM</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-4">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#191714] text-white">
        <Bot className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="mb-3 text-sm font-semibold text-[#191714]">Tina</p>
        <div className="max-w-3xl whitespace-pre-line text-[15px] leading-7 text-[#191714]">
          {displayContent}
        </div>
        {showSnapshot ? <MarketSnapshot state={state} /> : null}
        {showSnapshot ? (
          <div className="mt-5 text-[15px] leading-7 text-[#191714]">
            <p>Calibration risks to test:</p>
            <ul className="mt-2 list-disc pl-5">
              <li>Product-heavy builder vs. research/infrastructure specialist.</li>
              <li>First-version owner vs. long-term AI strategy lead.</li>
              <li>Frontier pedigree vs. startup velocity.</li>
            </ul>
          </div>
        ) : null}
        <div className="mt-5 flex items-center justify-between text-xs text-[#7a7168]">
          <span>9:41 AM</span>
          <div className="flex gap-4 text-[#36312c]">
            <ThumbsUp className="h-4 w-4" />
            <ThumbsDown className="h-4 w-4" />
            <Bookmark className="h-4 w-4" />
          </div>
        </div>
      </div>
    </div>
  );
}

function MarketSnapshot({ state }: { state: TinaState }) {
  const snapshot = state.workspace.marketSnapshot;
  return (
    <div className="mt-6 max-w-3xl rounded-xl border border-[#e5ded3] bg-[#fffdf8] p-5">
      <p className="text-sm font-semibold text-[#191714]">Market snapshot for this direction</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SnapshotMetric label="Talent pool" value={snapshot.talentPool} sub="Relevant market" />
        <SnapshotMetric label="Market difficulty" value="Moderate" sub="Trending up" trend="up" />
        <SnapshotMetric label="Market comp" value={snapshot.marketCompRange} sub="Benchmark range" trend="up" />
        <SnapshotMetric label="Est. time to hire" value={snapshot.timeline} sub="With focused search" />
      </div>
    </div>
  );
}

function SnapshotMetric({
  label,
  value,
  sub,
  trend
}: {
  label: string;
  value: string;
  sub: string;
  trend?: "up";
}) {
  return (
    <div className="flex min-h-[116px] flex-col rounded-lg border border-[#eee5d8] bg-[#fbfaf7] p-3">
      <p className="text-xs text-[#6c645c]">{label}</p>
      <p className="mt-3 text-base font-semibold leading-6 text-[#191714]">{value}</p>
      <p className="mt-auto pt-2 text-xs leading-5 text-[#6c645c]">
        {sub} {trend ? <span className="text-[#c26728]">↗</span> : <span className="text-[#4f7b48]">↘</span>}
      </p>
    </div>
  );
}

function getContextDepth(text: string) {
  const normalized = text.toLowerCase();
  let score = 0;

  if (/\b(customer|users|buyer|founder|business|team|stage|first|seed|series|growth|revenue)\b/.test(normalized)) score += 1;
  if (/\b(infra|infrastructure|distributed|systems|architecture|scale|reliability|backend)\b/.test(normalized)) score += 1;
  if (/\b(product|ship|shipping|prototype|workflow|strategy|roadmap|research|model|eval|ai)\b/.test(normalized)) score += 1;
  if (/\b(must|required|nice to have|not required|more|less|instead|matter more|tradeoff)\b/.test(normalized)) score += 1;

  return Math.min(score, 3);
}
