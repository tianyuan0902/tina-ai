"use client";

import { FormEvent, KeyboardEvent, ReactNode, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Archive,
  ArrowRight,
  Brain,
  CheckCircle2,
  Mic,
  MoreHorizontal,
  Pencil,
  Sparkles,
  Square,
  SlidersHorizontal,
  XCircle
} from "lucide-react";

import { buildBrainState } from "@/lib/brain/buildBrainState";
import { buildCanonicalSearchState, type CanonicalSearchState } from "@/lib/brain/canonicalSearchState";
import type { BrainState } from "@/lib/brain/types";
import type { ProfileLead, SourcingBatchMetadata } from "@/lib/tina/profile-lead-types";
import { evaluateSourcingReadiness, type SourcingReadiness } from "@/lib/tina/sourcing-readiness";
import { actionButtonsForCurrentRead, type CurrentRead, type CurrentReadArchetype } from "@/lib/tina-mvp/current-read";
import type { HiringArtifact } from "@/lib/tina-mvp/hiring-artifacts";
import { isExampleShapeFeedback, isExampleShapeRequest, type ExampleShapeSet } from "@/lib/tina-mvp/example-shapes";
import type { SignalMap } from "@/lib/tina-mvp/signal-map";
import type { TinaChatApiResponse, TinaMvpMessage } from "@/lib/tina-mvp/types";
import type { WorkingThesis } from "@/lib/tina-mvp/working-thesis";

type ChatThread = {
  id: string;
  title: string;
  time: string;
  messages: TinaMvpMessage[];
  manuallyRenamed?: boolean;
  sessionId?: string;
};

const THREAD_STORAGE_KEY = "tina:mvp:threads";
const ACTIVE_THREAD_STORAGE_KEY = "tina:mvp:active-thread-id";
const SESSION_ID_STORAGE_KEY = "tina:mvp:anonymous-session-id";
const PROFILE_LEAD_STATUS_STORAGE_KEY = "tina:mvp:profile-lead-status";
const BRAIN_STATE_STORAGE_KEY = "tina:mvp:brain-state";
const CANONICAL_SEARCH_STATE_STORAGE_KEY = "tina:mvp:canonical-search-state";
const WORKING_THESIS_STORAGE_KEY = "tina:mvp:working-thesis";
const CURRENT_READ_STORAGE_KEY = "tina:mvp:current-read";
const SIGNAL_MAP_STORAGE_KEY = "tina:mvp:signal-map";
const LOG_CONSENT_VERSION = "public-demo-v1";
const MAX_FEEDBACK_SUMMARY_LEADS = 8;

const typingPhrases = ["Shaping the read", "Reading candidate signal", "Tightening the example shapes"];

const stableNewRoleThread: ChatThread = {
  id: "session-new-role",
  title: "New role",
  time: "Just now",
  messages: []
};
const MARKET_INTEL_FORMING_TITLE = "Scope forming";

type ProfileLeadStatus = {
  action?: "saved" | "rejected";
  preference?: "more_like_this" | "less_like_this";
};

type ProfileLeadItem = {
  lead: ProfileLead;
  batchId: string;
  statusKey: string;
};

type ClickedActionLog = {
  label: string;
  prompt: string;
  source: "chat_input" | "right_rail" | "empty_state";
  timestamp: string;
};

type SourcingStrategy = {
  readiness: SourcingReadiness;
  searchThesis: string;
  seek: string[];
  targetTitles: string[];
  targetCompanyTypes: string[];
  searchLanes: string[];
  mustHaveSignals: string[];
  niceToHaveSignals: string[];
  avoidSignals: string[];
  queryTerms: string[];
};

const openingMessage: TinaMvpMessage = {
  id: "tina-opening",
  role: "tina",
  content: "Tell me what you are trying to solve with this hire. I’ll turn the messy version into a sharper market read."
};

const initialThreads: ChatThread[] = [
  {
    id: "ai-engineer",
    title: "AI Engineer",
    time: "Just now",
    messages: [openingMessage]
  },
  {
    id: "head-of-product",
    title: "Head of Product",
    time: "2 days ago",
    messages: [
      {
        id: "head-product-opening",
        role: "tina",
        content: "Tell me what you are trying to solve with this hire. I’ll turn the messy version into a sharper market read."
      },
      {
        id: "head-product-founder-1",
        role: "founder",
        content: "We need a Head of Product, but I am not sure if we need a product leader or someone who can create clarity across the company."
      },
      {
        id: "head-product-tina-1",
        role: "tina",
        content: "This sounds less like a classic Head of Product search and more like a clarity-and-judgment hire. I’d probably separate two lanes: someone who can turn founder intuition into product direction, and someone who can install product operating rhythm without slowing everyone down."
      },
      {
        id: "head-product-founder-2",
        role: "founder",
        content: "The team keeps shipping, but it feels scattered. Engineering wants clearer priorities."
      },
      {
        id: "head-product-tina-2",
        role: "tina",
        content: "That points toward a product leader who reduces decision fog, not just someone with roadmap hygiene. The danger is hiring a process-heavy PM leader when the real need is sharper tradeoff judgment."
      },
      {
        id: "head-product-founder-3",
        role: "founder",
        content: "I want someone senior, but not too corporate."
      },
      {
        id: "head-product-tina-3",
        role: "tina",
        content: "Then I’d look for someone who has led through ambiguity at a startup after seeing some scale, but before they got addicted to committees. The screen should be: can they make the company calmer without making it slower?"
      }
    ]
  },
  {
    id: "senior-product-designer",
    title: "Senior Product Designer",
    time: "5 days ago",
    messages: [
      {
        id: "designer-opening",
        role: "tina",
        content: "Tell me what you are trying to solve with this hire. I’ll turn the messy version into a sharper market read."
      },
      {
        id: "designer-founder-1",
        role: "founder",
        content: "We need a senior product designer who can work close to engineering and make the product feel more polished."
      },
      {
        id: "designer-tina-1",
        role: "tina",
        content: "I’d be careful with the word polished here. This may be more about product taste and decision quality than visual finish."
      },
      {
        id: "designer-founder-2",
        role: "founder",
        content: "They need to talk to customers, simplify flows, and not need much management."
      },
      {
        id: "designer-tina-2",
        role: "tina",
        content: "That sounds like a product-minded designer who can own ambiguity, not a pure craft specialist. I’d screen for people who can turn messy customer context into fewer, better product choices."
      },
      {
        id: "designer-founder-3",
        role: "founder",
        content: "We do not have a PM, so they need to help shape the product too."
      },
      {
        id: "designer-tina-3",
        role: "tina",
        content: "Got it. This is giving senior designer plus product brain, not pixel perfection. I’d treat PM-adjacent judgment as a must-have and visual polish as the multiplier."
      }
    ]
  }
];

export function TinaWorkspace() {
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  if (!hasMounted) return <TinaWorkspaceLoading />;

  return <TinaWorkspaceInner />;
}

function TinaWorkspaceLoading() {
  return (
    <main className="relative h-screen overflow-hidden bg-[#F7F4EF] text-[#171717]">
      <div className="grid h-full place-items-center">
        <div className="text-center">
          <p className="font-serif text-2xl font-semibold">Tina</p>
          <p className="mt-2 text-sm text-[#6F675E]">Current Read loading.</p>
        </div>
      </div>
    </main>
  );
}

function TinaWorkspaceInner() {
  const [anonymousSessionId] = useState(() => getOrCreateAnonymousSessionId());
  const [threads, setThreads] = useState<ChatThread[]>([{ ...stableNewRoleThread, sessionId: anonymousSessionId }]);
  const [activeThreadId, setActiveThreadId] = useState(stableNewRoleThread.id);
  const [storageReady, setStorageReady] = useState(false);
  const [storedCurrentReads, setShellCurrentReads] = useState<Record<string, CurrentRead>>({});
  const [latestSynthesis, setLatestSynthesis] = useState(
    "Tina is watching for the difference between a strong title match and a person who actually reduces founder ambiguity."
  );
  const activeThread = threads.find((thread) => thread.id === activeThreadId) || threads[0];

  useEffect(() => {
    const storedThreads = readStoredThreads();
    const sessionThread = createNewRoleThread(anonymousSessionId);
    setShellCurrentReads(readStoredCurrentReads());

    if (storedThreads.length) {
      setThreads([sessionThread, ...storedThreads.filter((thread) => !isBlankNewRoleThread(thread))]);
      setActiveThreadId(sessionThread.id);
      setLatestSynthesis(latestThreadSynthesis(sessionThread.messages));
    }

    setStorageReady(true);
  }, [anonymousSessionId]);

  useEffect(() => {
    if (!storageReady) return;
    const persistedThreads = threads.map((thread) => ({
      ...thread,
      sessionId: anonymousSessionId,
      latestSynthesis: thread.id === activeThreadId ? latestSynthesis : latestThreadSynthesis(thread.messages)
    }));

    window.sessionStorage.setItem(THREAD_STORAGE_KEY, JSON.stringify(persistedThreads));
    window.sessionStorage.setItem(ACTIVE_THREAD_STORAGE_KEY, activeThreadId);

    const timer = window.setTimeout(() => {
      fetch("/api/tina-mvp/threads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: anonymousSessionId, threads: persistedThreads })
      }).catch(() => {
        // Session storage has already saved the workspace for this tab.
      });
    }, 400);

    return () => window.clearTimeout(timer);
  }, [activeThreadId, anonymousSessionId, latestSynthesis, storageReady, threads]);

  function selectThread(threadId: string) {
    const nextThread = threads.find((thread) => thread.id === threadId);
    if (!nextThread) return;

    setActiveThreadId(threadId);
    setLatestSynthesis(latestThreadSynthesis(nextThread.messages));
  }

  function startNewThread() {
    if (activeThread && isBlankNewRoleThread(activeThread)) {
      setThreads((current) => current.filter((thread) => thread.id === activeThread.id || !isBlankNewRoleThread(thread)));
      setActiveThreadId(activeThread.id);
      setLatestSynthesis("Tina is watching for the difference between a strong title match and a person who actually reduces founder ambiguity.");
      return;
    }

    const nextThread = createNewRoleThread(anonymousSessionId);

    setThreads((current) => [nextThread, ...current.filter((thread) => !isBlankNewRoleThread(thread))]);
    setActiveThreadId(nextThread.id);
    setLatestSynthesis("Tina is watching for the difference between a strong title match and a person who actually reduces founder ambiguity.");
  }

  function updateActiveThreadMessages(messages: TinaMvpMessage[], titleOverride?: string) {
    setThreads((current) =>
      current.map((thread) =>
        thread.id === activeThreadId
          ? {
              ...thread,
              sessionId: thread.sessionId || anonymousSessionId,
              title: !thread.manuallyRenamed && titleOverride
                ? titleOverride
                : shouldAutoRenameThread(thread)
                  ? titleFromMessages(messages)
                  : thread.title,
              messages
            }
          : thread
      )
    );
  }

  function renameThread(threadId: string, title: string) {
    const cleanTitle = title.trim();
    if (!cleanTitle) return;

    setThreads((current) =>
      current.map((thread) => (thread.id === threadId ? { ...thread, title: cleanTitle, manuallyRenamed: true } : thread))
    );
  }

  function archiveThread(threadId: string) {
    setThreads((current) => {
      const remaining = current.filter((thread) => thread.id !== threadId);
      if (!remaining.length) {
        const replacement = createNewRoleThread(anonymousSessionId);
        setActiveThreadId(replacement.id);
        setLatestSynthesis(latestThreadSynthesis(replacement.messages));
        return [replacement];
      }

      if (threadId === activeThreadId) {
        setActiveThreadId(remaining[0].id);
        setLatestSynthesis(latestThreadSynthesis(remaining[0].messages));
      }

      return remaining;
    });
  }

  return (
    <main className="relative h-screen overflow-hidden bg-[#F7F4EF] text-[#171717]">
      <div className="relative z-10 flex h-screen min-h-0 max-w-full overflow-hidden">
        <Sidebar
          threads={threads}
          activeThreadId={activeThreadId}
          currentReads={storedCurrentReads}
          onSelectThread={selectThread}
          onNewThread={startNewThread}
          onRenameThread={renameThread}
          onArchiveThread={archiveThread}
        />
        <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
          <HomeCommandCenter
            activeThread={activeThread}
            onMessagesChange={updateActiveThreadMessages}
            onSynthesis={setLatestSynthesis}
            latestSynthesis={latestSynthesis}
          />
        </div>
      </div>
    </main>
  );
}

function Sidebar({
  threads,
  activeThreadId,
  currentReads,
  onSelectThread,
  onNewThread,
  onRenameThread,
  onArchiveThread
}: {
  threads: ChatThread[];
  activeThreadId: string;
  currentReads: Record<string, CurrentRead>;
  onSelectThread: (threadId: string) => void;
  onNewThread: () => void;
  onRenameThread: (threadId: string, title: string) => void;
  onArchiveThread: (threadId: string) => void;
}) {
  const [editingThreadId, setEditingThreadId] = useState<string | null>(null);
  const [openMenuThreadId, setOpenMenuThreadId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");

  function startEditing(thread: ChatThread) {
    setOpenMenuThreadId(null);
    setEditingThreadId(thread.id);
    setDraftTitle(displayThreadTitle(thread, currentReads[thread.id]));
  }

  function finishEditing() {
    if (!editingThreadId) return;
    onRenameThread(editingThreadId, draftTitle);
    setEditingThreadId(null);
    setDraftTitle("");
  }

  return (
    <aside className="flex h-full min-h-0 w-32 shrink-0 flex-col border-r border-[#E4DDD2] bg-[#FFFCF8] px-2 py-4 shadow-[14px_0_44px_rgba(23,23,23,0.025)] md:w-36 lg:w-44 xl:w-52 xl:px-3">
      <div className="mb-5 px-2">
        <p className="font-serif text-xl font-semibold tracking-normal xl:text-2xl">Tina</p>
      </div>

      <button
        type="button"
        onClick={onNewThread}
        className="mb-5 flex items-center justify-between gap-2 rounded-md border border-[#171717] bg-[#171717] px-2.5 py-2 text-sm font-medium text-white shadow-[0_12px_32px_rgba(23,23,23,0.16)] transition hover:bg-[#262626]"
      >
        <span className="truncate">New role</span>
        <ArrowRight className="h-4 w-4" />
      </button>

      <div className="shrink-0 px-2 text-xs font-medium text-[#6F675E]">Conversations</div>
      <div className="mt-3 grid min-h-0 min-w-0 flex-1 content-start gap-1.5 overflow-y-auto overscroll-contain pb-8 pr-1">
        {threads.map((thread) => (
          <div
            key={thread.id}
            className={`group relative flex min-w-0 max-w-full items-center gap-1 rounded-md px-2 py-1.5 transition ${
              thread.id === activeThreadId ? "bg-[#F1ECE4] shadow-[0_10px_24px_rgba(62,52,42,0.05)]" : "hover:bg-[#F7F4EF]"
            }`}
          >
            {editingThreadId === thread.id ? (
              <input
                value={draftTitle}
                onChange={(event) => setDraftTitle(event.target.value)}
                onBlur={finishEditing}
                onKeyDown={(event) => {
                  if (event.key === "Enter") finishEditing();
                  if (event.key === "Escape") setEditingThreadId(null);
                }}
                className="min-w-0 flex-1 rounded border border-[#D8CEC2] bg-white px-2 py-1 text-sm text-[#262626] outline-none"
                autoFocus
              />
            ) : (
              <button type="button" onClick={() => onSelectThread(thread.id)} className="min-w-0 flex-1 text-left">
                <p className="truncate text-sm font-medium text-[#262626]">{displayThreadTitle(thread, currentReads[thread.id])}</p>
                <p className="mt-0.5 text-xs text-[#777068]">{thread.time}</p>
              </button>
            )}

            <button
              type="button"
              onClick={() => setOpenMenuThreadId((current) => (current === thread.id ? null : thread.id))}
              className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-[#8A8178] opacity-0 transition hover:bg-white hover:text-[#171717] group-hover:opacity-100"
              aria-label={`Conversation options for ${displayThreadTitle(thread, currentReads[thread.id])}`}
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
            {openMenuThreadId === thread.id ? (
              <div className="absolute right-2 top-9 z-20 w-32 overflow-hidden rounded-lg border border-[#E2DDD6] bg-white p-1 text-sm shadow-[0_18px_40px_rgba(23,23,23,0.12)]">
                <button
                  type="button"
                  onClick={() => startEditing(thread)}
                  className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-[#262626] hover:bg-[#F7F4EF]"
                >
                  <Pencil className="h-3.5 w-3.5 text-[#8A8178]" />
                  Edit name
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOpenMenuThreadId(null);
                    onArchiveThread(thread.id);
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-[#262626] hover:bg-[#F7F4EF]"
                >
                  <Archive className="h-3.5 w-3.5 text-[#8A8178]" />
                  Archive
                </button>
              </div>
            ) : null}
          </div>
        ))}
      </div>

    </aside>
  );
}

function HomeCommandCenter({
  activeThread,
  onMessagesChange,
  latestSynthesis,
  onSynthesis
}: {
  activeThread: ChatThread;
  onMessagesChange: (messages: TinaMvpMessage[], titleOverride?: string) => void;
  latestSynthesis: string;
  onSynthesis: (value: string) => void;
}) {
  const [isThinking, setIsThinking] = useState(false);
  const [profileLeadStatus, setProfileLeadStatus] = useState<Record<string, ProfileLeadStatus>>({});
  const [storedBrainStates, setStoredBrainStates] = useState<Record<string, BrainState>>({});
  const [storedCanonicalSearchStates, setStoredCanonicalSearchStates] = useState<Record<string, CanonicalSearchState>>({});
  const [storedWorkingTheses, setStoredWorkingTheses] = useState<Record<string, WorkingThesis>>({});
  const [storedCurrentReads, setStoredCurrentReads] = useState<Record<string, CurrentRead>>({});
  const [storedSignalMaps, setStoredSignalMaps] = useState<Record<string, SignalMap>>({});
  const [clickedActionsByThread, setClickedActionsByThread] = useState<Record<string, ClickedActionLog[]>>({});
  const [showFullConversation, setShowFullConversation] = useState(false);
  const [isClientMounted, setIsClientMounted] = useState(false);
  const [pendingActionText, setPendingActionText] = useState("");
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);
  const messages = activeThread.messages;
  const hasConversation = messages.some((message) => message.role === "founder");
  const profiles = useMemo(() => deriveCalibrationProfiles(messages), [messages]);
  const sourcingReadiness = useMemo(() => latestSourcingReadiness(messages) || evaluateSourcingReadiness(messages), [messages]);
  const profileLeadItems = useMemo(() => collectProfileLeadItems(activeThread.id, messages), [activeThread.id, messages]);
  const latestProfileLeadItems = useMemo(() => collectLatestProfileLeadItems(activeThread.id, messages), [activeThread.id, messages]);
  const fallbackCanonicalSearchState = useMemo(
    () => buildCanonicalSearchState({
      messages,
      profileLeads: (latestProfileLeadItems.length ? latestProfileLeadItems : profileLeadItems).map((item) => item.lead)
    }),
    [messages, latestProfileLeadItems, profileLeadItems]
  );
  const storedCanonicalSearchState = storedCanonicalSearchStates[activeThread.id];
  const canonicalSearchState = storedCanonicalSearchState && isStoredCanonicalStateFresh(storedCanonicalSearchState, fallbackCanonicalSearchState)
    ? storedCanonicalSearchState
    : fallbackCanonicalSearchState;
  const workingThesis = storedWorkingTheses[activeThread.id];
  const currentRead = storedCurrentReads[activeThread.id];
  const storedSignalMap = storedSignalMaps[activeThread.id];
  const signalMap = storedSignalMap && isSignalMapFresh(storedSignalMap, currentRead) ? storedSignalMap : undefined;
  const canonicalProfileIds = useMemo(
    () => new Set(canonicalSearchState.candidateProfiles.map((lead) => lead.id)),
    [canonicalSearchState]
  );
  const currentProfileLeadItems = useMemo(
    () => canonicalSearchState.candidateProfiles.length
      ? profileLeadItems.filter((item) => canonicalProfileIds.has(item.lead.id))
      : [],
    [canonicalSearchState.candidateProfiles.length, profileLeadItems, canonicalProfileIds]
  );
  const currentLatestProfileLeadItems = useMemo(
    () => canonicalSearchState.candidateProfiles.length
      ? latestProfileLeadItems.filter((item) => canonicalProfileIds.has(item.lead.id))
      : [],
    [canonicalSearchState.candidateProfiles.length, latestProfileLeadItems, canonicalProfileIds]
  );
  const latestSourcingBatch = useMemo(() => collectLatestSourcingBatch(messages), [messages]);
  const calibration = useMemo(() => deriveLiveCalibration(messages), [messages]);
  const pipeline = useMemo(() => derivePipelineIntelligence(messages), [messages]);
  const sourcingStrategy = useMemo(() => deriveSourcingStrategy(calibration, profiles, sourcingReadiness), [calibration, profiles, sourcingReadiness]);
  const brainState = useMemo(
    () => buildBrainState({
      messages,
      sourcingReadiness,
      profileLeads: (currentLatestProfileLeadItems.length ? currentLatestProfileLeadItems : currentProfileLeadItems).map((item) => item.lead),
      feedback: currentProfileLeadItems.map((item) => ({
        lead: item.lead,
        status: profileLeadStatus[item.statusKey]
      })),
      roleThesis: sourcingStrategy.searchThesis,
      seekSignals: sourcingStrategy.seek,
      avoidSignals: sourcingStrategy.avoidSignals,
      likelyTitles: sourcingStrategy.targetTitles,
      sourceLaneHints: [
        ...sourcingStrategy.targetCompanyTypes,
        ...sourcingStrategy.searchLanes,
        ...sourcingStrategy.queryTerms
      ]
    }),
    [messages, sourcingReadiness, currentLatestProfileLeadItems, currentProfileLeadItems, profileLeadStatus, sourcingStrategy]
  );
  const latestTinaMessageId = useMemo(() => [...messages].reverse().find((message) => message.role === "tina")?.id, [messages]);
  const visibleProfileLeadItems = useMemo(
    () => prioritizeLatestProfileLeadItems(currentProfileLeadItems, currentLatestProfileLeadItems),
    [currentProfileLeadItems, currentLatestProfileLeadItems]
  );
  const shortlistedItems = useMemo(
    () => currentProfileLeadItems.filter((item) => profileLeadStatus[item.statusKey]?.action === "saved"),
    [currentProfileLeadItems, profileLeadStatus]
  );
  const potentialItems = useMemo(
    () => prioritizePotentialCandidateItems(
      visibleProfileLeadItems.filter((item) => profileLeadStatus[item.statusKey]?.action !== "saved"),
      profileLeadStatus
    ),
    [visibleProfileLeadItems, profileLeadStatus]
  );
  const hasCandidateResults = visibleProfileLeadItems.length > 0;
  const hasFeedback = currentLatestProfileLeadItems.some((item) => hasProfileLeadFeedback(profileLeadStatus[item.statusKey]));
  const feedbackRead = buildFeedbackLearningRead(currentLatestProfileLeadItems, profileLeadStatus);
  const refineLabel = shortlistedItems.length ? "Turn saved shapes into a sourcing brief" : "Refine Example Shapes";
  const latestBatchRead = buildTalentBatchRead(currentLatestProfileLeadItems.length ? currentLatestProfileLeadItems : visibleProfileLeadItems);
  const clickedActions = clickedActionsByThread[activeThread.id] || [];
  const displayedMessages = hasCandidateResults && !showFullConversation ? latestConversationExchange(messages) : messages;
  const hiddenMessageCount = Math.max(0, messages.length - displayedMessages.length);
  const missionHeader = buildMissionHeader(canonicalSearchState, messages, currentRead, false);
  const handleRefineSearch = () => {
    const summary = buildTalentPoolFeedbackSummary(currentLatestProfileLeadItems, profileLeadStatus);
    if (summary) {
      recordClickedAction("Refine Example Shapes", "Turn my Example Shapes feedback into a sourcing brief.", "right_rail");
      sendMessage("Turn my Example Shapes feedback into a sourcing brief.", {
        sourcingRefinementSummary: summary
      });
    }
  };

  function recordClickedAction(label: string, prompt: string, source: ClickedActionLog["source"]) {
    setClickedActionsByThread((current) => {
      const nextActions = [
        ...(current[activeThread.id] || []),
        {
          label,
          prompt,
          source,
          timestamp: new Date().toISOString()
        }
      ].slice(-30);

      return { ...current, [activeThread.id]: nextActions };
    });
  }

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isThinking, activeThread.id]);

  useEffect(() => {
    setShowFullConversation(false);
  }, [activeThread.id, hasCandidateResults]);

  useEffect(() => {
    if (!isClientMounted || !hasConversation) return;

    const timer = window.setTimeout(() => {
      const artifacts = collectHiringArtifacts(messages);
      const marketReality = artifacts.find((artifact) => artifact.kind === "market_reality")?.marketReality;
      const artifactSourcingStrategy = artifacts.find((artifact) => artifact.kind === "sourcing_strategy")?.sourcingStrategy;

      fetch("/api/tina-mvp/conversation-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          anonymousSessionId: activeThread.sessionId || getOrCreateAnonymousSessionId(),
          threadId: activeThread.id,
          messages,
          currentRead,
          workingThesis,
          canonicalSearchState,
          signalMap,
          artifacts,
          marketReality,
          sourcingStrategy: artifactSourcingStrategy || sourcingStrategy,
          clickedActions,
          metadata: {
            threadTitle: activeThread.title,
            hasCandidateResults,
            latestSourcingBatch,
            loggedFrom: "public-demo"
          },
          consentVersion: LOG_CONSENT_VERSION
        })
      }).catch(() => {
        // Logging is private product telemetry and should never interrupt the chat UX.
      });
    }, 1200);

    return () => window.clearTimeout(timer);
  }, [
    activeThread.id,
    activeThread.sessionId,
    activeThread.title,
    canonicalSearchState,
    clickedActions,
    currentRead,
    hasCandidateResults,
    hasConversation,
    isClientMounted,
    latestSourcingBatch,
    messages,
    signalMap,
    sourcingStrategy,
    workingThesis
  ]);

  useEffect(() => {
    setIsClientMounted(true);
    setProfileLeadStatus(readProfileLeadStatus());
    setStoredBrainStates(readStoredBrainStates());
    setStoredCanonicalSearchStates(readStoredCanonicalSearchStates());
    setStoredWorkingTheses(readStoredWorkingTheses());
    setStoredCurrentReads(readStoredCurrentReads());
    setStoredSignalMaps(readStoredSignalMaps());
  }, []);

  useEffect(() => {
    window.sessionStorage.setItem(PROFILE_LEAD_STATUS_STORAGE_KEY, JSON.stringify(profileLeadStatus));
  }, [profileLeadStatus]);

  useEffect(() => {
    setStoredBrainStates((current) => {
      const next = { ...current, [activeThread.id]: brainState };
      window.sessionStorage.setItem(BRAIN_STATE_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, [activeThread.id, brainState]);

  useEffect(() => {
    const stored = storedCanonicalSearchStates[activeThread.id];
    if (stored && isStoredCanonicalStateFresh(stored, fallbackCanonicalSearchState)) return;

    setStoredCanonicalSearchStates((current) => {
      const next = { ...current, [activeThread.id]: fallbackCanonicalSearchState };
      window.sessionStorage.setItem(CANONICAL_SEARCH_STATE_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, [activeThread.id, fallbackCanonicalSearchState, storedCanonicalSearchStates]);

  async function sendMessage(content: string, options?: { sourcingRefinementSummary?: string }) {
    if (!content.trim() || isThinking) return;

    const founderMessage: TinaMvpMessage = {
      id: `founder-${Date.now()}`,
      role: "founder",
      content: content.trim()
    };
    const nextMessages = [...messages, founderMessage];

    onMessagesChange(nextMessages);
    setIsThinking(true);
    const actionText = actionProgressText(content);
    setPendingActionText(actionText);
    onSynthesis(actionText);

    try {
      const response = await fetch("/api/tina-mvp/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: nextMessages,
            sourcingRefinementSummary: options?.sourcingRefinementSummary,
            canonicalSearchState,
            workingThesis,
            currentRead,
            signalMap,
            referenceProfileInsight: [...messages].reverse().find((message) => message.referenceProfileInsight)?.referenceProfileInsight
          })
        });
      const data = (await response.json()) as TinaChatApiResponse | { error?: string };

      if (!response.ok || !("message" in data)) throw new Error("Tina lost context.");
      const finalMessages = [...nextMessages, data.message];
      if (data.canonicalSearchState) {
        setStoredCanonicalSearchStates((current) => {
          const next = { ...current, [activeThread.id]: data.canonicalSearchState! };
          window.sessionStorage.setItem(CANONICAL_SEARCH_STATE_STORAGE_KEY, JSON.stringify(next));
          return next;
        });
      }
      if (data.workingThesis) {
        setStoredWorkingTheses((current) => {
          const next = { ...current, [activeThread.id]: data.workingThesis! };
          window.sessionStorage.setItem(WORKING_THESIS_STORAGE_KEY, JSON.stringify(next));
          return next;
        });
      }
      if (data.currentRead) {
        setStoredCurrentReads((current) => {
          const next = { ...current, [activeThread.id]: data.currentRead! };
          window.sessionStorage.setItem(CURRENT_READ_STORAGE_KEY, JSON.stringify(next));
          return next;
        });
      }
      if (data.signalMap) {
        setStoredSignalMaps((current) => {
          const next = { ...current, [activeThread.id]: data.signalMap! };
          window.sessionStorage.setItem(SIGNAL_MAP_STORAGE_KEY, JSON.stringify(next));
          return next;
        });
      } else if (data.clearSignalMap) {
        setStoredSignalMaps((current) => {
          const next = { ...current };
          delete next[activeThread.id];
          window.sessionStorage.setItem(SIGNAL_MAP_STORAGE_KEY, JSON.stringify(next));
          return next;
        });
      }
      onMessagesChange(finalMessages, data.currentRead ? titleFromCurrentRead(data.currentRead) : titleFromMessages(finalMessages));
      onSynthesis(data.message.content);
    } catch {
      const errorMessage: TinaMvpMessage = {
        id: `tina-error-${Date.now()}`,
        role: "tina",
        content: "Tina lost context for a second. Try again."
      };
      onMessagesChange([...nextMessages, errorMessage]);
      onSynthesis("Tina lost context for a second. Try again.");
    } finally {
      setIsThinking(false);
      setPendingActionText("");
    }
  }

  return (
    <div className={`grid h-screen min-h-0 w-full max-w-[1320px] grid-cols-1 gap-3 overflow-hidden bg-[#F7F4EF] px-3 pb-3 pt-6 md:mx-auto md:pb-4 md:pt-8 xl:gap-[clamp(14px,1.25vw,22px)] xl:px-[clamp(14px,1.4vw,22px)] ${hasConversation ? "xl:pt-6" : "xl:pt-14"}`}>
      <section className="flex min-h-0 flex-col overflow-hidden">
        <header className={`shrink-0 pt-1 ${hasConversation ? "mb-2 text-left" : "mb-3 text-center xl:mb-5 xl:pt-2"}`}>
          {hasConversation ? (
            <div className="mx-auto max-w-[820px] rounded-xl border border-[#E4DDD2] bg-white/90 px-4 py-2.5 shadow-[0_14px_40px_rgba(23,23,23,0.045)]">
              <p className="flex items-center gap-2 text-[11px] font-medium text-[#6B6259]">
                <Sparkles className="h-3.5 w-3.5 text-[#178A52]" />
                Active hiring read
              </p>
              <h1 className="mt-1 text-base font-semibold leading-6 text-[#171717]">{missionHeader}</h1>
            </div>
          ) : (
            <div className="mx-auto max-w-xl xl:max-w-2xl">
              <p className="mb-2 flex items-center justify-center gap-2 text-[11px] text-[#6B6259] xl:mb-3">
                <Sparkles className="h-3.5 w-3.5 text-[#178A52]" />
                Founder-grade hiring judgment, before the search begins.
              </p>
              <h1 className="font-serif text-[clamp(1.45rem,1.9vw,2.1rem)] font-semibold leading-[1.05] tracking-normal text-[#171717] xl:text-[clamp(1.75rem,2.15vw,2.35rem)]">
                Don’t start with the role. Start with the problem.
              </h1>
            </div>
          )}
        </header>

        <div className={`grid min-h-0 gap-3 overflow-hidden ${hasConversation ? "flex-1 grid-rows-[minmax(0,1fr)]" : "shrink-0"}`}>
        <div className={`mx-auto flex w-full flex-col overflow-hidden rounded-2xl border border-[#E4DDD2] bg-white shadow-[0_24px_80px_rgba(23,23,23,0.06)] ${hasConversation ? "min-h-0 max-w-[820px]" : "max-w-[920px]"}`}>
          <div className="shrink-0 border-b border-[#E4DDD2] bg-white px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[13px] font-semibold">Tina</p>
                  <p className="mt-0.5 text-xs text-[#6F675E]">Chat first. Artifacts appear here when you ask.</p>
              </div>
              {hasCandidateResults && hiddenMessageCount > 0 ? (
                <button
                  type="button"
                  onClick={() => setShowFullConversation((current) => !current)}
                  className="shrink-0 rounded-md border border-[#E3DED7] bg-white px-2.5 py-1.5 text-xs font-medium text-[#625A52] transition hover:bg-[#F7F4EF]"
                >
                  {showFullConversation ? "Hide conversation" : `Show conversation (${hiddenMessageCount})`}
                </button>
              ) : null}
            </div>
          </div>

          {hasConversation ? <SessionReadStrip currentRead={currentRead} /> : null}

          <div className={`${hasConversation ? "min-h-0 flex-1 overflow-y-auto" : "overflow-visible"} bg-white px-4 ${hasCandidateResults ? "py-3" : hasConversation ? "py-5" : "py-6"}`}>
            <div className={`mx-auto grid w-full gap-4 ${hasConversation ? "max-w-[740px]" : "max-w-[760px]"}`}>
              {hasCandidateResults ? (
                <SourcingResultArtifact leads={(currentLatestProfileLeadItems.length ? currentLatestProfileLeadItems : visibleProfileLeadItems).map((item) => item.lead)} sourcingBatch={latestSourcingBatch} />
              ) : null}
              {displayedMessages.map((message) => (
                <ChatMessage
                  key={message.id}
                  message={message}
                  signals={message.role === "tina" ? deriveInlineSignals(messages.slice(0, messages.findIndex((item) => item.id === message.id) + 1)) : []}
                  animate={message.role === "tina" && message.id === latestTinaMessageId && hasConversation}
                  onExampleShapeReaction={sendMessage}
                />
              ))}
              {isThinking ? (
                <div className="flex gap-3">
                  <TinaMark />
                  <div>
                    <p className="text-sm font-semibold">Tina</p>
                    <TypingStatus label={pendingActionText} />
                    <InlineSignalRows signals={[pendingActionText || "Current Read updating", "Thesis tightening"]} />
                  </div>
                </div>
              ) : null}
              {!hasConversation ? (
                <div className="flex items-start justify-center">
                  <EmptyConversationNotes onSubmit={sendMessage} onActionClick={recordClickedAction} isThinking={isThinking} />
                </div>
              ) : null}
              <div ref={transcriptEndRef} />
            </div>
          </div>

          <div className={`shrink-0 border-t border-[#E4DDD2] bg-[#F7F4EF] ${hasConversation ? "p-2" : "p-3"}`}>
            <CommandInput onSubmit={sendMessage} onActionClick={recordClickedAction} isThinking={isThinking} currentRead={currentRead} hasSignalMap={Boolean(signalMap)} compact />
          </div>
        </div>
        </div>
      </section>

    </div>
  );
}

function SessionReadStrip({ currentRead }: { currentRead?: CurrentRead }) {
  const title = titleFromCurrentReadValue(currentRead);
  const hasRead = Boolean(title);
  const status = sessionStatusForRead(currentRead);
  const nextMove = currentRead?.nextBestMove?.trim() || "Name what feels messy, then Tina will sharpen the read.";

  return (
    <div className="sticky top-0 z-10 shrink-0 border-b border-[#E4DDD2] bg-[#FFFCF8]/95 px-4 py-3 backdrop-blur">
      <div className="mx-auto flex w-full max-w-[740px] flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[#E7F7EF] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#168A5A]">
              {status}
            </span>
            <p className="truncate text-sm font-semibold leading-5 text-[#171717]">{hasRead ? title : "Working read forming"}</p>
          </div>
          <p className="mt-1 overflow-hidden text-ellipsis whitespace-nowrap text-xs leading-5 text-[#6F6A63]">
            Next: {oneSentence(nextMove)}
          </p>
        </div>
      </div>
    </div>
  );
}

function sessionStatusForRead(read?: CurrentRead) {
  if (!read || !titleFromCurrentReadValue(read)) return "forming";
  if (read.mode === "execution" || read.mode === "sourcing" || read.confidence === "high") return "ready to brief";
  return "calibrated";
}

function CommandInput({
  onSubmit,
  onActionClick,
  isThinking,
  currentRead,
  hasSignalMap,
  compact = false
}: {
  onSubmit: (value: string) => void;
  onActionClick: (label: string, prompt: string, source: ClickedActionLog["source"]) => void;
  isThinking: boolean;
  currentRead?: CurrentRead;
  hasSignalMap?: boolean;
  compact?: boolean;
}) {
  const [value, setValue] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isUploadingAudio, setIsUploadingAudio] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [voiceError, setVoiceError] = useState("");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const cancelRecordingRef = useRef(false);
  const hasCommittedRead = Boolean(currentRead && titleFromCurrentReadValue(currentRead));
  const visibleChips = hasSignalMap
    ? [
        { label: "Build scorecard", prompt: "Build a lightweight scorecard from this signal map." },
        { label: "Create interview plan", prompt: "Create an interview plan from this signal map." },
        { label: "Define candidate archetype", prompt: "Define the candidate archetype from this signal map." },
        { label: "Pressure-test market", prompt: "Pressure-test market reality from this signal map before sourcing." }
      ]
    : hasCommittedRead
      ? [
          { label: "Show example shapes", prompt: "Show me example shapes for this hiring read." },
          { label: "Turn into Hiring Read", prompt: "Turn this into a concise Hiring Read." },
          { label: "Build scorecard", prompt: "Build a lightweight scorecard for this hiring read." },
          { label: "Pressure-test market", prompt: "Pressure-test market reality for this hiring read." }
        ]
      : [
          { label: "Start with the problem", prompt: "Help me clarify the hiring problem before we talk about candidates." },
          { label: "Pressure-test this hire", prompt: "Pressure-test whether this is the right hire before we start sourcing." }
        ];

  useEffect(() => {
    if (!isRecording) return;

    const intervalId = window.setInterval(() => {
      setRecordingSeconds((seconds) => seconds + 1);
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [isRecording]);

  useEffect(() => {
    return () => {
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = value.trim();
    if (!content || isThinking || isRecording || isUploadingAudio) return;
    onSubmit(content);
    setValue("");
    setVoiceError("");
  }

  function sendOnEnter(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.nativeEvent.isComposing) return;
    if (event.key !== "Enter" && event.code !== "Enter" && event.code !== "NumpadEnter") return;
    if (event.shiftKey) return;
    if (event.metaKey) return;

    event.preventDefault();
    const content = value.trim();
    if (!content || isThinking || isRecording || isUploadingAudio) return;
    onSubmit(content);
    setValue("");
    setVoiceError("");
  }

  function updateDraft(nextValue: string) {
    setValue(nextValue);
    if (voiceError) setVoiceError("");
  }

  async function startRecording() {
    if (isThinking || isRecording || isUploadingAudio) return;
    setVoiceError("");

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setVoiceError("Voice recording is not supported in this browser.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaStreamRef.current = stream;
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      cancelRecordingRef.current = false;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const chunks = audioChunksRef.current;
        const shouldCancel = cancelRecordingRef.current;
        cleanupRecording();
        if (!shouldCancel) {
          void uploadRecording(chunks, mediaRecorder.mimeType || "audio/webm");
        }
      };

      setRecordingSeconds(0);
      setIsRecording(true);
      mediaRecorder.start();
    } catch (error) {
      setVoiceError(isPermissionDenied(error) ? "Microphone permission was denied." : "Could not start recording. Please try again.");
      cleanupRecording();
    }
  }

  function stopRecording() {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === "inactive") return;
    cancelRecordingRef.current = false;
    mediaRecorderRef.current.stop();
  }

  function cancelRecording() {
    cancelRecordingRef.current = true;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    } else {
      cleanupRecording();
    }
  }

  function cleanupRecording() {
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
    mediaRecorderRef.current = null;
    audioChunksRef.current = [];
    setIsRecording(false);
    setRecordingSeconds(0);
  }

  async function uploadRecording(chunks: BlobPart[], mimeType: string) {
    if (!chunks.length) {
      setVoiceError("I did not catch any audio. Try recording again.");
      return;
    }

    setIsUploadingAudio(true);
    setVoiceError("");

    try {
      const audioBlob = new Blob(chunks, { type: mimeType });
      if (!audioBlob.size) {
        setVoiceError("I did not catch any audio. Try recording again.");
        return;
      }

      const formData = new FormData();
      formData.append("audio", audioBlob, `tina-voice-memo.${audioExtensionForMimeType(mimeType)}`);

      const response = await fetch("/api/tina-mvp/transcribe", {
        method: "POST",
        body: formData
      });
      const data = (await response.json()) as { transcript?: string; error?: string };
      const transcript = data.transcript?.trim();

      if (!response.ok || !transcript) {
        throw new Error(data.error || "Transcription failed.");
      }

      setValue((current) => (current.trim() ? `${current.trim()}\n${transcript}` : transcript));
    } catch (error) {
      setVoiceError(error instanceof Error ? error.message : "Could not transcribe the voice memo.");
    } finally {
      setIsUploadingAudio(false);
    }
  }

  return (
    <form onSubmit={submit} className={`rounded-2xl border border-[#E4DDD2] bg-white shadow-[0_18px_48px_rgba(23,23,23,0.07)] transition focus-within:border-[#CFC4FF] focus-within:shadow-[0_22px_60px_rgba(124,103,216,0.11)] ${compact ? "p-2.5" : "p-4"}`}>
      <textarea
        value={value}
        onChange={(event) => updateDraft(event.target.value)}
        onKeyDown={sendOnEnter}
        placeholder="Tell Tina what feels messy about this hire..."
        className={`${compact ? "min-h-10" : "min-h-20"} w-full resize-none bg-transparent text-[14px] leading-6 text-[#171717] outline-none placeholder:text-[#9B9289]`}
      />
      {isRecording ? (
        <div className="mt-2 rounded-lg border border-[#E7D8CB] bg-[#FFF8F1] px-3 py-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-medium text-[#7B4E27]">
              <span className="h-2 w-2 rounded-full bg-[#D95336] shadow-[0_0_0_5px_rgba(217,83,54,0.12)]" />
              Recording {formatRecordingTime(recordingSeconds)}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={stopRecording}
                className="inline-flex items-center gap-1.5 rounded-md bg-[#1E1E1E] px-2.5 py-1.5 text-xs font-medium text-white"
              >
                <Square className="h-3 w-3 fill-current" />
                Stop
              </button>
              <button
                type="button"
                onClick={cancelRecording}
                className="inline-flex items-center gap-1.5 rounded-md border border-[#E3D6CA] bg-white px-2.5 py-1.5 text-xs font-medium text-[#6B6259]"
              >
                <XCircle className="h-3.5 w-3.5" />
                Cancel
              </button>
            </div>
          </div>
          <p className="mt-2 text-[11px] leading-4 text-[#8A6A55]">
            Voice memos are transcribed to improve Tina. Don&apos;t include sensitive personal information.
          </p>
        </div>
      ) : null}
      {voiceError ? <p className="mt-2 text-[11px] font-medium leading-4 text-[#B34532]">{voiceError}</p> : null}
      {isUploadingAudio ? <p className="mt-2 text-[11px] font-medium leading-4 text-[#6B6259]">Transcribing voice memo...</p> : null}
      <p className={`${compact ? "mt-1" : "mt-2"} text-[11px] leading-4 text-[#8A8178]`}>
        Conversations may be reviewed to improve Tina. Don&apos;t include sensitive personal information.
      </p>
      <div className={`${compact ? "mt-1.5 pt-1.5" : "mt-4 pt-3"} flex flex-col gap-2 border-t border-[#E4DDD2] sm:flex-row sm:items-center sm:justify-between`}>
        <div className="flex flex-wrap gap-2">
          {visibleChips.map((chip) => (
            <button
              key={chip.label}
              type="button"
              onClick={() => {
                onActionClick(chip.label, chip.prompt, "chat_input");
                updateDraft(chip.prompt);
              }}
              className="rounded-lg border border-[#E4DDD2] bg-white px-2.5 py-1.5 text-xs font-medium text-[#625A52] shadow-[0_8px_18px_rgba(23,23,23,0.035)] transition hover:border-[#CFC4FF] hover:bg-[#F1EEFF] hover:text-[#5A42C8]"
            >
              {chip.label}
            </button>
          ))}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={startRecording}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#E4DDD2] bg-white text-[#625A52] shadow-[0_8px_18px_rgba(23,23,23,0.045)] transition hover:border-[#D7C9FF] hover:bg-[#F1EEFF] hover:text-[#5A42C8] disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isThinking || isRecording || isUploadingAudio}
            aria-label="Record voice memo"
            title="Record voice memo"
          >
            <Mic className="h-4 w-4" />
          </button>
          <button
            type="submit"
            className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-[#171717] px-4 text-xs font-semibold text-white shadow-[0_10px_28px_rgba(23,23,23,0.18)] transition hover:bg-[#168A5A] disabled:opacity-60"
            disabled={isThinking || isRecording || isUploadingAudio}
          >
            Send
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </form>
  );
}

function formatRecordingTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

function audioExtensionForMimeType(mimeType: string) {
  if (mimeType.includes("mp4")) return "mp4";
  if (mimeType.includes("ogg")) return "ogg";
  if (mimeType.includes("wav")) return "wav";
  return "webm";
}

function isPermissionDenied(error: unknown) {
  return error instanceof DOMException && (error.name === "NotAllowedError" || error.name === "PermissionDeniedError");
}

function EmptyConversationNotes({
  onSubmit,
  onActionClick,
  isThinking
}: {
  onSubmit: (value: string) => void;
  onActionClick: (label: string, prompt: string, source: ClickedActionLog["source"]) => void;
  isThinking: boolean;
}) {
  const notes = [
    { label: "What changed?", prompt: "What changed that made this hire feel urgent?", tone: "green" },
    { label: "What’s breaking?", prompt: "Help me figure out what is breaking before we define the role.", tone: "coral" },
    { label: "Who owns it now?", prompt: "Help me think through who owns this work today and where the gap is.", tone: "blue" }
  ];

  return (
    <div className="mx-auto flex w-full max-w-xl flex-wrap justify-center gap-2">
      {notes.map((note) => (
        <button
          key={note.label}
          type="button"
          onClick={() => {
            onActionClick(note.label, note.prompt, "empty_state");
            onSubmit(note.prompt);
          }}
          disabled={isThinking}
          className={`rounded-full border px-3.5 py-2 text-[11px] font-semibold uppercase tracking-[0.13em] shadow-[0_8px_18px_rgba(23,23,23,0.035)] transition hover:-translate-y-0.5 disabled:opacity-60 ${
            note.tone === "green"
              ? "border-[#D6E9DD] bg-[#F3FBF6] text-[#168A5A] hover:bg-[#E7F7EF]"
              : note.tone === "coral"
                ? "border-[#F0D4C8] bg-[#FFF0EA] text-[#B85C3F] hover:bg-[#FFE8DD]"
                : "border-[#D9E5EC] bg-[#EDF6FB] text-[#2F6F9F] hover:bg-[#E3F1F8]"
          }`}
        >
          {note.label}
        </button>
      ))}
    </div>
  );
}

function ChatMessage({
  message,
  signals,
  animate,
  onExampleShapeReaction
}: {
  message: TinaMvpMessage;
  signals: string[];
  animate: boolean;
  onExampleShapeReaction?: (value: string) => void;
}) {
  if (message.role === "founder") {
    return (
      <div className="flex min-w-0 justify-end">
        <div className="max-w-[82%] break-words rounded-lg border border-[#E2D7CB] bg-[#F1ECE4] px-3.5 py-2.5 text-[13px] leading-5 text-[#171717] shadow-[0_8px_22px_rgba(23,23,23,0.035)]">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-w-0 gap-3">
      <TinaMark />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold">Tina</p>
        {isHiringReadMessage(message) ? (
          <HiringReadCard content={message.content} />
        ) : !message.signalMap ? (
          <div className="mt-2 max-w-full overflow-visible whitespace-pre-wrap break-words text-[13px] leading-5 text-[#262626]">
            <TypedText text={message.content} animate={animate} />
          </div>
        ) : null}
        {message.signalMap ? <SignalMapBoard signalMap={message.signalMap} /> : null}
        {message.hiringArtifacts?.length
          ? message.hiringArtifacts.map((artifact) => (
              <HiringArtifactBoard key={`${message.id}-${artifact.kind}`} artifact={artifact} />
            ))
          : message.hiringArtifact
            ? <HiringArtifactBoard artifact={message.hiringArtifact} />
            : null}
        {message.exampleShapes ? <ExampleShapesBoard exampleShapes={message.exampleShapes} onReaction={onExampleShapeReaction} /> : null}
        {message.exampleShapeFeedback ? <ExampleShapeFeedbackBoard feedback={message.exampleShapeFeedback} /> : null}
        {message.profileLeads?.length ? <SourcingResultArtifact leads={message.profileLeads} sourcingBatch={message.sourcingBatch} /> : null}
        <InlineSignalRows signals={signals} />
      </div>
    </div>
  );
}

function isHiringReadMessage(message: TinaMvpMessage) {
  return message.role === "tina" && /^Here(?:'|’)s the Hiring Read\./i.test(message.content.trim());
}

function HiringReadCard({ content }: { content: string }) {
  const sections = parseHiringReadSections(content);

  return (
    <section className="mt-3 overflow-hidden rounded-2xl border border-[#D9E5EC] bg-white shadow-[0_18px_55px_rgba(47,111,159,0.08)]">
      <div className="border-b border-[#D9E5EC] bg-[#EDF6FB] px-4 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#2F6F9F]">Hiring Read</p>
        <h3 className="mt-1 text-sm font-semibold leading-5 text-[#171717]">A concise snapshot of the decision.</h3>
      </div>
      <div className="grid gap-0 divide-y divide-[#E4DDD2] px-4 py-2">
        {sections.map((section) => (
          <div key={section.title} className="grid gap-1 py-3 sm:grid-cols-[170px_1fr] sm:gap-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-[#6F6A63]">{section.title}</p>
            <p className="text-[13px] font-medium leading-5 text-[#27211C]">{section.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function parseHiringReadSections(content: string) {
  const body = content.replace(/^Here(?:'|’)s the Hiring Read\.\s*/i, "").trim();
  const labels = [
    { source: "What I think is really happening", title: "What’s happening" },
    { source: "What this is probably not", title: "What it’s not" },
    { source: "Best-fit role shape", title: "Best-fit role" },
    { source: "Example shapes / false positives", title: "False positives" },
    { source: "Must-prove signals", title: "Must prove" },
    { source: "Next move", title: "Next move" }
  ];

  const sections = labels
    .map((label, index) => {
      const nextLabels = labels.slice(index + 1).map((item) => escapeRegExp(item.source)).join("|");
      const pattern = nextLabels
        ? new RegExp(`${escapeRegExp(label.source)}:\\s*([\\s\\S]*?)(?=\\n\\n(?:${nextLabels}):|$)`, "i")
        : new RegExp(`${escapeRegExp(label.source)}:\\s*([\\s\\S]*)$`, "i");
      const match = body.match(pattern);
      return match?.[1]?.trim()
        ? { title: label.title, body: compactArtifactText(match[1]) }
        : null;
    })
    .filter(Boolean) as { title: string; body: string }[];

  return sections.length ? sections : [{ title: "Read", body: compactArtifactText(body) }];
}

function compactArtifactText(value: string) {
  return value.replace(/\s+/g, " ").replace(/^[-•]\s*/, "").trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function ExampleShapesBoard({ exampleShapes, onReaction }: { exampleShapes: ExampleShapeSet; onReaction?: (value: string) => void }) {
  const reactionButtons = ["closer", "wrong", "too senior", "too junior", "too corporate", "too generic"];

  return (
    <section className="mt-3 max-w-full overflow-hidden rounded-2xl border border-[#D9E5EC] bg-white shadow-[0_18px_55px_rgba(47,111,159,0.08)]">
      <div className="border-b border-[#D9E5EC] bg-[#EDF6FB] px-4 pb-3 pt-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#2F6F9F]">Example Shapes</p>
        <h3 className="mt-1 text-sm font-semibold leading-5 text-[#171717]">{exampleShapes.title}</h3>
      </div>
      <div className="grid gap-3 p-4 md:grid-cols-3">
        {exampleShapes.shapes.slice(0, 3).map((shape) => (
          <article key={shape.id} className="flex min-w-0 flex-col rounded-xl border border-[#E4DDD2] bg-[#FFFCF8] p-3.5 shadow-[0_8px_22px_rgba(23,23,23,0.03)]">
            <h4 className="text-sm font-semibold leading-5 text-[#171717]">{shape.name}</h4>
            <div className="mt-3 grid flex-1 gap-2 text-xs leading-5 text-[#4B453F]">
              <ExampleShapeField label="Solves" value={shape.solves} />
              <ExampleShapeField label="Fails when" value={shape.fails} />
              <ExampleShapeField label="Recognize by" value={shape.recognize} />
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {reactionButtons.map((reaction) => (
                <button
                  key={reaction}
                  type="button"
                  onClick={() => onReaction?.(`${reaction}: ${shape.name}`)}
                  className="rounded-full border border-[#D8D0FF] bg-[#F1EEFF] px-2.5 py-1 text-[11px] font-medium text-[#5B4AB6] transition hover:border-[#7C67D8] hover:bg-white"
                >
                  {reaction}
                </button>
              ))}
            </div>
          </article>
        ))}
      </div>
      <p className="px-4 pb-4 text-xs leading-5 text-[#6F6A63]">These are examples to react to, not candidates.</p>
    </section>
  );
}

function ExampleShapeField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8A8178]">{label}</p>
      <p className="mt-0.5 font-medium text-[#2F2A25]">{value}</p>
    </div>
  );
}

function ExampleShapeFeedbackBoard({ feedback }: { feedback: NonNullable<TinaMvpMessage["exampleShapeFeedback"]> }) {
  const rows = [
    { label: "Positive", items: feedback.positiveSignals },
    { label: "Avoid", items: feedback.negativeSignals },
    { label: "Must prove", items: feedback.mustHaveEvidence },
    { label: "False positives", items: feedback.falsePositives }
  ];

  return (
    <section className="mt-3 rounded-2xl border border-[#E4DCD1] bg-[#FFFCF7] p-4 shadow-[0_18px_50px_rgba(23,23,23,0.05)]">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8A8178]">Shape feedback</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {rows.map((row) => (
          <div key={row.label} className="rounded-xl border border-[#E8DED3] bg-white/80 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8A8178]">{row.label}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {row.items.slice(0, 3).map((item) => (
                <span key={item} className="rounded-full bg-[#F8F4EE] px-2.5 py-1 text-[11px] font-medium text-[#4B453F]">{item}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 rounded-xl border border-[#D7E9DD] bg-[#F4FBF6] px-3 py-2 text-xs font-semibold leading-5 text-[#244933]">{feedback.recommendedNextStep}</p>
    </section>
  );
}

function SignalMapBoard({ signalMap }: { signalMap: SignalMap }) {
  const watchOut = [...signalMap.weakSignals, ...signalMap.falsePositives];
  const columns = [
    {
      title: "Must prove",
      items: signalMap.mustProveSignals,
      icon: <CheckCircle2 className="h-3.5 w-3.5" />,
      shell: "border-[#D7E9DD] bg-[#F4FBF6]",
      heading: "text-[#257647]",
      row: "bg-white/85 text-[#244933]"
    },
    {
      title: "Watch out for",
      items: watchOut,
      icon: <AlertTriangle className="h-3.5 w-3.5" />,
      shell: "border-[#EBDDC8] bg-[#FFF8ED]",
      heading: "text-[#9A6632]",
      row: "bg-white/85 text-[#59422B]"
    },
    {
      title: "How to test",
      items: signalMap.interviewProbes,
      icon: <Sparkles className="h-3.5 w-3.5" />,
      shell: "border-[#DDD8F1] bg-[#F8F6FF]",
      heading: "text-[#6453A6]",
      row: "bg-white/85 text-[#403868]"
    }
  ];

  return (
    <section className="mt-3 max-w-full overflow-hidden rounded-2xl border border-[#E4DCD1] bg-[#FFFCF7] shadow-[0_18px_50px_rgba(23,23,23,0.055)]">
      <div className="px-4 pb-2 pt-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8A8178]">Signal Map</p>
        <h3 className="mt-1 text-sm font-semibold leading-5 text-[#171717]">What this hire must prove</h3>
      </div>

      <div className="grid gap-3 p-4 pt-2 sm:grid-cols-3">
        {columns.map((column) => (
          <div key={column.title} className={`rounded-xl border p-3.5 ${column.shell}`}>
            <p className={`flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] ${column.heading}`}>
              {column.icon}
              {column.title}
            </p>
            <div className="mt-3 grid gap-2">
              {column.items.slice(0, 3).map((item) => (
                <div key={item} className={`rounded-lg px-3 py-2 text-[12px] font-medium leading-4 shadow-[0_1px_0_rgba(23,23,23,0.035)] ${column.row}`}>
                  {shortSignalText(item, signalMap.derivedFromThesisTitle, column.title)}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mx-4 mb-4 rounded-xl border border-[#E8DED3] bg-white/75 px-3.5 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8A8178]">Best fit profile</p>
        <p className="mt-1 text-xs leading-5 text-[#4B453F]">{completeProfileSentence(signalMap.bestCandidateArchetype)}</p>
      </div>
    </section>
  );
}

function shortSignalText(value: string, thesisTitle = "", columnTitle = "") {
  const directLabel = signalMapLabel(value, thesisTitle, columnTitle);
  if (directLabel) return directLabel;

  const clean = value
    .replace(/^has\s+/i, "")
    .replace(/^can\s+/i, "")
    .replace(/^is able to\s+/i, "")
    .replace(/^tell me about a time you\s+/i, "")
    .replace(/^tell me about a time\s+/i, "")
    .replace(/^how did you\s+/i, "")
    .replace(/^how would you\s+/i, "")
    .replace(/^what\s+/i, "")
    .replace(/\bwithout founder hand-?holding\b/gi, "independently")
    .replace(/\bfounder or exec team\b/gi, "leadership")
    .replace(/\btechnical\/product decision-making\b/gi, "technical decisions")
    .replace(/\bengineering execution rhythm\b/gi, "engineering rhythm")
    .replace(/\bmessy startup environment\b/gi, "messy startup")
    .replace(/\bmanaged a large team inside a mature company\b/gi, "big-company team management")
    .replace(/\bimpressive architecture experience\b/gi, "architecture-only strength")
    .replace(/\bprocess-heavy\b/gi, "process-heavy")
    .replace(/\bcreates meetings but not speed\b/gi, "meetings, not speed")
    .replace(/[?.]$/g, "")
    .trim();

  const clause = clean.split(/\s+(?:who|with|without|while|when|where|because|so)\s+|[;,:—]/)[0]?.trim() || clean;
  const label = signalMapLabel(clause, thesisTitle, columnTitle) || clause;
  const words = label.split(/\s+/).filter(Boolean);
  if (words.length <= 10) return label;
  return keywordSignalLabel(label, thesisTitle, columnTitle);
}

function signalMapLabel(value: string, thesisTitle = "", columnTitle = "") {
  const text = value.toLowerCase();
  const thesis = thesisTitle.toLowerCase();
  const column = columnTitle.toLowerCase();
  if (column.includes("how to test")) {
    if (/customer delivery|repeatable system/.test(text)) return "Customer delivery example";
    if (/product, process, or customer fit|product.*process|process.*customer/.test(text)) return "Product/process diagnosis";
    if (/founder escalation|customer-facing workflow/.test(text)) return "Founder escalation example";
    if (/decision ownership|founder or exec|took decision/.test(text)) return "Founder decision example";
    if (/product and engineering disagreed|product\/eng/.test(text)) return "Product/eng conflict example";
    if (/operating rhythm|got faster/.test(text)) return "Operating rhythm change";
    if (/too many lanes|what not to own/.test(text)) return "Role scope tradeoff";
    if (/push back|asking one hire/.test(text)) return "Pushback example";
    if (/clarity without adding process/.test(text)) return "Clarity without theater";
  }
  if (thesis.includes("customer ops")) {
    if (/trust/.test(text)) return "Protects customer trust";
    if (/delivery|implementation/.test(text)) return "Repeatable delivery motion";
    if (/product gaps|implementation gaps|process gaps/.test(text)) return "Separates product vs process";
    if (/founder escalation|escalates/.test(text)) return "Reduces founder escalation";
    if (/relationship management/.test(text)) return "Relationship-only profile";
  }
  if (/decision ownership|own(ed|s)? .*decision|technical decisions|product decisions/.test(text)) return "Owns hard decisions";
  if (/founder.*hand|founder.*central|founder.*depend|founder leverage|proxy/.test(text)) return "Reduces founder dependency";
  if (/engineering execution rhythm|shipping cadence|execution rhythm|operating cadence/.test(text)) return "Improves team rhythm";
  if (/trust|morale/.test(text)) return thesis.includes("engineering") ? "Rebuilds trust and morale" : "Protects trust";
  if (/ambig/.test(text)) return "Works through ambiguity";
  if (/large team|mature company|big-company/.test(text)) return "Big-company manager";
  if (/architecture.*no people|architecture-only|people leadership/.test(text)) return "Architecture without leadership";
  if (/process-heavy|meetings.*speed|coordination layer/.test(text)) return "Process without speed";
  if (/senior ic|individual contributor/.test(text)) return "Senior IC, not leader";
  if (/product and engineering disagreed|product\/eng/.test(text)) return "Product/eng conflict";
  if (/customer discovery|customer signal/.test(text)) return "Reads customer signal";
  if (/product taste|product judgment/.test(text)) return "Sharp product judgment";
  if (/prioriti[sz]ation|tradeoff/.test(text)) return "Makes tradeoff calls";
  if (/startup pace|startup environment|messy startup/.test(text)) return "Startup operating proof";
  if (/shipped|shipping|built|build/.test(text)) return "Real shipping proof";
  if (/interview|probe|exercise/.test(text)) return "Concrete working example";
  if (/audit|security/.test(text)) return "Security-critical proof";
  if (/protocol|smart contract|solidity/.test(text)) return "Smart contract ownership";
  return "";
}

function keywordSignalLabel(value: string, thesisTitle = "", columnTitle = "") {
  const text = value.toLowerCase();
  if (columnTitle.toLowerCase().includes("how to test")) return "Specific example";
  if (thesisTitle.toLowerCase().includes("customer ops") && /trust/.test(text)) return "Protects customer trust";
  if (/ownership/.test(text)) return "Clear ownership proof";
  if (/judgment/.test(text)) return "Independent judgment";
  if (/lead/.test(text)) return "Leadership under pressure";
  if (/technical/.test(text)) return "Technical judgment";
  if (/product/.test(text)) return "Product judgment";
  if (/speed|fast/.test(text)) return "Speed without chaos";
  const words = value.split(/\s+/).filter(Boolean).slice(0, 10);
  return words.join(" ");
}

function completeProfileSentence(value: string) {
  const clean = value.replace(/\s+/g, " ").trim();
  if (!clean) return "";
  return /[.!?]$/.test(clean) ? clean : `${clean}.`;
}

function HiringArtifactBoard({ artifact }: { artifact: HiringArtifact }) {
  if (artifact.kind === "scorecard") {
    return (
      <section className="mt-3 max-w-full overflow-hidden rounded-2xl border border-[#E4DCD1] bg-[#FFFCF7] shadow-[0_18px_50px_rgba(23,23,23,0.05)]">
        <ArtifactHeader title="Scorecard" subline="Use this to judge the real signal." />
        <div className="grid gap-2.5 p-4 pt-2">
          {artifact.rows.slice(0, 5).map((row) => (
            <div key={row.competency} className="rounded-xl border border-[#E8DED3] bg-white/80 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-[#171717]">{row.competency}</p>
                <span className="rounded-full bg-[#F1ECE4] px-2.5 py-1 text-[10px] font-semibold text-[#6B6259]">{row.ratingScale}</span>
              </div>
              <div className="mt-2 grid gap-2 text-xs leading-5 text-[#4B453F] md:grid-cols-3">
                <ArtifactField label="Signal" value={row.signal} />
                <ArtifactField label="Strong evidence" value={row.strongEvidence} />
                <ArtifactField label="Red flag" value={row.redFlag} />
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (artifact.kind === "interview_plan") {
    return (
      <section className="mt-3 max-w-full overflow-hidden rounded-2xl border border-[#E4DCD1] bg-[#FFFCF7] shadow-[0_18px_50px_rgba(23,23,23,0.05)]">
        <ArtifactHeader title="Interview Plan" subline="A tight loop for the thesis." />
        <div className="grid gap-2.5 p-4 pt-2">
          {artifact.stages.slice(0, 4).map((stage) => (
            <div key={stage.stage} className="rounded-xl border border-[#E8DED3] bg-white/80 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-[#171717]">{stage.stage}</p>
                <span className="rounded-full bg-[#EEF7F1] px-2.5 py-1 text-[10px] font-semibold text-[#257647]">{stage.interviewer}</span>
              </div>
              <div className="mt-2 grid gap-2 text-xs leading-5 text-[#4B453F] md:grid-cols-3">
                <ArtifactField label="Tests" value={stage.tests} />
                <ArtifactField label="Ask" value={stage.prompt} />
                <ArtifactField label="Capture" value={stage.evidence} />
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (artifact.kind === "market_reality") {
    const reality = artifact.marketReality;
    return (
      <section className="mt-3 max-w-full overflow-hidden rounded-2xl border border-[#E4DCD1] bg-[#FFFCF7] shadow-[0_18px_50px_rgba(23,23,23,0.05)]">
        <ArtifactHeader title="Market Reality" subline="Pressure-test before sourcing." />
        <div className="grid gap-2.5 p-4 pt-2">
          <div className="rounded-xl border border-[#E8DED3] bg-white/80 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-[#171717]">{reality.marketDifficulty} search</p>
              <span className="rounded-full bg-[#F1ECE4] px-2.5 py-1 text-[10px] font-semibold text-[#6B6259]">{reality.uncertaintyLabel}</span>
            </div>
            <p className="mt-2 text-xs font-medium leading-5 text-[#2F2A25]">{reality.roleShape}</p>
          </div>

          <div className="grid gap-2.5 sm:grid-cols-2">
            <ArtifactList title="Likely source lanes" items={reality.sourceLanes} />
            <ArtifactList title="Tradeoffs" items={reality.tradeoffs} />
            <ArtifactList title="Risks" items={reality.risks} />
            <ArtifactList title="Missing inputs" items={reality.missingInputs.length ? reality.missingInputs : ["No major market inputs missing."]} />
          </div>

          <div className="rounded-xl border border-[#D7E9DD] bg-[#F4FBF6] p-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#257647]">Next move</p>
            <p className="mt-1 text-xs font-semibold leading-5 text-[#244933]">{reality.nextMove}</p>
          </div>
        </div>
      </section>
    );
  }

  if (artifact.kind === "sourcing_strategy") {
    const strategy = artifact.sourcingStrategy;
    return (
      <section className="mt-3 max-w-full overflow-hidden rounded-2xl border border-[#E4DCD1] bg-[#FFFCF7] shadow-[0_18px_50px_rgba(23,23,23,0.05)]">
        <ArtifactHeader title="Sourcing Strategy" subline="Search logic before candidates." />
        <div className="grid gap-2.5 p-4 pt-2">
          <div className="rounded-xl border border-[#E8DED3] bg-white/80 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8A8178]">Target profile</p>
            <p className="mt-1 text-xs font-semibold leading-5 text-[#2F2A25]">{strategy.targetProfile}</p>
          </div>
          <div className="grid gap-2.5 sm:grid-cols-2">
            <ArtifactList title="Search lanes" items={strategy.searchLanes} />
            <ArtifactList title="Target titles" items={strategy.targetTitles} />
            <ArtifactList title="Must-have filters" items={strategy.mustHaveFilters} />
            <ArtifactList title="Avoid filters" items={strategy.avoidFilters} />
          </div>
          <ArtifactList title="Search logic" items={strategy.searchLogic} />
          <div className="rounded-xl border border-[#D7E9DD] bg-[#F4FBF6] p-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#257647]">Outreach angle</p>
            <p className="mt-1 text-xs font-semibold leading-5 text-[#244933]">{strategy.outreachAngle}</p>
          </div>
          <ArtifactList title="Missing constraints" items={strategy.missingConstraints.length ? strategy.missingConstraints : ["No major sourcing constraints missing."]} />
        </div>
      </section>
    );
  }

  return (
    <section className="mt-3 max-w-full overflow-hidden rounded-2xl border border-[#E4DCD1] bg-[#FFFCF7] shadow-[0_18px_50px_rgba(23,23,23,0.05)]">
      <ArtifactHeader title="Candidate Archetype" subline="The profile most likely to carry this problem." />
      <div className="grid gap-2.5 p-4 pt-2 sm:grid-cols-2">
        {artifact.items.slice(0, 5).map((item) => (
          <div key={item.label} className="rounded-xl border border-[#E8DED3] bg-white/80 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8A8178]">{item.label}</p>
            <p className="mt-1 text-xs font-medium leading-5 text-[#2F2A25]">{item.value}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function ArtifactList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-xl border border-[#E8DED3] bg-white/80 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8A8178]">{title}</p>
      <div className="mt-2 grid gap-1.5">
        {items.slice(0, 5).map((item) => (
          <p key={item} className="rounded-lg bg-[#F8F4EE] px-2.5 py-2 text-xs font-medium leading-5 text-[#2F2A25]">{item}</p>
        ))}
      </div>
    </div>
  );
}

function ArtifactHeader({ title, subline }: { title: string; subline: string }) {
  return (
    <div className="px-4 pb-2 pt-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8A8178]">{title}</p>
      <h3 className="mt-1 text-sm font-semibold leading-5 text-[#171717]">{subline}</h3>
    </div>
  );
}

function ArtifactField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-[#F8F4EE] px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8A8178]">{label}</p>
      <p className="mt-1 font-medium text-[#2F2A25]">{value}</p>
    </div>
  );
}

function SourcingResultArtifact({ leads, sourcingBatch }: { leads: ProfileLead[]; sourcingBatch?: SourcingBatchMetadata }) {
  const highCount = leads.filter((lead) => lead.confidence === "high").length;
  const topTags = topValues(leads.flatMap((lead) => lead.tags)).slice(0, 2);
  const missingThemes = topValues(leads.map((lead) => missingSignalTheme(missingSignalForLead(lead)))).slice(0, 1);
  const evidenceSummary = leads.some((lead) => lead.evidenceLevel === "synthetic")
    ? "Synthetic examples"
    : leads.length
      ? "Unverified public leads"
      : "";

  return (
    <div className="mt-3 max-w-full overflow-hidden rounded-lg border border-[#E1D8CE] bg-[#FFFCF7] p-3 shadow-[0_12px_32px_rgba(23,23,23,0.04)]">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-[#EEF8F1] px-2.5 py-1 text-[11px] font-semibold text-[#108A4B]">Example Shapes updated</span>
        <span className="text-xs font-medium text-[#625A52]">{leads.length} {leads.length === 1 ? "profile" : "profiles"}</span>
        {highCount ? <span className="text-xs text-[#8A8178]">{highCount} strong</span> : null}
        {evidenceSummary ? <span className="text-xs text-[#8A8178]">{evidenceSummary}</span> : null}
        {sourcingBatch ? <SearchSourceBadge sourcingBatch={sourcingBatch} /> : null}
      </div>
      <p className="mt-2 break-words text-xs leading-5 text-[#4B453F]">
        I found {leads.length} possible {leads.length === 1 ? "archetype" : "archetypes"} and added them here. Best signal: {topTags.join(", ") || "role adjacency"}. Weakness: {missingThemes.join(", ") || "proof still needs review"}.
      </p>
      <p className="mt-1 text-[11px] text-[#8A8178]">Review as calibration examples, not finalists.</p>
    </div>
  );
}

function SearchSourceBadge({ sourcingBatch }: { sourcingBatch: SourcingBatchMetadata }) {
  if (!sourcingBatch.searchProvider || !sourcingBatch.searchStatus) {
    return (
      <span className="rounded-full bg-[#F4EFE8] px-2 py-0.5 text-[10px] font-semibold text-[#8A8178]">
        Search source unknown
      </span>
    );
  }

  const isLive = sourcingBatch.searchProvider === "tavily" && sourcingBatch.searchStatus === "live";
  const label = sourcingBatch.searchProvider === "mock"
    ? "Mock search"
    : sourcingBatch.searchStatus === "partial_failure"
      ? "Tavily partial"
      : sourcingBatch.searchStatus === "failed"
        ? "Tavily failed"
        : "Tavily live";
  const className = isLive
    ? "bg-[#EEF8F1] text-[#108A4B]"
    : "bg-[#FFF2E8] text-[#A7531F]";

  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${className}`}>
      {label}
    </span>
  );
}

function TypedText({ text, animate }: { text: string; animate: boolean }) {
  const [visibleText, setVisibleText] = useState(animate ? "" : text);

  useEffect(() => {
    if (!animate) {
      setVisibleText(text);
      return;
    }

    let index = 0;
    setVisibleText("");
    const timer = window.setInterval(() => {
      index = Math.min(text.length, index + 3);
      setVisibleText(text.slice(0, index));
      if (index >= text.length) window.clearInterval(timer);
    }, 18);

    return () => window.clearInterval(timer);
  }, [text, animate]);

  return (
    <>
      {visibleText}
      {animate && visibleText.length < text.length ? <span className="ml-0.5 inline-block h-4 w-px translate-y-0.5 animate-pulse bg-[#6F675E]" /> : null}
    </>
  );
}

function TypingStatus({ label }: { label?: string }) {
  const [phraseIndex, setPhraseIndex] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setPhraseIndex((current) => (current + 1) % typingPhrases.length);
    }, 1200);

    return () => window.clearInterval(timer);
  }, []);

  return (
    <p className="mt-2 inline-flex items-center gap-1 text-[13px] text-[#6F7B5B]">
      <span>{label || typingPhrases[phraseIndex]}</span>
      <span className="typing-dots" aria-hidden="true">
        <span>.</span>
        <span>.</span>
        <span>.</span>
      </span>
      <style jsx>{`
        .typing-dots span {
          animation: tinaTypingDot 1.1s ease-in-out infinite;
          opacity: 0.25;
        }

        .typing-dots span:nth-child(2) {
          animation-delay: 0.15s;
        }

        .typing-dots span:nth-child(3) {
          animation-delay: 0.3s;
        }

        @keyframes tinaTypingDot {
          0%, 100% {
            opacity: 0.25;
          }
          45% {
            opacity: 1;
          }
        }
      `}</style>
    </p>
  );
}

function InlineSignalRows({ signals }: { signals: string[] }) {
  if (!signals.length) return null;

  return (
    <div className="mt-3 flex max-w-xl flex-wrap gap-1.5 transition-all duration-300">
      {signals.slice(0, 3).map((signal) => (
        <span
          key={signal}
          className="inline-flex items-center gap-1.5 rounded-full border border-[#E2D7CB] bg-[#F8F4ED]/72 px-2.5 py-1 text-[11px] leading-4 text-[#625A52] shadow-[0_6px_16px_rgba(23,23,23,0.025)] transition hover:border-[#C8BDAE] hover:bg-[#FFFCF7]"
        >
          <span className="text-[#6F7B5B]">↗</span>
          {signal}
        </span>
      ))}
    </div>
  );
}

function latestThreadSynthesis(messages: TinaMvpMessage[]) {
  const latestTinaMessage = [...messages].reverse().find((message) => message.role === "tina");
  return latestTinaMessage?.content || "Tina is watching for the difference between a strong title match and a person who actually reduces founder ambiguity.";
}

function titleFromMessages(messages: TinaMvpMessage[]) {
  const founderMessages = messages
    .filter((message) => message.role === "founder")
    .map((message) => message.content.trim())
    .filter(Boolean);
  const founderText = founderMessages.join(" ");
  if (!founderText) return "New role";

  return controlledThesisTitleFromText(founderText);
}

function titleFromCanonicalSearchState(state: CanonicalSearchState) {
  const roleTitle = cleanRoleTitle(state.roleTitle || "");
  if (!isSpecificRoleTitle(roleTitle) || /forming/i.test(roleTitle)) return "";
  return roleTitle;
}

function titleFromCurrentRead(read: CurrentRead) {
  return titleFromCurrentReadValue(read);
}

function titleFromCurrentReadValue(read?: CurrentRead) {
  return read?.thesisTitle && read.thesisTitle !== "Unknown / Needs Clarification"
    ? read.thesisTitle
    : "";
}

function controlledThesisTitleFromText(value: string): CurrentReadArchetype {
  const text = value.toLowerCase();
  if (/\b(\$500k|500k|500,000|capital allocation|budget allocation|what should i do next|what should we do next)\b/i.test(text)) return "Capital Allocation Diagnosis";
  if (/\b(ml phd|phd|machine learning|ai hire|ai team|ai engineer|model|llm)\b/i.test(text) && /\b(onboarding|activation|workflow|low data|apis?|existing engineers?)\b/i.test(text)) return "Workflow Ownership Before AI Hire";
  if (/\b(people leader|head of people|people ops|manager enablement|first[-\s]?time managers?|feedback cadence|delayed feedback|hard conversations?)\b/i.test(text)) return "Manager Enablement / Feedback Cadence Gap";
  if (/\b(vp product|chief product|cpo|head of product|product leader)\b/i.test(text) && /\b(founder owns|roadmap|priority churn|low trust|pms? exist|delegat)\b/i.test(text)) return "Founder Control / Product Delegation Gap";
  if (/\b(head of ops|operations leader|ops lead|operating cadence|cadence|operating rhythm|everything in (my|the founder'?s) head)\b/i.test(text) && /\b(first[-\s]?time founder|first startup|founder keeps|in my head|delegat|no cadence)\b/i.test(text)) return "Operating Cadence / Founder Delegation Gap";
  if (/\b(product.?ops|product\/ops|product operator|operator profile|high[-\s]?agency|people like this|profile like this|reference profile|culture code|people dna|look for people like)\b/i.test(text)) return "Product/Ops Generalist Archetype";
  if (/\b(recruiter|recruiting|sourcer|talent acquisition)\b/i.test(text)) return "Recruiting System Before Recruiter";
  if (/\b(vp marketing|head of marketing|marketing leader|growth is slow|positioning|icp|acquisition channel|demand gen)\b/i.test(text)) return "Marketing Positioning Gap";
  if (/\b(ai team|build an ai|ai roadmap|customers.*ai|existing roadmap|shiny object)\b/i.test(text)) return "AI Prioritization Gap";
  if (/\b(vp sales|head of sales|sales leader|ae\b|account executive|gtm|revenue)\b/i.test(text)) return "Founder-Led Sales Transition";
  if (/\b(no existing team|no team|no engineers?|first engineer|first technical hire|co[-\s]?founder|agency)\b/i.test(text) && /\b(cto|technical|engineer|engineering|build)\b/i.test(text)) return "Technical Ownership / First Builder Decision";
  if (/\b(head of eng|head of engineering|engineering manager|eng leader|engineering leadership|cto|vp engineering)\b/i.test(text)) return "Engineering Leadership Bottleneck";
  if (/\b(more senior|senior person|adult in the room|experienced|too junior|not senior enough|run themselves|autonomy|independent)\b/i.test(text)) return "Senior Ownership Gap";
  if (/\b(generalist|chief of staff|founder.?s office|operator|wear many hats|do everything|all of it)\b/i.test(text)) return "Role Compression / Generalist Hire";
  if (/\b(urgent|asap|fast|yesterday|panic|lost|left|need now|quickly)\b/i.test(text)) return "Urgent Hiring Triage";
  if (/\b(vp product|vp of product|chief product|cpo\b|pm|product manager|head of product|product lead|priorities|prioritization|alignment|product execution|ship)\b/i.test(text)) return "Product/Execution Ownership Gap";
  if (/\b(support|support reps?|tickets?|queue|onboarding|customer success|deployment)\b/i.test(text) && /\b(repeated|same questions?|bugs?|docs?|documentation|missing docs?|product bug|self[-\s]?serve|feedback loop)\b/i.test(text)) return "Product/Support Loop";
  if (/\b(customer ops|implementation|support|success|onboarding|customer success|deployment)\b/i.test(text)) return "Support Load Root Cause";
  return "Unknown / Needs Clarification";
}

function isMarketIntelMode(currentRead?: CurrentRead) {
  return currentRead?.mode === "execution" || currentRead?.mode === "sourcing";
}

function latestFounderContent(messages: TinaMvpMessage[]) {
  return [...messages].reverse().find((message) => message.role === "founder")?.content || "";
}

function isClarificationQuestion(value: string) {
  return /\b(what does that mean|why\??|can you explain|help me understand|what do you mean|say more|explain that)\b/i.test(value.trim());
}

function isFounderUncertaintyRequest(value: string) {
  return /\b(i don['’]?t know|not sure|unsure|no idea|still figuring|haven['’]?t figured)\b/i.test(value.trim());
}

function isMarketRealityRequest(value: string) {
  if (/\b(pressure[-\s]?test market|market reality)\b/i.test(value)) return false;
  if (isPlanningArtifactRequest(value)) return false;
  if (isExampleShapeRequest(value) || isExampleShapeFeedback(value)) return false;
  if (isFounderUncertaintyRequest(value)) return false;
  return /\b(market|market reality|comp|compensation|salary|equity|location|geo|geography|talent pool|time[-\s]?to[-\s]?fill|ttf|candidate|candidates|profile|profiles|people|lead|leads|sourcing|source|source against this thesis|build search lanes|search lanes|find people|pull)\b/i.test(value);
}

function shouldShowMarketReality(messages: TinaMvpMessage[], currentRead?: CurrentRead, hasMarketArtifacts = false) {
  const latestFounder = latestFounderContent(messages);
  if (isClarificationQuestion(latestFounder)) return false;
  if (isFounderUncertaintyRequest(latestFounder)) return false;
  if (isExampleShapeRequest(latestFounder) || isExampleShapeFeedback(latestFounder)) return false;
  if (latestExampleShapeMessageIndex(messages) > latestMarketEvidenceMessageIndex(messages)) return false;
  if (isMarketRealityRequest(latestFounder)) return true;
  if (latestMessageHasMarketArtifact(messages)) return true;
  return Boolean(hasMarketArtifacts && latestMessageHasProfileEvidence(messages) && currentRead?.mode === "sourcing");
}

function latestExampleShapeMessageIndex(messages: TinaMvpMessage[]) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.exampleShapes?.shapes?.length || message.exampleShapeFeedback) return index;
  }
  return -1;
}

function latestMarketEvidenceMessageIndex(messages: TinaMvpMessage[]) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    const artifacts = message.hiringArtifacts?.length ? message.hiringArtifacts : message.hiringArtifact ? [message.hiringArtifact] : [];
    if (
      artifacts.some((artifact) => artifact.kind === "market_reality" || artifact.kind === "sourcing_strategy") ||
      message.profileLeads?.length ||
      message.sourcingBatch
    ) {
      return index;
    }
  }
  return -1;
}

function latestExampleShapeMode(messages: TinaMvpMessage[]) {
  const latestExampleIndex = latestExampleShapeMessageIndex(messages);
  if (latestExampleIndex <= latestMarketEvidenceMessageIndex(messages)) return "";
  const latestExample = messages[latestExampleIndex];
  if (latestExample?.exampleShapeFeedback) return "feedback";
  if (latestExample?.exampleShapes?.shapes?.length) return "shapes";
  return "";
}

function latestMessageHasMarketArtifact(messages: TinaMvpMessage[]) {
  const latestTina = [...messages].reverse().find((message) => message.role === "tina");
  const artifacts = latestTina?.hiringArtifacts?.length ? latestTina.hiringArtifacts : latestTina?.hiringArtifact ? [latestTina.hiringArtifact] : [];
  return artifacts.some((artifact) => artifact.kind === "market_reality" || artifact.kind === "sourcing_strategy");
}

function latestMessageHasProfileEvidence(messages: TinaMvpMessage[]) {
  const latestWithProfiles = [...messages].reverse().find((message) => message.profileLeads?.length || message.sourcingBatch);
  return Boolean(latestWithProfiles?.profileLeads?.length || latestWithProfiles?.sourcingBatch);
}

function shouldAutoRenameThread(thread: ChatThread) {
  return !thread.manuallyRenamed && isProvisionalThreadTitle(thread.title);
}

function displayThreadTitle(thread: ChatThread, currentRead?: CurrentRead) {
  const thesisTitle = titleFromCurrentReadValue(currentRead);
  if (thesisTitle) return thesisTitle;

  return shouldAutoRenameThread(thread) ? titleFromMessages(thread.messages) : thread.title;
}

function collectProfileLeadItems(threadId: string, messages: TinaMvpMessage[]) {
  const items = [...messages].reverse().flatMap((message) =>
    (message.profileLeads || []).map((lead) => toProfileLeadItem(threadId, message.id, lead))
  );
  const seen = new Set<string>();

  return items.filter((item) => {
    if (seen.has(item.statusKey)) return false;
    seen.add(item.statusKey);
    return true;
  });
}

function collectLatestProfileLeadItems(threadId: string, messages: TinaMvpMessage[]) {
  const latestMessage = [...messages].reverse().find((message) => message.profileLeads?.length);
  return latestMessage?.profileLeads?.map((lead) => toProfileLeadItem(threadId, latestMessage.id, lead)) || [];
}

function collectLatestSourcingBatch(messages: TinaMvpMessage[]) {
  return [...messages].reverse().find((message) => message.sourcingBatch)?.sourcingBatch;
}

function latestConversationExchange(messages: TinaMvpMessage[]) {
  const latestFounderIndex = messages.map((message, index) => ({ message, index })).reverse().find((item) => item.message.role === "founder")?.index;
  if (typeof latestFounderIndex !== "number") return messages.slice(-2);

  const nextTinaIndex = messages.findIndex((message, index) => index > latestFounderIndex && message.role === "tina");
  const startIndex = Math.max(0, latestFounderIndex - 1);
  const endIndex = nextTinaIndex >= 0 ? nextTinaIndex + 1 : latestFounderIndex + 1;

  return messages.slice(startIndex, endIndex);
}

function latestSourcingReadiness(messages: TinaMvpMessage[]) {
  return [...messages].reverse().find((message) => message.sourcingReadiness)?.sourcingReadiness;
}

function toProfileLeadItem(threadId: string, batchId: string, lead: ProfileLead): ProfileLeadItem {
  return {
    lead,
    batchId,
    statusKey: `${threadId}:${batchId}:${lead.id}`
  };
}

function readProfileLeadStatus() {
  try {
    const rawStatus = window.sessionStorage.getItem(PROFILE_LEAD_STATUS_STORAGE_KEY);
    if (!rawStatus) return {};
    const parsed = JSON.parse(rawStatus) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};

    return parsed as Record<string, ProfileLeadStatus>;
  } catch {
    return {};
  }
}

function readStoredBrainStates() {
  try {
    const rawStates = window.sessionStorage.getItem(BRAIN_STATE_STORAGE_KEY);
    if (!rawStates) return {};
    const parsed = JSON.parse(rawStates) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};

    return Object.fromEntries(
      Object.entries(parsed)
        .filter((entry): entry is [string, BrainState] => typeof entry[0] === "string" && isBrainState(entry[1]))
    );
  } catch {
    return {};
  }
}

function readStoredCanonicalSearchStates() {
  try {
    const rawStates = window.sessionStorage.getItem(CANONICAL_SEARCH_STATE_STORAGE_KEY);
    if (!rawStates) return {};
    const parsed = JSON.parse(rawStates) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};

    return Object.fromEntries(
      Object.entries(parsed)
        .filter((entry): entry is [string, CanonicalSearchState] => typeof entry[0] === "string" && isCanonicalSearchState(entry[1]))
    );
  } catch {
    return {};
  }
}

function readStoredWorkingTheses() {
  try {
    const rawStates = window.sessionStorage.getItem(WORKING_THESIS_STORAGE_KEY);
    if (!rawStates) return {};
    const parsed = JSON.parse(rawStates) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};

    return Object.fromEntries(
      Object.entries(parsed)
        .filter((entry): entry is [string, WorkingThesis] => typeof entry[0] === "string" && isWorkingThesis(entry[1]))
    );
  } catch {
    return {};
  }
}

function readStoredCurrentReads() {
  try {
    const rawStates = window.sessionStorage.getItem(CURRENT_READ_STORAGE_KEY);
    if (!rawStates) return {};
    const parsed = JSON.parse(rawStates) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};

    return Object.fromEntries(
      Object.entries(parsed)
        .filter((entry): entry is [string, CurrentRead] => typeof entry[0] === "string" && isCurrentRead(entry[1]))
    );
  } catch {
    return {};
  }
}

function readStoredSignalMaps() {
  try {
    const rawStates = window.sessionStorage.getItem(SIGNAL_MAP_STORAGE_KEY);
    if (!rawStates) return {};
    const parsed = JSON.parse(rawStates) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};

    return Object.fromEntries(
      Object.entries(parsed)
        .filter((entry): entry is [string, SignalMap] => typeof entry[0] === "string" && isSignalMap(entry[1]))
    );
  } catch {
    return {};
  }
}

function readStoredThreads() {
  try {
    const rawThreads = window.sessionStorage.getItem(THREAD_STORAGE_KEY);
    if (!rawThreads) return [];
    const parsed = JSON.parse(rawThreads) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(isChatThread);
  } catch {
    return [];
  }
}

function isBrainState(value: unknown): value is BrainState {
  if (!value || typeof value !== "object") return false;
  const state = value as BrainState;

  return (
    typeof state.roleThesis === "string" &&
    typeof state.readinessScore === "number" &&
    typeof state.batchQualityScore === "number" &&
    typeof state.noveltyScore === "number" &&
    typeof state.confidenceScore === "number" &&
    Boolean(state.searchShape) &&
    Array.isArray(state.seekSignals) &&
    Array.isArray(state.avoidSignals) &&
    Array.isArray(state.likelyTitles) &&
    Boolean(state.sourceLanes) &&
    Array.isArray(state.missingSignals) &&
    Array.isArray(state.calibrationQuestions) &&
    (state.sourcingReadiness === "not_ready" || state.sourcingReadiness === "calibration_batch" || state.sourcingReadiness === "ready") &&
    typeof state.tinaRead === "string"
  );
}

function isCanonicalSearchState(value: unknown): value is CanonicalSearchState {
  if (!value || typeof value !== "object") return false;
  const state = value as CanonicalSearchState;
  return typeof state.roleTitle === "string" &&
    typeof state.roleFamily === "string" &&
    typeof state.location === "string" &&
    Array.isArray(state.mustHaveSignals) &&
    Array.isArray(state.candidateProfiles);
}

function isWorkingThesis(value: unknown): value is WorkingThesis {
  if (!value || typeof value !== "object") return false;
  const thesis = value as WorkingThesis;
  return typeof thesis.currentHypothesis === "string" &&
    (thesis.confidence === "low" || thesis.confidence === "medium" || thesis.confidence === "high") &&
    Array.isArray(thesis.evidence) &&
    Array.isArray(thesis.resolvedSignals) &&
    Array.isArray(thesis.openTensions) &&
    Array.isArray(thesis.alternativeExplanations) &&
    typeof thesis.latestInsight === "string" &&
    (typeof thesis.nextBestQuestion === "undefined" || typeof thesis.nextBestQuestion === "string");
}

function isCurrentRead(value: unknown): value is CurrentRead {
  if (!value || typeof value !== "object") return false;
  const read = value as CurrentRead;
  return (
    (read.mode === "discovery" || read.mode === "thesis" || read.mode === "calibration" || read.mode === "execution" || read.mode === "sourcing") &&
    typeof read.thesisTitle === "string" &&
    typeof read.observation === "string" &&
    typeof read.hypothesis === "string" &&
    typeof read.risk === "string" &&
    (read.confidence === "low" || read.confidence === "medium" || read.confidence === "high") &&
    typeof read.whatWouldChangeMyMind === "string" &&
    typeof read.nextBestMove === "string" &&
    Array.isArray(read.calibratedScope) &&
    Array.isArray(read.evidence) &&
    Array.isArray(read.openTensions) &&
    (typeof read.statedRole === "undefined" || typeof read.statedRole === "string") &&
    (typeof read.likelyArchetype === "undefined" || typeof read.likelyArchetype === "string")
  );
}

function isSignalMap(value: unknown): value is SignalMap {
  if (!value || typeof value !== "object") return false;
  const map = value as SignalMap;
  return Array.isArray(map.mustProveSignals) &&
    Array.isArray(map.weakSignals) &&
    Array.isArray(map.falsePositives) &&
    Array.isArray(map.interviewProbes) &&
    typeof map.bestCandidateArchetype === "string" &&
    typeof map.derivedFromThesisTitle === "string";
}

function isSignalMapFresh(signalMap: SignalMap, currentRead?: CurrentRead) {
  if (!currentRead) return false;
  return signalMap.derivedFromThesisTitle === (currentRead.likelyArchetype || currentRead.thesisTitle);
}

function collectHiringArtifacts(messages: TinaMvpMessage[]) {
  return messages.flatMap((message) => message.hiringArtifacts?.length ? message.hiringArtifacts : message.hiringArtifact ? [message.hiringArtifact] : []);
}

function actionLabelFromPrompt(prompt: string) {
  const clean = prompt.trim();
  if (/scorecard/i.test(clean)) return "Build scorecard";
  if (/interview plan/i.test(clean)) return "Create interview plan";
  if (/candidate archetype/i.test(clean)) return "Define candidate archetype";
  if (/market reality/i.test(clean)) return "Pressure-test market reality";
  if (/sourcing strategy|search lanes/i.test(clean)) return "Build sourcing strategy";
  if (/source|candidate|profile|people/i.test(clean)) return "Source against this thesis";
  if (/ownership/i.test(clean)) return "Clarify ownership gap";
  if (/compare/i.test(clean)) return "Compare role archetypes";
  return clean.slice(0, 60) || "Planning action";
}

function isStoredCanonicalStateFresh(stored: CanonicalSearchState, fallback: CanonicalSearchState) {
  if (stored.lastUpdatedReason !== fallback.lastUpdatedReason) return false;
  if (fallback.roleTitle !== "Role forming" && stored.roleTitle !== fallback.roleTitle) return false;
  if (fallback.location !== "Location forming" && stored.location !== fallback.location) return false;
  if (fallback.roleFamily !== "other" && stored.roleFamily !== fallback.roleFamily) return false;
  return true;
}

function isChatThread(value: unknown): value is ChatThread {
  if (!value || typeof value !== "object") return false;
  const thread = value as ChatThread;

  return (
    typeof thread.id === "string" &&
    typeof thread.title === "string" &&
    typeof thread.time === "string" &&
    (typeof thread.manuallyRenamed === "undefined" || typeof thread.manuallyRenamed === "boolean") &&
    Array.isArray(thread.messages) &&
    thread.messages.every(isTinaMessage)
  );
}

function isTinaMessage(value: unknown): value is TinaMvpMessage {
  if (!value || typeof value !== "object") return false;
  const message = value as TinaMvpMessage;

  return (
    typeof message.id === "string" &&
    (message.role === "founder" || message.role === "tina") &&
    typeof message.content === "string"
  );
}

function createNewRoleThread(sessionId?: string): ChatThread {
  const threadId = `thread-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  return createNewRoleThreadWithId(threadId, sessionId);
}

function createNewRoleThreadWithId(threadId: string, sessionId?: string): ChatThread {
  return {
    id: threadId,
    title: "New role",
    time: "Just now",
    messages: [],
    sessionId
  };
}

function getOrCreateAnonymousSessionId() {
  try {
    const existing = window.sessionStorage.getItem(SESSION_ID_STORAGE_KEY);
    if (existing) return existing;

    const randomId = typeof window.crypto?.randomUUID === "function"
      ? window.crypto.randomUUID()
      : `anon-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const sessionId = `anon-${randomId}`;
    window.sessionStorage.setItem(SESSION_ID_STORAGE_KEY, sessionId);
    return sessionId;
  } catch {
    return `anon-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

function isBlankNewRoleThread(thread: ChatThread) {
  return (
    !thread.manuallyRenamed &&
    isProvisionalThreadTitle(thread.title) &&
    (
      thread.messages.length === 0 ||
      (
        thread.messages.length === 1 &&
        thread.messages[0]?.role === "tina" &&
        thread.messages[0]?.content === openingMessage.content
      )
    )
  );
}

function isProvisionalThreadTitle(title: string) {
  return (
    ["New role", "New conversation", "AI Engineer"].includes(title) ||
    /[,.;]|\b(in|near|around|based)\b/i.test(title) ||
    /^(a|an|the)\s+/i.test(title) ||
    title.length > 34
  );
}

function extractRoleTitle(text: string) {
  const normalized = text.replace(/\s+/g, " ").trim();
  const directAsk = normalized.match(/\b(?:need|hire|hiring|find|looking for|recruiting|searching for|bring on)\s+(?:a new|an|a|the|our|new)?\s*(.+)$/i)?.[1];
  const roleStatement = normalized.match(/\b(?:role is|hire is|person is)\s+(?:an|a|the|our)?\s*(.+)$/i)?.[1];

  for (const candidate of [directAsk, roleStatement]) {
    const scopedCandidate = (candidate || "").split(/\s+(?:in|for|who|that|with|to|at|near|around|based|because|but|and we|and i)\b|[,.;!?]/i)[0];
    const cleaned = cleanRoleTitle(scopedCandidate);
    if (isSpecificRoleTitle(cleaned)) return cleaned;
  }

  return "";
}

function compactRoleTitle(text: string) {
  const normalized = cleanRoleTitle(
    text
      .replace(/^i\s+(?:need|want|am looking for|['’]m looking for|have to find)\s+/i, "")
      .replace(/^we\s+(?:need|want|are looking for|['’]re looking for|have to find)\s+/i, "")
  );

  return normalized.length > 34 ? `${normalized.slice(0, 31).trim()}...` : normalized || "New role";
}

function cleanRoleTitle(value: string) {
  return value
    .replace(/^\s*(?:me|us)\s+/i, "")
    .replace(/^\s*(?:a|an|the|our|new)\s+/i, "")
    .replace(/\b(?:someone|somebody|person|candidate)\b/gi, "")
    .replace(/\b(?:can|could|will|would|should)\b.*$/i, "")
    .replace(/\b(?:in|at|near|around|based in)\s+[A-Z][\w\s,-]*$/i, "")
    .replace(/\b(?:illinois|illions|peoria|san francisco|sf|new york|nyc|china|remote)\b.*$/i, "")
    .replace(/\b(?:right now|asap|urgently)\b/gi, "")
    .replace(/\s+/g, " ")
    .replace(/^[\s,.-]+|[\s,.-]+$/g, "")
    .split(" ")
    .slice(0, 5)
    .map(formatTitleWord)
    .join(" ");
}

function formatTitleWord(word: string, index: number) {
  const lower = word.toLowerCase();
  if (index > 0 && ["of", "and", "for", "to"].includes(lower)) return lower;
  if (["ai", "ml", "pm", "gtm"].includes(lower)) return lower.toUpperCase();
  if (word.length <= 3 && word === word.toUpperCase()) return word;
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

function isSpecificRoleTitle(title: string) {
  if (!title || title.length < 4) return false;
  return /\b(engineer|designer|manager|operator|pm|product|sales|recruiter|lead|head|founder|chief|staff|marketer|growth|plant|backend|frontend|ai|ml|data)\b/i.test(title);
}

function TinaMark() {
  return (
    <div className="flex h-7 w-7 shrink-0 items-center justify-center text-[#178A52]">
      <Sparkles className="h-5 w-5" strokeWidth={1.8} />
    </div>
  );
}

function EmptyCalibrationPanel({ calibration }: { calibration: LiveCalibration }) {
  return (
    <aside className="rounded-lg border border-dashed border-[#D8CEC2] bg-[#FFFCF7]/72 p-4 shadow-[0_14px_40px_rgba(23,23,23,0.04)] backdrop-blur">
      <PanelHeader eyebrow="Calibration waiting" title="Tina is ready to form the hiring read." icon={Brain} />
      <p className="mt-2 text-sm leading-6 text-[#625A52]">
        Start with the problem this hire needs to solve. The workspace will turn the conversation into tensions, candidate lanes, market pressure, and next steps.
      </p>
      <div className="mt-4">
        <CalibrationCurrent calibration={calibration} />
      </div>

      <div className="mt-4 grid gap-3">
        <RoleClarityCard calibration={calibration} />
        <ModuleCard title="Likely tensions">
          <div className="grid gap-3">
            {calibration.tensions.slice(0, 3).map((tension) => (
              <TensionSlider key={`${tension.left}-${tension.right}`} {...tension} muted />
            ))}
          </div>
        </ModuleCard>
        <ModuleCard title="Signals waiting to form">
          <SignalList items={["First 90-day outcome", "Founder dependency level", "Speed vs depth tradeoff"]} />
        </ModuleCard>
        <NextActionCard action={calibration.nextAction} />
      </div>
    </aside>
  );
}

function RightIntelligenceRail({
  sourcingStrategy,
  brainState,
  profileLeadItems,
  latestProfileLeadItems,
  profileLeadStatus,
  onProfileLeadStatusChange,
  onRefineSearch,
  batchRead,
  sourcingBatch,
  feedbackRead,
  hasFeedback,
  refineLabel,
  isClientMounted,
  messages,
  canonicalSearchState,
  currentRead,
  onCurrentReadAction
}: {
  sourcingStrategy: SourcingStrategy;
  brainState: BrainState;
  profileLeadItems: ProfileLeadItem[];
  latestProfileLeadItems: ProfileLeadItem[];
  profileLeadStatus: Record<string, ProfileLeadStatus>;
  onProfileLeadStatusChange: (leadId: string, status: ProfileLeadStatus) => void;
  onRefineSearch: () => void;
  batchRead: string;
  sourcingBatch?: SourcingBatchMetadata;
  feedbackRead: string;
  hasFeedback: boolean;
  refineLabel: string;
  isClientMounted: boolean;
  messages: TinaMvpMessage[];
  canonicalSearchState: CanonicalSearchState;
  currentRead?: CurrentRead;
  onCurrentReadAction: (value: string) => void;
}) {
  const visibleItems = isClientMounted ? prioritizeLatestProfileLeadItems(profileLeadItems, latestProfileLeadItems) : [];
  const showMarketReality = shouldShowMarketReality(messages, currentRead, Boolean(sourcingBatch) || visibleItems.length > 0);
  const exampleShapeMode = showMarketReality ? "" : latestExampleShapeMode(messages);
  const railEyebrow = showMarketReality ? "Market Reality" : exampleShapeMode === "feedback" ? "Shape feedback" : exampleShapeMode === "shapes" ? "Example Shapes" : "Tina’s read";
  const railTitle = showMarketReality ? "Market reality" : exampleShapeMode === "feedback" ? "Shape feedback" : exampleShapeMode === "shapes" ? "Example shapes" : "Hiring thesis";
  const railSubtitle = showMarketReality ? "Shown when Tina is executing or sourcing." : exampleShapeMode ? "Calibration shapes, not market data." : "What Tina thinks is happening.";

  return (
    <aside className="hidden h-full min-h-0 min-w-0 max-w-full overflow-y-auto md:block md:pt-2 xl:pt-3">
      <section className="min-h-[calc(100%-0.75rem)] min-w-0 overflow-hidden rounded-xl border border-[#E7E3DD] bg-white shadow-[0_22px_70px_rgba(23,23,23,0.055)]">
        <div className="border-b border-[#ECE7E1] bg-white px-3 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#8A8178]">{railEyebrow}</p>
          <h2 className="mt-1 text-base font-semibold text-[#171717]">{railTitle}</h2>
          <p className="mt-1 text-xs leading-5 text-[#625A52]">{railSubtitle}</p>
        </div>

        <div className="min-w-0 overflow-hidden p-3">
          {showMarketReality ? (
            <MarketIntelRail
              brainState={brainState}
              sourcingStrategy={sourcingStrategy}
              items={visibleItems}
              latestItems={latestProfileLeadItems}
              statuses={profileLeadStatus}
              onProfileLeadStatusChange={onProfileLeadStatusChange}
              onRefineSearch={onRefineSearch}
              feedbackRead={feedbackRead}
              hasFeedback={hasFeedback}
              refineLabel={refineLabel}
              isClientMounted={isClientMounted}
              messages={messages}
              sourcingBatch={sourcingBatch}
              canonicalSearchState={canonicalSearchState}
              currentRead={currentRead}
            />
          ) : (
            <CurrentReadRail currentRead={currentRead} onAction={onCurrentReadAction} />
          )}
        </div>
      </section>
    </aside>
  );
}

function CurrentReadRail({ currentRead, onAction }: { currentRead?: CurrentRead; onAction: (value: string) => void }) {
  const read = currentRead || {
    mode: "discovery",
    thesisTitle: "Unknown / Needs Clarification",
    observation: "No real founder signal yet.",
    hypothesis: "The hiring problem is still unnamed.",
    risk: "A vague role can turn into a very expensive guess.",
    confidence: "low",
    stability: "emerging",
    operatingState: "unknown",
    hireDecisionType: "not_hiring_yet",
    whatWouldChangeMyMind: "One concrete description of what is breaking today.",
    nextBestMove: "Ask what changed that makes this hire feel necessary now.",
    calibratedScope: [],
    evidence: [],
    openTensions: ["the actual business problem behind the role"],
    likelyArchetype: "Unknown / Needs Clarification"
  } satisfies CurrentRead;
  const signals = (read.calibratedScope.length ? read.calibratedScope : read.evidence).slice(0, 3);
  const actions = actionButtonsForCurrentRead(read).slice(0, 2);
  const diagnosis = oneSentence(read.hypothesis);
  const risk = oneSentence(read.risk);
  const nextMove = oneSentence(read.nextBestMove);
  const bottlenecks = bottleneckBarsForRead(read);

  return (
    <section className="rounded-2xl border border-[#E5DCD1] bg-[#FFFCF7] p-4 shadow-[0_18px_55px_rgba(23,23,23,0.055)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8A8178]">Tina’s read</p>
          <h3 className="mt-2 text-xl font-semibold leading-6 text-[#171717]">{currentReadTitleForRail(read)}</h3>
        </div>
        <span className="shrink-0 rounded-full bg-[#EFF8F1] px-2.5 py-1 text-[10px] font-semibold capitalize text-[#137C48] ring-1 ring-[#DCEFE2]">
          {decisionStatusForRead(read)}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-[auto_1fr] gap-x-3 gap-y-3">
        <DecisionIcon tone="problem" icon={<Sparkles className="h-3.5 w-3.5" />} />
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8A8178]">Problem</p>
          <p className="mt-1 text-sm leading-5 text-[#171717]">{diagnosis}</p>
        </div>

        <DecisionIcon tone="risk" icon={<AlertTriangle className="h-3.5 w-3.5" />} />
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8A8178]">Risk</p>
          <p className="mt-1 text-sm leading-5 text-[#4B453F]">{risk}</p>
        </div>

        <DecisionIcon tone="next" icon={<ArrowRight className="h-3.5 w-3.5" />} />
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8A8178]">Next</p>
          <p className="mt-1 text-sm font-semibold leading-5 text-[#171717]">{nextMove}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-2">
        {actions.map((action) => (
          <button
            key={action.label}
            type="button"
            onClick={() => onAction(action.prompt)}
            className={`rounded-lg px-3 py-2.5 text-left text-xs font-semibold transition ${
              action === actions[0]
                ? "bg-[#171717] text-white shadow-[0_12px_28px_rgba(23,23,23,0.14)] hover:bg-[#2A2A2A]"
                : "border border-[#E3DED7] bg-white text-[#4B453F] hover:bg-[#F7F4EF]"
            }`}
          >
            {action.label}
          </button>
        ))}
      </div>

      <details className="mt-4 rounded-xl border border-dashed border-[#DED5CA] bg-white/70 p-3">
        <summary className="cursor-pointer text-xs font-semibold text-[#625A52]">Why Tina thinks this →</summary>
        <div className="mt-3 grid gap-3">
          {signals.length ? (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8A8178]">Signals</p>
              <ul className="mt-2 grid gap-1.5 text-xs leading-5 text-[#625A52]">
                {signals.map((signal) => (
                  <li key={signal} className="flex gap-2">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#178A52]" />
                    <span>{signal}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8A8178]">Bottleneck read</p>
            <div className="mt-2 grid gap-2">
              {bottlenecks.map((item) => (
                <BottleneckBar key={item.label} label={item.label} value={item.value} level={item.level} />
              ))}
            </div>
          </div>

          <div className="grid gap-1.5 text-xs leading-5 text-[#625A52]">
            <p><span className="font-semibold text-[#4B453F]">Still checking:</span> {read.whatWouldChangeMyMind}</p>
            {read.openTensions.length ? <p><span className="font-semibold text-[#4B453F]">Alternative:</span> {read.openTensions[0]}</p> : null}
          </div>
        </div>
      </details>
    </section>
  );
}

function DecisionIcon({ tone, icon }: { tone: "problem" | "risk" | "next"; icon: ReactNode }) {
  const styles = {
    problem: "bg-[#EEF8F1] text-[#178A52]",
    risk: "bg-[#FFF2E8] text-[#A35F2E]",
    next: "bg-[#F0EDFF] text-[#5B40D6]"
  };

  return (
    <div className={`mt-0.5 grid h-7 w-7 place-items-center rounded-full ${styles[tone]}`}>
      {icon}
    </div>
  );
}

function BottleneckBar({ label, value, level }: { label: string; value: number; level: string }) {
  return (
    <div className="grid gap-1">
      <div className="flex items-center justify-between gap-2 text-[11px]">
        <span className="text-[#625A52]">{label}</span>
        <span className="font-medium text-[#4B453F]">{level}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-[#E9E1D8]">
        <div className="h-full rounded-full bg-[#178A52]" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function oneSentence(value: string, maxLength = 118) {
  const sentence = value
    .replace(/\s+/g, " ")
    .trim()
    .split(/(?<=[.!?])\s+/)[0] || value;

  return compactLeadText(sentence, maxLength).replace(/\.$/, ".");
}

function decisionStatusForRead(read: CurrentRead) {
  if (read.stability === "committed") return "committed";
  if (read.stability === "revising") return "revising";
  if (read.mode === "discovery") return "forming";
  if (read.mode === "thesis") return "thesis";
  if (read.mode === "calibration") return "calibrating";
  if (read.mode === "execution") return "ready";
  return "sourcing";
}

function currentReadTitleForRail(read: CurrentRead) {
  if (!read.thesisTitle || read.thesisTitle === "Unknown / Needs Clarification") return "Hiring problem unclear";
  return read.thesisTitle;
}

function bottleneckBarsForRead(read: CurrentRead) {
  if (read.likelyArchetype === "Engineering Leadership Bottleneck") {
    return [
      { label: "Founder decisions", value: 88, level: "high" },
      { label: "Technical judgment", value: 62, level: "medium" },
      { label: "People leadership", value: 54, level: "medium" },
      { label: "Raw capacity", value: 28, level: "low" }
    ];
  }

  if (read.likelyArchetype === "Product/Execution Ownership Gap") {
    return [
      { label: "Founder decisions", value: 82, level: "high" },
      { label: "Product judgment", value: 68, level: "medium" },
      { label: "Execution load", value: 58, level: "medium" },
      { label: "Raw capacity", value: 35, level: "low" }
    ];
  }

  if (read.likelyArchetype === "Founder-Led Sales Transition") {
    return [
      { label: "Founder closing", value: 86, level: "high" },
      { label: "Repeatable motion", value: 48, level: "medium" },
      { label: "Sales leadership", value: 42, level: "medium" },
      { label: "Pipeline volume", value: 36, level: "low" }
    ];
  }

  if (read.likelyArchetype === "Urgent Hiring Triage") {
    return [
      { label: "Coverage gap", value: 88, level: "high" },
      { label: "Permanent scope", value: 44, level: "medium" },
      { label: "Search speed", value: 72, level: "high" },
      { label: "Role clarity", value: 34, level: "low" }
    ];
  }

  return [
    { label: "Founder load", value: 70, level: "high" },
    { label: "Role clarity", value: 48, level: "medium" },
    { label: "Decision rights", value: 56, level: "medium" },
    { label: "Market proof", value: 30, level: "low" }
  ];
}

function MarketIntelRail({
  brainState,
  sourcingStrategy,
  items,
  latestItems,
  statuses,
  onProfileLeadStatusChange,
  onRefineSearch,
  feedbackRead,
  hasFeedback,
  refineLabel,
  isClientMounted,
  messages,
  sourcingBatch,
  canonicalSearchState,
  currentRead
}: {
  brainState: BrainState;
  sourcingStrategy: SourcingStrategy;
  items: ProfileLeadItem[];
  latestItems: ProfileLeadItem[];
  statuses: Record<string, ProfileLeadStatus>;
  onProfileLeadStatusChange: (leadId: string, status: ProfileLeadStatus) => void;
  onRefineSearch: () => void;
  feedbackRead: string;
  hasFeedback: boolean;
  refineLabel: string;
  isClientMounted: boolean;
  messages: TinaMvpMessage[];
  sourcingBatch?: SourcingBatchMetadata;
  canonicalSearchState: CanonicalSearchState;
  currentRead?: CurrentRead;
}) {
  const sortedItems = isClientMounted ? prioritizePotentialCandidateItems(items, statuses) : [];
  const latestKeys = new Set(isClientMounted ? latestItems.map((item) => item.statusKey) : []);
  const intel = isClientMounted ? buildMarketIntelSnapshot(canonicalSearchState, brainState, sourcingStrategy, sortedItems, messages, currentRead) : emptyMarketIntelSnapshot();

  return (
    <div className="grid gap-3">
      <CalibratedScopeCard intel={intel} />
      <TalentPoolSnapshotCard intel={intel} />

      {sortedItems.length || sourcingBatch ? (
      <section className="rounded-lg border border-[#E2D8CD] bg-white p-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#8A8178]">Archetypes</p>
            <p className="mt-1 text-sm font-semibold text-[#171717]">
              {sortedItems.length ? `${sortedItems.length} ${sortedItems.length === 1 ? "archetype" : "archetypes"}` : "No validated archetypes yet"}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {sourcingBatch ? <SearchSourceBadge sourcingBatch={sourcingBatch} /> : null}
            {hasFeedback ? (
              <button
                type="button"
                onClick={onRefineSearch}
                className="rounded-md bg-[#171717] px-2.5 py-1.5 text-[11px] font-medium text-white"
              >
                {refineLabel}
              </button>
            ) : null}
          </div>
        </div>

        {feedbackRead ? <p className="mt-2 rounded-md bg-[#F4FAF5] px-2 py-1.5 text-[11px] leading-4 text-[#4A6A4D]">{feedbackRead}</p> : null}

        <div className="mt-3 grid gap-2">
          {sortedItems.length ? sortedItems.slice(0, 8).map((item) => (
            <MarketProfileRow
              key={item.statusKey}
              item={item}
              isLatest={latestKeys.has(item.statusKey)}
              status={statuses[item.statusKey]}
              onStatusChange={(status) => onProfileLeadStatusChange(item.statusKey, status)}
            />
          )) : (
            <p className="rounded-lg border border-dashed border-[#DED5CA] bg-[#FFFCF7] px-3 py-4 text-center text-xs text-[#8A8178]">
              {sourcingBatch
                ? sourcingBatch.filteredCount
                  ? `Experimental sourcing filtered ${sourcingBatch.filteredCount} weak or wrong-fit results. Next: turn the thesis into a cleaner sourcing brief.`
                  : "Experimental sourcing ran but did not find reliable role-fit matches yet. Next: turn the thesis into a cleaner sourcing brief."
                : "No example shapes yet."}
            </p>
          )}
        </div>

        {sourcingBatch?.audit ? (
          <details className="mt-3 rounded-md border border-[#E7DDD1] bg-[#FFFCF7] p-2">
            <summary className="cursor-pointer text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8A8178]">Search details</summary>
            <div className="mt-2 space-y-1 text-[11px] leading-4 text-[#625A52]">
              <p>{sourcingBatch.searchProvider === "tavily" ? "Live Tavily search" : "Fallback mock search"} · {sourcingBatch.audit.rawResultCount} raw results · {sourcingBatch.audit.candidateCount} candidate-shaped · {sourcingBatch.audit.validCount} shown</p>
              {sourcingBatch.audit.tavilyFailureCount ? (
                <p className="text-[#A7531F]">{sourcingBatch.audit.tavilyFailureCount} Tavily {sourcingBatch.audit.tavilyFailureCount === 1 ? "query failed" : "queries failed"}.</p>
              ) : null}
              <p className="break-words text-[#8A8178]">First query: {sourcingBatch.audit.queriesRun[0] || "none"}</p>
            </div>
          </details>
        ) : null}
      </section>
      ) : null}

      <section className="rounded-lg border border-[#D7CFC5] bg-[#1E1E1E] p-3 text-white shadow-[0_16px_42px_rgba(23,23,23,0.12)]">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#CFC7BD]">Founder Takeaway</p>
        <p className="mt-2 text-sm leading-5">{intel.founderTakeaway}</p>
      </section>
    </div>
  );
}

function CalibratedScopeCard({ intel }: { intel: MarketIntelSnapshot }) {
  return (
    <section className="rounded-lg border border-[#E2D8CD] bg-[#FFFCF7] p-3">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#8A8178]">Calibrated Scope</p>
      <h3 className="mt-2 text-base font-semibold leading-5 text-[#171717]">{intel.scopeTitle}</h3>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {intel.nonNegotiables.length ? intel.nonNegotiables.map((signal) => (
          <span key={signal} className="rounded-full bg-white px-2.5 py-1 text-[11px] font-medium text-[#4B453F] ring-1 ring-[#E5DCD1]">
            {signal}
          </span>
        )) : (
          <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-medium text-[#8A8178] ring-1 ring-[#E5DCD1]">{MARKET_INTEL_FORMING_TITLE}</span>
        )}
      </div>
      {intel.driftLine ? <p className="mt-2 text-[11px] text-[#8A8178]">Drift: {intel.driftLine}</p> : null}
    </section>
  );
}

function TalentPoolSnapshotCard({ intel }: { intel: MarketIntelSnapshot }) {
  return (
    <section className="rounded-lg border border-[#E2D8CD] bg-white p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#8A8178]">Example Shapes Snapshot</p>
        <span className="rounded-full bg-[#F4F1EC] px-2 py-1 text-[10px] font-medium text-[#6F675E]">{intel.dataLabel}</span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <MiniStat label="Pool" value={intel.poolSize} />
        <MiniStat label="Comp" value={intel.compRange} />
      </div>

      <div className="mt-3 grid gap-2">
        <MarketDonut title="Location mix" emptyLabel="Not enough evidence yet" segments={intel.locationMix} />
        <MarketDonut title="Seniority mix" emptyLabel="Not enough evidence yet" segments={intel.seniorityMix} />
      </div>

      <div className="mt-3">
        <MiniStat label="Est. Time to Fill" value={intel.timeToFill} />
      </div>
    </section>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#E8E1D8] bg-[#FFFCF7] px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8A8178]">{label}</p>
      <p className="mt-1 text-sm font-semibold text-[#171717]">{value}</p>
    </div>
  );
}

function MarketDonut({ title, emptyLabel, segments }: { title: string; emptyLabel: string; segments: MarketSegment[] }) {
  const hasSegments = segments.length > 0;
  const gradient = hasSegments ? donutGradient(segments) : "#E9E1D8";

  return (
    <div className="rounded-lg border border-[#E8E1D8] bg-[#FFFCF7] p-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8A8178]">{title}</p>
      <div className="mt-2 flex items-center gap-3">
        <div
          className="grid h-14 w-14 shrink-0 place-items-center rounded-full"
          style={{ background: hasSegments ? `conic-gradient(${gradient})` : gradient }}
        >
          <div className="h-8 w-8 rounded-full bg-[#FFFCF7]" />
        </div>
        <div className="min-w-0 flex-1">
          {hasSegments ? segments.map((segment) => (
            <div key={segment.label} className="mb-1 flex items-center justify-between gap-2 text-[11px]">
              <span className="truncate text-[#625A52]">{segment.label}</span>
              <span className="font-medium text-[#171717]">{segment.value}%</span>
            </div>
          )) : (
            <p className="text-xs text-[#8A8178]">{emptyLabel}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function MarketProfileRow({
  item,
  isLatest,
  status,
  onStatusChange
}: {
  item: ProfileLeadItem;
  isLatest: boolean;
  status?: ProfileLeadStatus;
  onStatusChange: (status: ProfileLeadStatus) => void;
}) {
  const lead = item.lead;
  const name = compactLeadName(lead.title);
  const match = profileMatchScore(lead);
  const isSaved = status?.action === "saved";
  const isRejected = status?.action === "rejected";

  return (
    <details className={`min-w-0 overflow-hidden rounded-lg border bg-white ${isRejected ? "border-[#E2D6CC] opacity-70" : "border-[#E8E1D8]"} ${isLatest ? "ring-1 ring-[#E7DDD1]" : ""}`}>
      <summary className="cursor-pointer list-none p-2.5">
        <div className="flex items-start gap-2.5">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#EEF8F1] text-[11px] font-semibold text-[#108A4B]">
            {initialsForName(name)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <p className="truncate text-sm font-semibold text-[#171717]">{name}</p>
              <span className="shrink-0 rounded-full bg-[#F3EFE8] px-2 py-0.5 text-[10px] font-semibold text-[#4B453F]">{match}%</span>
            </div>
            <p className="mt-1 truncate text-xs text-[#625A52]">{profileSignalLine(lead)}</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <span className="rounded-full bg-[#F7F4EF] px-2 py-0.5 text-[10px] capitalize text-[#6F675E]">{lead.source.replace("_", " ")}</span>
              <span className={`rounded-full px-2 py-0.5 text-[10px] ${lead.evidenceLevel === "synthetic" ? "bg-[#FFF2E8] text-[#A35F2E]" : "bg-[#F4F1EC] text-[#6F675E]"}`}>
                {candidateEvidenceLabel(lead)}
              </span>
              {isSaved ? <span className="rounded-full bg-[#EEF8F1] px-2 py-0.5 text-[10px] text-[#108A4B]">Saved</span> : null}
              {isRejected ? <span className="rounded-full bg-[#FFF2E8] px-2 py-0.5 text-[10px] text-[#A35F2E]">Rejected</span> : null}
            </div>
          </div>
        </div>
      </summary>

      <div className="border-t border-[#EFE8DF] px-2.5 py-3 text-xs leading-5 text-[#4B453F]">
        <p className="break-words"><span className="font-semibold">Source:</span> <a href={lead.url} target="_blank" rel="noreferrer" className="text-[#4B28C9]">Open profile</a></p>
        <p className="mt-1 break-words"><span className="font-semibold">Evidence level:</span> {candidateEvidenceLabel(lead)}</p>
        <p className="mt-1 break-words"><span className="font-semibold">Why surfaced:</span> {lead.fitReason}</p>
        <p className="mt-1 break-words"><span className="font-semibold">Evidence/proof:</span> {leadEvidenceLine(lead)}</p>
        <p className="mt-1 break-words"><span className="font-semibold">Missing proof:</span> {missingSignalForLead(lead)}</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {lead.tags.slice(0, 5).map((tag) => (
            <span key={tag} className="rounded-md bg-[#F4F1EC] px-2 py-1 text-[11px] text-[#625A52]">{tag}</span>
          ))}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-1.5">
          <button type="button" onClick={() => onStatusChange({ action: isSaved ? undefined : "saved" })} className={`rounded-md border px-2 py-1.5 text-[11px] font-medium ${isSaved ? "border-[#171717] bg-[#171717] text-white" : "border-[#E3DED7] text-[#4B453F]"}`}>{isSaved ? "Saved" : "Save"}</button>
          <button type="button" onClick={() => onStatusChange({ action: isRejected ? undefined : "rejected" })} className={`rounded-md border px-2 py-1.5 text-[11px] font-medium ${isRejected ? "border-[#A35F2E] bg-[#FFF2E8] text-[#A35F2E]" : "border-[#E3DED7] text-[#4B453F]"}`}>{isRejected ? "Rejected" : "Reject"}</button>
          <button type="button" onClick={() => onStatusChange({ preference: status?.preference === "more_like_this" ? undefined : "more_like_this" })} className={`rounded-md border px-2 py-1.5 text-[11px] font-medium ${status?.preference === "more_like_this" ? "border-[#108A4B] bg-[#EEF8F1] text-[#108A4B]" : "border-[#E3DED7] text-[#4B453F]"}`}>More like this</button>
          <button type="button" onClick={() => onStatusChange({ preference: status?.preference === "less_like_this" ? undefined : "less_like_this" })} className={`rounded-md border px-2 py-1.5 text-[11px] font-medium ${status?.preference === "less_like_this" ? "border-[#B87A4A] bg-[#FFF2E8] text-[#A35F2E]" : "border-[#E3DED7] text-[#4B453F]"}`}>Less like this</button>
        </div>
      </div>
    </details>
  );
}

type MarketSegment = {
  label: string;
  value: number;
  color: string;
};

type MarketIntelSnapshot = {
  scopeTitle: string;
  nonNegotiables: string[];
  driftLine: string;
  poolSize: "Broad" | "Moderate" | "Narrow" | "Forming";
  dataLabel: "Directional" | "Early read" | "Pending";
  locationMix: MarketSegment[];
  seniorityMix: MarketSegment[];
  compRange: string;
  timeToFill: string;
  founderTakeaway: string;
};

function emptyMarketIntelSnapshot(): MarketIntelSnapshot {
  return {
    scopeTitle: MARKET_INTEL_FORMING_TITLE,
    nonNegotiables: [],
    driftLine: "",
    poolSize: "Forming",
    dataLabel: "Pending",
    locationMix: [],
    seniorityMix: [],
    compRange: "Not estimated yet",
    timeToFill: "Not estimated yet",
    founderTakeaway: "No market reality read yet."
  };
}

function buildMarketIntelSnapshot(
  canonicalSearchState: CanonicalSearchState,
  brainState: BrainState,
  sourcingStrategy: SourcingStrategy,
  items: ProfileLeadItem[],
  messages: TinaMvpMessage[] = [],
  currentRead?: CurrentRead
): MarketIntelSnapshot {
  const leads = items.map((item) => item.lead);
  const conversationText = messages.map((message) => message.content).join(" ").toLowerCase();
  const hasMarketSignal = canonicalSearchState.evidenceLevel !== "none" || leads.length > 0 || brainState.sourcingReadiness !== "not_ready" || brainState.readinessScore > 20;

  if (!hasMarketSignal) {
    return emptyMarketIntelSnapshot();
  }

  const thesisTitle = titleFromCurrentReadValue(currentRead);
  const scopeTitle = thesisTitle
    ? thesisTitle
    : canonicalSearchState.roleTitle && canonicalSearchState.roleTitle !== "Role forming"
    ? canonicalSearchState.roleTitle
    : marketScopeTitle(brainState, sourcingStrategy);
  const nonNegotiables = currentRead?.calibratedScope.length
    ? currentRead.calibratedScope.slice(0, 3)
    : canonicalSearchState.mustHaveSignals.slice(0, 3);
  const poolSize = canonicalSearchState.talentPoolSize !== "Forming"
    ? canonicalSearchState.talentPoolSize
    : inferPoolSize(brainState, leads, sourcingStrategy, conversationText);
  const locationMix = buildLocationMix(leads, conversationText, canonicalSearchState.location);
  const seniorityMix = buildSeniorityMix(leads, sourcingStrategy, canonicalSearchState.seniority);
  const compRange = canonicalSearchState.compensation !== "Comp forming"
    ? normalizeMarketStat(canonicalSearchState.compensation)
    : inferMarketCompRange(leads, sourcingStrategy, conversationText);
  const timeToFill = canonicalSearchState.timeToFill !== "TTF forming"
    ? normalizeMarketStat(canonicalSearchState.timeToFill)
    : inferTimeToFill(poolSize, seniorityMix, brainState, conversationText);
  const dataLabel = leads.length >= 3 ? "Directional" : leads.length || locationMix.length ? "Early read" : "Pending";

  return {
    scopeTitle,
    nonNegotiables,
    driftLine: currentRead ? "" : inferCanonicalDrift(canonicalSearchState, sourcingStrategy),
    poolSize,
    dataLabel,
    locationMix,
    seniorityMix,
    compRange,
    timeToFill,
    founderTakeaway: buildFounderTakeaway(poolSize, locationMix, seniorityMix, compRange, timeToFill, leads, conversationText, canonicalSearchState)
  };
}

function normalizeMarketStat(value: string) {
  if (/directional/i.test(value) || /pending|forming|ok/i.test(value)) return value;
  return `${value} · Directional`;
}

function inferCanonicalDrift(canonicalSearchState: CanonicalSearchState, sourcingStrategy: SourcingStrategy) {
  const fallback = inferScopeDrift(sourcingStrategy);
  if (!fallback || canonicalSearchState.roleTitle === MARKET_INTEL_FORMING_TITLE || canonicalSearchState.roleTitle === "Role forming") return "";
  if (fallback.toLowerCase().includes(canonicalSearchState.roleTitle.toLowerCase())) return fallback;
  return "";
}

function marketScopeTitle(brainState: BrainState, sourcingStrategy: SourcingStrategy) {
  const title = sourcingStrategy.targetTitles[0] || brainState.likelyTitles[0] || "";
  if (title) return compactLeadText(title, 48);
  if (brainState.roleThesis && brainState.roleThesis !== MARKET_INTEL_FORMING_TITLE && brainState.roleThesis !== "Role draft forming") return compactLeadText(brainState.roleThesis, 48);
  return MARKET_INTEL_FORMING_TITLE;
}

function inferScopeDrift(sourcingStrategy: SourcingStrategy) {
  const titles = sourcingStrategy.targetTitles.filter(Boolean);
  if (titles.length < 2) return "";
  const first = compactLeadText(titles[0], 26);
  const second = compactLeadText(titles[1], 26);
  if (!first || !second || first === second) return "";
  return `${first} > ${second}`;
}

function inferPoolSize(brainState: BrainState, leads: ProfileLead[], sourcingStrategy: SourcingStrategy, conversationText = ""): MarketIntelSnapshot["poolSize"] {
  if (!leads.length && brainState.sourcingReadiness === "not_ready") return "Forming";
  const text = `${conversationText} ${brainState.roleThesis} ${sourcingStrategy.searchThesis} ${sourcingStrategy.mustHaveSignals.join(" ")} ${sourcingStrategy.queryTerms.join(" ")}`.toLowerCase();
  const narrowSignals = [
    /\bfounding|principal|staff|solidity|smart contract|nlp|security|compliance|fintech|peoria|healthcare|medical device|pharma|regulated|fda|local\b/.test(text),
    brainState.missingSignals.length >= 2,
    leads.length > 0 && leads.length < 5
  ].filter(Boolean).length;
  if (narrowSignals >= 2) return "Narrow";
  if (leads.length >= 8 || brainState.readinessScore > 82) return "Moderate";
  return leads.length || brainState.readinessScore > 55 ? "Moderate" : "Forming";
}

function buildLocationMix(leads: ProfileLead[], conversationText = "", canonicalLocation = ""): MarketSegment[] {
  const explicitLocation = canonicalLocation && !/forming/i.test(canonicalLocation) ? canonicalLocation : inferConversationLocation(conversationText);
  if (explicitLocation) return [{ label: explicitLocation, value: 100, color: "#178A52" }];
  if (leads.length < 3) return [];
  const buckets = leads.map((lead) => inferLocationBucket(lead)).filter(Boolean);
  return valuesToSegments(buckets, ["#178A52", "#7D6BF2", "#D58B39"]).slice(0, 3);
}

function inferConversationLocation(text: string) {
  if (/\bpeoria\b/.test(text)) return "Peoria, IL";
  if (/\bsf|san francisco|bay area\b/.test(text)) return "SF";
  if (/\bnyc|new york\b/.test(text)) return "NYC";
  if (/\bchicago\b/.test(text)) return "Chicago";
  if (/\bindianapolis\b/.test(text)) return "Indianapolis";
  if (/\bremote\b/.test(text) && !/\b(don't want remote|dont want remote|not remote|no remote|strictly local)\b/.test(text)) return "Remote";
  return "";
}

function inferLocationBucket(lead: ProfileLead) {
  const text = `${lead.title} ${lead.snippet} ${lead.calibration?.location || ""}`.toLowerCase();
  if (/\b(sf|san francisco|bay area|palo alto|menlo park|mountain view|san jose)\b/.test(text)) return "SF";
  if (/\b(nyc|new york|brooklyn|manhattan)\b/.test(text)) return "NYC";
  if (/\b(seattle|bellevue)\b/.test(text)) return "Seattle";
  if (/\b(austin)\b/.test(text)) return "Austin";
  if (/\b(boston|cambridge)\b/.test(text)) return "Boston";
  if (/\b(canada|toronto|vancouver|montreal)\b/.test(text)) return "Canada";
  if (/\b(remote|distributed)\b/.test(text)) return "Remote";
  return "Remote/Other";
}

function buildSeniorityMix(leads: ProfileLead[], sourcingStrategy: SourcingStrategy, canonicalSeniority = ""): MarketSegment[] {
  void sourcingStrategy;
  if (canonicalSeniority && !/forming/i.test(canonicalSeniority)) return [{ label: canonicalSeniority, value: 100, color: "#178A52" }];
  if (leads.length < 3) return [];
  const values = leads.length ? leads.map(inferSeniorityBucket) : [];
  return valuesToSegments(values.filter(Boolean), ["#178A52", "#D58B39", "#7D6BF2"]).slice(0, 3);
}

function inferSeniorityBucket(lead: ProfileLead) {
  const text = `${lead.title} ${lead.snippet} ${lead.fitReason} ${lead.tags.join(" ")}`.toLowerCase();
  return inferSeniorityBucketFromText(text);
}

function inferSeniorityBucketFromText(value: string) {
  const text = value.toLowerCase();
  if (/\b(chief|vp|c-level|cfo|cto|coo|exec|head of)\b/.test(text)) return "Exec";
  if (/\b(founding|principal|staff)\b/.test(text)) return "Founding / Principal";
  if (/\b(senior|lead|manager|architect)\b/.test(text)) return "Senior";
  if (/\b(junior|associate|entry)\b/.test(text)) return "Junior";
  return "Mid";
}

function valuesToSegments(values: string[], colors: string[]): MarketSegment[] {
  if (!values.length) return [];
  const counts = values.reduce<Record<string, number>>((acc, value) => {
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
  const total = values.length;

  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([label, count], index) => ({
      label,
      value: Math.max(8, Math.round((count / total) * 100)),
      color: colors[index % colors.length]
    }));
}

function inferMarketCompRange(leads: ProfileLead[], sourcingStrategy: SourcingStrategy, conversationText = "") {
  if (/\b(market comp is fine|comp is fine|budget is fine|pay market|competitive comp|can pay market)\b/.test(conversationText)) return "Market comp OK";
  const leadComp = leads.map((lead) => lead.calibration?.compRange).find(Boolean);
  if (leadComp) return `${leadComp} · Directional`;
  const text = `${sourcingStrategy.searchThesis} ${sourcingStrategy.targetTitles.join(" ")}`.toLowerCase();
  if (/\b(staff|principal|founding|head|senior)\b/.test(text)) return "$220k-$300k+ · Directional";
  if (/\bengineer|product manager|pm|designer\b/.test(text)) return "$160k-$240k · Directional";
  return "Comp: pending";
}

function inferTimeToFill(poolSize: MarketIntelSnapshot["poolSize"], seniorityMix: MarketSegment[], brainState: BrainState, conversationText = "") {
  const seniorHeavy = seniorityMix.some((segment) => /founding|principal|exec/i.test(segment.label) && segment.value >= 25);
  if (poolSize === "Forming" || brainState.sourcingReadiness === "not_ready") return "Not estimated yet";
  if (/\b(asap|urgent|rapid|quick|fast|immediately)\b/.test(conversationText)) return "ASAP search · Directional";
  if (poolSize === "Narrow" || seniorHeavy) return "10-16 wks · Directional";
  if (poolSize === "Moderate") return "8-12 wks · Directional";
  return "6-10 wks · Directional";
}

function buildFounderTakeaway(
  poolSize: MarketIntelSnapshot["poolSize"],
  locationMix: MarketSegment[],
  seniorityMix: MarketSegment[],
  compRange: string,
  timeToFill: string,
  leads: ProfileLead[],
  conversationText = "",
  canonicalSearchState?: CanonicalSearchState
) {
  if (canonicalSearchState?.roleFamily === "manufacturing operations" && /peoria/i.test(canonicalSearchState.location)) return "Peoria is a narrow local market; nearby hubs or relocation will likely matter.";
  if (isEngineeringLeadershipState(canonicalSearchState) && canonicalSearchState?.location && !/forming/i.test(canonicalSearchState.location)) return `${canonicalSearchState.location} is the current lane; keep proof tied to engineering leadership, technical judgment, and team operating cadence.`;
  if (canonicalSearchState?.roleFamily === "engineering" && canonicalSearchState.location && !/forming/i.test(canonicalSearchState.location)) return `${canonicalSearchState.location} is the current lane; keep proof tied to actual building work.`;
  if (/\bpeoria\b/.test(conversationText)) return "Peoria is a narrow local market; nearby hubs or relocation will likely matter.";
  if (!leads.length && locationMix.length) return `${locationMix[0].label} is the stated search market; profile evidence is still pending.`;
  if (!leads.length) return "No market reality read yet.";
  if (!locationMix.length || !seniorityMix.length) return "Market mix is still forming; this batch is useful for calibration, not market conclusions.";
  const topLocations = locationMix.slice(0, 2).map((segment) => segment.label).join(" + ");
  const senior = seniorityMix[0]?.label || "Senior";
  if (poolSize === "Narrow") return `${topLocations || "Remote"} looks strongest; budget and timeline need room for ${senior.toLowerCase()} proof.`;
  if (compRange.includes("pending")) return `${topLocations || "Remote"} is the first market to test; comp still needs calibration.`;
  return `${topLocations || "Remote"} is the cleanest first lane; ${timeToFill.replace("TTF: ", "").replace(" · Directional", "")} is a realistic early read.`;
}

function isEngineeringLeadershipState(state?: CanonicalSearchState) {
  return state?.roleFamily === "engineering" &&
    /\b(head of engineering|vp engineering|engineering manager|engineering leadership|director of engineering)\b/i.test(state.roleTitle);
}

function donutGradient(segments: MarketSegment[]) {
  let cursor = 0;
  return segments.map((segment) => {
    const start = cursor;
    cursor += segment.value;
    return `${segment.color} ${start}% ${Math.min(cursor, 100)}%`;
  }).join(", ");
}

function profileMatchScore(lead: ProfileLead) {
  if (lead.confidence === "high") return 92;
  if (lead.confidence === "medium") return 84;
  return 72;
}

function profileSignalLine(lead: ProfileLead) {
  const tags = lead.tags.slice(0, 2).join(" ");
  if (tags) return compactLeadText(`${tags} signal`, 56);
  return compactLeadText(lead.fitReason || lead.snippet, 56);
}

function candidateEvidenceLabel(lead: ProfileLead) {
  if (lead.evidenceLevel === "synthetic") return "Synthetic example";
  if (lead.evidenceLevel === "verified_public") return "Verified public lead";
  return "Unverified lead";
}

function actionProgressText(content: string) {
  const text = content.toLowerCase();
  if (isPlanningArtifactRequest(content)) return "Building the requested artifact...";
  if (/\b(refine|more like|talent pool feedback|example shape|archetype feedback)\b/.test(text)) return "Refining example shapes...";
  if (/\b(search real profiles|public profiles|linkedin profiles|source candidates)\b/.test(text)) return "Searching public profiles...";
  if (/\b(candidate|profile|people|pull|find)\b/.test(text)) return "Building example shapes...";
  if (/\b(source lanes|sourcing strategy|search strategy|sourcing plan|search plan|build search lanes)\b/.test(text)) return "Building the requested artifact...";
  return "Updating the read...";
}

function isPlanningArtifactRequest(value: string) {
  return /\b(hiring thesis|must[-\s]?have signals?|signal map|scorecard|candidate archetype|interview plan|criteria|rubric|role shape|tradeoffs?|pressure[-\s]?test market|market reality|source lanes|sourcing strategy|search strategy|sourcing plan|search plan|time[-\s]?to[-\s]?fill|ttf)\b/i.test(value);
}

function initialsForName(name: string) {
  const parts = name.replace(/[^A-Za-z\s]/g, " ").split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] || "T") + (parts[1]?.[0] || "");
}

function TalentPoolRail({
  brainState,
  sourcingStrategy,
  items,
  latestItems,
  statuses,
  onProfileLeadStatusChange,
  onRefineSearch,
  batchRead,
  sourcingBatch,
  feedbackRead,
  hasFeedback,
  refineLabel
}: {
  brainState: BrainState;
  sourcingStrategy: SourcingStrategy;
  items: ProfileLeadItem[];
  latestItems: ProfileLeadItem[];
  statuses: Record<string, ProfileLeadStatus>;
  onProfileLeadStatusChange: (leadId: string, status: ProfileLeadStatus) => void;
  onRefineSearch: () => void;
  batchRead: string;
  sourcingBatch?: SourcingBatchMetadata;
  feedbackRead: string;
  hasFeedback: boolean;
  refineLabel: string;
}) {
  const latestKeys = new Set(latestItems.map((item) => item.statusKey));
  const sortedItems = prioritizePotentialCandidateItems(items, statuses);
  const batchReadSummary = limitSentences(`${brainState.tinaRead} ${batchReadDetail(batchRead)}`, 2);

  return (
    <div className="grid gap-3">
      <section className="min-w-0 overflow-hidden rounded-lg border border-[#DCD3C8] bg-[#FFFCF7] p-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#8A8178]">Batch read</p>
        <p className="mt-2 text-sm font-semibold text-[#171717]">{items.length} {items.length === 1 ? "profile" : "profiles"}</p>
          </div>
          {hasFeedback ? (
            <button
              type="button"
              onClick={onRefineSearch}
              className="shrink-0 rounded-md bg-[#171717] px-2.5 py-1.5 text-[11px] font-medium text-white"
            >
              {refineLabel}
            </button>
          ) : null}
        </div>
        {sourcingBatch ? (
          <p className="mt-2 rounded-md bg-white px-2 py-1.5 text-[11px] font-medium text-[#6F675E] ring-1 ring-[#E7DDD1]">
            {sourcingBatch.requestedCount} requested · {sourcingBatch.validCount} valid · {sourcingBatch.filteredCount} filtered
          </p>
        ) : null}
        <p className="mt-2 text-xs leading-5 text-[#4B453F]">{batchReadSummary}</p>
        {feedbackRead ? <p className="mt-2 text-xs leading-5 text-[#4A6A4D]">{feedbackRead}</p> : null}
      </section>

      <div className="grid gap-2">
        {sortedItems.map((item) => (
          <TalentPoolLeadRow
            key={item.statusKey}
            item={item}
            isLatest={latestKeys.has(item.statusKey)}
            status={statuses[item.statusKey]}
            onStatusChange={(status) => onProfileLeadStatusChange(item.statusKey, status)}
          />
        ))}
      </div>

      {sourcingBatch?.filteredCount ? (
        <details className="rounded-lg border border-[#E7DDD1] bg-white p-3">
          <summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.14em] text-[#8A8178]">Filtered out</summary>
          <p className="mt-2 text-xs leading-5 text-[#625A52]">
            Tina filtered {sourcingBatch.filteredCount} false {sourcingBatch.filteredCount === 1 ? "positive" : "positives"} before showing this batch: {sourcingBatch.filteredReasons.join(", ") || "role/function mismatch"}.
          </p>
        </details>
      ) : null}

      <details className="rounded-lg border border-[#E7DDD1] bg-white p-3">
        <summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.14em] text-[#8A8178]">Why Tina searched this way</summary>
        <div className="mt-3">
          <SourcingStrategyCard strategy={sourcingStrategy} brainState={brainState} />
        </div>
      </details>

      <details className="rounded-lg border border-[#E7DDD1] bg-white p-3">
        <summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.14em] text-[#8A8178]">Missing signals</summary>
        <div className="mt-2">
          <StrategyRow label="Missing" items={brainState.missingSignals.slice(0, 5)} tone="warning" />
        </div>
      </details>

      <details className="rounded-lg border border-[#E7DDD1] bg-white p-3">
        <summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.14em] text-[#8A8178]">Source lanes</summary>
        <div className="mt-2">
          <StrategyRow label="Lanes" items={sourceLaneChips(brainState.sourceLanes)} />
        </div>
      </details>
    </div>
  );
}

function TalentPoolLeadRow({
  item,
  isLatest,
  status,
  onStatusChange
}: {
  item: ProfileLeadItem;
  isLatest: boolean;
  status?: ProfileLeadStatus;
  onStatusChange: (status: ProfileLeadStatus) => void;
}) {
  const lead = item.lead;
  const isSaved = status?.action === "saved";
  const isRejected = status?.action === "rejected";
  const whySurfaced = compactLeadText(lead.fitReason, 92);
  const missingSignal = compactLeadText(missingSignalForLead(lead), 92);

  return (
    <details className={`min-w-0 overflow-hidden rounded-lg border bg-white p-3 ${isRejected ? "border-[#E2D6CC] opacity-70" : "border-[#E5E2DD]"} ${isLatest ? "ring-1 ring-[#E7DDD1]" : ""}`}>
      <summary className="cursor-pointer list-none">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-[#171717]">{lead.title}</p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              <span className="rounded-full bg-[#EEF8F1] px-2 py-0.5 text-[10px] capitalize text-[#4F7A5C]">{lead.source.replace("_", " ")}</span>
              <span className="rounded-full bg-[#F3EFE8] px-2 py-0.5 text-[10px] capitalize text-[#6F675E]">{lead.confidence}</span>
              {isSaved ? <span className="rounded-full bg-[#EEF8F1] px-2 py-0.5 text-[10px] text-[#108A4B]">Saved</span> : null}
              {isRejected ? <span className="rounded-full bg-[#FFF2E8] px-2 py-0.5 text-[10px] text-[#A35F2E]">Rejected</span> : null}
            </div>
          </div>
        </div>
        <p className="mt-2 break-words text-xs leading-5 text-[#4B453F]">{whySurfaced}</p>
        <p className="mt-1 break-words text-[11px] leading-4 text-[#8A8178]">{missingSignal}</p>
        <div className="mt-2 grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              onStatusChange({ action: isSaved ? undefined : "saved" });
            }}
            className={`rounded-md border px-2 py-1.5 text-[11px] font-medium ${isSaved ? "border-[#171717] bg-[#171717] text-white" : "border-[#E3DED7] text-[#4B453F]"}`}
          >
            {isSaved ? "Saved" : "Save"}
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              onStatusChange({ action: isRejected ? undefined : "rejected" });
            }}
            className={`rounded-md border px-2 py-1.5 text-[11px] font-medium ${isRejected ? "border-[#A35F2E] bg-[#FFF2E8] text-[#A35F2E]" : "border-[#E3DED7] text-[#4B453F]"}`}
          >
            {isRejected ? "Rejected" : "Reject"}
          </button>
        </div>
      </summary>

      <div className="mt-3 min-w-0 border-t border-[#EFE8DF] pt-3 text-xs leading-5 text-[#4B453F]">
        <p className="break-words"><span className="font-semibold">Why surfaced:</span> {lead.fitReason}</p>
        <p className="mt-1 break-words"><span className="font-semibold">Evidence/proof:</span> {leadEvidenceLine(lead)}</p>
        <p className="mt-1 break-words"><span className="font-semibold">Missing signal:</span> {missingSignalForLead(lead)}</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {lead.tags.slice(0, 5).map((tag) => (
            <span key={tag} className="rounded-md bg-[#F4F1EC] px-2 py-1 text-[11px] text-[#625A52]">{tag}</span>
          ))}
        </div>
        <p className="mt-2 break-words"><span className="font-semibold">Query:</span> {lead.query}</p>
        <div className="mt-3 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          <a href={lead.url} target="_blank" rel="noreferrer" className="rounded-md border border-[#E3DED7] px-2 py-1.5 text-center text-[11px] font-medium text-[#4B453F]">Open</a>
          <button type="button" onClick={() => onStatusChange({ preference: status?.preference === "more_like_this" ? undefined : "more_like_this" })} className={`rounded-md border px-2 py-1.5 text-[11px] font-medium ${status?.preference === "more_like_this" ? "border-[#108A4B] bg-[#EEF8F1] text-[#108A4B]" : "border-[#E3DED7] text-[#4B453F]"}`}>More like this</button>
          <button type="button" onClick={() => onStatusChange({ preference: status?.preference === "less_like_this" ? undefined : "less_like_this" })} className={`rounded-md border px-2 py-1.5 text-[11px] font-medium ${status?.preference === "less_like_this" ? "border-[#B87A4A] bg-[#FFF2E8] text-[#A35F2E]" : "border-[#E3DED7] text-[#4B453F]"}`}>Less like this</button>
        </div>
      </div>
    </details>
  );
}

function CalibrationIntelligenceTab({
  hasConversation,
  calibration,
  latestSynthesis,
  snapshot
}: {
  hasConversation: boolean;
  calibration: LiveCalibration;
  latestSynthesis: string;
  snapshot: PipelineSnapshot;
}) {
  return (
    <div className="grid gap-3">
      <section className="rounded-lg border border-[#E5E2DD] bg-white p-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#8A8178]">Calibration snapshot</p>
            <p className="mt-2.5 text-[13px] font-medium text-[#171717]">
              {hasConversation ? "Role signal is forming." : "Waiting for the first role signal."}
            </p>
            <p className="mt-1 text-[11px] leading-4 text-[#6F675E]">
              {hasConversation ? trimInsight(latestSynthesis) : "Start with the outcome this person should unlock."}
            </p>
          </div>
          <AlignmentRing value={calibration.clarity} />
        </div>
      </section>

      <LiveJdCard calibration={calibration} />

      <section className="rounded-lg border border-[#E5E2DD] bg-white p-3">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-[#8A8178]">Hiring tension</p>
        <div className="grid gap-3">
          {calibration.tensions.slice(0, 4).map((tension) => (
            <TensionSlider key={`${tension.left}-${tension.right}`} {...tension} />
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-[#E5E2DD] bg-[#FBFAF7] p-3">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#8A8178]">Tina recommendation</p>
        <p className="mt-2 text-[13px] font-semibold leading-5 text-[#171717]">{trimInsight(snapshot.recommendation)}</p>
        <p className="mt-2 text-xs leading-5 text-[#625A52]">{snapshot.briefing.next}</p>
      </section>
    </div>
  );
}

function MarketIntelTab({
  calibration,
  profiles,
  snapshot
}: {
  calibration: LiveCalibration;
  profiles: ReturnType<typeof deriveCalibrationProfiles>;
  snapshot: PipelineSnapshot;
}) {
  const primaryProfile = profiles[0];

  return (
    <div className="grid gap-3">
      <section className="rounded-lg border border-[#E5E2DD] bg-white p-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#8A8178]">Market reality</p>
            <h3 className="mt-2 text-sm font-semibold text-[#171717]">{calibration.marketPressure} pressure</h3>
          </div>
          <Activity className="h-4 w-4 text-[#108A4B]" />
        </div>
        <p className="mt-3 text-xs leading-5 text-[#625A52]">{marketPressureInterpretation(calibration)}</p>
      </section>

      <div className="grid grid-cols-3 overflow-hidden rounded-lg border border-[#E5E2DD] bg-white">
        <MarketMetric label="Talent supply" value={calibration.poolImpact} note={primaryProfile?.marketDensity || "Forming"} />
        <MarketMetric label="Comp range" value={primaryProfile?.comp || "TBD"} note="Rough calibration" />
        <MarketMetric label="Time to fill" value={primaryProfile?.timeToFill || "TBD"} note="+/- market fit" />
      </div>

      <section className="rounded-lg border border-[#E5E2DD] bg-white p-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#8A8178]">Sourcing keywords</p>
        <div className="flex flex-wrap gap-1.5">
          {calibration.keywords.slice(0, 8).map((keyword) => (
            <span key={keyword} className="rounded-md bg-[#F4F1EC] px-2.5 py-1 text-xs text-[#625A52]">
              {keyword}
            </span>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-[#E5E2DD] bg-[#FBFAF7] p-3">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#8A8178]">What to ignore</p>
        <p className="mt-2 text-sm leading-5 text-[#4B453F]">{snapshot.briefing.ignore}</p>
      </section>
    </div>
  );
}

function TalentPoolTab({
  hasConversation,
  profiles,
  calibration,
  sourcingReadiness,
  sourcingStrategy,
  brainState,
  profileLeadItems,
  latestProfileLeadItems,
  profileLeadStatus,
  onProfileLeadStatusChange,
  onRefineSearch,
  latestSynthesis,
  snapshot
}: {
  hasConversation: boolean;
  profiles: ReturnType<typeof deriveCalibrationProfiles>;
  calibration: LiveCalibration;
  sourcingReadiness: SourcingReadiness;
  sourcingStrategy: SourcingStrategy;
  brainState: BrainState;
  profileLeadItems: ProfileLeadItem[];
  latestProfileLeadItems: ProfileLeadItem[];
  profileLeadStatus: Record<string, ProfileLeadStatus>;
  onProfileLeadStatusChange: (leadId: string, status: ProfileLeadStatus) => void;
  onRefineSearch: (summary: string) => void;
  latestSynthesis: string;
  snapshot: PipelineSnapshot;
}) {
  const visibleProfiles = profiles.slice(0, calibration.depth >= 3 ? 3 : 2);
  const visibleItems = prioritizeLatestProfileLeadItems(profileLeadItems, latestProfileLeadItems);
  const shortlistedItems = profileLeadItems.filter((item) => profileLeadStatus[item.statusKey]?.action === "saved");
  const potentialItems = prioritizePotentialCandidateItems(
    visibleItems.filter((item) => profileLeadStatus[item.statusKey]?.action !== "saved"),
    profileLeadStatus
  );
  const hasFeedback = latestProfileLeadItems.some((item) => hasProfileLeadFeedback(profileLeadStatus[item.statusKey]));
  const feedbackRead = buildFeedbackLearningRead(latestProfileLeadItems, profileLeadStatus);
  const refineLabel = shortlistedItems.length ? "Turn saved shapes into a sourcing brief" : "Refine Example Shapes";
  const handleRefineSearch = () => {
    const summary = buildTalentPoolFeedbackSummary(latestProfileLeadItems, profileLeadStatus);
    if (summary) onRefineSearch(summary);
  };

  if (visibleItems.length) {
    const latestBatchRead = buildTalentBatchRead(latestProfileLeadItems.length ? latestProfileLeadItems : visibleItems);

    return (
      <div className="grid gap-3">
        <SourcingStrategyCard strategy={sourcingStrategy} brainState={brainState} />

        <CandidateResultsSection
          brainState={brainState}
          count={latestProfileLeadItems.length || visibleItems.length}
          hasFeedback={hasFeedback}
          refineLabel={refineLabel}
          onRefineSearch={handleRefineSearch}
          batchRead={latestBatchRead}
          feedbackRead={feedbackRead}
        >
          {potentialItems.map((item) => (
            <ProfileLeadCard
              key={item.statusKey}
              lead={item.lead}
              status={profileLeadStatus[item.statusKey]}
              onStatusChange={(status) => onProfileLeadStatusChange(item.statusKey, status)}
            />
          ))}
        </CandidateResultsSection>

        <ShortlistSection
          items={shortlistedItems}
          statuses={profileLeadStatus}
          onRemove={(statusKey) => onProfileLeadStatusChange(statusKey, { action: undefined })}
        />

        <RoleMemorySection calibration={calibration} strategy={sourcingStrategy} brainState={brainState} latestSynthesis={latestSynthesis} defaultOpen={hasConversation && calibration.depth >= 3} />

        <MarketRealitySection calibration={calibration} profiles={profiles} strategy={sourcingStrategy} brainState={brainState} snapshot={snapshot} defaultOpen={false} />
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      <SourcingStrategyCard strategy={sourcingStrategy} brainState={brainState} />

      <EmptyCandidateResults />

      <details className="rounded-lg border border-[#E5E2DD] bg-white p-3">
        <summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.14em] text-[#8A8178] marker:text-[#8A8178]">
          Search lane examples
        </summary>
        <div className="mt-3 grid gap-3">
          {visibleProfiles.map((profile) => (
            <ArchetypeCalibrationCard key={profile.title} profile={profile} />
          ))}
        </div>
      </details>

      <ShortlistSection
        items={shortlistedItems}
        statuses={profileLeadStatus}
        onRemove={(statusKey) => onProfileLeadStatusChange(statusKey, { action: undefined })}
      />

      <RoleMemorySection calibration={calibration} strategy={sourcingStrategy} brainState={brainState} latestSynthesis={latestSynthesis} defaultOpen={false} />

      <MarketRealitySection calibration={calibration} profiles={profiles} strategy={sourcingStrategy} brainState={brainState} snapshot={snapshot} defaultOpen={false} />
    </div>
  );
}

function MainCandidateResults({
  brainState,
  count,
  hasFeedback,
  refineLabel,
  onRefineSearch,
  batchRead,
  feedbackRead,
  shortlistedItems,
  profileLeadStatus,
  onProfileLeadStatusChange,
  potentialItems
}: {
  brainState: BrainState;
  count: number;
  hasFeedback: boolean;
  refineLabel: string;
  onRefineSearch: () => void;
  batchRead: string;
  feedbackRead: string;
  shortlistedItems: ProfileLeadItem[];
  profileLeadStatus: Record<string, ProfileLeadStatus>;
  onProfileLeadStatusChange: (leadId: string, status: ProfileLeadStatus) => void;
  potentialItems: ProfileLeadItem[];
}) {
  const batchReadSummary = limitSentences(`${brainState.tinaRead} ${batchReadDetail(batchRead)}`, 2);

  return (
    <section className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-[#E2DDD6] bg-white shadow-[0_24px_80px_rgba(23,23,23,0.07)]">
      <div className="flex flex-col gap-3 border-b border-[#ECE7E1] bg-[#FFFCF7] px-4 py-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#8A8178]">Candidate Results</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold leading-tight text-[#171717]">Potential Candidates</h2>
            <span className="rounded-full bg-[#F3EFE8] px-2.5 py-1 text-xs font-medium text-[#6F675E]">
              {count} {count === 1 ? "lead" : "leads"}
            </span>
          </div>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#4B453F]">{batchReadSummary}</p>
          {feedbackRead ? <p className="mt-1 text-xs leading-5 text-[#4A6A4D]">{feedbackRead}</p> : null}
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <MiniScore label="Quality" value={brainState.batchQualityScore} />
          <MiniScore label="Novelty" value={brainState.noveltyScore} />
          <MiniScore label="Confidence" value={brainState.confidenceScore} />
          {hasFeedback ? (
            <button
              type="button"
              onClick={onRefineSearch}
              className="rounded-md border border-[#CFC4B8] bg-[#171717] px-3 py-2 text-xs font-medium text-white transition hover:bg-[#2A2724]"
            >
              {refineLabel}
            </button>
          ) : null}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {shortlistedItems.length ? (
          <div className="mb-4 rounded-lg border border-[#D7CFC5] bg-[#FBFAF7] p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#8A8178]">Shortlist</p>
                <p className="mt-1 text-sm font-semibold text-[#171717]">Saved candidates</p>
              </div>
              <span className="rounded-full bg-[#EEF8F1] px-2 py-1 text-[11px] font-medium text-[#108A4B]">
                {shortlistedItems.length} saved
              </span>
            </div>
            <p className="mt-2 text-xs leading-5 text-[#4B453F]">{buildShortlistRead(shortlistedItems)}</p>
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              {shortlistedItems.map((item) => (
                <div key={item.statusKey} className="rounded-lg border border-[#E7DDD1] bg-white p-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[#171717]">{item.lead.title}</p>
                      <p className="mt-1 text-[11px] text-[#8A8178]">{displayCompanyFromLead(item.lead)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onProfileLeadStatusChange(item.statusKey, { action: undefined })}
                      className="shrink-0 rounded-md border border-[#E3DED7] bg-white px-2 py-1 text-[11px] font-medium text-[#625A52] transition hover:bg-[#F7F4EF]"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {potentialItems.map((item) => (
            <ProfileLeadCard
              key={item.statusKey}
              lead={item.lead}
              status={profileLeadStatus[item.statusKey]}
              onStatusChange={(status) => onProfileLeadStatusChange(item.statusKey, status)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function ProfileLeadCard({
  lead,
  status,
  onStatusChange
}: {
  lead: ProfileLead;
  status?: ProfileLeadStatus;
  onStatusChange: (status: ProfileLeadStatus) => void;
}) {
  const calibration = lead.calibration;
  const isSaved = status?.action === "saved";
  const isRejected = status?.action === "rejected";
  const sourceLabel = lead.source.replace("_", " ");
  const companyLabel = displayCompanyFromLead(lead);
  const whySurfaced = compactLeadText(lead.fitReason, 140);
  const evidenceLine = leadEvidenceLine(lead);
  const missingSignal = missingSignalForLead(lead);

  return (
    <article
      className={`rounded-xl border p-4 shadow-[0_14px_38px_rgba(23,23,23,0.045)] transition ${
        isRejected ? "border-[#E2D6CC] bg-[#FBF7F3] opacity-75" : "border-[#E5E2DD] bg-white"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-semibold leading-6 text-[#171717]">{lead.title}</h3>
          <p className="mt-1 text-xs leading-5 text-[#8A8178]">{companyLabel}</p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="rounded-full bg-[#EEF8F1] px-2.5 py-1 text-xs capitalize text-[#4F7A5C]">{sourceLabel}</span>
            <span className="rounded-full bg-[#F3EFE8] px-2.5 py-1 text-xs capitalize text-[#6F675E]">{lead.confidence} confidence</span>
            {isRejected ? <span className="rounded-full bg-[#FFF2E8] px-2 py-0.5 text-[11px] text-[#A35F2E]">Rejected</span> : null}
            {isSaved ? <span className="rounded-full bg-[#EEF8F1] px-2 py-0.5 text-[11px] text-[#108A4B]">Saved</span> : null}
          </div>
        </div>
        <a
          href={lead.url}
          target="_blank"
          rel="noreferrer"
          className="shrink-0 rounded-md border border-[#E3DED7] px-2.5 py-1.5 text-xs font-medium text-[#4B453F] hover:bg-[#F7F4EF]"
        >
          Open
        </a>
      </div>

      <div className="mt-4 grid gap-3 rounded-lg bg-[#FBFAF7] p-3 text-sm leading-6">
        <p className="text-[#262626]"><span className="font-semibold">Why surfaced:</span> {whySurfaced}</p>
        <p className="text-[#4B453F]"><span className="font-semibold">Evidence/proof:</span> {evidenceLine}</p>
        <p className="text-[#625A52]"><span className="font-semibold text-[#4B453F]">Missing signal:</span> {missingSignal}</p>
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {lead.tags.slice(0, 5).map((tag) => (
          <span key={tag} className="rounded-md bg-[#F4F1EC] px-2.5 py-1 text-xs text-[#625A52]">
            {tag}
          </span>
        ))}
      </div>

      <details className="mt-3 rounded-lg border border-[#E7DDD1] bg-white">
        <summary className="cursor-pointer px-2.5 py-2 text-[11px] font-medium text-[#5A524A] marker:text-[#8A8178]">
          Details
        </summary>
        <div className="grid gap-2 border-t border-[#EFE8DF] p-2.5 text-[11px] leading-4 text-[#625A52]">
          <p><span className="font-semibold text-[#4B453F]">Source URL:</span> <a href={lead.url} target="_blank" rel="noreferrer" className="text-[#4B28C9] underline-offset-2 hover:underline">{lead.url}</a></p>
          <p><span className="font-semibold text-[#4B453F]">Snippet:</span> {lead.snippet}</p>
          {calibration ? (
            <>
              <p><span className="font-semibold text-[#4B453F]">Scope:</span> {calibration.scope}</p>
              <p><span className="font-semibold text-[#4B453F]">Parsed title:</span> {calibration.roleTitle}</p>
              <p><span className="font-semibold text-[#4B453F]">Location:</span> {calibration.location}</p>
              <p><span className="font-semibold text-[#4B453F]">Experience:</span> {calibration.yearsExperience}</p>
              <p><span className="font-semibold text-[#4B453F]">Must-haves:</span> {calibration.mustHaves.slice(0, 3).join(", ")}</p>
              <p><span className="font-semibold text-[#4B453F]">Nice-to-haves:</span> {calibration.niceToHaves.slice(0, 3).join(", ")}</p>
              <p><span className="font-semibold text-[#4B453F]">Comp:</span> {calibration.compRange}</p>
            </>
          ) : null}
          <p><span className="font-semibold text-[#4B453F]">Query:</span> {lead.query}</p>
        </div>
      </details>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onStatusChange({ action: isSaved ? undefined : "saved" })}
          className={`rounded-md border px-2 py-2 text-xs font-medium transition ${
            isSaved ? "border-[#171717] bg-[#171717] text-white" : "border-[#E3DED7] bg-white text-[#4B453F] hover:bg-[#F7F4EF]"
          }`}
        >
          {isSaved ? "Saved" : "Save"}
        </button>
        <button
          type="button"
          onClick={() => onStatusChange({ action: isRejected ? undefined : "rejected" })}
          className={`rounded-md border px-2 py-2 text-xs font-medium transition ${
            isRejected ? "border-[#A35F2E] bg-[#FFF2E8] text-[#A35F2E]" : "border-[#E3DED7] bg-white text-[#4B453F] hover:bg-[#F7F4EF]"
          }`}
        >
          {isRejected ? "Rejected" : "Reject"}
        </button>
        <button
          type="button"
          onClick={() => onStatusChange({ preference: "more_like_this" })}
          className={`rounded-md border px-2 py-2 text-xs font-medium transition ${
            status?.preference === "more_like_this" ? "border-[#108A4B] bg-[#EEF8F1] text-[#108A4B]" : "border-[#E3DED7] bg-white text-[#4B453F] hover:bg-[#F7F4EF]"
          }`}
        >
          More like this
        </button>
        <button
          type="button"
          onClick={() => onStatusChange({ preference: "less_like_this" })}
          className={`rounded-md border px-2 py-2 text-xs font-medium transition ${
            status?.preference === "less_like_this" ? "border-[#B87A4A] bg-[#FFF2E8] text-[#A35F2E]" : "border-[#E3DED7] bg-white text-[#4B453F] hover:bg-[#F7F4EF]"
          }`}
        >
          Less like this
        </button>
      </div>
    </article>
  );
}

function CandidateResultsSection({
  brainState,
  count,
  hasFeedback,
  refineLabel,
  onRefineSearch,
  batchRead,
  feedbackRead,
  children
}: {
  brainState: BrainState;
  count: number;
  hasFeedback: boolean;
  refineLabel: string;
  onRefineSearch: () => void;
  batchRead: string;
  feedbackRead: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-[#E5E2DD] bg-white p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#8A8178]">Candidate Results</p>
          <h3 className="mt-2 text-sm font-semibold text-[#171717]">Potential Candidates</h3>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {hasFeedback ? (
            <button
              type="button"
              onClick={onRefineSearch}
              className="rounded-md border border-[#CFC4B8] bg-[#171717] px-2 py-1 text-[11px] font-medium text-white transition hover:bg-[#2A2724]"
            >
              {refineLabel}
            </button>
          ) : null}
          <span className="rounded-full bg-[#F3EFE8] px-2 py-1 text-[11px] font-medium text-[#6F675E]">
            {count} {count === 1 ? "lead" : "leads"}
          </span>
        </div>
      </div>
      <p className="mt-1 text-xs leading-5 text-[#625A52]">Actionable candidates from public signals. Review before outreach.</p>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <MiniScore label="Quality" value={brainState.batchQualityScore} />
        <MiniScore label="Novelty" value={brainState.noveltyScore} />
        <MiniScore label="Confidence" value={brainState.confidenceScore} />
      </div>
      <TalentBatchReadCard read={batchRead} />
      {feedbackRead ? <FeedbackLearningCard read={feedbackRead} /> : null}
      <div className="mt-3 grid gap-3">{children}</div>
    </section>
  );
}

function MiniScore({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-[#E7DDD1] bg-[#FBFAF7] p-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-medium uppercase tracking-[0.1em] text-[#8A8178]">{label}</p>
        <span className="text-[11px] font-semibold text-[#262626]">{value}</span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#E9E1D8]">
        <div className="h-full rounded-full bg-[#108A4B]" style={{ width: `${clampPercent(value)}%` }} />
      </div>
    </div>
  );
}

function EmptyCandidateResults() {
  return (
    <section className="rounded-lg border border-dashed border-[#D8CEC2] bg-white p-3">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#8A8178]">Candidate Results</p>
      <h3 className="mt-2 text-sm font-semibold text-[#171717]">No candidates yet.</h3>
      <p className="mt-1 text-xs leading-5 text-[#625A52]">
        Tell Tina who you need, and she’ll build a search brief before pulling profiles.
      </p>
    </section>
  );
}

function FeedbackLearningCard({ read }: { read: string }) {
  return (
    <div className="mt-3 rounded-lg border border-[#DDE9D8] bg-[#F5FBF6] p-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#5F7A61]">Taste signal</p>
      <p className="mt-1.5 text-xs leading-5 text-[#405A43]">{read}</p>
    </div>
  );
}

function RoleMemorySection({
  calibration,
  strategy,
  brainState,
  latestSynthesis,
  defaultOpen
}: {
  calibration: LiveCalibration;
  strategy: SourcingStrategy;
  brainState: BrainState;
  latestSynthesis: string;
  defaultOpen: boolean;
}) {
  const hasSignal = calibration.depth > 0;
  const openQuestions = strategy.readiness.followUpQuestions.length
    ? strategy.readiness.followUpQuestions
    : [calibration.nextAction];

  return (
    <details open={defaultOpen} className="rounded-lg border border-[#E5E2DD] bg-[#FFFCF7] p-3">
      <summary className="cursor-pointer list-none">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#8A8178]">Role Memory</p>
          <h3 className="mt-2 text-sm font-semibold text-[#171717]">Current Role Brief</h3>
        </div>
        <span className="rounded-full bg-white px-2 py-1 text-[11px] font-medium text-[#6F675E] ring-1 ring-[#E5E2DD]">
          {hasSignal ? "Evolving" : "Waiting"}
        </span>
      </div>
      </summary>

      <div className="mt-3 rounded-lg border border-[#E7DDD1] bg-white p-2.5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8A8178]">Role thesis</p>
        <p className="mt-1.5 text-xs leading-5 text-[#4B453F]">{brainState.roleThesis}</p>
      </div>

      <div className="mt-3 rounded-lg border border-[#E7DDD1] bg-white p-2.5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8A8178]">Hiring tension</p>
        <p className="mt-1.5 text-xs leading-5 text-[#4B453F]">{latestSynthesis || calibration.clarityLabel}</p>
      </div>

      <div className="mt-3 grid gap-2">
        <StrategyRow label="Must-have signals" items={strategy.mustHaveSignals.slice(0, 5)} />
        <StrategyRow label="Nice-to-have signals" items={strategy.niceToHaveSignals.slice(0, 5)} />
        <StrategyRow label="Avoid signals" items={brainState.avoidSignals.slice(0, 5)} tone="warning" />
        <StrategyRow label="Open questions" items={(brainState.calibrationQuestions.length ? brainState.calibrationQuestions : openQuestions).slice(0, 3)} tone={brainState.calibrationQuestions.length ? "warning" : "default"} />
      </div>

      <details className="mt-3 rounded-lg border border-[#E7DDD1] bg-white">
        <summary className="cursor-pointer px-2.5 py-2 text-[11px] font-medium text-[#5A524A] marker:text-[#8A8178]">
          Living JD / Current Role Brief
        </summary>
        <div className="border-t border-[#EFE8DF] p-2.5">
          <h4 className="text-sm font-semibold leading-5 text-[#171717]">{titleForLiveJd(calibration)}</h4>
          <p className="mt-2 whitespace-pre-line text-xs leading-5 text-[#4B453F]">
            {hasSignal ? calibration.fullJd : "Waiting to gather more information. Share the outcome, scope, must-haves, and tradeoffs, then Tina will turn it into a working role brief."}
          </p>
        </div>
      </details>
    </details>
  );
}

function ShortlistSection({
  items,
  statuses,
  onRemove
}: {
  items: ProfileLeadItem[];
  statuses: Record<string, ProfileLeadStatus>;
  onRemove: (statusKey: string) => void;
}) {
  return (
    <details open={items.length > 0} className="rounded-lg border border-[#D7CFC5] bg-white p-3 shadow-[0_12px_34px_rgba(23,23,23,0.035)]">
      <summary className="cursor-pointer list-none">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#8A8178]">Shortlist</p>
          <h3 className="mt-2 text-sm font-semibold text-[#171717]">Saved Candidates</h3>
        </div>
        <span className="rounded-full bg-[#EEF8F1] px-2 py-1 text-[11px] font-medium text-[#108A4B]">
          {items.length} saved
        </span>
      </div>
      </summary>

      {items.length ? (
        <ShortlistReadCard read={buildShortlistRead(items)} />
      ) : (
        <p className="mt-3 text-xs leading-5 text-[#625A52]">Saved candidates will collect here when Tina finds profiles worth returning to.</p>
      )}

      {items.length ? <div className="mt-3 grid gap-2">
        {items.map((item) => {
          const lead = item.lead;
          const status = statuses[item.statusKey];
          const outreachReady = lead.confidence === "high" && !missingSignalForLead(lead).toLowerCase().includes("thin");

          return (
            <article key={item.statusKey} className="rounded-lg border border-[#E7DDD1] bg-[#FBFAF7] p-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[#171717]">{lead.title}</p>
                  <p className="mt-1 text-[11px] text-[#8A8178]">{displayCompanyFromLead(lead)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => onRemove(item.statusKey)}
                  className="shrink-0 rounded-md border border-[#E3DED7] bg-white px-2 py-1 text-[11px] font-medium text-[#625A52] transition hover:bg-[#F7F4EF]"
                >
                  Remove
                </button>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <span className={`rounded-full px-2 py-0.5 text-[11px] ${outreachReady ? "bg-[#EEF8F1] text-[#108A4B]" : "bg-[#F3EFE8] text-[#6F675E]"}`}>
                  {outreachReady ? "Outreach-ready signal" : "Calibration signal"}
                </span>
                <span className="rounded-full bg-[#F4F1EC] px-2 py-0.5 text-[11px] capitalize text-[#6F675E]">{lead.confidence} confidence</span>
                {status?.preference === "more_like_this" ? (
                  <span className="rounded-full bg-[#EEF8F1] px-2 py-0.5 text-[11px] text-[#108A4B]">Pattern to repeat</span>
                ) : null}
              </div>
              <p className="mt-2 text-xs leading-5 text-[#4B453F]">{compactLeadText(lead.fitReason, 130)}</p>
            </article>
          );
        })}
      </div> : null}
    </details>
  );
}

function MarketRealitySection({
  calibration,
  profiles,
  strategy,
  brainState,
  snapshot,
  defaultOpen
}: {
  calibration: LiveCalibration;
  profiles: ReturnType<typeof deriveCalibrationProfiles>;
  strategy: SourcingStrategy;
  brainState: BrainState;
  snapshot: PipelineSnapshot;
  defaultOpen: boolean;
}) {
  const primaryProfile = profiles[0];
  const compRange = primaryProfile?.comp || calibration.marketPressure;
  const talentSupply = calibration.poolImpact || snapshot.briefing.marketReality;
  const timeToFill = estimateTimeToFill(calibration, profiles);
  const keywords = uniqueStrings([...strategy.queryTerms, ...brainState.seekSignals, ...calibration.keywords]).slice(0, 6);

  return (
    <details open={defaultOpen} className="rounded-lg border border-[#E5E2DD] bg-white p-3">
      <summary className="cursor-pointer list-none">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#8A8178]">Market Reality</p>
            <h3 className="mt-2 text-sm font-semibold text-[#171717]">Supply behind the search</h3>
          </div>
          <span className="rounded-full bg-[#F3EFE8] px-2 py-1 text-[11px] font-medium text-[#6F675E]">Support</span>
        </div>
      </summary>

      <div className="mt-3 grid gap-2">
        <MarketRealityRow label="Market pressure" value={calibration.marketPressure} />
        <MarketRealityRow label="Talent supply" value={talentSupply} />
        <MarketRealityRow label="Comp range" value={compRange} />
        <MarketRealityRow label="Time to fill" value={timeToFill} />
        <StrategyRow label="Sourcing keywords" items={keywords} />
      </div>
    </details>
  );
}

function MarketRealityRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-[#E7DDD1] bg-[#FBFAF7] p-2">
      <p className="text-[10px] font-medium uppercase tracking-[0.1em] text-[#8A8178]">{label}</p>
      <p className="mt-1 text-xs leading-5 text-[#4B453F]">{value}</p>
    </div>
  );
}

function estimateTimeToFill(calibration: LiveCalibration, profiles: ReturnType<typeof deriveCalibrationProfiles>) {
  const text = `${calibration.roleTitle} ${calibration.jdSummary} ${calibration.marketPressure}`.toLowerCase();
  if (/\b(ai|llm|solidity|smart contract|staff|principal|founding)\b/.test(text)) return "Likely 6-10 weeks if the bar is real.";
  if (profiles[0]?.marketDensity === "low") return "Likely 5-8 weeks; pool is narrow.";
  if (profiles[0]?.marketDensity === "high") return "Likely 3-5 weeks with a tight lane.";
  return "Likely 4-7 weeks, depending on compensation and specificity.";
}

function ShortlistReadCard({ read }: { read: string }) {
  return (
    <div className="mt-3 rounded-lg border border-[#E7DDD1] bg-[#FFFCF7] p-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8A8178]">Tina’s shortlist read</p>
      <p className="mt-1.5 text-xs leading-5 text-[#4B453F]">{read}</p>
    </div>
  );
}

function SourcingStrategyCard({ strategy, brainState }: { strategy: SourcingStrategy; brainState: BrainState }) {
  const sourceLaneItems = sourceLaneChips(brainState.sourceLanes);

  return (
    <section className="rounded-lg border border-[#DCD3C8] bg-[#FBFAF7] p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#8A8178]">Search Brief</p>
          <h3 className="mt-2 text-sm font-semibold text-[#171717]">How Tina is thinking.</h3>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold ${brainReadinessBadgeClass(brainState.sourcingReadiness)}`}>
          {brainReadinessLabel(brainState.sourcingReadiness)}
        </span>
      </div>

      <p className="mt-2 text-xs leading-5 text-[#5A524A]">{brainState.tinaRead}</p>

      <div className="mt-3 rounded-lg border border-[#E7DDD1] bg-white p-2.5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8A8178]">Readiness</p>
          <span className="text-xs font-semibold text-[#262626]">{brainState.readinessScore}</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#E9E1D8]">
          <div className="h-full rounded-full bg-[#108A4B]" style={{ width: `${clampPercent(brainState.readinessScore)}%` }} />
        </div>
      </div>

      <div className="mt-3 grid gap-2">
        <SearchShapeBar label="Ownership" value={brainState.searchShape.ownership} />
        <SearchShapeBar label="Ambiguity" value={brainState.searchShape.ambiguityTolerance} />
        <SearchShapeBar label="Product judgment" value={brainState.searchShape.productJudgment} />
        <SearchShapeBar label="Execution speed" value={brainState.searchShape.executionSpeed} />
        <SearchShapeBar label="Technical depth" value={brainState.searchShape.technicalDepth} />
      </div>

      {brainState.missingSignals.length ? (
        <div className="mt-3 rounded-lg border border-[#F0D8C8] bg-[#FFF8F2] p-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#A35F2E]">Missing signal</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {brainState.missingSignals.slice(0, 4).map((signal) => (
              <span key={signal} className="rounded-md bg-white px-2 py-1 text-[11px] text-[#9A5D31] ring-1 ring-[#F0D8C8]">
                {signal}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-3 grid gap-2">
        <StrategyRow label="Seek" items={brainState.seekSignals.slice(0, 5)} />
        <StrategyRow label="Avoid" items={brainState.avoidSignals.slice(0, 5)} tone="warning" />
        <StrategyRow label="Likely titles" items={brainState.likelyTitles.slice(0, 5)} />
        <StrategyRow label="Source lanes" items={sourceLaneItems} />
      </div>

      <details className="mt-3 rounded-lg border border-[#E7DDD1] bg-white">
        <summary className="flex cursor-pointer items-center gap-1 px-2.5 py-2 text-[11px] font-medium text-[#5A524A] marker:text-[#8A8178]">
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Show details
        </summary>
        <div className="grid gap-2 border-t border-[#EFE8DF] p-2.5">
          <StrategyRow label="Must-have signals" items={strategy.mustHaveSignals.slice(0, 5)} />
          <StrategyRow label="Nice-to-have signals" items={strategy.niceToHaveSignals.slice(0, 5)} />
          <StrategyRow label="Target company types" items={strategy.targetCompanyTypes.slice(0, 5)} />
          <StrategyRow label="Search lanes" items={strategy.searchLanes.slice(0, 5)} />
          <StrategyRow label="Calibration questions" items={brainState.calibrationQuestions.slice(0, 5)} tone="warning" />
          <StrategyRow label="Query terms" items={strategy.queryTerms.slice(0, 5)} />
        </div>
      </details>
    </section>
  );
}

function sourceLaneChips(sourceLanes: BrainState["sourceLanes"]) {
  const labels: Record<keyof BrainState["sourceLanes"], string> = {
    publicWeb: "Public web",
    linkedinLike: "LinkedIn-like",
    github: "GitHub",
    startupAlumni: "Startup alumni",
    blogsTalks: "Blogs/talks"
  };

  return (Object.entries(sourceLanes) as Array<[keyof BrainState["sourceLanes"], BrainState["sourceLanes"][keyof BrainState["sourceLanes"]]]>)
    .filter(([, status]) => status !== "inactive")
    .map(([lane, status]) => `${labels[lane]}: ${status}`);
}

function SearchShapeBar({ label, value }: { label: string; value: number }) {
  const hasSignal = value > 0;

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-[#625A52]">{label}</span>
        <span className="text-[10px] font-medium text-[#8A8178]">{hasSignal ? value : "missing"}</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[#E9E1D8]">
        <div className={`h-full rounded-full ${hasSignal ? "bg-[#178A52]" : "bg-[#D8CEC2]"}`} style={{ width: `${hasSignal ? clampPercent(value) : 8}%` }} />
      </div>
    </div>
  );
}

function readinessLabel(status: SourcingReadiness["readinessStatus"]) {
  if (status === "ready_to_source") return "Ready to source";
  if (status === "low_confidence_search") return "Ready for first pass";
  return "Needs calibration";
}

function readinessBadgeClass(status: SourcingReadiness["readinessStatus"]) {
  if (status === "ready_to_source") return "bg-[#EEF8F1] text-[#108A4B]";
  if (status === "low_confidence_search") return "bg-[#EEF8F1] text-[#108A4B]";
  return "bg-[#FFF2E8] text-[#A35F2E]";
}

function brainReadinessLabel(status: BrainState["sourcingReadiness"]) {
  if (status === "ready") return "Ready for first batch";
  if (status === "calibration_batch") return "Calibration batch";
  return "Not ready";
}

function brainReadinessBadgeClass(status: BrainState["sourcingReadiness"]) {
  if (status === "ready") return "bg-[#EEF8F1] text-[#108A4B]";
  if (status === "calibration_batch") return "bg-[#FFF7E8] text-[#9A6A18]";
  return "bg-[#FFF2E8] text-[#A35F2E]";
}

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function TalentBatchReadCard({ read }: { read: string }) {
  return (
    <section className="rounded-lg border border-[#E5E2DD] bg-white p-3">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#8A8178]">Tina’s batch read</p>
      <p className="mt-2 text-sm leading-5 text-[#4B453F]">{read}</p>
    </section>
  );
}

function StrategyRow({
  label,
  items,
  tone = "default"
}: {
  label: string;
  items: string[];
  tone?: "default" | "warning";
}) {
  return (
    <div className="rounded-md border border-[#E7DDD1] bg-white p-2">
      <p className="text-[10px] font-medium uppercase tracking-[0.1em] text-[#8A8178]">{label}</p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {items.map((item) => (
          <span
            key={`${label}-${item}`}
            className={`rounded-md px-2 py-1 text-[11px] ${
              tone === "warning" ? "bg-[#FFF2E8] text-[#9A5D31]" : "bg-[#F4F1EC] text-[#5F574F]"
            }`}
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

function prioritizeLatestProfileLeadItems(profileLeadItems: ProfileLeadItem[], latestProfileLeadItems: ProfileLeadItem[]) {
  const latestKeys = new Set(latestProfileLeadItems.map((item) => item.statusKey));
  return [
    ...latestProfileLeadItems,
    ...profileLeadItems.filter((item) => !latestKeys.has(item.statusKey))
  ];
}

function prioritizePotentialCandidateItems(items: ProfileLeadItem[], statuses: Record<string, ProfileLeadStatus>) {
  return [...items].sort((a, b) => {
    const aRejected = statuses[a.statusKey]?.action === "rejected";
    const bRejected = statuses[b.statusKey]?.action === "rejected";
    if (aRejected !== bRejected) return aRejected ? 1 : -1;

    return confidenceRank(b.lead.confidence) - confidenceRank(a.lead.confidence);
  });
}

function confidenceRank(confidence: ProfileLead["confidence"]) {
  if (confidence === "high") return 3;
  if (confidence === "medium") return 2;
  return 1;
}

function hasProfileLeadFeedback(status?: ProfileLeadStatus) {
  return Boolean(status?.action || status?.preference);
}

function buildTalentPoolFeedbackSummary(items: ProfileLeadItem[], statuses: Record<string, ProfileLeadStatus>) {
  const positive: string[] = [];
  const negative: string[] = [];

  for (const item of items) {
    const status = statuses[item.statusKey];
    if (!status) continue;

    const summary = summarizeProfileLeadForRefinement(item.lead);

    if (status.action === "saved" || status.preference === "more_like_this") {
      positive.push(summary);
    }

    if (status.action === "rejected" || status.preference === "less_like_this") {
      negative.push(summary);
    }
  }

  const sections = [];
  if (positive.length) sections.push(`Positive signals: ${positive.slice(0, MAX_FEEDBACK_SUMMARY_LEADS).join(" | ")}`);
  if (negative.length) sections.push(`Negative signals: ${negative.slice(0, MAX_FEEDBACK_SUMMARY_LEADS).join(" | ")}`);

  return sections.join(" ");
}

function buildFeedbackLearningRead(items: ProfileLeadItem[], statuses: Record<string, ProfileLeadStatus>) {
  const positiveTags = items
    .filter((item) => statuses[item.statusKey]?.action === "saved" || statuses[item.statusKey]?.preference === "more_like_this")
    .flatMap((item) => item.lead.tags);
  const negativeTags = items
    .filter((item) => statuses[item.statusKey]?.action === "rejected" || statuses[item.statusKey]?.preference === "less_like_this")
    .flatMap((item) => item.lead.tags);
  const positive = topValues(positiveTags).slice(0, 2);
  const negative = topValues(negativeTags).slice(0, 2);

  if (!positive.length && !negative.length) return "";

  return [
    positive.length ? `I’m learning you prefer ${positive.join(" and ")} signals` : "",
    negative.length ? `and want to avoid ${negative.join(" and ")} noise` : ""
  ].filter(Boolean).join(" ").replace(/\s+/g, " ").trim() + ".";
}

function summarizeProfileLeadForRefinement(lead: ProfileLead) {
  const company = inferCompanyFromLead(lead);
  const calibration = lead.calibration;
  const details = [
    `title=${lead.title}`,
    company ? `company=${company}` : "",
    `source=${lead.source}`,
    `confidence=${lead.confidence}`,
    lead.tags.length ? `tags=${lead.tags.slice(0, 5).join(", ")}` : "",
    lead.fitReason ? `fitReason=${compactLeadText(lead.fitReason)}` : "",
    lead.snippet ? `snippet=${compactLeadText(lead.snippet)}` : "",
    calibration?.scope ? `scope=${compactLeadText(calibration.scope)}` : "",
    calibration?.mustHaves?.length ? `mustHaves=${calibration.mustHaves.slice(0, 3).join(", ")}` : ""
  ].filter(Boolean);

  return details.join("; ");
}

function inferCompanyFromLead(lead: ProfileLead) {
  const title = lead.title.replace(/\s+-\s+LinkedIn$/i, "").trim();
  const explicitAt = title.match(/\b(?:@|at)\s+([^|,–—-]{2,48})(?:\s*[-–—|,]|$)/i);
  if (explicitAt?.[1]) return cleanCompanyCandidate(explicitAt[1]);

  const titleSegments = title.split(/\s+-\s+/).map((part) => part.trim()).filter(Boolean);
  const lastSegment = titleSegments[titleSegments.length - 1] || "";
  if (titleSegments.length >= 3 && looksLikeCompanyName(lastSegment)) return cleanCompanyCandidate(lastSegment);

  const snippetMatch = lead.snippet.match(/\b(?:at|@)\s+([A-Z][A-Za-z0-9.&'\-\s]{2,40})(?:[,.]|\s{2,}|$)/);
  if (snippetMatch?.[1] && looksLikeCompanyName(snippetMatch[1])) return cleanCompanyCandidate(snippetMatch[1]);

  return "";
}

function displayCompanyFromLead(lead: ProfileLead) {
  return inferCompanyFromLead(lead) || "Company unclear";
}

function cleanCompanyCandidate(value: string) {
  return value.replace(/\b(linkedin|profile|experience|about)\b/gi, "").replace(/\s+/g, " ").trim();
}

function looksLikeCompanyName(value: string) {
  const cleaned = cleanCompanyCandidate(value);
  if (!cleaned || cleaned.length < 2 || cleaned.length > 48) return false;
  if (/\b(product manager|engineer|founder|operator|consultant|student|candidate|linkedin|experience|about|senior|lead|head of)\b/i.test(cleaned)) return false;
  return /[A-Z]/.test(cleaned) || /\b(ai|labs|studio|systems|technologies|startup|ventures|software|shopify)\b/i.test(cleaned);
}

function missingSignalForLead(lead: ProfileLead) {
  const text = `${lead.title} ${lead.snippet} ${lead.fitReason} ${lead.tags.join(" ")}`.toLowerCase();
  if (lead.confidence === "low") return "Public evidence is thin; verify ownership depth before treating this as a strong lane.";
  if (!/\b(shipped|built|launched|owned|founding|founder)\b/.test(text)) return "Need proof of shipped ownership, not just title adjacency.";
  if (/\b(ai|llm|model)\b/.test(text) && !/\b(customer|user|workflow|product)\b/.test(text)) return "Need evidence that the AI work touched real product or customer constraints.";
  if (/\b(product|pm)\b/.test(text) && !/\b(technical|engineer|built|builder)\b/.test(text)) return "Need to verify builder proximity; this may be product-heavy rather than hands-on.";
  return "Looks directionally relevant; verify depth, recency, and operating environment.";
}

function leadEvidenceLine(lead: ProfileLead) {
  const calibration = lead.calibration;
  const proof = [
    calibration?.scope,
    calibration?.yearsExperience,
    lead.tags.slice(0, 2).join(", ")
  ].filter(Boolean).join(" · ");

  return compactLeadText(proof || lead.snippet || lead.fitReason, 150);
}

function buildTalentBatchRead(items: ProfileLeadItem[]) {
  const leads = items.map((item) => item.lead);
  const count = leads.length;
  const highConfidence = leads.filter((lead) => lead.confidence === "high").length;
  const mediumConfidence = leads.filter((lead) => lead.confidence === "medium").length;
  const topTags = topValues(leads.flatMap((lead) => lead.tags)).slice(0, 3);
  const sourceMix = topValues(leads.map((lead) => lead.source.replace("_", " "))).slice(0, 2);
  const unclearCompanies = leads.filter((lead) => !inferCompanyFromLead(lead)).length;
  const signal = topTags.length ? topTags.join(", ") : "role-adjacent";
  const confidenceRead = highConfidence
    ? `${highConfidence} strong ${highConfidence === 1 ? "lead" : "leads"}`
    : mediumConfidence
      ? `${mediumConfidence} medium-confidence ${mediumConfidence === 1 ? "lead" : "leads"}`
      : "mostly light public evidence";
  const companyCaveat = unclearCompanies ? ` Company is unclear on ${unclearCompanies} ${unclearCompanies === 1 ? "profile" : "profiles"}, so judge by evidence before outreach.` : "";
  const qualityLead = highConfidence
    ? "This batch is tight enough to review for outreach."
    : mediumConfidence
      ? "This batch is useful for calibration, not outreach yet."
      : "This batch is still title-noisy. I’d use it to clarify the lane before messaging anyone.";

  return `${qualityLead} It has ${count} ${count === 1 ? "profile" : "profiles"}, mostly from ${sourceMix.join(" and ") || "public sources"}, with ${signal} signals. Treat it as ${confidenceRead}; the next judgment is whether the public evidence proves the actual operating pattern.${companyCaveat}`;
}

function limitSentences(value: string, maxSentences: number) {
  const sentences = value.match(/[^.!?]+[.!?]+/g);
  if (!sentences?.length) return compactLeadText(value, 240);
  return sentences.slice(0, maxSentences).join(" ").replace(/\s+/g, " ").trim();
}

function batchReadDetail(value: string) {
  const sentences = value.match(/[^.!?]+[.!?]+/g) || [];
  return sentences.find((sentence) => /\b(has|profiles|signals|mostly from)\b/i.test(sentence) && !/\btight enough|useful for calibration|title-noisy\b/i.test(sentence))?.trim() || "";
}

function buildShortlistRead(items: ProfileLeadItem[]) {
  const leads = items.map((item) => item.lead);
  const ready = leads.filter((lead) => lead.confidence === "high");
  const calibrationOnly = leads.filter((lead) => lead.confidence !== "high");
  const sharedSignals = topValues(leads.flatMap((lead) => lead.tags)).slice(0, 3);
  const missingProof = topValues(leads.map((lead) => missingSignalTheme(missingSignalForLead(lead)))).slice(0, 2);
  const readyNames = ready.map((lead) => compactLeadName(lead.title)).slice(0, 2);
  const calibrationNames = calibrationOnly.map((lead) => compactLeadName(lead.title)).slice(0, 2);

  return [
    sharedSignals.length ? `Strongest shared signals: ${sharedSignals.join(", ")}.` : "Strongest shared signals are still forming.",
    missingProof.length ? `Missing proof: ${missingProof.join(", ")}.` : "Missing proof: verify depth and recent ownership.",
    readyNames.length ? `Ready for outreach review: ${readyNames.join(", ")}.` : "No one is clearly outreach-ready yet.",
    calibrationNames.length ? `Use for calibration: ${calibrationNames.join(", ")}.` : ""
  ].filter(Boolean).join(" ");
}

function missingSignalTheme(value: string) {
  const text = value.toLowerCase();
  if (text.includes("shipped ownership")) return "shipped ownership";
  if (text.includes("customer") || text.includes("product")) return "customer/product proof";
  if (text.includes("builder")) return "builder proximity";
  if (text.includes("thin")) return "public evidence depth";
  return "depth and recency";
}

function compactLeadName(title: string) {
  return title
    .replace(/\s+-\s+LinkedIn$/i, "")
    .replace(/\s+\|\s+.*$/i, "")
    .split(/\s+-\s+/)[0]
    .trim()
    .slice(0, 42);
}

function topValues(values: string[]) {
  const counts = values.filter(Boolean).reduce<Record<string, number>>((acc, value) => {
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});

  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([value]) => value);
}

function compactLeadText(value: string, maxLength = 180) {
  const cleaned = value.replace(/\s+/g, " ").trim();
  return cleaned.length > maxLength ? `${cleaned.slice(0, maxLength - 1).trim()}...` : cleaned;
}

function LiveJdTab({
  calibration,
  profiles
}: {
  calibration: LiveCalibration;
  profiles: ReturnType<typeof deriveCalibrationProfiles>;
}) {
  const primaryProfile = profiles[0];
  const hasSignal = calibration.depth > 0;

  return (
    <div className="grid gap-3">
      <section className="rounded-lg border border-[#E5E2DD] bg-white p-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#8A8178]">Live JD</p>
          <span className="rounded-full bg-[#EEF8F1] px-2 py-1 text-[11px] text-[#108A4B]">
            {hasSignal ? "Drafting" : "Waiting"}
          </span>
        </div>
        <h3 className="mt-3 text-sm font-semibold leading-5 text-[#171717]">{titleForLiveJd(calibration)}</h3>
        <p className="mt-2 whitespace-pre-line text-[13px] leading-5 text-[#4B453F]">
          {hasSignal ? calibration.fullJd : "Waiting to gather more information. Share the outcome, scope, must-haves, and tradeoffs, then Tina will turn it into a working JD."}
        </p>
      </section>

      <section className="rounded-lg border border-[#E5E2DD] bg-[#FBFAF7] p-3">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#8A8178]">Must prove</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {calibration.keywords.slice(0, 6).map((keyword) => (
            <span key={keyword} className="rounded-md bg-white px-2.5 py-1 text-xs text-[#625A52] ring-1 ring-[#E5E2DD]">
              {keyword}
            </span>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-[#E5E2DD] bg-white p-3">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#8A8178]">Profile anchor</p>
        <p className="mt-2 text-[13px] font-semibold text-[#171717]">{primaryProfile?.title || "Still forming"}</p>
        <p className="mt-1 text-xs leading-5 text-[#625A52]">{primaryProfile?.why || "Tina needs one more concrete role signal."}</p>
      </section>
    </div>
  );
}

function titleForLiveJd(calibration: LiveCalibration) {
  if (calibration.depth === 0) return "Role draft forming";
  return calibration.roleTitle;
}

function AlignmentRing({ value }: { value: number }) {
  return (
    <div className="grid shrink-0 place-items-center">
      <div
        className="grid h-14 w-14 place-items-center rounded-full"
        style={{ background: `conic-gradient(#108A4B ${value * 3.6}deg, #EFEAE2 0deg)` }}
      >
        <div className="grid h-10 w-10 place-items-center rounded-full bg-white">
          <span className="text-base font-semibold text-[#108A4B]">{value}</span>
        </div>
      </div>
      <p className="mt-1 text-[10px] text-[#108A4B]">alignment</p>
    </div>
  );
}

function LiveJdCard({ calibration }: { calibration: LiveCalibration }) {
  const showOverview = calibration.depth > 0 && calibration.jdRequested;

  return (
    <section className="rounded-lg border border-[#E5E2DD] bg-white p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#8A8178]">Live JD</p>
        <span className="rounded-full bg-[#EEF8F1] px-2 py-1 text-[11px] text-[#108A4B]">{showOverview ? "Ready" : "Waiting"}</span>
      </div>
      <p className="mt-3 text-[13px] leading-5 text-[#262626]">
        {showOverview ? calibration.jdOverview : "Waiting to gather more information. Ask Tina to draft the JD once the role has an outcome, scope, and tradeoff."}
      </p>
      <div className="mt-3 flex items-center gap-2 text-[11px] text-[#6F675E]">
        <span className="h-1.5 w-1.5 rounded-full bg-[#108A4B]" />
        Auto-updated from the conversation
      </div>
    </section>
  );
}

function MarketMetric({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="border-r border-[#E5E2DD] p-3 last:border-r-0">
      <p className="text-[11px] font-medium text-[#6F675E]">{label}</p>
      <p className="mt-2 text-sm font-semibold text-[#108A4B]">{value}</p>
      <p className="mt-1 text-[11px] leading-4 text-[#6F675E]">{note}</p>
    </div>
  );
}

function trimInsight(value: string) {
  const firstLine = value.split("\n").find(Boolean) || value;
  return firstLine.length > 150 ? `${firstLine.slice(0, 147).trim()}...` : firstLine;
}

function CalibrationProfiles({
  profiles,
  calibration,
  latestSynthesis
}: {
  profiles: ReturnType<typeof deriveCalibrationProfiles>;
  calibration: LiveCalibration;
  latestSynthesis: string;
}) {
  const founderMessageCount = calibration.depth;
  const showFullCalibration = founderMessageCount >= 3;

  return (
    <section className="rounded-lg border border-[#DDD2C5] bg-[#FFFCF7]/90 p-3 shadow-[0_16px_48px_rgba(23,23,23,0.06)] backdrop-blur transition-all duration-300">
      <PanelHeader eyebrow="Live calibration" title={showFullCalibration ? "Role intelligence is taking shape." : "Early hiring signals forming."} icon={Brain} />

      <p className="mb-3 rounded-md border border-[#E7DDD1] bg-[#F8F4ED] p-2.5 text-xs leading-5 text-[#4B453F] shadow-[0_10px_28px_rgba(62,52,42,0.04)]">{latestSynthesis}</p>

      <div className="mb-4 grid grid-cols-3 gap-2 transition-all duration-300">
        <ProfileMetric label="Clarity" value={`${calibration.clarity}%`} />
        <ProfileMetric label="Pressure" value={calibration.marketPressure} />
        <ProfileMetric label="Pool" value={calibration.poolImpact} />
      </div>
      <div className="mb-4">
        <CalibrationCurrent calibration={calibration} />
      </div>
      <div className="mb-4">
        <WhyThisMatters>{calibrationInterpretation(calibration)}</WhyThisMatters>
      </div>

      <div className="grid gap-3">
        <RoleClarityCard calibration={calibration} />

        <ModuleCard title="Hiring tension map">
          <div className="grid gap-3">
            {calibration.tensions.slice(0, showFullCalibration ? 4 : 3).map((tension) => (
              <TensionSlider key={`${tension.left}-${tension.right}`} {...tension} />
            ))}
          </div>
        </ModuleCard>

        {showFullCalibration ? (
          <ModuleCard title="Live JD summary">
            <p className="text-xs leading-5 text-[#5A524A]">{calibration.jdSummary}</p>
          </ModuleCard>
        ) : null}

        <ModuleCard title="Candidate Archetypes">
          <div className="grid gap-2.5">
            {profiles.slice(0, showFullCalibration ? 3 : 2).map((profile) => (
              <ArchetypeCalibrationCard key={profile.title} profile={profile} />
            ))}
          </div>
        </ModuleCard>

        <ModuleCard title="Market pressure">
          <div className="grid gap-2">
            <PressureRow label="Difficulty" value={calibration.marketPressure} />
            <PressureRow label="Pool impact" value={calibration.poolImpact} />
            <PressureRow label="Likely time to fill" value={profiles[0]?.timeToFill || "TBD"} />
          </div>
          <WhyThisMatters>{marketPressureInterpretation(calibration)}</WhyThisMatters>
        </ModuleCard>

        {showFullCalibration ? (
          <ModuleCard title="Suggested sourcing keywords">
            <div className="flex flex-wrap gap-1.5">
              {calibration.keywords.map((keyword) => (
                <span key={keyword} className="rounded-full bg-[#F1ECE4] px-2.5 py-1 text-xs text-[#625A52]">
                  {keyword}
                </span>
              ))}
            </div>
          </ModuleCard>
        ) : null}

        <NextActionCard action={calibration.nextAction} />
      </div>
    </section>
  );
}

function PipelineIntelligenceModule({ pipeline }: { pipeline: PipelineIntelligence }) {
  const [selectedState, setSelectedState] = useState<PipelineState>(pipeline.defaultState);
  const snapshot = pipeline.snapshots[selectedState];
  const isAdjusting = selectedState === "adjust";

  return (
    <section className="rounded-lg border border-[#D2C5B7] bg-[#FFFCF7]/94 p-3.5 shadow-[0_18px_52px_rgba(23,23,23,0.07)] backdrop-blur">
      <PanelHeader eyebrow="Pipeline intelligence" title="Tina reads the funnel as strategic signal." icon={Activity} />

      <div className="mb-3 grid grid-cols-2 gap-2 rounded-md border border-[#E7DDD1] bg-[#F8F4ED] p-1">
        {pipeline.stateOptions.map((option) => (
          <button
            key={option.state}
            type="button"
            onClick={() => setSelectedState(option.state)}
            className={`flex items-center justify-center gap-1.5 rounded px-2 py-1.5 text-xs font-medium transition ${
              selectedState === option.state ? "bg-[#1E1E1E] text-white shadow-[0_8px_20px_rgba(23,23,23,0.14)]" : "text-[#625A52] hover:bg-[#FFFCF7]"
            }`}
          >
            {option.state === "steady" ? <CheckCircle2 className="h-3.5 w-3.5" /> : <SlidersHorizontal className="h-3.5 w-3.5" />}
            {option.label}
          </button>
        ))}
      </div>

      <ExecutiveRecommendationCard snapshot={snapshot} isAdjusting={isAdjusting} />

      <div className="mt-3 grid gap-2.5">
        <StrategicEvidenceCard title="Calibration drift" priority="primary">
          <DriftMeter value={snapshot.calibrationDrift} label={snapshot.driftLabel} />
          <WhyThisMatters>{snapshot.interpretation.drift}</WhyThisMatters>
        </StrategicEvidenceCard>

        <StrategicEvidenceCard title="Funnel health">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-2xl font-semibold tracking-tight text-[#262626]">{snapshot.healthScore}%</p>
              <p className="mt-1 text-xs leading-5 text-[#625A52]">{snapshot.healthRead}</p>
            </div>
            <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-1 text-[11px] font-medium ${isAdjusting ? "bg-[#F7EFE6] text-[#8A5A33]" : "bg-[#EEF1E8] text-[#5F6D4E]"}`}>
              {isAdjusting ? <AlertTriangle className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              {snapshot.stateLabel}
            </span>
          </div>
          <div className="mt-3 grid gap-1.5">
            {snapshot.funnel.slice(0, 4).map((stage) => (
              <FunnelStageRow key={stage.stage} stage={stage} maxCount={snapshot.maxStageCount} />
            ))}
          </div>
          <WhyThisMatters>{snapshot.interpretation.funnel}</WhyThisMatters>
        </StrategicEvidenceCard>

        <StrategicEvidenceCard title="Bottleneck">
          <p className="text-xs leading-5 text-[#4B453F]">{snapshot.briefing.bottleneck}</p>
          <p className="mt-1.5 text-[11px] leading-4 text-[#8A8178]">{describeWeakestPassThrough(snapshot)}</p>
          <WhyThisMatters>{snapshot.interpretation.bottleneck}</WhyThisMatters>
        </StrategicEvidenceCard>

        <StrategicEvidenceCard title="Market reality">
          <p className="text-xs leading-5 text-[#4B453F]">{snapshot.briefing.marketReality}</p>
          <WhyThisMatters>{snapshot.interpretation.market}</WhyThisMatters>
        </StrategicEvidenceCard>

        <StrategicEvidenceCard title="Rejection patterns" muted>
          <div className="grid gap-2">
            {snapshot.rejectionPatterns.slice(0, 3).map((pattern) => (
              <RejectionPatternRow key={pattern.reason} pattern={pattern} />
            ))}
          </div>
          <WhyThisMatters>{snapshot.interpretation.rejections}</WhyThisMatters>
        </StrategicEvidenceCard>
      </div>
    </section>
  );
}

function ExecutiveRecommendationCard({
  snapshot,
  isAdjusting
}: {
  snapshot: PipelineSnapshot;
  isAdjusting: boolean;
}) {
  return (
    <section className={`rounded-xl border p-4 shadow-[0_18px_46px_rgba(23,23,23,0.08)] ${isAdjusting ? "border-[#262626] bg-[#1E1E1E] text-white" : "border-[#D2C5B7] bg-[linear-gradient(180deg,#FFFCF7,#F7F1E9)] text-[#171717]"}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={`text-[11px] font-semibold uppercase tracking-[0.16em] ${isAdjusting ? "text-[#E9CFAD]" : "text-[#8A8178]"}`}>Tina recommendation</p>
          <h3 className={`mt-2 text-lg font-semibold leading-6 ${isAdjusting ? "text-white" : "text-[#1E1E1E]"}`}>{snapshot.recommendation}</h3>
        </div>
        <div className={`rounded-full p-2 ${isAdjusting ? "bg-white/10 text-[#E9CFAD]" : "bg-[#EEF1E8] text-[#5F6D4E]"}`}>
          {isAdjusting ? <AlertTriangle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
        </div>
      </div>

      <div className="mt-4 grid gap-2">
        <BriefingRow label="What’s happening" value={snapshot.briefing.happening} dark={isAdjusting} />
        <BriefingRow label="Should founder care" value={snapshot.briefing.care} dark={isAdjusting} />
        <BriefingRow label="Do next" value={snapshot.briefing.next} dark={isAdjusting} />
        <BriefingRow label="Ignore for now" value={snapshot.briefing.ignore} dark={isAdjusting} />
      </div>
    </section>
  );
}

function BriefingRow({ label, value, dark }: { label: string; value: string; dark: boolean }) {
  return (
    <div className={`rounded-lg border p-2.5 ${dark ? "border-white/10 bg-white/[0.06]" : "border-[#E5DACE] bg-white/58"}`}>
      <p className={`text-[10px] font-semibold uppercase tracking-[0.12em] ${dark ? "text-[#D8CEC2]" : "text-[#8A8178]"}`}>{label}</p>
      <p className={`mt-1 text-xs leading-5 ${dark ? "text-[#F8F4ED]" : "text-[#4B453F]"}`}>{value}</p>
    </div>
  );
}

function WhyThisMatters({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-3 rounded-md border border-[#E7DDD1] bg-[#FFFCF7]/72 p-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8A8178]">Why this matters</p>
      <p className="mt-1 text-xs leading-5 text-[#4B453F]">{children}</p>
    </div>
  );
}

function StrategicEvidenceCard({
  title,
  children,
  priority,
  muted
}: {
  title: string;
  children: React.ReactNode;
  priority?: "primary";
  muted?: boolean;
}) {
  return (
    <section className={`rounded-lg border p-3 transition-all duration-300 ${priority === "primary" ? "border-[#D8CEC2] bg-[#F8F4ED] shadow-[0_10px_28px_rgba(23,23,23,0.035)]" : "border-[#E7DDD1] bg-white/48"} ${muted ? "opacity-82" : ""}`}>
      <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.12em] text-[#8A8178]">{title}</p>
      {children}
    </section>
  );
}

function describeWeakestPassThrough(snapshot: PipelineSnapshot) {
  const weakest = snapshot.passThroughRates.reduce((current, rate) => {
    const currentGap = current.benchmark - current.rate;
    const rateGap = rate.benchmark - rate.rate;
    return rateGap > currentGap ? rate : current;
  }, snapshot.passThroughRates[0]);

  if (!weakest) return "No bottleneck is visible yet.";
  const gap = weakest.benchmark - weakest.rate;
  const transition = plainTransition(weakest.label);

  if (gap <= 6) return `${transition} is holding up, which suggests the market understands the role once it gets concrete.`;
  return `${transition} is where the search starts losing conviction; this points to expectation mismatch, not just sourcing quality.`;
}

function plainTransition(label: string) {
  const transitions: Record<string, string> = {
    "Sourced to Screen": "The first conversation",
    "Screen to Founder call": "The founder conversation step",
    "Founder call to Work sample": "The proof-of-work step",
    "Work sample to Offer": "The close"
  };

  return transitions[label] || "This step";
}

function FunnelStageRow({ stage, maxCount }: { stage: PipelineStage; maxCount: number }) {
  const width = Math.max(10, Math.round((stage.count / maxCount) * 100));

  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2 text-xs">
        <span className="font-medium text-[#4B453F]">{stage.stage}</span>
        <span className="text-[#6F675E]">{stage.count}</span>
      </div>
      <div className="h-2 rounded-full bg-[#E7DDD1]">
        <div className="h-full rounded-full bg-[#6F7B5B] transition-all duration-700 ease-out" style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

function PassThroughRow({ rate }: { rate: PassThroughRate }) {
  const isWeak = rate.rate < rate.benchmark - 8;

  return (
    <div className="rounded-md border border-[#E7DDD1] bg-[#F8F4ED] p-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-[#4B453F]">{rate.label}</p>
        <span className={`text-xs font-semibold ${isWeak ? "text-[#8A5A33]" : "text-[#5F6D4E]"}`}>{rate.rate}%</span>
      </div>
      <div className="mt-2 h-1.5 rounded-full bg-[#E7DDD1]">
        <div className={`h-full rounded-full ${isWeak ? "bg-[#B77A4B]" : "bg-[#6F7B5B]"}`} style={{ width: `${rate.rate}%` }} />
      </div>
      <p className="mt-1.5 text-[11px] leading-4 text-[#6F675E]">Expected around {rate.benchmark}%.</p>
    </div>
  );
}

function RejectionPatternRow({ pattern }: { pattern: RejectionPattern }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-[#E7DDD1] bg-[#F8F4ED] p-2">
      {pattern.severity === "high" ? <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#9E563F]" /> : <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#6F7B5B]" />}
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium text-[#4B453F]">{pattern.reason}</p>
          <span className="text-[11px] text-[#8A8178]">{pattern.count}</span>
        </div>
        <p className="mt-1 text-[11px] leading-4 text-[#6F675E]">{pattern.read}</p>
      </div>
    </div>
  );
}

function DriftMeter({ value, label }: { value: number; label: string }) {
  const isHigh = value >= 50;

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-lg font-semibold text-[#262626]">{value}%</p>
          <p className="text-xs leading-5 text-[#625A52]">{label}</p>
        </div>
        <div className={`rounded-full px-2.5 py-1 text-xs font-medium ${isHigh ? "bg-[#F7EFE6] text-[#8A5A33]" : "bg-[#EEF1E8] text-[#5F6D4E]"}`}>
          {isHigh ? "Drifting" : "Stable"}
        </div>
      </div>
      <div className="mt-3 h-2 rounded-full bg-[#E7DDD1]">
        <div className={`h-full rounded-full ${isHigh ? "bg-[#B77A4B]" : "bg-[#6F7B5B]"}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function PanelHeader({ eyebrow, title, icon: Icon }: { eyebrow: string; title: string; icon: typeof Brain }) {
  return (
    <div className="mb-3 flex items-start justify-between gap-3">
      <div>
        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#8A8178]">{eyebrow}</p>
        <h2 className="mt-1 text-base font-semibold leading-6">{title}</h2>
      </div>
      <Icon className="h-4 w-4 text-[#6F7B5B]" />
    </div>
  );
}

function ModuleCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-[#E2D7CB] bg-[linear-gradient(180deg,rgba(255,255,255,0.76),rgba(255,252,247,0.78))] p-3 shadow-[0_10px_28px_rgba(23,23,23,0.035)] transition-all duration-300 hover:border-[#C8BDAE] hover:bg-white">
      <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.12em] text-[#8A8178]">{title}</p>
      {children}
    </section>
  );
}

function CalibrationCurrent({ calibration }: { calibration: LiveCalibration }) {
  const position = Math.min(92, Math.max(8, calibration.clarity));
  const state = calibration.depth === 0 ? "Waiting for first signal" : calibration.depth < 3 ? "Learning from the conversation" : "Calibration tightening";
  const read = calibration.depth === 0
    ? "The system is quiet until the founder names the real hiring problem."
    : calibration.poolImpact === "Narrow"
      ? "The candidate pool is contracting as the role becomes more precise."
      : "The role signal is moving from broad intent toward a sharper market read.";

  return (
    <section className="overflow-hidden rounded-lg border border-[#E2D7CB] bg-[linear-gradient(180deg,rgba(255,255,255,0.82),rgba(248,244,237,0.72))] p-3 shadow-[0_10px_28px_rgba(23,23,23,0.035)]">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-[#8A8178]">Calibration current</p>
          <p className="mt-1 text-xs leading-5 text-[#4B453F]">{state}</p>
        </div>
        <span className="rounded-full border border-[#D8CEC2] bg-[#FFFCF7] px-2 py-1 text-[11px] text-[#625A52]">{calibration.clarity}%</span>
      </div>

      <div className="relative h-12">
        <div className="absolute left-0 right-0 top-5 h-px bg-[#DED5C9]" />
        <div className="absolute left-0 top-5 h-px bg-[#6F7B5B] transition-all duration-700 ease-out" style={{ width: `${position}%` }} />
        <div
          className="calibration-current-sweep absolute top-[13px] h-4 w-16 rounded-full bg-[linear-gradient(90deg,rgba(111,123,91,0),rgba(111,123,91,0.22),rgba(111,123,91,0))]"
          style={{ left: `calc(${position}% - 32px)` }}
        />
        <div
          className="absolute top-[15px] h-3 w-3 rounded-full border border-[#6F7B5B] bg-[#FFFCF7] shadow-[0_0_0_5px_rgba(111,123,91,0.08)] transition-all duration-700 ease-out"
          style={{ left: `calc(${position}% - 6px)` }}
        />
        <div className="absolute inset-x-0 bottom-0 flex justify-between text-[10px] uppercase tracking-[0.1em] text-[#8A8178]">
          <span>Intent</span>
          <span>Market</span>
          <span>Pool</span>
        </div>
      </div>

      <p className="mt-2 text-[11px] leading-4 text-[#6F675E]">{read}</p>
      <style jsx>{`
        @keyframes calibrationCurrentSweep {
          0%, 100% {
            transform: translateX(-5px);
            opacity: 0.34;
          }
          50% {
            transform: translateX(5px);
            opacity: 0.78;
          }
        }

        .calibration-current-sweep {
          animation: calibrationCurrentSweep 3.8s ease-in-out infinite;
        }
      `}</style>
    </section>
  );
}

function RoleClarityCard({ calibration }: { calibration: LiveCalibration }) {
  return (
    <ModuleCard title="Confidence / role clarity">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-lg font-semibold text-[#262626]">{calibration.clarity}%</p>
          <p className="text-xs leading-5 text-[#625A52]">{calibration.clarityLabel}</p>
        </div>
        <div className="h-2 w-28 overflow-hidden rounded-full bg-[#E7DDD1]">
          <div className="h-full rounded-full bg-[#6F7B5B] transition-all duration-700 ease-out" style={{ width: `${calibration.clarity}%` }} />
        </div>
      </div>
    </ModuleCard>
  );
}

function TensionSlider({ left, right, value, muted }: Tension & { muted?: boolean }) {
  return (
    <div className={muted ? "opacity-70" : ""}>
      <div className="mb-1 flex items-center justify-between gap-2 text-[11px] text-[#625A52]">
        <span>{left}</span>
        <span>{right}</span>
      </div>
      <div className="relative h-2 rounded-full bg-[#EFEAE2]">
        <div className="absolute inset-y-0 left-0 rounded-full bg-[#108A4B] transition-all duration-700 ease-out" style={{ width: `${value}%` }} />
        <div className="absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full border border-white bg-[#F8F6FF] shadow-[0_0_0_3px_rgba(91,53,213,0.08),0_5px_12px_rgba(23,23,23,0.13)] transition-all duration-700 ease-out" style={{ left: `calc(${value}% - 8px)` }} />
      </div>
    </div>
  );
}

function SignalList({ items }: { items: string[] }) {
  return (
    <div className="grid gap-2">
      {items.map((item) => (
        <div key={item} className="flex items-center gap-2 text-xs leading-5 text-[#5A524A]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#B8B09D]" />
          {item}
        </div>
      ))}
    </div>
  );
}

function PressureRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-xs leading-5">
      <span className="text-[#6F675E]">{label}</span>
      <span className="font-medium text-[#262626]">{value}</span>
    </div>
  );
}

function NextActionCard({ action }: { action: string }) {
  return (
    <div className="rounded-lg border border-[#D8CEC2] bg-[#1E1E1E] p-3 text-white shadow-[0_14px_36px_rgba(23,23,23,0.12)] transition hover:bg-[#262626]">
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#D8CEC2]">Next founder action</p>
      <p className="mt-2 text-sm leading-6">{action}</p>
    </div>
  );
}

function ArchetypeCalibrationCard({ profile }: { profile: ReturnType<typeof deriveCalibrationProfiles>[number] }) {
  return (
    <article className="rounded-lg border border-[#E2D7CB] bg-white p-3 shadow-[0_10px_28px_rgba(23,23,23,0.03)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">{profile.title}</h3>
          <p className="mt-1.5 text-xs leading-5 text-[#5A524A]">{profile.why}</p>
        </div>
        <span className="shrink-0 rounded-full bg-[#EEF1E8] px-2.5 py-1 text-xs text-[#5F6D4E]">{profile.match}% fit</span>
      </div>

      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {profile.keywords.map((keyword) => (
          <span key={keyword} className="rounded-full bg-[#F1ECE4] px-2.5 py-1 text-xs text-[#625A52]">
            {keyword}
          </span>
        ))}
      </div>

      <div className="mt-4 grid gap-2">
        <ArchetypeRead label="Strengths" value={profile.strengths} />
        <ArchetypeRead label="Likely tradeoffs" value={profile.tradeoffs} />
        <ArchetypeRead label="Hiring risks" value={profile.risks} />
        <ArchetypeRead label="Operating style" value={profile.operatingStyle} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <ProfileMetric label="Market density" value={profile.marketDensity} />
        <ProfileMetric label="Comp range" value={profile.comp} />
      </div>
    </article>
  );
}

function ArchetypeRead({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-[#E7DDD1] bg-[#FBFAF7] p-2">
      <p className="text-[10px] font-medium uppercase tracking-[0.1em] text-[#8A8178]">{label}</p>
      <p className="mt-1 text-xs leading-5 text-[#4B453F]">{value}</p>
    </div>
  );
}

function ProfileMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-[#E7DDD1] bg-[#F8F4ED] p-2">
      <p className="text-[10px] font-medium uppercase tracking-[0.1em] text-[#8A8178]">{label}</p>
      <p className="mt-1 text-xs font-medium text-[#262626]">{value}</p>
    </div>
  );
}

function deriveInlineSignals(messages: TinaMvpMessage[]) {
  const founderMessages = messages.filter((message) => message.role === "founder");
  if (!founderMessages.length) return [];

  const text = founderMessages.map((message) => message.content).join(" ").toLowerCase();
  const latestFounder = founderMessages[founderMessages.length - 1]?.content || "";
  const isAI = /\b(ai|llm|model|agent|machine learning|ml)\b/.test(text);
  const isProduct = /\b(product|customer|workflow|pm|designer|design)\b/.test(text);
  const isOperator = /\b(operator|ops|operations|chief of staff|founder office|bottleneck)\b/.test(text);
  const hasFounderBottleneck = /\b(founder|mostly me|my plate|less dependent|bottleneck|without me|run themselves)\b/.test(text);
  const hasDecisionOwnership = /\b(own|owns|ownership|decision|decisions|priorit(y|ies|ization)|judgment|autonom(y|ous)|independent)\b/.test(text);
  const hasRoleCompression = /\b(all of it|everything|many hats|generalist|chief of staff|operator|too many jobs|three jobs)\b/.test(text);
  const hasArtifactRequest = isPlanningArtifactRequest(latestFounder);
  const hasSourcingEvidence = messages.some((message) => Boolean(message.sourcingBatch) || Boolean(message.profileLeads?.length));
  const hasMarketRequest = isMarketRealityRequest(latestFounder);
  const locationChip = explicitLocationSignalChip(text);
  const hasCompEvidence = explicitCompSignal(text);
  const canShowMarketChip = hasSourcingEvidence || hasMarketRequest;
  const signals: string[] = [];

  if (hasDecisionOwnership) {
    signals.push("Decision ownership");
  } else if (hasFounderBottleneck) {
    signals.push("Founder bottleneck");
  } else if (hasRoleCompression) {
    signals.push("Role compression");
  } else if (isAI && isProduct) {
    signals.push("Must-have signals forming");
  } else if (isAI) {
    signals.push("Technical signal forming");
  } else if (isOperator) {
    signals.push("Ownership gap forming");
  } else if (isProduct) {
    signals.push("Product judgment becoming primary signal");
  } else {
    signals.push("Thesis tightening");
  }

  if (hasFounderBottleneck && !signals.includes("Founder bottleneck")) signals.push("Founder bottleneck");
  if (hasRoleCompression && !signals.includes("Role compression")) signals.push("Role compression");
  if (hasArtifactRequest && /\b(scorecard|criteria|rubric)\b/i.test(latestFounder)) signals.push("Scorecard ready");
  if (hasArtifactRequest && /\b(interview plan)\b/i.test(latestFounder)) signals.push("Interview plan ready");
  if (hasArtifactRequest && /\b(must[-\s]?have|signal map|candidate archetype|role shape|tradeoffs?)\b/i.test(latestFounder)) signals.push("Must-have signals");
  if (founderMessages.length >= 3) signals.push("Calibration read stabilizing");

  if (canShowMarketChip || locationChip || hasCompEvidence) {
    if (hasSourcingEvidence) signals.push("Example-shape evidence added");
    if (locationChip) signals.push(locationChip);
    if (hasCompEvidence) signals.push("Comp constraint noted");
  }

  return Array.from(new Set(signals));
}

function explicitLocationSignalChip(text: string) {
  if (/\b(remote)\b/.test(text)) return "Remote constraint noted";
  if (/\b(sf|san francisco|bay area)\b/.test(text)) return "SF constraint noted";
  if (/\b(nyc|new york)\b/.test(text)) return "NYC constraint noted";
  if (/\b(peoria|chicago|austin|seattle|london)\b/.test(text)) return "Location constraint noted";
  return "";
}

function explicitCompSignal(text: string) {
  return /\$\d|\b(comp(?:ensation)?|salary|budget|pay range|cash comp)\b/.test(text);
}

function calibrationInterpretation(calibration: LiveCalibration) {
  if (calibration.depth === 0) return "Tina does not have enough signal yet; the first useful move is naming the business problem this hire should remove.";
  if (calibration.clarity < 55) return "The role is still forming, so early candidates should be used for calibration rather than judged too literally.";
  if (calibration.marketPressure === "High") return "The ask is specific enough to be useful, but the market will punish vague must-haves quickly.";
  if (calibration.poolImpact === "Narrow") return "The profile is getting sharper, which is good; it also means each extra requirement has a real cost.";
  return "The role has enough shape to test against real people without widening the search too early.";
}

function marketPressureInterpretation(calibration: LiveCalibration) {
  if (calibration.marketPressure === "High") return "High pressure means the founder needs sharper tradeoffs, not a longer wish list.";
  if (calibration.poolImpact === "Narrow") return "A narrow pool can still work if the first screen is precise and the must-haves stay honest.";
  if (calibration.depth < 3) return "This is still an early read; the next answer should clarify whether the market is actually tight or just undefined.";
  return "The market looks workable if the search keeps optimizing for operating fit over title match.";
}

type Tension = {
  left: string;
  right: string;
  value: number;
};

type LiveCalibration = {
  depth: number;
  clarity: number;
  clarityLabel: string;
  marketPressure: string;
  poolImpact: string;
  nextAction: string;
  roleTitle: string;
  jdRequested: boolean;
  jdSummary: string;
  jdOverview: string;
  fullJd: string;
  keywords: string[];
  tensions: Tension[];
};

type PipelineState = "steady" | "adjust";

type MockPipelineCandidate = {
  name: string;
  stage: "Sourced" | "Screen" | "Founder call" | "Work sample" | "Offer" | "Rejected";
  signal: string;
  rejectionReason?: string;
};

type PipelineStage = {
  stage: string;
  count: number;
};

type PassThroughRate = {
  label: string;
  rate: number;
  benchmark: number;
};

type RejectionPattern = {
  reason: string;
  count: number;
  read: string;
  severity: "low" | "high";
};

type ExecutiveBriefing = {
  happening: string;
  care: string;
  next: string;
  ignore: string;
  bottleneck: string;
  marketReality: string;
};

type IntelligenceInterpretation = {
  drift: string;
  funnel: string;
  bottleneck: string;
  market: string;
  rejections: string;
};

type PipelineSnapshot = {
  stateLabel: string;
  healthScore: number;
  healthRead: string;
  funnel: PipelineStage[];
  maxStageCount: number;
  passThroughRates: PassThroughRate[];
  rejectionPatterns: RejectionPattern[];
  calibrationDrift: number;
  driftLabel: string;
  recommendation: string;
  briefing: ExecutiveBriefing;
  interpretation: IntelligenceInterpretation;
};

type PipelineIntelligence = {
  defaultState: PipelineState;
  stateOptions: { state: PipelineState; label: string }[];
  snapshots: Record<PipelineState, PipelineSnapshot>;
};

const mockPipelineCandidates: Record<PipelineState, MockPipelineCandidate[]> = {
  steady: [
    { name: "Maya R.", stage: "Work sample", signal: "customer-facing AI workflows" },
    { name: "Leo C.", stage: "Founder call", signal: "fast applied AI generalist" },
    { name: "Priya M.", stage: "Screen", signal: "backend reliability with AI fluency" },
    { name: "Owen T.", stage: "Work sample", signal: "customer demo to product judgment" },
    { name: "Nina S.", stage: "Rejected", signal: "strong infra", rejectionReason: "Too infra-heavy" },
    { name: "Sam V.", stage: "Rejected", signal: "excellent comp target", rejectionReason: "Timing mismatch" },
    { name: "Rhea P.", stage: "Rejected", signal: "good builder range", rejectionReason: "Light AI production evidence" },
    { name: "Ethan K.", stage: "Offer", signal: "deep eval instincts" }
  ],
  adjust: [
    { name: "Maya R.", stage: "Founder call", signal: "strong builder, unclear depth" },
    { name: "Leo C.", stage: "Rejected", signal: "fast generalist", rejectionReason: "Bar shifted after screen" },
    { name: "Priya M.", stage: "Rejected", signal: "reliable backend owner", rejectionReason: "Not customer-facing enough" },
    { name: "Owen T.", stage: "Rejected", signal: "strong demos", rejectionReason: "Demo polish over product judgment" },
    { name: "Nina S.", stage: "Rejected", signal: "excellent infra", rejectionReason: "Too infra-heavy" },
    { name: "Ethan K.", stage: "Rejected", signal: "research credibility", rejectionReason: "Too research-oriented" },
    { name: "Ari D.", stage: "Screen", signal: "broad AI builder" },
    { name: "June L.", stage: "Rejected", signal: "enterprise AI platform", rejectionReason: "Too enterprise" }
  ]
};

const mockPipelineFunnels: Record<PipelineState, PipelineStage[]> = {
  steady: [
    { stage: "Sourced", count: 46 },
    { stage: "Screen", count: 21 },
    { stage: "Founder call", count: 11 },
    { stage: "Work sample", count: 5 },
    { stage: "Offer", count: 1 }
  ],
  adjust: [
    { stage: "Sourced", count: 52 },
    { stage: "Screen", count: 24 },
    { stage: "Founder call", count: 6 },
    { stage: "Work sample", count: 1 },
    { stage: "Offer", count: 0 }
  ]
};

function derivePipelineIntelligence(messages: TinaMvpMessage[]): PipelineIntelligence {
  const founderMessages = messages.filter((message) => message.role === "founder");
  const text = founderMessages.map((message) => message.content).join(" ").toLowerCase();
  const depth = founderMessages.length;
  const isAI = /\b(ai|llm|model|agent|machine learning|ml)\b/.test(text);
  const isOperator = /\b(operator|ops|operations|chief of staff|founder office|bottleneck)\b/.test(text);
  const defaultState: PipelineState = depth >= 3 ? "adjust" : "steady";

  return {
    defaultState,
    stateOptions: [
      { state: "steady", label: "No action needed" },
      { state: "adjust", label: "Adjust strategy" }
    ],
    snapshots: {
      steady: buildPipelineSnapshot({
        state: "steady",
        healthScore: 82,
        calibrationDrift: 18,
        stateLabel: "No action needed",
        driftLabel: "Candidates are mostly testing the calibrated lane.",
        healthRead: "The funnel is thin but coherent. Founder-call pass-through is healthy enough to keep learning before changing the search.",
        recommendation: isOperator
          ? "Keep the operator lane intact for one more batch. The rejection pattern is about evidence quality, not a broken profile."
          : "Keep the calibrated lane running. Do not widen yet; the current misses are normal learning, not a strategy failure.",
        briefing: isOperator
          ? {
              happening: "The operator lane is producing a small but coherent batch. The misses are clarifying the evidence bar.",
              care: "Care a little, but do not panic. This looks like normal calibration, not a broken search.",
              next: "Run one more batch with sharper proof of judgment under loose ownership.",
              ignore: "Generic seniority debates. They are probably a distraction from actual leverage.",
              bottleneck: "Work sample quality is the main place to watch; sourcing volume is not the issue yet.",
              marketReality: "The market is workable if the lane stays narrow and founder-context heavy."
            }
          : {
              happening: "The funnel is small but internally coherent. Candidates are testing the intended profile.",
              care: "Yes, but lightly. There is signal here, just not enough volume to declare victory.",
              next: "Keep the lane narrow for one more batch and learn from the next founder-call pattern.",
              ignore: "Top-of-funnel anxiety for now. More people will not help if the lane is already right.",
              bottleneck: "The search is leaking mostly at depth checks, not at initial interest.",
              marketReality: "Market pressure is real, but not yet forcing a profile change."
            },
        interpretation: isOperator
          ? {
              drift: "A low drift read means the founder and market are mostly looking at the same kind of person.",
              funnel: "People are staying credible as the conversation gets more specific, so the search does not need a new shape yet.",
              bottleneck: "The useful question is whether candidates show real judgment under ambiguity, not whether they have the right operator vocabulary.",
              market: "You can keep the bar specific without starving the search yet.",
              rejections: "The misses are teaching the evidence bar. That is useful noise, not a reason to rewrite the role."
            }
          : {
              drift: "Low drift means the role definition is still surviving contact with the market.",
              funnel: "Healthy founder-call movement suggests people understand and value the role once it is explained.",
              bottleneck: "If the weak point is late, the issue is usually proof or expectations, not initial market interest.",
              market: "The market is not rejecting the premise; it is asking for a tighter version of it.",
              rejections: "A few consistent misses help sharpen the screen. Random misses would be more concerning."
            }
      }),
      adjust: buildPipelineSnapshot({
        state: "adjust",
        healthScore: 54,
        calibrationDrift: isAI ? 72 : 64,
        stateLabel: "Adjust strategy",
        driftLabel: "The funnel is pulling away from the role Tina calibrated.",
        healthRead: "Top-of-funnel volume looks fine, but founder-call conversion collapses. That usually means the sourcing lane is plausible on paper and wrong in the room.",
        recommendation: isAI
          ? "Tighten the first filter around shipped AI product judgment. Too many candidates are passing resume screens on AI proximity, then failing when the work needs customer-shaped judgment."
          : "Rewrite the first screen around the real operating signal. The current pass-through says the search is collecting adjacent talent, not the person who reduces founder load.",
        briefing: isAI
          ? {
              happening: "The search is attracting people near AI, but not enough people who have shipped AI inside real product constraints.",
              care: "Yes. This is calibration drift, not normal funnel noise.",
              next: "Screen first for shipped AI product judgment: messy customer workflow, eval instinct, reliability tradeoffs.",
              ignore: "More generic AI resumes. They will add motion without much signal.",
              bottleneck: "Founder-call conversion is exposing a gap between AI proximity and product judgment.",
              marketReality: "The market has talent, but the current query is pulling adjacent builders too easily."
            }
          : {
              happening: "The search is collecting plausible adjacent people, then losing them when the role needs sharper operating proof.",
              care: "Yes. The funnel is telling you the role bar and sourcing lane are not fully aligned.",
              next: "Move the first screen closer to the actual founder-load problem, not the title.",
              ignore: "Raw candidate volume. This is not a spreadsheet problem wearing a blazer.",
              bottleneck: "The search is breaking between screen and founder call, where real operating fit becomes visible.",
              marketReality: "The market can produce this person, but not if the ask stays too broad."
            },
        interpretation: isAI
          ? {
              drift: "High drift means the search is starting to reward AI adjacency over the actual operating signal.",
              funnel: "Volume at the top is not the win here; the role is losing clarity when candidates have to explain how they build.",
              bottleneck: "When founder conversations drop, the market may like the title but not match the real job.",
              market: "There are enough relevant people, but the search language is inviting too many almost-right profiles.",
              rejections: "Repeated late misses suggest expectation mismatch, not a sourcing-quality problem."
            }
          : {
              drift: "High drift means the process is quietly changing the role as it reacts to candidates.",
              funnel: "The search has activity, but activity is not the same as confidence.",
              bottleneck: "The moment the role gets real, candidates stop looking as aligned as they did on paper.",
              market: "The market can support this search, but only if the role stops trying to be several jobs at once.",
              rejections: "Repeated reasons are useful: they show the role bar is clearer than the search strategy."
            }
      })
    }
  };
}

function buildPipelineSnapshot({
  state,
  healthScore,
  calibrationDrift,
  stateLabel,
  driftLabel,
  healthRead,
  recommendation,
  briefing,
  interpretation
}: {
  state: PipelineState;
  healthScore: number;
  calibrationDrift: number;
  stateLabel: string;
  driftLabel: string;
  healthRead: string;
  recommendation: string;
  briefing: ExecutiveBriefing;
  interpretation: IntelligenceInterpretation;
}): PipelineSnapshot {
  const funnel = mockPipelineFunnels[state];
  const candidates = mockPipelineCandidates[state];
  const passThroughRates = funnel.slice(0, -1).map((stage, index) => {
    const nextStage = funnel[index + 1];
    const rate = stage.count === 0 ? 0 : Math.round((nextStage.count / stage.count) * 100);

    return {
      label: `${stage.stage} to ${nextStage.stage}`,
      rate,
      benchmark: [42, 48, 38, 25][index]
    };
  });
  const rejectionPatterns = rejectionPatternsFrom(candidates, state);

  return {
    stateLabel,
    healthScore,
    healthRead,
    funnel,
    maxStageCount: Math.max(...funnel.map((stage) => stage.count)),
    passThroughRates,
    rejectionPatterns,
    calibrationDrift,
    driftLabel,
    recommendation,
    briefing,
    interpretation
  };
}

function rejectionPatternsFrom(candidates: MockPipelineCandidate[], state: PipelineState): RejectionPattern[] {
  const counts = candidates.reduce<Record<string, number>>((acc, candidate) => {
    if (!candidate.rejectionReason) return acc;
    acc[candidate.rejectionReason] = (acc[candidate.rejectionReason] || 0) + 1;
    return acc;
  }, {});

  return Object.entries(counts)
    .map(([reason, count]) => {
      const severity: RejectionPattern["severity"] = state === "adjust" && !["Timing mismatch"].includes(reason) ? "high" : "low";

      return {
        reason,
        count,
        read: rejectionReadFor(reason),
        severity
      };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 4);
}

function rejectionReadFor(reason: string) {
  const reads: Record<string, string> = {
    "Too infra-heavy": "The lane may be over-indexing on systems strength.",
    "Timing mismatch": "Normal market friction; not a calibration problem.",
    "Light AI production evidence": "Good screen to keep if reliability matters.",
    "Bar shifted after screen": "Interviewers may not be using the same role bar.",
    "Not customer-facing enough": "The search wants product contact, not just build quality.",
    "Demo polish over product judgment": "Classic false positive for AI product roles.",
    "Too research-oriented": "Pedigree is leaking into the screen without enough product proof.",
    "Too enterprise": "The market lane is drifting toward slower operating systems."
  };

  return reads[reason] || "Pattern worth watching across the next batch.";
}

function deriveLiveCalibration(messages: TinaMvpMessage[]): LiveCalibration {
  const founderMessages = messages.filter((message) => message.role === "founder");
  const founderText = founderMessages.map((message) => message.content).join(" ");
  const allText = messages.map((message) => message.content).join(" ");
  const text = founderText.toLowerCase();
  const depth = founderMessages.length;
  const isAI = /\b(ai|llm|model|agent|machine learning|ml)\b/.test(text);
  const isProduct = /\b(product|customer|workflow|pm|designer|design)\b/.test(text);
  const isOperator = /\b(operator|ops|operations|chief of staff|founder office|bottleneck)\b/.test(text);
  const isSenior = /\b(senior|lead|founding|head of|principal|staff)\b/.test(text);
  const speed = /\b(fast|quick|speed|urgent|young|sharp|high slope|move)\b/.test(text);
  const domain = /\b(fintech|healthcare|medical|crypto|web3|security|sales|gtm|domain|manufacturing|plant|factory|industrial|warehouse|operations)\b/.test(text);
  const clarity = Math.min(86, 28 + depth * 14 + (isAI || isProduct || isOperator ? 10 : 0) + (isSenior ? 6 : 0));
  const roleTitle = roleTitleForLiveCalibration(founderText);
  const jdRequested = /\b(jd|job description|role description|draft the role|draft.*jd|create.*jd|write.*jd|live jd)\b/i.test(allText);
  const jdSummary = summarizeRole({ isAI, isProduct, isOperator, isSenior, speed, domain, text, roleTitle });
  const keywords = sourcingKeywordsFor({ isAI, isProduct, isOperator, isSenior, domain, speed });

  return {
    depth,
    clarity,
    clarityLabel: depth === 0 ? "Waiting for the first hiring signal" : depth < 3 ? "Early read, still forming" : "Enough signal to pressure-test the lane",
    marketPressure: marketPressureFor({ isAI, isSenior, domain, speed }),
    poolImpact: poolImpactFor({ isAI, isOperator, isProduct, domain }),
    nextAction: nextFounderAction({ depth, isAI, isProduct, isOperator }),
    roleTitle,
    jdRequested,
    jdSummary,
    jdOverview: buildLiveJdOverview({ roleTitle, jdSummary, text, depth }),
    fullJd: buildFullLiveJd({ roleTitle, jdSummary, keywords, text, depth }),
    keywords,
    tensions: [
      { left: "Execution Speed", right: "Technical Depth", value: speed ? 38 : isAI ? 63 : 52 },
      { left: "Product Instinct", right: "Systems Rigor", value: isProduct ? 36 : isAI ? 58 : 48 },
      { left: "Startup Athlete", right: "Domain Specialist", value: domain ? 68 : 34 },
      { left: "Low Management", right: "High Experience", value: isSenior ? 72 : 44 }
    ]
  };
}

function marketPressureFor({
  isAI,
  isSenior,
  domain,
  speed
}: {
  isAI: boolean;
  isSenior: boolean;
  domain: boolean;
  speed: boolean;
}) {
  if (isAI && isSenior) return "High";
  if ((isAI && speed) || (domain && isSenior)) return "Medium-high";
  return "Moderate";
}

function poolImpactFor({
  isAI,
  isOperator,
  isProduct,
  domain
}: {
  isAI: boolean;
  isOperator: boolean;
  isProduct: boolean;
  domain: boolean;
}) {
  if (isAI && isProduct) return "Narrower";
  if (isOperator || domain) return "Focused";
  return "Broad";
}

function nextFounderAction({
  depth,
  isAI,
  isProduct,
  isOperator
}: {
  depth: number;
  isAI: boolean;
  isProduct: boolean;
  isOperator: boolean;
}) {
  if (depth === 0) return "Describe the messy version of the hire in one or two sentences.";
  if (depth < 3) return "Name the first 90-day outcome. That will separate wish-list from real search lane.";
  if (isOperator) return "Pressure-test how much founder context this person needs to absorb without creating process drag.";
  if (isAI || isProduct) return "Decide whether the first filter is shipped product judgment or technical depth.";
  return "Pick one must-win outcome and one tradeoff you can live with.";
}

function summarizeRole({
  isAI,
  isProduct,
  isOperator,
  isSenior,
  speed,
  domain,
  text,
  roleTitle
}: {
  isAI: boolean;
  isProduct: boolean;
  isOperator: boolean;
  isSenior: boolean;
  speed: boolean;
  domain: boolean;
  text: string;
  roleTitle: string;
}) {
  if (/\b(plant manager|plant|factory|manufacturing|industrial|warehouse)\b/.test(text)) {
    return `${roleTitle} who can run day-to-day site execution, stabilize people and process, and translate founder-level priorities into reliable operating rhythm.`;
  }
  if (isOperator) return "Founder-adjacent operator who can absorb loose context, close loops, and reduce leadership drag without adding heavy process.";
  if (isAI && isProduct) return "AI product builder who can turn ambiguous customer problems into reliable workflows, not just impressive demos.";
  if (isAI) return "Technical AI builder with enough product judgment to ship in messy startup conditions.";
  if (isProduct) return "Product-minded operator who can convert customer signal into clear execution without hiding behind process.";
  if (domain) return "Domain-aware builder who can move fast without flattening the market or customer nuance.";
  if (isSenior && speed) return "Senior enough to raise the bar, but still impatient enough to ship before the org becomes ceremonial.";
  return "High-ownership startup hire who clarifies the role as much as they execute it.";
}

function roleTitleForLiveCalibration(founderText: string) {
  if (!founderText.trim()) return "Role draft forming";
  const extracted = extractRoleTitle(founderText) || compactRoleTitle(founderText);
  return extracted === "New role" ? "High-Ownership Startup Hire" : extracted;
}

function buildLiveJdOverview({
  roleTitle,
  jdSummary,
  text,
  depth
}: {
  roleTitle: string;
  jdSummary: string;
  text: string;
  depth: number;
}) {
  if (depth === 0) return "Waiting to gather more information.";
  const secondSentence = /\b(plant|manufacturing|factory|industrial|warehouse)\b/.test(text)
    ? "The core screen is whether they can create operating calm on-site without needing the founder to translate every priority."
    : "The core screen is whether they reduce ambiguity in the environment the company actually has, not the cleaner one everyone wishes existed.";

  return `${roleTitle}: ${jdSummary} ${secondSentence}`;
}

function buildFullLiveJd({
  roleTitle,
  jdSummary,
  keywords,
  text,
  depth
}: {
  roleTitle: string;
  jdSummary: string;
  keywords: string[];
  text: string;
  depth: number;
}) {
  if (depth === 0) return "Waiting to gather more information.";

  const plantRole = /\b(plant|manufacturing|factory|industrial|warehouse)\b/.test(text);
  const mustProve = plantRole
    ? ["Can run a plant or site through messy daily execution", "Earns trust with frontline teams and founder/ops leadership", "Improves process without turning the environment into bureaucracy"]
    : ["Can own the first 90-day outcome with limited hand-holding", "Has judgment in ambiguous startup conditions", "Can separate real signal from impressive but irrelevant experience"];
  const responsibilities = plantRole
    ? ["Own daily plant performance, people rhythm, quality, and escalation paths", "Translate business priorities into clear operating routines", "Spot process gaps early and fix them without slowing the floor down"]
    : ["Turn ambiguous hiring or business needs into clear execution", "Partner closely with founders and functional leaders", "Create leverage without adding unnecessary process"];
  const interviewFocus = plantRole
    ? ["How they handled a plant-floor failure or production miss", "How they manage frontline trust and accountability", "Where they draw the line between process discipline and speed"]
    : ["How quickly they create clarity from messy context", "Their strongest examples of ownership under uncertainty", "Where their operating style may create drag"];

  return [
    `${roleTitle}`,
    "",
    "Quick read",
    jdSummary,
    "",
    "What this person owns",
    ...responsibilities.map((item) => `- ${item}`),
    "",
    "Must prove",
    ...mustProve.map((item) => `- ${item}`),
    "",
    "Useful signals",
    ...keywords.slice(0, 6).map((keyword) => `- ${keyword}`),
    "",
    "Interview focus",
    ...interviewFocus.map((item) => `- ${item}`)
  ].join("\n");
}

function sourcingKeywordsFor({
  isAI,
  isProduct,
  isOperator,
  isSenior,
  domain,
  speed
}: {
  isAI: boolean;
  isProduct: boolean;
  isOperator: boolean;
  isSenior: boolean;
  domain: boolean;
  speed: boolean;
}) {
  const keywords = new Set<string>(["startup", "ownership", "0 to 1"]);

  if (isAI) ["LLM", "AI product", "evals", "applied AI"].forEach((keyword) => keywords.add(keyword));
  if (isProduct) ["product judgment", "customer-facing", "workflow"].forEach((keyword) => keywords.add(keyword));
  if (isOperator) ["founder office", "bizops", "chief of staff", "operator"].forEach((keyword) => keywords.add(keyword));
  if (isSenior) ["staff", "lead", "principal"].forEach((keyword) => keywords.add(keyword));
  if (domain) ["domain depth", "regulated market", "customer trust"].forEach((keyword) => keywords.add(keyword));
  if (speed) ["high slope", "prototype", "fast shipping"].forEach((keyword) => keywords.add(keyword));

  return Array.from(keywords).slice(0, 10);
}

function deriveSourcingStrategy(
  calibration: LiveCalibration,
  profiles: ReturnType<typeof deriveCalibrationProfiles>,
  sourcingReadiness: SourcingReadiness
): SourcingStrategy {
  const text = `${calibration.roleTitle} ${calibration.jdSummary} ${calibration.keywords.join(" ")}`.toLowerCase();
  const isAI = /\b(ai|llm|model|eval|applied ai)\b/.test(text);
  const isProduct = /\b(product|customer|workflow|pm|designer|design)\b/.test(text);
  const isOperator = /\b(operator|ops|operations|chief of staff|founder office|bizops)\b/.test(text);
  const isPlant = /\b(plant|factory|manufacturing|industrial|warehouse)\b/.test(text);
  const isEngineeringLeadership = /\b(head of eng|head of engineering|vp engineering|vp of engineering|engineering manager|eng manager|engineering leadership|engineering leader|director of engineering|engineering director)\b/.test(text);
  const isSenior = /\b(senior|staff|principal|lead|head|founding)\b/.test(text);
  const explicitProductRole = /\b(pm|product manager|founding pm|head of product|product lead)\b/.test(text);
  const primaryProfile = profiles[0];

  if (isPlant) {
    return {
      readiness: sourcingReadiness,
      searchThesis: sourcingReadiness.searchThesis,
      seek: ["floor leadership", "quality ownership", "daily execution rhythm"],
      targetTitles: ["Plant Manager", "Operations Manager", "Site Lead", "Manufacturing Operations Lead"],
      targetCompanyTypes: ["high-mix manufacturing", "industrial startups", "warehouse operations", "multi-shift production teams"],
      searchLanes: ["hands-on site operators", "process-improving plant leaders", "frontline-trust builders"],
      mustHaveSignals: ["floor leadership", "quality ownership", "people accountability", "daily execution rhythm"],
      niceToHaveSignals: ["startup exposure", "lean/process discipline", "ERP or production systems"],
      avoidSignals: ["office-only operators", "process without floor trust", "big-company pace dependency"],
      queryTerms: ["plant manager", "operations manager", "manufacturing", "quality"]
    };
  }

  if (isEngineeringLeadership) {
    return {
      readiness: sourcingReadiness,
      searchThesis: sourcingReadiness.searchThesis,
      seek: ["technical judgment", "team operating cadence", "founder-facing leadership"],
      targetTitles: ["Head of Engineering", "VP Engineering", "Director of Engineering", "Engineering Manager"],
      targetCompanyTypes: ["founder-led startups", "engineering-heavy scaleups", "platform or infra teams", "technical product companies"],
      searchLanes: ["startup engineering leaders", "architecture-heavy managers", "founder-facing technical leads"],
      mustHaveSignals: ["engineering leadership", "technical judgment", "team operating cadence", "architecture ownership"],
      niceToHaveSignals: ["hired senior engineers", "managed through scale", "AI/infra/product exposure"],
      avoidSignals: ["IC-only builders", "people managers without technical depth", "process-heavy big-company leaders"],
      queryTerms: ["Head of Engineering", "VP Engineering", "Director of Engineering", "Engineering Manager"]
    };
  }

  if (isOperator) {
    return {
      readiness: sourcingReadiness,
      searchThesis: sourcingReadiness.searchThesis,
      seek: ["context absorption", "loop closing", "low explanation dependency"],
      targetTitles: ["Founder’s Office", "Chief of Staff", "BizOps Lead", "Startup Operator", "Special Projects Lead"],
      targetCompanyTypes: ["founder-led startups", "fast-scaling seed to Series B teams", "marketplace or ops-heavy startups", "lean product-led companies"],
      searchLanes: ["founder-adjacent operators", "high-agency generalists", "customer/ops translators"],
      mustHaveSignals: ["low explanation dependency", "context absorption", "loop closing", "ambiguity tolerance"],
      niceToHaveSignals: ["product fluency", "customer proximity", "finance or GTM range"],
      avoidSignals: ["process-first operators", "coordination without judgment", "needs mature ownership lanes"],
      queryTerms: ["founder office", "chief of staff", "bizops", "operator"]
    };
  }

  if (isProduct && explicitProductRole) {
    return {
      readiness: sourcingReadiness,
      searchThesis: sourcingReadiness.searchThesis,
      seek: ["customer signal", "clarity creation", "independent judgment"],
      targetTitles: [isSenior ? "Founding PM" : "Product Manager", "Product Lead", "Product Operator", "Customer Discovery Lead"],
      targetCompanyTypes: ["zero-to-one startups", "vertical SaaS", "AI or fintech product teams", "founder-led product teams"],
      searchLanes: ["startup-native PMs", "customer-discovery operators", "product-minded AI/fintech operators"],
      mustHaveSignals: ["customer signal", "clarity creation", "prioritization judgment", "low-process execution"],
      niceToHaveSignals: ["technical fluency", "fintech or AI exposure", "early-stage launches"],
      avoidSignals: ["roadmap administration", "process-heavy PM work", "infra depth with no product pull"],
      queryTerms: ["founding PM", "product manager", "fintech product", "AI product"]
    };
  }

  if (isAI && isProduct) {
    return {
      readiness: sourcingReadiness,
      searchThesis: sourcingReadiness.searchThesis,
      seek: ["shipped AI workflows", "product judgment", "startup pace"],
      targetTitles: ["AI Product Engineer", "Founding AI Engineer", "Applied AI Engineer", "Product-Minded ML Engineer"],
      targetCompanyTypes: ["AI workflow startups", "vertical AI SaaS", "devtools with AI surfaces", "customer-facing automation companies"],
      searchLanes: ["shipped AI workflow builders", "product-minded engineers", "applied AI generalists"],
      mustHaveSignals: ["shipped customer-facing AI", "product judgment", "eval instincts", "startup pace"],
      niceToHaveSignals: ["founding team experience", "workflow reliability", "customer calls", "full-stack range"],
      avoidSignals: ["prompt demos only", "research-only orientation", "infra depth with no product pull"],
      queryTerms: ["AI product engineer", "applied AI", "customer-facing", "evals"]
    };
  }

  if (isAI) {
    return {
      readiness: sourcingReadiness,
      searchThesis: sourcingReadiness.searchThesis,
      seek: ["production AI judgment", "systems reliability", "practical eval sense"],
      targetTitles: ["Applied AI Engineer", "ML Engineer", "AI Platform Engineer", "Founding Engineer"],
      targetCompanyTypes: ["AI infrastructure startups", "model-serving teams", "automation companies", "technical product startups"],
      searchLanes: ["applied AI builders", "ML infra owners", "technical founders turned operators"],
      mustHaveSignals: ["production AI judgment", "systems reliability", "practical eval sense"],
      niceToHaveSignals: ["product exposure", "customer-facing workflows", "startup ownership"],
      avoidSignals: ["lab pedigree without shipping", "demo polish without reliability", "overbuilding before signal"],
      queryTerms: ["applied AI engineer", "ML engineer", "AI platform", "startup"]
    };
  }

  if (isProduct) {
    return {
      readiness: sourcingReadiness,
      searchThesis: sourcingReadiness.searchThesis,
      seek: ["customer signal", "clarity creation", "independent judgment"],
      targetTitles: [isSenior ? "Founding PM" : "Product Manager", "Product Lead", "Product Operator", "Customer Discovery Lead"],
      targetCompanyTypes: ["zero-to-one startups", "vertical SaaS", "devtools or workflow products", "founder-led product teams"],
      searchLanes: ["customer-discovery operators", "startup-native PMs", "product-minded builders"],
      mustHaveSignals: ["customer signal", "clarity creation", "prioritization judgment", "low-process execution"],
      niceToHaveSignals: ["technical fluency", "founder-context translation", "early-stage launches"],
      avoidSignals: ["roadmap administration", "process-heavy PM work", "polish without ownership"],
      queryTerms: ["founding PM", "product operator", "customer discovery", "zero-to-one"]
    };
  }

  return {
    readiness: sourcingReadiness,
    searchThesis: sourcingReadiness.searchThesis,
    seek: ["ownership", "ambiguity tolerance", "judgment under incomplete context"],
    targetTitles: uniqueStrings([calibration.roleTitle, primaryProfile?.title, "Startup Generalist", "Founding Operator"]).slice(0, 4),
    targetCompanyTypes: ["early-stage startups", "founder-led teams", "ambiguous product or ops environments", "adjacent high-ownership companies"],
    searchLanes: ["high-ownership generalists", "customer-close builders", "clarity creators"],
    mustHaveSignals: ["ownership", "ambiguity tolerance", "judgment under incomplete context"],
    niceToHaveSignals: calibration.keywords.slice(0, 4),
    avoidSignals: ["title match without operating proof", "needs heavy structure", "generic startup enthusiasm"],
    queryTerms: ["startup generalist", "founding operator", "builder", "ownership"]
  };
}

function buildMissionHeader(canonicalSearchState: CanonicalSearchState, messages: TinaMvpMessage[], currentRead?: CurrentRead, showMarketReality = false) {
  const founderText = messages.filter((message) => message.role === "founder").map((message) => message.content).join(" ").toLowerCase();
  const allText = messages.map((message) => message.content).join(" ").toLowerCase();
  const controlledTitle = titleFromCurrentReadValue(currentRead);
  const role = compactMissionPart(controlledTitle || (currentRead ? "Unknown / Needs Clarification" : "this search"));
  if (!showMarketReality) return `Thesis: ${role}`;

  const constraints = [
    /\b(us|u\.s\.|usa|united states)\b/.test(founderText) && /\bcanada|canadian\b/.test(founderText) ? "US/Canada" : "",
    canonicalSearchState.location && !/forming/i.test(canonicalSearchState.location) ? canonicalSearchState.location : "",
    /\b(urgent|asap|very fast|move fast)\b/.test(founderText) ? "urgent" : "",
    /\b(fintech|banking|compliance|fraud|credit|underwriting)\b/.test(allText) ? "fintech" : "",
    /\b(nlp|document parsing|language model|llm)\b/.test(allText) ? "NLP" : "",
    isWeb3EngineeringSearch(founderText) ? "web3" : ""
  ].filter(Boolean);

  return `Finding: ${role}${constraints.length ? ` · ${uniqueStrings(constraints).join(" · ")}` : ""}`;
}

function isWeb3EngineeringSearch(text: string) {
  return /\b(solidity|smartcontract|smart contract engineer|protocol engineer|web3 engineer|defi engineer|mainnet engineer)\b/.test(text) ||
    (/\b(smart contract|web3|defi|protocol|mainnet)\b/.test(text) && /\b(engineer|developer|code|coding|ship code)\b/.test(text));
}

function compactMissionPart(value: string) {
  return value
    .replace(/\s+-\s+LinkedIn$/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 72);
}

function uniqueStrings(values: Array<string | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value?.trim()))));
}

function deriveCalibrationProfiles(messages: TinaMvpMessage[]) {
  const text = messages.map((message) => message.content).join(" ").toLowerCase();
  const isAI = /\b(ai|llm|model|prompt|agent)\b/.test(text);
  const isProduct = /\b(product|customer|workflow|pm|designer|design)\b/.test(text);
  const isOperator = /\b(operator|ops|operations|bottleneck|run with|chaos|execution)\b/.test(text);
  const isSenior = /\b(senior|lead|founding|founder|head of)\b/.test(text);
  const speed = /\b(fast|quick|speed|young|sharp|high slope|move)\b/.test(text);

  if (isOperator) {
    return [
      {
        title: "Founder-Adjacent Operator",
        why: "Fits when the real need is lower founder load, not another process layer.",
        match: 86,
        keywords: ["context absorption", "trust generation", "low explanation dependency"],
        strengths: "Absorbs messy founder context, closes loops, and creates trust without ceremony.",
        tradeoffs: "May be lighter on deep functional craft if the role secretly needs a specialist.",
        risks: "Can become the catch-all person if ownership boundaries stay blurry.",
        operatingStyle: "High-context, calm, low-ego, comfortable with incomplete information.",
        marketDensity: "Focused",
        comp: "$170k-$240k",
        timeToFill: "8-12 wks"
      },
      {
        title: "High-Agency Generalist",
        why: "Useful if the role crosses product, customers, ops, and execution without clean boundaries.",
        match: 78,
        keywords: ["ambiguity", "loop closing", "calm urgency"],
        strengths: "Moves fast across functions and turns vague ownership into forward motion.",
        tradeoffs: "Needs a clear quality bar or may optimize for motion over depth.",
        risks: "Can look great early and then plateau if the company needs deeper expertise.",
        operatingStyle: "Scrappy, direct, broad-range operator who prefers problems over process.",
        marketDensity: "Moderate",
        comp: "$140k-$210k",
        timeToFill: "6-10 wks"
      }
    ];
  }

  if (isAI || isProduct) {
    return [
      {
        title: isProduct ? "Product-Oriented AI Builder" : "Native AI Builder",
        why: "Matches the need for AI-native work that can become real customer-facing product.",
        match: speed ? 88 : 82,
        keywords: ["AI workflows", "product judgment", "eval instincts"],
        strengths: "Turns model capability into useful product behavior and learns quickly from users.",
        tradeoffs: "May not have frontier-depth research taste or hardcore infra depth.",
        risks: "Demo fluency can masquerade as production judgment if the interview is too polished.",
        operatingStyle: "Builder-minded, customer-aware, pragmatic about reliability tradeoffs.",
        marketDensity: "Narrow",
        comp: isSenior ? "$220k-$330k" : "$180k-$260k",
        timeToFill: "10-14 wks"
      },
      {
        title: "ML Infrastructure Specialist",
        why: "Good lane if reliability matters as much as demo speed.",
        match: 76,
        keywords: ["production AI", "systems taste", "workflow reliability"],
        strengths: "Brings rigor around model serving, eval loops, observability, and reliability.",
        tradeoffs: "May be less natural at product discovery or customer-shaped ambiguity.",
        risks: "Can overbuild infrastructure before there is enough product signal.",
        operatingStyle: "Systems-oriented, careful, skeptical of fragile demo magic.",
        marketDensity: "Moderate",
        comp: "$200k-$300k",
        timeToFill: "9-13 wks"
      },
      {
        title: "Research-to-Product Translator",
        why: "Worth testing if the founder cares more about learning velocity than deep research pedigree.",
        match: 71,
        keywords: ["prototype speed", "customer learning", "young sharp builder"],
        strengths: "Bridges technical AI concepts with usable workflows and product decisions.",
        tradeoffs: "May need support from deeper infra or research partners as systems scale.",
        risks: "Can become too broad if the first 90-day outcome is not concrete.",
        operatingStyle: "Curious, fast-learning, comfortable translating between users and technical constraints.",
        marketDensity: "Moderate-high",
        comp: "$150k-$230k",
        timeToFill: "6-9 wks"
      }
    ];
  }

  return [
    {
      title: "Zero-to-One Generalist",
      why: "A flexible starting profile while Tina learns whether the real constraint is product, ops, or founder leverage.",
      match: 70,
      keywords: ["ambiguity", "ownership", "clarity creation"],
      strengths: "Creates clarity in undefined environments and keeps moving without a perfect spec.",
      tradeoffs: "May lack the domain depth needed once the role narrows.",
      risks: "Can become a vague catch-all if the founder never names the real job.",
      operatingStyle: "High-agency, adaptable, comfortable with loose ownership.",
      marketDensity: "Broad",
      comp: "$130k-$210k",
      timeToFill: "6-10 wks"
    },
    {
      title: "Customer-Obsessed Builder",
      why: "Useful if the hire needs to turn fuzzy customer pain into product or operating direction.",
      match: 66,
      keywords: ["customer signal", "taste", "execution"],
      strengths: "Finds patterns in customer pain and turns them into simpler product choices.",
      tradeoffs: "May be less strong in deep systems or formal operating cadence.",
      risks: "Can over-index on individual customer requests without a clear strategy bar.",
      operatingStyle: "Close to users, commercially aware, practical about shipping.",
      marketDensity: "Moderate",
      comp: "$150k-$230k",
      timeToFill: "7-11 wks"
    }
  ];
}
