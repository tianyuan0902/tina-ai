"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";

const chips = [
  "We keep meeting smart people but none feel right",
  "Why does this role keep changing?",
  "Founding AI engineer vs AI infra lead",
  "Strong resumes, weak conviction",
  "Need someone senior without big-company slowness",
  "What does 'great' actually look like here?"
];

const rotatingPlaceholders = [
  "What feels unclear about this hire?",
  "What kind of person succeeds here?",
  "Why does this search feel difficult?",
  "What does 'great' actually look like?"
];

const tinaIntro = "Most teams do not actually have a sourcing problem. They have a calibration problem.";
const firstSentence = "Most teams do not actually have a sourcing problem.";

export default function TinaHomepageConcept() {
  const router = useRouter();
  const [need, setNeed] = useState("");
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [streamedIntro, setStreamedIntro] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [absorbingChip, setAbsorbingChip] = useState("");
  const transitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setPlaceholderIndex((current) => (current + 1) % rotatingPlaceholders.length);
    }, 2800);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let index = 0;
    const timer = window.setInterval(() => {
      index += Math.max(1, Math.round(tinaIntro.length / 42));
      setStreamedIntro(tinaIntro.slice(0, index));

      if (index >= tinaIntro.length) window.clearInterval(timer);
    }, 28);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    return () => {
      if (transitionTimerRef.current) window.clearTimeout(transitionTimerRef.current);
    };
  }, []);

  function goToKickoff(value: string, delay = 0) {
    const cleanedNeed = value.trim();
    if (!cleanedNeed) return;

    window.localStorage.setItem("tina_pending_need", cleanedNeed);

    if (transitionTimerRef.current) window.clearTimeout(transitionTimerRef.current);
    transitionTimerRef.current = setTimeout(() => {
      router.push(`/kickoff?need=${encodeURIComponent(cleanedNeed)}`);
    }, delay);
  }

  function startKickoff(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    goToKickoff(need);
  }

  function startFromChip(chip: string) {
    setNeed(chip);
    setAbsorbingChip(chip);
    goToKickoff(chip, 520);
  }

  return (
    <main className="tina-home">
      <div className="tina-glow" />

      <nav className="tina-nav">
        <div className="tina-logo">Tina</div>
        <div className="tina-status">
          <span />
          Thinking about hiring
        </div>
      </nav>

      <section className="tina-hero">
        <div className="tina-pill">
          <span />
          Tina is designed for founders and hiring managers
        </div>

        <h1>
          Most hiring problems start
          <br />
          before sourcing.
        </h1>

        <p className="tina-subtitle">
          Tina helps teams pressure test hiring assumptions before the search drifts.
        </p>

        <div className="tina-card">
          <div className="tina-card-header">
            <div className="tina-avatar">T</div>
            <div>
              <div className="tina-card-title">Tina</div>
              <div className="tina-card-status">
                <span />
                Live calibration
              </div>
            </div>
          </div>

          <div className="tina-card-body">
            <div className="tina-stream">
              <span>{streamedIntro.slice(0, firstSentence.length)}</span>
              {streamedIntro.length > firstSentence.length ? <br /> : null}
              <span className="muted">{streamedIntro.slice(firstSentence.length + 1)}</span>
              <span className="cursor" />
            </div>

            <form className={`tina-input ${isFocused ? "focused" : ""} ${absorbingChip ? "absorbing" : ""}`} onSubmit={startKickoff}>
              <label htmlFor="hiring-need">What feels unclear about this hire?</label>
              <div className="input-wrap">
                {!need ? (
                  <div key={placeholderIndex} className="rotating-placeholder">
                    {rotatingPlaceholders[placeholderIndex]}
                  </div>
                ) : null}
                <textarea
                  id="hiring-need"
                  value={need}
                  onChange={(event) => {
                    setNeed(event.target.value);
                    setAbsorbingChip("");
                  }}
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setIsFocused(false)}
                />
              </div>

              <div className="input-footer">
                <div>Start with the tension, not the title.</div>
                <button type="submit">
                  Let&apos;s figure this out
                  <ArrowRight size={16} />
                </button>
              </div>
            </form>
          </div>
        </div>
      </section>

      <section className="chip-rail">
        <div className="chip-track">
          {[...chips, ...chips].map((chip, index) => (
            <button
              key={`${chip}-${index}`}
              type="button"
              onClick={() => startFromChip(chip)}
              className={absorbingChip === chip ? "absorbing-chip" : ""}
            >
              {chip}
            </button>
          ))}
        </div>
      </section>

      <style jsx>{`
        .tina-home {
          position: relative;
          display: flex;
          height: 100dvh;
          min-height: 560px;
          flex-direction: column;
          overflow: hidden;
          background: #f5f1ea;
          color: #1e1b18;
          font-family:
            Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }

        .tina-glow {
          position: absolute;
          top: -18vmin;
          left: 50%;
          width: min(58vmin, 560px);
          height: min(58vmin, 560px);
          transform: translateX(-50%);
          border-radius: 999px;
          background: #e9e2d8;
          opacity: 0.62;
          filter: blur(64px);
        }

        .tina-nav {
          position: relative;
          z-index: 2;
          display: flex;
          flex-shrink: 0;
          align-items: center;
          justify-content: space-between;
          padding: clamp(0.7rem, 1.8vh, 1rem) clamp(1rem, 3vw, 2rem);
        }

        .tina-logo {
          font-size: clamp(1.85rem, 5vmin, 2.55rem);
          font-weight: 900;
          line-height: 1;
          letter-spacing: 0;
        }

        .tina-status,
        .tina-card-status {
          display: flex;
          align-items: center;
          gap: 0.7rem;
          color: #6d655d;
          font-size: clamp(0.72rem, 1.8vmin, 0.9rem);
        }

        .tina-status span,
        .tina-card-status span {
          width: 0.5rem;
          height: 0.5rem;
          border-radius: 999px;
          background: #4f7b48;
        }

        .tina-hero {
          position: relative;
          z-index: 1;
          display: flex;
          min-height: 0;
          width: 100%;
          max-width: 72rem;
          flex: 1;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          margin: 0 auto;
          padding: 0 clamp(1rem, 3vw, 2rem);
          text-align: center;
        }

        .tina-pill {
          display: inline-flex;
          align-items: center;
          gap: 0.55rem;
          margin-bottom: clamp(0.55rem, 1.6vh, 1rem);
          border: 1px solid #ded5c9;
          border-radius: 999px;
          background: rgb(255 255 255 / 0.62);
          padding: 0.42rem 0.85rem;
          color: #6a625a;
          font-size: clamp(0.68rem, 1.6vmin, 0.78rem);
          box-shadow: 0 2px 12px rgb(49 42 34 / 0.08);
          backdrop-filter: blur(10px);
        }

        .tina-pill span {
          width: 0.45rem;
          height: 0.45rem;
          border-radius: 999px;
          background: #1e1b18;
        }

        h1 {
          max-width: min(52rem, 92vw);
          font-size: clamp(2.25rem, 8vmin, 4.45rem);
          font-weight: 900;
          line-height: 0.94;
          letter-spacing: 0;
        }

        .tina-subtitle {
          max-width: 38rem;
          margin-top: clamp(0.65rem, 2vh, 1rem);
          color: #6d655d;
          font-size: clamp(0.9rem, 2.2vmin, 1.125rem);
          line-height: 1.55;
        }

        .tina-card {
          width: min(42rem, 92vw);
          margin-top: clamp(0.85rem, 2.8vh, 1.5rem);
          overflow: hidden;
          border: 1px solid #ddd3c8;
          border-radius: 1rem;
          background: rgb(255 255 255 / 0.72);
          box-shadow: 0 16px 56px rgb(49 42 34 / 0.055);
          text-align: left;
          backdrop-filter: blur(20px);
          transition:
            box-shadow 500ms ease,
            transform 500ms ease;
        }

        .tina-card:hover {
          box-shadow: 0 20px 70px rgb(49 42 34 / 0.08);
        }

        .tina-card-header {
          display: flex;
          align-items: center;
          gap: 0.8rem;
          border-bottom: 1px solid #eee7de;
          padding: clamp(0.6rem, 1.7vh, 0.85rem) clamp(1rem, 3vw, 1.5rem);
        }

        .tina-avatar {
          display: flex;
          width: clamp(2rem, 5vmin, 2.35rem);
          height: clamp(2rem, 5vmin, 2.35rem);
          align-items: center;
          justify-content: center;
          border-radius: 0.75rem;
          background: #1e1b18;
          color: white;
          font-size: 0.9rem;
          font-weight: 800;
        }

        .tina-card-title {
          font-size: clamp(0.9rem, 2vmin, 1rem);
          font-weight: 700;
        }

        .tina-card-status {
          gap: 0.45rem;
          font-size: clamp(0.68rem, 1.6vmin, 0.75rem);
          color: #8a8179;
        }

        .tina-card-body {
          padding: clamp(0.8rem, 2vh, 1rem) clamp(1rem, 3vw, 1.5rem);
        }

        .tina-stream {
          min-height: clamp(2.3rem, 7vh, 3rem);
          color: #1e1b18;
          font-size: clamp(0.95rem, 2.25vmin, 1.125rem);
          font-weight: 600;
          line-height: 1.55;
        }

        .tina-stream .muted {
          color: #625b54;
          font-weight: 500;
        }

        .cursor {
          display: inline-block;
          width: 1px;
          height: 1.05em;
          margin-left: 0.25rem;
          transform: translateY(0.18em);
          background: #1e1b18;
          animation: blink 1s steps(2, start) infinite;
        }

        .tina-input {
          position: relative;
          margin-top: clamp(0.65rem, 1.8vh, 1rem);
          border: 1px solid #ddd2c5;
          border-radius: 1rem;
          background: #faf8f5;
          padding: clamp(0.8rem, 2.2vmin, 1rem);
          box-shadow: inset 0 2px 12px rgb(49 42 34 / 0.035);
          transition:
            border-color 450ms ease,
            box-shadow 450ms ease,
            transform 450ms ease;
        }

        .tina-input.focused {
          border-color: #bfb19f;
          box-shadow:
            0 0 0 5px rgb(191 177 159 / 0.16),
            0 18px 60px rgb(49 42 34 / 0.08);
        }

        .tina-input.absorbing {
          border-color: #aa9b89;
          transform: scale(1.01);
        }

        .tina-input label {
          position: absolute;
          width: 1px;
          height: 1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
        }

        .input-wrap {
          position: relative;
        }

        .rotating-placeholder {
          pointer-events: none;
          position: absolute;
          top: 0;
          left: 0;
          color: #8c847b;
          font-size: clamp(0.9rem, 2.2vmin, 1.05rem);
          line-height: 1.75rem;
          opacity: 0.8;
          animation: placeholderSwap 2.8s ease-in-out;
        }

        textarea {
          min-height: clamp(2.7rem, 8vh, 3.5rem);
          width: 100%;
          resize: none;
          border: 0;
          background: transparent;
          color: #1e1b18;
          font: inherit;
          font-size: clamp(0.9rem, 2.2vmin, 1.05rem);
          line-height: 1.75rem;
          outline: 0;
        }

        .input-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.75rem;
          margin-top: clamp(0.55rem, 1.5vh, 0.75rem);
          border-top: 1px solid #ebe4dc;
          padding-top: clamp(0.55rem, 1.5vh, 0.75rem);
          color: #9a9188;
          font-size: clamp(0.68rem, 1.6vmin, 0.75rem);
        }

        .input-footer button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.45rem;
          border: 0;
          border-radius: 0.75rem;
          background: #1e1b18;
          padding: 0.55rem 1.1rem;
          color: white;
          font-size: clamp(0.68rem, 1.6vmin, 0.75rem);
          font-weight: 700;
          transition:
            transform 200ms ease,
            background 200ms ease;
        }

        .input-footer button:hover {
          transform: scale(1.02);
          background: #000;
        }

        .chip-rail {
          position: relative;
          z-index: 1;
          flex-shrink: 0;
          overflow: hidden;
          margin: clamp(0.55rem, 1.8vh, 1rem) 0 clamp(0.6rem, 2vh, 1.2rem);
        }

        .chip-rail::before,
        .chip-rail::after {
          pointer-events: none;
          content: "";
          position: absolute;
          top: 0;
          bottom: 0;
          z-index: 2;
          width: 6rem;
        }

        .chip-rail::before {
          left: 0;
          background: linear-gradient(to right, #f5f1ea, transparent);
        }

        .chip-rail::after {
          right: 0;
          background: linear-gradient(to left, #f5f1ea, transparent);
        }

        .chip-track {
          display: flex;
          width: max-content;
          gap: 1rem;
          white-space: nowrap;
          padding: 0 1.5rem;
          animation: marquee 38s linear infinite;
        }

        .chip-track:hover {
          animation-play-state: paused;
        }

        .chip-track button {
          border: 1px solid #ddd3c7;
          border-radius: 999px;
          background: rgb(255 255 255 / 0.7);
          padding: clamp(0.42rem, 1.3vh, 0.65rem) clamp(0.85rem, 2.5vw, 1rem);
          color: #4f4943;
          font-size: clamp(0.72rem, 1.8vmin, 0.875rem);
          box-shadow: 0 2px 10px rgb(49 42 34 / 0.055);
          backdrop-filter: blur(12px);
          transition:
            transform 300ms ease,
            background 300ms ease,
            box-shadow 300ms ease,
            opacity 300ms ease;
        }

        .chip-track button:hover {
          transform: translateY(-1px);
          background: #fff;
          box-shadow: 0 6px 18px rgb(49 42 34 / 0.08);
        }

        .absorbing-chip {
          opacity: 0.4;
          transform: scale(0.95);
          filter: blur(0.5px);
        }

        @keyframes marquee {
          from {
            transform: translateX(0);
          }
          to {
            transform: translateX(-50%);
          }
        }

        @keyframes blink {
          0%,
          45% {
            opacity: 1;
          }
          46%,
          100% {
            opacity: 0;
          }
        }

        @keyframes placeholderSwap {
          0% {
            opacity: 0;
            transform: translateY(6px);
          }
          12%,
          82% {
            opacity: 0.82;
            transform: translateY(0);
          }
          100% {
            opacity: 0;
            transform: translateY(-6px);
          }
        }

        @media (max-height: 690px) {
          .tina-home {
            min-height: 500px;
          }

          .tina-subtitle {
            margin-top: 0.55rem;
          }

          .tina-card {
            margin-top: 0.7rem;
          }

          .tina-card-body {
            padding-top: 0.65rem;
            padding-bottom: 0.65rem;
          }

          .tina-input {
            margin-top: 0.55rem;
          }
        }

        @media (max-width: 640px) {
          .tina-status {
            gap: 0.45rem;
          }

          .input-footer {
            align-items: stretch;
            flex-direction: column;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          * {
            animation-duration: 0.001ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.001ms !important;
          }
        }
      `}</style>
    </main>
  );
}
