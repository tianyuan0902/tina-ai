"use client";

import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import { ArrowUp } from "lucide-react";

import { CandidateArchetypeCards } from "@/components/tina-mvp/candidate-archetype-cards";
import { createOpeningMessage, reasonAboutHiringConversation } from "@/lib/tina-mvp/reasoning";
import type { TinaCandidateArchetype, TinaChatApiResponse, TinaMvpMessage } from "@/lib/tina-mvp/types";

type ArchetypeSnapshot = {
  afterMessageId: string;
  cards: TinaCandidateArchetype[];
};

const STORAGE_KEY = "tina_mvp_messages";

export function TinaChatPage() {
  const [messages, setMessages] = useState<TinaMvpMessage[]>(() => [createOpeningMessage()]);
  const [draft, setDraft] = useState("");
  const [archetypeSnapshot, setArchetypeSnapshot] = useState<ArchetypeSnapshot | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const isSendingRef = useRef(false);
  const messagesRef = useRef<TinaMvpMessage[]>(messages);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesRef.current = messages;
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      setIsHydrated(true);
      return;
    }

    try {
      const parsed = JSON.parse(stored) as TinaMvpMessage[];
      const validMessages = parsed.filter(
        (message) =>
          (message.role === "founder" || message.role === "tina") &&
          typeof message.content === "string" &&
          Boolean(message.content.trim())
      );

      if (validMessages.length) {
        messagesRef.current = validMessages;
        setMessages(validMessages);
      }
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    } finally {
      setIsHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!isHydrated) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  }, [isHydrated, messages]);

  async function sendMessage(value = draft) {
    const content = value.trim();
    if (!content || isSendingRef.current) return;
    isSendingRef.current = true;

    const timestamp = Date.now();
    const founderMessage: TinaMvpMessage = {
      id: `founder-${timestamp}`,
      role: "founder",
      content
    };
    const nextMessages = [...messagesRef.current, founderMessage];
    const localRead = reasonAboutHiringConversation(messagesRef.current, content);
    const shouldShowCards = shouldShowArchetypeCards(content);

    messagesRef.current = nextMessages;
    setMessages(nextMessages);
    setArchetypeSnapshot(null);
    setDraft("");
    setIsSending(true);

    console.info("[Tina MVP] exact messages sent to chat API:", nextMessages);
    console.info("[Tina MVP] latest user message included:", content);

    try {
      const response = await fetch("/api/tina-mvp/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ messages: nextMessages })
      });
      const data = (await response.json()) as TinaChatApiResponse | { error?: string };

      if (!response.ok || !("message" in data)) {
        throw new Error("error" in data && data.error ? data.error : "Tina could not get an OpenAI response.");
      }

      console.info("[Tina MVP] assistant response source:", data.source, data.responseId);
      messagesRef.current = [...nextMessages, data.message];
      setMessages(messagesRef.current);
      setArchetypeSnapshot(
        shouldShowCards
          ? {
              afterMessageId: data.message.id,
              cards: localRead.archetypes
            }
          : null
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Tina could not get an OpenAI response.";
      const tinaMessage: TinaMvpMessage = {
        id: `tina-error-${timestamp}`,
        role: "tina",
        content: errorMessage
      };

      messagesRef.current = [...nextMessages, tinaMessage];
      setMessages(messagesRef.current);
    } finally {
      isSendingRef.current = false;
      setIsSending(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    sendMessage();
  }

  function sendOnEnter(event: KeyboardEvent<HTMLTextAreaElement>) {
    if ((event.nativeEvent as KeyboardEvent["nativeEvent"]).isComposing) return;
    if (event.key !== "Enter" && event.code !== "Enter" && event.code !== "NumpadEnter") return;
    if (event.shiftKey) return;

    event.preventDefault();
    sendMessage();
  }

  return (
    <main className="min-h-screen bg-[#eef1ea] text-[#18201b]">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-4 md:px-6 md:py-6">
        <header className="mx-auto flex w-full max-w-4xl shrink-0 items-center justify-between border-b border-[#d5dccf] pb-4">
          <div>
            <p className="text-3xl font-semibold tracking-normal text-[#18201b]">Tina</p>
            <p className="mt-1 text-sm text-[#63715f]">Natural-language recruiting calibration</p>
          </div>
        </header>

        <div className="mx-auto flex min-h-0 w-full max-w-4xl flex-1 py-5">
          <section className="flex min-h-[640px] w-full flex-col overflow-hidden rounded-lg border border-[#d5dccf] bg-[#fbfcf7]">
            <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-5 md:px-6">
              <div className="mx-auto grid max-w-3xl gap-5">
                {messages.map((message) => (
                  <MessageGroup
                    key={message.id}
                    message={message}
                    archetypes={archetypeSnapshot?.afterMessageId === message.id ? archetypeSnapshot.cards : []}
                  />
                ))}
                {isSending ? <ThinkingBubble /> : null}
              </div>
            </div>

            <form onSubmit={handleSubmit} className="border-t border-[#dce2d7] p-4 md:p-5">
              <div className="rounded-lg border border-[#cbd6c7] bg-white p-3 shadow-[0_10px_28px_rgba(38,52,40,0.06)]">
                <textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={sendOnEnter}
                  placeholder="Describe the role, tension, candidate feedback, or tradeoff..."
                  className="min-h-24 w-full resize-none bg-transparent text-base leading-7 text-[#18201b] outline-none placeholder:text-[#7d8879]"
                />
                <div className="mt-3 flex items-center justify-between gap-3 border-t border-[#edf0e9] pt-3">
                  <p className="text-sm leading-5 text-[#6a7667]">Tina will answer briefly and ask one next question.</p>
                  <button
                    type="submit"
                    disabled={isSending}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#263a2b] text-white transition hover:bg-[#17251b] disabled:cursor-not-allowed disabled:opacity-60"
                    aria-label="Send message"
                  >
                    <ArrowUp className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </form>
          </section>
        </div>
      </div>
    </main>
  );
}

function shouldShowArchetypeCards(text: string) {
  return /\b(archetype|candidate|profile|who should|what type|type of|hire|hiring|role|engineer|designer|product|sales|gtm|recruiter|founder|manager|lead)\b/i.test(
    text
  );
}

function MessageGroup({
  message,
  archetypes
}: {
  message: TinaMvpMessage;
  archetypes: TinaCandidateArchetype[];
}) {
  return (
    <div className="grid gap-4">
      <MessageBubble message={message} />
      {message.role === "tina" ? <CandidateArchetypeCards archetypes={archetypes} /> : null}
    </div>
  );
}

function ThinkingBubble() {
  return (
    <div className="flex gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#263a2b] text-sm font-semibold text-white">
        T
      </div>
      <div className="min-w-0 flex-1">
        <p className="mb-2 text-sm font-semibold text-[#18201b]">Tina</p>
        <div className="max-w-[680px] text-[15px] leading-7 text-[#6a7667]">Thinking...</div>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: TinaMvpMessage }) {
  if (message.role === "founder") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[680px] rounded-lg bg-[#dfe8d8] px-4 py-3 text-sm leading-6 text-[#18201b]">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#263a2b] text-sm font-semibold text-white">
        T
      </div>
      <div className="min-w-0 flex-1">
        <p className="mb-2 text-sm font-semibold text-[#18201b]">Tina</p>
        <div className="max-w-[680px] whitespace-pre-line text-[15px] leading-7 text-[#263026]">{message.content}</div>
      </div>
    </div>
  );
}
