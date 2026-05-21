"use client";

import { FormEvent, KeyboardEvent, useMemo, useState } from "react";
import {
  ArrowRight,
  BadgeCheck,
  Brain,
  Gem,
  LineChart,
  MessageSquareText,
  Radar,
  Search,
  Sparkles,
  Target,
  UsersRound
} from "lucide-react";

import type { TinaChatApiResponse, TinaMvpMessage } from "@/lib/tina-mvp/types";

type View = "home" | "role";

const prompts = [
  "What feels unresolved about this hire?",
  "Where does this hiring process feel uncertain?",
  "What tension are you seeing in this role?"
];

const activeSearches = [
  {
    title: "Founding AI Product Engineer",
    stage: "Calibration",
    confidence: 76,
    read: "Strong need for product judgment plus practical AI reliability. Market likely wider than frontier-lab-only."
  },
  {
    title: "Startup Operator",
    stage: "Role shaping",
    confidence: 62,
    read: "Founder wants leverage without process weight. The real screen is judgment under loose ownership."
  },
  {
    title: "Founding Designer",
    stage: "Market read",
    confidence: 68,
    read: "This is less visual polish, more product taste under ambiguity and engineering proximity."
  }
];

const insightCards = [
  {
    label: "Tina noticed",
    title: "The AI engineer role is drifting broad.",
    body: "The search is asking for native AI depth, product taste, and high-slope builder energy. That can work, but only if the first 90 days are very concrete.",
    tone: "amber"
  },
  {
    label: "Calibration summary",
    title: "You seem allergic to pure specialists.",
    body: "The pattern across recent searches is clear: you trust people who can translate ambiguity into motion, not people who wait for mature lanes.",
    tone: "green"
  },
  {
    label: "Open question",
    title: "Speed and reliability are competing quietly.",
    body: "The role may need someone who prototypes fast but knows when AI behavior is too brittle for customer-facing use.",
    tone: "blue"
  }
];

const roleArchetypes = [
  {
    title: "Product Instinct Operator",
    confidence: 84,
    fit: "Turns customer ambiguity into product direction without waiting for a perfect roadmap.",
    strengths: ["Customer pattern recognition", "Fast prioritization", "Founder-context fluency"],
    tradeoff: "May be less deep on model internals.",
    style: "Low-ego, high-context, close to users and engineering."
  },
  {
    title: "AI Systems Builder",
    confidence: 78,
    fit: "Can make AI behavior reliable enough to survive real workflows.",
    strengths: ["Eval instincts", "Practical architecture", "Production reliability"],
    tradeoff: "May push for more technical rigor than the product cycle wants.",
    style: "Calm, technical, skeptical of demo magic."
  },
  {
    title: "Execution Accelerator",
    confidence: 71,
    fit: "Ships fast in messy environments and helps the team learn faster.",
    strengths: ["High agency", "Prototype speed", "Ambiguity tolerance"],
    tradeoff: "Needs a clear bar for quality or may over-iterate.",
    style: "Energetic, direct, allergic to slow process."
  }
];

const roleTensions = [
  ["AI depth", "Product judgment", 72],
  ["Shipping speed", "Reliability", 58],
  ["High slope", "Senior judgment", 64],
  ["Founder proximity", "Independent ownership", 69]
];

const openingMessage: TinaMvpMessage = {
  id: "tina-opening",
  role: "tina",
  content: "Tell me what feels unresolved about the hire. I’ll help turn the messy version into a sharper market read."
};

export function TinaWorkspace() {
  const [view, setView] = useState<View>("home");
  const [latestSynthesis, setLatestSynthesis] = useState(
    "Tina is watching for the difference between a strong title match and a person who actually reduces founder ambiguity."
  );

  return (
    <main className="relative min-h-screen overflow-hidden bg-white text-[#171717]">
      <div className="relative z-10 flex min-h-screen">
        <Sidebar view={view} onChange={setView} />
        <div className="min-w-0 flex-1">
          {view === "home" ? (
            <HomeCommandCenter onSynthesis={setLatestSynthesis} latestSynthesis={latestSynthesis} />
          ) : (
            <RoleWorkspace onBackHome={() => setView("home")} latestSynthesis={latestSynthesis} />
          )}
        </div>
      </div>
    </main>
  );
}

function Sidebar({ view, onChange }: { view: View; onChange: (view: View) => void }) {
  return (
    <aside className="hidden w-56 shrink-0 border-r border-[#DED5C9] bg-[#EFE7DC]/88 px-3 py-4 shadow-[18px_0_60px_rgba(23,23,23,0.035)] backdrop-blur lg:flex lg:flex-col">
      <div className="mb-4 flex items-center justify-between px-2">
        <div>
          <p className="font-serif text-2xl font-semibold tracking-normal">Tina</p>
          <p className="mt-1 text-xs text-[#6F675E]">Hiring intelligence</p>
        </div>
        <button type="button" onClick={() => onChange("home")} className="rounded-md border border-[#D8CEC2] bg-[#F8F5EF]/70 px-2 py-1 text-xs text-[#5F574F] transition hover:border-[#9A927E] hover:text-[#262626]">
          New
        </button>
      </div>

      <button
        type="button"
        onClick={() => onChange("home")}
        className={`mb-5 flex items-center justify-between rounded-md border px-3 py-2 text-sm transition ${
          view === "home" ? "border-[#B8B09D] bg-[#F1ECE4] shadow-[0_12px_32px_rgba(62,52,42,0.06)]" : "border-[#D8CEC2] bg-[#F8F5EF]/55 hover:border-[#C8BDAE] hover:bg-[#F1ECE4]/70"
        }`}
      >
        <span>New conversation</span>
        <ArrowRight className="h-4 w-4 text-[#6F7B5B]" />
      </button>

      <div className="px-2 text-xs font-medium uppercase tracking-[0.12em] text-[#8A8178]">Recent conversations</div>
      <div className="mt-3 grid gap-1.5">
        {[
          ["AI Engineer", "Just now"],
          ["Head of Product", "2 days ago"],
          ["Senior Product Designer", "5 days ago"]
        ].map(([title, time], index) => (
          <button
            key={title}
            type="button"
            onClick={() => onChange(index === 0 ? "home" : "role")}
            className="rounded-md px-3 py-1.5 text-left transition hover:bg-[#F1ECE4]/70"
          >
            <p className="text-sm font-medium text-[#262626]">{title}</p>
            <p className="mt-0.5 text-xs text-[#777068]">{time}</p>
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
  latestSynthesis,
  onSynthesis
}: {
  latestSynthesis: string;
  onSynthesis: (value: string) => void;
}) {
  const [messages, setMessages] = useState<TinaMvpMessage[]>([openingMessage]);
  const [isThinking, setIsThinking] = useState(false);
  const hasConversation = messages.some((message) => message.role === "founder");
  const profiles = useMemo(() => deriveCalibrationProfiles(messages), [messages]);

  async function sendMessage(content: string) {
    if (!content.trim() || isThinking) return;

    const founderMessage: TinaMvpMessage = {
      id: `founder-${Date.now()}`,
      role: "founder",
      content: content.trim()
    };
    const nextMessages = [...messages, founderMessage];

    setMessages(nextMessages);
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
      setMessages(finalMessages);
      onSynthesis(data.message.content);
    } catch {
      const errorMessage: TinaMvpMessage = {
        id: `tina-error-${Date.now()}`,
        role: "tina",
        content: "Tina lost context for a second. Try again."
      };
      setMessages([...nextMessages, errorMessage]);
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
          <p className="mt-2 text-sm leading-6 text-[#625A52]">She’ll calibrate the role, pressure-test the market, and show candidate perspectives as the conversation sharpens.</p>
        </div>
      </header>

      <section className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-h-[calc(100vh-170px)] flex-col overflow-hidden rounded-lg border border-[#DDD2C5] bg-[#FFFCF7]/92 shadow-[0_18px_56px_rgba(23,23,23,0.065)] backdrop-blur">
          <div className="border-b border-[#E7DDD1] bg-[linear-gradient(180deg,rgba(255,255,255,0.52),rgba(255,252,247,0))] px-4 py-3">
            <p className="text-sm font-semibold">Tina</p>
            <p className="mt-0.5 text-xs text-[#6F675E]">Conversation first. Calibration forms alongside it.</p>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4">
            <div className="mx-auto grid max-w-2xl gap-4">
              {messages.map((message) => (
                <ChatMessage key={message.id} message={message} />
              ))}
              {isThinking ? (
                <div className="flex gap-3">
                  <TinaMark />
                  <div>
                    <p className="text-sm font-semibold">Tina</p>
                    <p className="mt-2 text-sm text-[#6F7B5B]">Reading the hiring signal...</p>
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <div className="border-t border-[#E7DDD1] bg-[#F8F4ED]/70 p-3">
            <CommandInput onSubmit={sendMessage} isThinking={isThinking} />
          </div>
        </div>

        {hasConversation ? (
          <CalibrationProfiles
            profiles={profiles}
            latestSynthesis={latestSynthesis}
          />
        ) : (
          <EmptyCalibrationPanel />
        )}
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

function ChatMessage({ message }: { message: TinaMvpMessage }) {
  if (message.role === "founder") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[78%] rounded-lg border border-[#E2D7CB] bg-[#F1ECE4] px-4 py-3 text-sm leading-6 text-[#171717] shadow-[0_8px_22px_rgba(23,23,23,0.035)]">
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
        <p className="mt-2 max-w-2xl whitespace-pre-line text-[15px] leading-7 text-[#262626]">{message.content}</p>
      </div>
    </div>
  );
}

function TinaMark() {
  return <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#1E1E1E] text-xs font-semibold text-white">T</div>;
}

function EmptyCalibrationPanel() {
  return (
    <aside className="hidden rounded-lg border border-dashed border-[#D8CEC2] bg-[#FFFCF7]/72 p-4 shadow-[0_14px_40px_rgba(23,23,23,0.04)] backdrop-blur xl:block">
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#8A8178]">Calibration profiles</p>
      <h2 className="mt-2 text-lg font-semibold leading-6">Profiles appear once the conversation starts.</h2>
      <p className="mt-2 text-sm leading-6 text-[#625A52]">
        Tina will translate the conversation into potential candidate lanes, market size, comp, time to fill, and talent location signals.
      </p>
      <div className="mt-4 grid gap-3">
        <GhostProfileLine />
        <GhostProfileLine />
        <GhostProfileLine />
      </div>
    </aside>
  );
}

function GhostProfileLine() {
  return (
    <div className="rounded-lg border border-[#E2D7CB] bg-[#FFFCF7]/70 p-4">
      <div className="h-3 w-32 rounded-full bg-[#EDE5DB]" />
      <div className="mt-3 h-2 w-full rounded-full bg-[#EDE5DB]" />
      <div className="mt-2 h-2 w-3/4 rounded-full bg-[#EDE5DB]" />
    </div>
  );
}

function CalibrationProfiles({
  profiles,
  latestSynthesis
}: {
  profiles: ReturnType<typeof deriveCalibrationProfiles>;
  latestSynthesis: string;
}) {
  return (
    <aside className="max-h-[calc(100vh-120px)] overflow-y-auto rounded-lg border border-[#DDD2C5] bg-[#FFFCF7]/90 p-3 shadow-[0_16px_48px_rgba(23,23,23,0.06)] backdrop-blur">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#8A8178]">Market shift</p>
          <h2 className="mt-1 text-base font-semibold">Calibration is moving</h2>
        </div>
        <Brain className="h-4 w-4 text-[#6F7B5B]" />
      </div>

      <p className="mb-3 rounded-md border border-[#E7DDD1] bg-[#F8F4ED] p-2.5 text-xs leading-5 text-[#4B453F] shadow-[0_10px_28px_rgba(62,52,42,0.04)]">{latestSynthesis}</p>

      <div className="mb-4 grid grid-cols-3 gap-2">
        <ProfileMetric label="Pool" value={profiles[0]?.marketSize || "TBD"} />
        <ProfileMetric label="Timeline" value={profiles[0]?.timeToFill || "TBD"} />
        <ProfileMetric label="Comp" value={profiles[0]?.comp || "TBD"} />
      </div>

      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#8A8178]">Profile lanes</p>
          <h3 className="mt-1 text-sm font-semibold">What to test first</h3>
        </div>
        <UsersRound className="h-4 w-4 text-[#6F7B5B]" />
      </div>

      <div className="grid gap-2.5">
        {profiles.map((profile) => (
          <CalibrationProfileCard key={profile.title} profile={profile} />
        ))}
      </div>
    </aside>
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

function RoleWorkspace({ onBackHome, latestSynthesis }: { onBackHome: () => void; latestSynthesis: string }) {
  return (
    <div className="mx-auto max-w-7xl px-5 py-5 md:px-8 md:py-7">
      <button type="button" onClick={onBackHome} className="mb-5 text-sm text-[#625A52] hover:text-[#171717]">
        Home / Roles
      </button>

      <header className="mb-6 rounded-lg border border-[#DDD2C5] bg-[#FFFCF7]/90 p-6 shadow-[0_20px_60px_rgba(23,23,23,0.075)] backdrop-blur">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="mb-3 flex flex-wrap gap-2">
              <StatusChip icon={Sparkles} label="Living role" />
              <StatusChip icon={BadgeCheck} label="76% confidence" />
              <StatusChip icon={Radar} label="2 active tensions" />
            </div>
            <h1 className="text-4xl font-semibold tracking-normal">Founding AI Product Engineer</h1>
            <p className="mt-3 max-w-3xl text-[15px] leading-7 text-[#5A524A]">
              Tina reads this as a product-minded AI builder role, not a pure research or prompt role. The hire needs to turn customer ambiguity into reliable AI workflows.
            </p>
          </div>
          <ConfidencePanel />
        </div>
      </header>

      <div className="mb-5 flex gap-2 overflow-x-auto">
        {["Overview", "Archetypes", "Pipeline", "Insights", "Hiring Plan"].map((tab, index) => (
          <button
            key={tab}
            type="button"
            className={`shrink-0 rounded-md px-3 py-2 text-sm transition ${index === 0 ? "bg-[#1E1E1E] text-white shadow-[0_12px_30px_rgba(23,23,23,0.12)]" : "border border-[#D8CEC2] bg-[#FFFCF7] text-[#625A52] hover:border-[#C8BDAE] hover:bg-[#F1ECE4]"}`}
          >
            {tab}
          </button>
        ))}
      </div>

      <section className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="grid gap-5">
          <Module title="Living Role Definition" icon={MessageSquareText}>
            <p className="text-lg leading-8 text-[#262626]">
              Build customer-facing AI workflows that feel reliable, useful, and fast to iterate.
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <DefinitionPoint label="Must prove" text="AI behavior that survived real users" />
              <DefinitionPoint label="Not enough" text="Prompt fluency or demo polish" />
              <DefinitionPoint label="First 90 days" text="One workflow shipped, measured, and trusted" />
            </div>
          </Module>

          <Module title="Candidate Archetypes" icon={Gem}>
            <div className="grid gap-3">
              {roleArchetypes.map((archetype) => (
                <ArchetypeCard key={archetype.title} {...archetype} />
              ))}
            </div>
          </Module>
        </div>

        <div className="grid gap-5">
          <Module title="Hiring Tension Map" icon={Target}>
            <div className="grid gap-4">
              {roleTensions.map(([left, right, value]) => (
                <TensionMap key={`${left}-${right}`} left={String(left)} right={String(right)} value={Number(value)} />
              ))}
            </div>
          </Module>

          <RiskRadar />

          <Module title="Tina Recommendations" icon={Brain}>
            <div className="grid gap-3">
              <Recommendation text="Do not over-filter for frontier lab pedigree. It may narrow the market before you know whether the role truly needs it." />
              <Recommendation text="Interview for judgment speed: give a messy customer problem and watch how quickly they separate useful signal from noise." />
              <Recommendation text={latestSynthesis} />
            </div>
          </Module>

          <InterviewFocusCard />
        </div>
      </section>
    </div>
  );
}

function InsightCard({ label, title, body, tone }: { label: string; title: string; body: string; tone: string }) {
  const colors: Record<string, string> = {
    amber: "bg-[#F1ECE4] text-[#6D5B45]",
    green: "bg-[#EEF1E8] text-[#5F6D4E]",
    blue: "bg-[#F3EFE8] text-[#625A52]"
  };

  return (
    <article className="rounded-lg border border-[#DDD2C5] bg-[#FFFCF7]/86 p-4 shadow-[0_14px_36px_rgba(23,23,23,0.05)]">
      <span className={`rounded-full px-2.5 py-1 text-xs ${colors[tone]}`}>{label}</span>
      <h2 className="mt-4 text-base font-semibold leading-6">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-[#5A524A]">{body}</p>
    </article>
  );
}

function Module({ title, icon: Icon, children }: { title: string; icon: typeof Brain; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-[#DDD2C5] bg-[#FFFCF7]/88 p-5 shadow-[0_16px_44px_rgba(23,23,23,0.055)] backdrop-blur">
      <div className="mb-4 flex items-center gap-2">
        <Icon className="h-4 w-4 text-[#6F7B5B]" />
        <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-[#625A52]">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function ArchetypeCard({ title, confidence, fit, strengths, tradeoff, style }: (typeof roleArchetypes)[number]) {
  return (
    <article className="rounded-lg border border-[#E2D7CB] bg-[#FFFCF7]/70 p-4 transition hover:border-[#C8BDAE] hover:bg-white hover:shadow-[0_14px_38px_rgba(62,52,42,0.06)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold">{title}</h3>
          <p className="mt-2 text-sm leading-6 text-[#5A524A]">{fit}</p>
        </div>
        <span className="shrink-0 rounded-full bg-[#EEF1E8] px-3 py-1 text-sm text-[#5F6D4E]">{confidence}% match</span>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-[#8A8178]">Strengths</p>
          <p className="mt-2 text-sm leading-6 text-[#5A524A]">{strengths.join(", ")}</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-[#8A8178]">Tradeoff</p>
          <p className="mt-2 text-sm leading-6 text-[#5A524A]">{tradeoff}</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-[#8A8178]">Operating style</p>
          <p className="mt-2 text-sm leading-6 text-[#5A524A]">{style}</p>
        </div>
      </div>
    </article>
  );
}

function RiskRadar() {
  return (
    <section className="rounded-lg border border-[#DDD2C5] bg-[#FFFCF7]/88 p-5 shadow-[0_16px_44px_rgba(23,23,23,0.055)]">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-[#625A52]">Risk radar</p>
          <h2 className="mt-1 text-lg font-semibold">Where the hire could drift</h2>
        </div>
        <Radar className="h-5 w-5 text-[#6F7B5B]" />
      </div>
      <div className="grid gap-3">
        <RiskLine label="Demo fluency mistaken for product judgment" value={78} />
        <RiskLine label="Role over-scoped for current market" value={64} />
        <RiskLine label="Founder proximity unclear" value={52} />
      </div>
    </section>
  );
}

function InterviewFocusCard() {
  return (
    <section className="rounded-lg border border-[#262626] bg-[#1E1E1E] p-5 text-white shadow-[0_18px_50px_rgba(23,23,23,0.18)]">
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-[#D8CEC2]">Interview focus</p>
      <h2 className="mt-2 text-xl font-semibold">Watch how they think when the workflow breaks.</h2>
      <p className="mt-3 text-sm leading-6 text-[#EFE7DC]">
        Give them a messy customer workflow, a brittle AI behavior, and one business constraint. The signal is how quickly they find the real failure point.
      </p>
    </section>
  );
}

function ConfidencePanel() {
  return (
    <div className="w-full rounded-lg border border-[#E2D7CB] bg-[#F8F4ED]/76 p-4 lg:w-72">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Hiring readiness</p>
        <p className="text-2xl font-semibold">76%</p>
      </div>
      <div className="mt-3 h-2 rounded-full bg-[#E7DDD1]">
        <div className="h-full w-[76%] rounded-full bg-[#6F7B5B]" />
      </div>
      <p className="mt-3 text-sm leading-6 text-[#625A52]">Clear enough to start market testing. Not clear enough to lock the scorecard.</p>
    </div>
  );
}

function TensionMap({ left, right, value }: { left: string; right: string; value: number }) {
  return (
    <div>
      <div className="mb-2 flex justify-between text-sm text-[#5A524A]">
        <span>{left}</span>
        <span>{right}</span>
      </div>
      <div className="h-2 rounded-full bg-[#E7DDD1]">
        <div className="h-full rounded-full bg-[#6F7B5B]" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function RiskLine({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3 text-sm">
        <span>{label}</span>
        <span className="text-[#8A8178]">{value}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-[#E7DDD1]">
        <div className="h-full rounded-full bg-[#9A927E]" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function MiniConfidence({ value }: { value: number }) {
  return (
    <div className="mt-4 flex items-center gap-3">
      <div className="h-1.5 flex-1 rounded-full bg-[#E7DDD1]">
        <div className="h-full rounded-full bg-[#6F7B5B]" style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs text-[#6F675E]">{value}%</span>
    </div>
  );
}

function ConfidencePill({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-full border border-[#D8CEC2] bg-[#FFFCF7] px-4 py-2 text-sm shadow-sm">
      <span className="mr-2 text-[#6F7B5B]">{value}%</span>
      <span className="text-[#625A52]">{label}</span>
    </div>
  );
}

function StatusChip({ icon: Icon, label }: { icon: typeof Sparkles; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[#D8CEC2] bg-[#FFFCF7]/70 px-3 py-1.5 text-xs text-[#625A52]">
      <Icon className="h-3.5 w-3.5 text-[#6F7B5B]" />
      {label}
    </span>
  );
}

function SynthesisLine({ label, text }: { label: string; text: string }) {
  return (
    <div className="rounded-md border border-[#E7DDD1] bg-[#F8F4ED] p-3">
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-[#8A8178]">{label}</p>
      <p className="mt-1 text-sm leading-6 text-[#5A524A]">{text}</p>
    </div>
  );
}

function SectionHeader({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-[#8A8178]">{eyebrow}</p>
      <h2 className="mt-1 text-xl font-semibold">{title}</h2>
    </div>
  );
}

function DecisionCard({ title, text }: { title: string; text: string }) {
  return (
    <article className="rounded-lg border border-[#DDD2C5] bg-[#FFFCF7] p-4 shadow-[0_14px_36px_rgba(23,23,23,0.05)]">
      <Search className="mb-3 h-4 w-4 text-[#6F7B5B]" />
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-[#625A52]">{text}</p>
    </article>
  );
}

function DefinitionPoint({ label, text }: { label: string; text: string }) {
  return (
    <div className="rounded-md border border-[#E7DDD1] bg-[#F8F4ED] p-3">
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-[#8A8178]">{label}</p>
      <p className="mt-2 text-sm leading-6 text-[#5A524A]">{text}</p>
    </div>
  );
}

function Recommendation({ text }: { text: string }) {
  return (
    <div className="flex gap-3 rounded-md border border-[#E7DDD1] bg-[#F8F4ED] p-3">
      <LineChart className="mt-0.5 h-4 w-4 shrink-0 text-[#6F7B5B]" />
      <p className="text-sm leading-6 text-[#5A524A]">{text}</p>
    </div>
  );
}
