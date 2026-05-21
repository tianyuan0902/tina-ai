"use client";

import { FormEvent, KeyboardEvent, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Brain,
  CheckCircle2,
  Sparkles,
  SlidersHorizontal,
  XCircle
} from "lucide-react";

import type { TinaChatApiResponse, TinaMvpMessage } from "@/lib/tina-mvp/types";

type ChatThread = {
  id: string;
  title: string;
  time: string;
  messages: TinaMvpMessage[];
};

const prompts = [
  "What are you trying to solve with this hire?",
  "What kind of person do you wish you already had?",
  "Where does this hire feel unclear right now?"
];

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
  const [threads, setThreads] = useState<ChatThread[]>(initialThreads);
  const [activeThreadId, setActiveThreadId] = useState(initialThreads[0].id);
  const [latestSynthesis, setLatestSynthesis] = useState(
    "Tina is watching for the difference between a strong title match and a person who actually reduces founder ambiguity."
  );
  const activeThread = threads.find((thread) => thread.id === activeThreadId) || threads[0];

  function selectThread(threadId: string) {
    const nextThread = threads.find((thread) => thread.id === threadId);
    if (!nextThread) return;

    setActiveThreadId(threadId);
    setLatestSynthesis(latestThreadSynthesis(nextThread.messages));
  }

  function startNewThread() {
    const threadId = `thread-${Date.now()}`;
    const nextThread: ChatThread = {
      id: threadId,
      title: "New role",
      time: "Just now",
      messages: [
        {
          ...openingMessage,
          id: `tina-opening-${threadId}`
        }
      ]
    };

    setThreads((current) => [nextThread, ...current]);
    setActiveThreadId(threadId);
    setLatestSynthesis("Tina is watching for the difference between a strong title match and a person who actually reduces founder ambiguity.");
  }

  function updateActiveThreadMessages(messages: TinaMvpMessage[]) {
    setThreads((current) =>
      current.map((thread) =>
        thread.id === activeThreadId
          ? {
              ...thread,
              title: shouldAutoRenameThread(thread.title) ? titleFromMessages(messages) : thread.title,
              messages
            }
          : thread
      )
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-white text-[#171717]">
      <div className="relative z-10 flex min-h-screen">
        <Sidebar
          threads={threads}
          activeThreadId={activeThreadId}
          onSelectThread={selectThread}
          onNewThread={startNewThread}
        />
        <div className="min-w-0 flex-1">
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
  onSelectThread,
  onNewThread
}: {
  threads: ChatThread[];
  activeThreadId: string;
  onSelectThread: (threadId: string) => void;
  onNewThread: () => void;
}) {
  return (
    <aside className="hidden w-56 shrink-0 border-r border-[#DED5C9] bg-[#EFE7DC]/88 px-3 py-4 shadow-[18px_0_60px_rgba(23,23,23,0.035)] backdrop-blur lg:flex lg:flex-col">
      <div className="mb-4 flex items-center justify-between px-2">
        <div>
          <p className="font-serif text-2xl font-semibold tracking-normal">Tina</p>
          <p className="mt-1 text-xs text-[#6F675E]">Hiring intelligence</p>
        </div>
        <button type="button" onClick={onNewThread} className="rounded-md border border-[#D8CEC2] bg-[#F8F5EF]/70 px-2 py-1 text-xs text-[#5F574F] transition hover:border-[#9A927E] hover:text-[#262626]">
          New
        </button>
      </div>

      <button
        type="button"
        onClick={onNewThread}
        className="mb-5 flex items-center justify-between rounded-md border border-[#D8CEC2] bg-[#F8F5EF]/55 px-3 py-2 text-sm transition hover:border-[#C8BDAE] hover:bg-[#F1ECE4]/70"
      >
        <span>New role</span>
        <ArrowRight className="h-4 w-4 text-[#6F7B5B]" />
      </button>

      <div className="px-2 text-xs font-medium uppercase tracking-[0.12em] text-[#8A8178]">Recent conversations</div>
      <div className="mt-3 grid gap-1.5">
        {threads.map((thread) => (
          <button
            key={thread.id}
            type="button"
            onClick={() => onSelectThread(thread.id)}
            className={`rounded-md px-3 py-1.5 text-left transition ${
              thread.id === activeThreadId ? "bg-[#F1ECE4] shadow-[0_10px_24px_rgba(62,52,42,0.05)]" : "hover:bg-[#F1ECE4]/70"
            }`}
          >
            <p className="text-sm font-medium text-[#262626]">{displayThreadTitle(thread)}</p>
            <p className="mt-0.5 text-xs text-[#777068]">{thread.time}</p>
          </button>
        ))}
      </div>

      <div className="mt-auto rounded-lg border border-[#D8CEC2] bg-[#F8F5EF]/70 p-3 shadow-[0_12px_30px_rgba(23,23,23,0.035)]">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#1E1E1E] text-xs font-semibold text-white">T</div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">Tina workspace</p>
            <p className="text-xs text-[#6F675E]">Calibration mode</p>
          </div>
        </div>
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
  onMessagesChange: (messages: TinaMvpMessage[]) => void;
  latestSynthesis: string;
  onSynthesis: (value: string) => void;
}) {
  const [isThinking, setIsThinking] = useState(false);
  const messages = activeThread.messages;
  const hasConversation = messages.some((message) => message.role === "founder");
  const profiles = useMemo(() => deriveCalibrationProfiles(messages), [messages]);
  const calibration = useMemo(() => deriveLiveCalibration(messages), [messages]);
  const pipeline = useMemo(() => derivePipelineIntelligence(messages), [messages]);

  async function sendMessage(content: string) {
    if (!content.trim() || isThinking) return;

    const founderMessage: TinaMvpMessage = {
      id: `founder-${Date.now()}`,
      role: "founder",
      content: content.trim()
    };
    const nextMessages = [...messages, founderMessage];

    onMessagesChange(nextMessages);
    setIsThinking(true);
    onSynthesis("Tina is translating the ask into a market and profile read...");

    try {
      const response = await fetch("/api/tina-mvp/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages })
      });
      const data = (await response.json()) as TinaChatApiResponse | { error?: string };

      if (!response.ok || !("message" in data)) throw new Error("Tina lost context.");
      const finalMessages = [...nextMessages, data.message];
      onMessagesChange(finalMessages);
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
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-[1180px] flex-col px-4 py-4 md:px-6 md:py-5">
      <header className="mb-4 text-center">
        <div className="mx-auto max-w-2xl">
          <p className="mb-2 flex items-center justify-center gap-2 text-xs text-[#6B6259]">
            <Sparkles className="h-4 w-4 text-[#6F7B5B]" />
            Hiring intelligence before the search begins
          </p>
          <h1 className="font-serif text-2xl font-semibold tracking-normal text-[#171717] md:text-3xl">
            Tell Tina what you’re hiring for.
          </h1>
          <p className="mt-2 text-sm leading-6 text-[#625A52]">She’ll calibrate the role, pressure-test the market, and turn the conversation into a live hiring read.</p>
        </div>
      </header>

      <section className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex min-h-[calc(100vh-170px)] flex-col overflow-hidden rounded-lg border border-[#DDD2C5] bg-[#FFFCF7]/92 shadow-[0_18px_56px_rgba(23,23,23,0.065)] backdrop-blur">
          <div className="border-b border-[#E7DDD1] bg-[linear-gradient(180deg,rgba(255,255,255,0.52),rgba(255,252,247,0))] px-4 py-3">
            <p className="text-sm font-semibold">Tina</p>
            <p className="mt-0.5 text-xs text-[#6F675E]">Conversation first. Calibration forms alongside it.</p>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4">
            <div className="mx-auto grid max-w-2xl gap-3">
              {messages.map((message, index) => (
                <ChatMessage key={message.id} message={message} signals={message.role === "tina" ? deriveInlineSignals(messages.slice(0, index + 1)) : []} />
              ))}
              {isThinking ? (
                <div className="flex gap-3">
                  <TinaMark />
                  <div>
                    <p className="text-sm font-semibold">Tina</p>
                    <p className="mt-2 text-sm text-[#6F7B5B]">Reading the hiring signal...</p>
                    <InlineSignalRows signals={["Live calibration updating", "Market read forming"]} />
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <div className="border-t border-[#E7DDD1] bg-[#F8F4ED]/70 p-3">
            <CommandInput onSubmit={sendMessage} isThinking={isThinking} />
          </div>
        </div>

        <RightIntelligenceRail
          hasConversation={hasConversation}
          profiles={profiles}
          calibration={calibration}
          pipeline={pipeline}
          latestSynthesis={latestSynthesis}
        />
      </section>
    </div>
  );
}

function CommandInput({ onSubmit, isThinking }: { onSubmit: (value: string) => void; isThinking: boolean }) {
  const [value, setValue] = useState("");
  const placeholder = prompts[0];

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = value.trim();
    if (!content || isThinking) return;
    onSubmit(content);
    setValue("");
  }

  function sendOnEnter(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.nativeEvent.isComposing) return;
    if (event.key !== "Enter" && event.code !== "Enter" && event.code !== "NumpadEnter") return;
    if (event.metaKey) return;

    event.preventDefault();
    const content = value.trim();
    if (!content || isThinking) return;
    onSubmit(content);
    setValue("");
  }

  return (
    <form onSubmit={submit} className="rounded-lg border border-[#D8CEC2] bg-[#FFFCF7] p-3 shadow-[0_14px_36px_rgba(62,52,42,0.055)] transition focus-within:border-[#9A927E] focus-within:shadow-[0_18px_48px_rgba(62,52,42,0.08)]">
      <textarea
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={sendOnEnter}
        placeholder={placeholder}
        className="min-h-20 w-full resize-none bg-transparent text-sm leading-6 text-[#171717] outline-none placeholder:text-[#9B9289]"
      />
      <div className="mt-3 flex flex-col gap-3 border-t border-[#E7DDD1] pt-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {["Need an AI product engineer", "Founder is still the bottleneck", "Strong people keep hesitating"].map((chip) => (
            <button
              key={chip}
              type="button"
              onClick={() => setValue(chip)}
              className="rounded-full border border-[#DED5C9] bg-[#F8F4ED]/70 px-3 py-1.5 text-xs text-[#625A52] transition hover:border-[#C8BDAE] hover:bg-[#F1ECE4] hover:text-[#262626]"
            >
              {chip}
            </button>
          ))}
        </div>
        <button
          type="submit"
          className="inline-flex items-center justify-center gap-2 rounded-md bg-[#1E1E1E] px-3.5 py-2 text-sm font-medium text-white shadow-[0_10px_28px_rgba(23,23,23,0.18)] transition hover:bg-[#262626] disabled:opacity-60"
          disabled={isThinking}
        >
          Send
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </form>
  );
}

function ChatMessage({ message, signals }: { message: TinaMvpMessage; signals: string[] }) {
  if (message.role === "founder") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[74%] rounded-lg border border-[#E2D7CB] bg-[#F1ECE4] px-4 py-3 text-sm leading-6 text-[#171717] shadow-[0_8px_22px_rgba(23,23,23,0.035)]">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3">
      <TinaMark />
      <div className="min-w-0">
        <p className="text-sm font-semibold">Tina</p>
        <p className="mt-2 max-w-lg whitespace-pre-line text-sm leading-6 text-[#262626]">{message.content}</p>
        <InlineSignalRows signals={signals} />
      </div>
    </div>
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
  const founderText = messages
    .filter((message) => message.role === "founder")
    .map((message) => message.content.trim())
    .join(" ");
  if (!founderText) return "New role";

  const extractedRole = extractRoleTitle(founderText);
  const title = extractedRole || compactRoleTitle(founderText);

  return title.charAt(0).toUpperCase() + title.slice(1);
}

function shouldAutoRenameThread(title: string) {
  return isProvisionalThreadTitle(title);
}

function displayThreadTitle(thread: ChatThread) {
  return isProvisionalThreadTitle(thread.title) ? titleFromMessages(thread.messages) : thread.title;
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
  if (word.length <= 3 && word === word.toUpperCase()) return word;
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

function isSpecificRoleTitle(title: string) {
  if (!title || title.length < 4) return false;
  return /\b(engineer|designer|manager|operator|pm|product|sales|recruiter|lead|head|founder|chief|staff|marketer|growth|plant|backend|frontend|ai|ml|data)\b/i.test(title);
}

function TinaMark() {
  return <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#1E1E1E] text-xs font-semibold text-white">T</div>;
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
  hasConversation,
  profiles,
  calibration,
  pipeline,
  latestSynthesis
}: {
  hasConversation: boolean;
  profiles: ReturnType<typeof deriveCalibrationProfiles>;
  calibration: LiveCalibration;
  pipeline: PipelineIntelligence;
  latestSynthesis: string;
}) {
  return (
    <aside className="hidden max-h-[calc(100vh-170px)] overflow-y-auto xl:block">
      <div className="grid gap-4 pr-1">
        {hasConversation ? (
          <CalibrationProfiles
            profiles={profiles}
            calibration={calibration}
            latestSynthesis={latestSynthesis}
          />
        ) : (
          <EmptyCalibrationPanel calibration={calibration} />
        )}

        <PipelineIntelligenceModule key={pipeline.defaultState} pipeline={pipeline} />
      </div>
    </aside>
  );
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

        <ModuleCard title="Candidate lanes">
          <div className="grid gap-2.5">
            {profiles.slice(0, showFullCalibration ? 3 : 2).map((profile) => (
              <CalibrationProfileCard key={profile.title} profile={profile} />
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
      <div className="relative h-2 rounded-full bg-[#E7DDD1]">
        <div className="absolute inset-y-0 left-0 rounded-full bg-[#B8B09D] transition-all duration-700 ease-out" style={{ width: `${value}%` }} />
        <div className="absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full border border-[#D8CEC2] bg-white shadow-[0_4px_12px_rgba(23,23,23,0.12)] transition-all duration-700 ease-out" style={{ left: `calc(${value}% - 8px)` }} />
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

function CalibrationProfileCard({ profile }: { profile: ReturnType<typeof deriveCalibrationProfiles>[number] }) {
  return (
    <article className="rounded-lg border border-[#E2D7CB] bg-[linear-gradient(180deg,rgba(255,255,255,0.72),rgba(255,252,247,0.72))] p-3 shadow-[0_10px_28px_rgba(23,23,23,0.035)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">{profile.title}</h3>
          <p className="mt-1.5 text-xs leading-5 text-[#5A524A]">{profile.why}</p>
        </div>
        <span className="shrink-0 rounded-full bg-[#EEF1E8] px-2.5 py-1 text-xs text-[#5F6D4E]">{profile.match}%</span>
      </div>

      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {profile.keywords.map((keyword) => (
          <span key={keyword} className="rounded-full bg-[#F1ECE4] px-2.5 py-1 text-xs text-[#625A52]">
            {keyword}
          </span>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <ProfileMetric label="Market" value={profile.marketSize} />
        <ProfileMetric label="Comp" value={profile.comp} />
        <ProfileMetric label="Fill time" value={profile.timeToFill} />
        <ProfileMetric label="Top locations" value={profile.locations} />
      </div>

      <div className="mt-4">
        <p className="mb-2 text-xs font-medium uppercase tracking-[0.12em] text-[#8A8178]">Talent distribution</p>
        <DistributionBar values={profile.distribution} />
      </div>
    </article>
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

function DistributionBar({ values }: { values: number[] }) {
  const colors = ["#6F7B5B", "#B8B09D", "#262626"];

  return (
    <div className="flex h-2 overflow-hidden rounded-full bg-[#E7DDD1]">
      {values.map((value, index) => (
        <div key={`${value}-${index}`} style={{ width: `${value}%`, background: colors[index] }} />
      ))}
    </div>
  );
}

function deriveInlineSignals(messages: TinaMvpMessage[]) {
  const founderMessages = messages.filter((message) => message.role === "founder");
  if (!founderMessages.length) return [];

  const text = founderMessages.map((message) => message.content).join(" ").toLowerCase();
  const depth = founderMessages.length;
  const isAI = /\b(ai|llm|model|agent|machine learning|ml)\b/.test(text);
  const isProduct = /\b(product|customer|workflow|pm|designer|design)\b/.test(text);
  const isOperator = /\b(operator|ops|operations|chief of staff|founder office|bottleneck)\b/.test(text);
  const isSenior = /\b(senior|lead|founding|head of|principal|staff)\b/.test(text);
  const domain = /\b(fintech|healthcare|medical|crypto|web3|security|sales|gtm|domain)\b/.test(text);
  const speed = /\b(fast|quick|speed|urgent|young|sharp|high slope|move)\b/.test(text);
  const signals: string[] = [];

  if (isAI && isProduct) {
    signals.push("Candidate pool shrinks ~38%");
    signals.push("Adjacent backgrounds detected");
  } else if (isAI) {
    signals.push("AI talent pool narrowing");
  } else if (isOperator) {
    signals.push("Founder-adjacent operator lane forming");
  } else if (isProduct) {
    signals.push("Product judgment becoming primary signal");
  } else {
    signals.push("Role clarity still forming");
  }

  if (domain) signals.push("Domain filter increases market pressure");
  if (isSenior || speed) signals.push("Compensation pressure increasing");
  if (depth >= 2) signals.push("Strongest markets: SF, NYC");
  if (depth >= 3) signals.push("Calibration read stabilizing");

  return Array.from(new Set(signals));
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
  jdSummary: string;
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
  const text = founderMessages.map((message) => message.content).join(" ").toLowerCase();
  const depth = founderMessages.length;
  const isAI = /\b(ai|llm|model|agent|machine learning|ml)\b/.test(text);
  const isProduct = /\b(product|customer|workflow|pm|designer|design)\b/.test(text);
  const isOperator = /\b(operator|ops|operations|chief of staff|founder office|bottleneck)\b/.test(text);
  const isSenior = /\b(senior|lead|founding|head of|principal|staff)\b/.test(text);
  const speed = /\b(fast|quick|speed|urgent|young|sharp|high slope|move)\b/.test(text);
  const domain = /\b(fintech|healthcare|medical|crypto|web3|security|sales|gtm|domain)\b/.test(text);
  const clarity = Math.min(86, 28 + depth * 14 + (isAI || isProduct || isOperator ? 10 : 0) + (isSenior ? 6 : 0));

  return {
    depth,
    clarity,
    clarityLabel: depth === 0 ? "Waiting for the first hiring signal" : depth < 3 ? "Early read, still forming" : "Enough signal to pressure-test the lane",
    marketPressure: marketPressureFor({ isAI, isSenior, domain, speed }),
    poolImpact: poolImpactFor({ isAI, isOperator, isProduct, domain }),
    nextAction: nextFounderAction({ depth, isAI, isProduct, isOperator }),
    jdSummary: summarizeRole({ isAI, isProduct, isOperator, isSenior, speed, domain }),
    keywords: sourcingKeywordsFor({ isAI, isProduct, isOperator, isSenior, domain, speed }),
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
  domain
}: {
  isAI: boolean;
  isProduct: boolean;
  isOperator: boolean;
  isSenior: boolean;
  speed: boolean;
  domain: boolean;
}) {
  if (isOperator) return "Founder-adjacent operator who can absorb loose context, close loops, and reduce leadership drag without adding heavy process.";
  if (isAI && isProduct) return "AI product builder who can turn ambiguous customer problems into reliable workflows, not just impressive demos.";
  if (isAI) return "Technical AI builder with enough product judgment to ship in messy startup conditions.";
  if (isProduct) return "Product-minded operator who can convert customer signal into clear execution without hiding behind process.";
  if (domain) return "Domain-aware builder who can move fast without flattening the market or customer nuance.";
  if (isSenior && speed) return "Senior enough to raise the bar, but still impatient enough to ship before the org becomes ceremonial.";
  return "High-ownership startup hire who clarifies the role as much as they execute it.";
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
        marketSize: "1.8k-3.2k",
        comp: "$170k-$240k",
        timeToFill: "8-12 wks",
        locations: "SF, NYC, Remote",
        distribution: [42, 31, 27]
      },
      {
        title: "High-Agency Generalist",
        why: "Useful if the role crosses product, customers, ops, and execution without clean boundaries.",
        match: 78,
        keywords: ["ambiguity", "loop closing", "calm urgency"],
        marketSize: "3k-5k",
        comp: "$140k-$210k",
        timeToFill: "6-10 wks",
        locations: "SF, Austin, NYC",
        distribution: [36, 34, 30]
      }
    ];
  }

  if (isAI || isProduct) {
    return [
      {
        title: isProduct ? "AI Product Builder" : "Native AI Engineer",
        why: "Matches the need for AI-native work that can become real customer-facing product.",
        match: speed ? 88 : 82,
        keywords: ["AI workflows", "product judgment", "eval instincts"],
        marketSize: "900-1.6k",
        comp: isSenior ? "$220k-$330k" : "$180k-$260k",
        timeToFill: "10-14 wks",
        locations: "SF, NYC, London",
        distribution: [48, 28, 24]
      },
      {
        title: "Product-Minded Systems Builder",
        why: "Good lane if reliability matters as much as demo speed.",
        match: 76,
        keywords: ["production AI", "systems taste", "workflow reliability"],
        marketSize: "1.4k-2.4k",
        comp: "$200k-$300k",
        timeToFill: "9-13 wks",
        locations: "SF, Seattle, Remote",
        distribution: [44, 25, 31]
      },
      {
        title: "High-Slope Applied AI Generalist",
        why: "Worth testing if the founder cares more about learning velocity than deep research pedigree.",
        match: 71,
        keywords: ["prototype speed", "customer learning", "young sharp builder"],
        marketSize: "2k-4k",
        comp: "$150k-$230k",
        timeToFill: "6-9 wks",
        locations: "NYC, SF, Toronto",
        distribution: [35, 33, 32]
      }
    ];
  }

  return [
    {
      title: "Zero-to-One Generalist",
      why: "A flexible starting profile while Tina learns whether the real constraint is product, ops, or founder leverage.",
      match: 70,
      keywords: ["ambiguity", "ownership", "clarity creation"],
      marketSize: "4k-7k",
      comp: "$130k-$210k",
      timeToFill: "6-10 wks",
      locations: "SF, NYC, Remote",
      distribution: [34, 33, 33]
    },
    {
      title: "Customer-Obsessed Builder",
      why: "Useful if the hire needs to turn fuzzy customer pain into product or operating direction.",
      match: 66,
      keywords: ["customer signal", "taste", "execution"],
      marketSize: "2.5k-4.5k",
      comp: "$150k-$230k",
      timeToFill: "7-11 wks",
      locations: "NYC, SF, LA",
      distribution: [37, 36, 27]
    }
  ];
}
