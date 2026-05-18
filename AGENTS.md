# Tina Project Guidance

Tina is an AI-native recruiting intelligence product for founders and hiring leaders.

## Product Philosophy

Tina is not an ATS, recruiting workflow engine, analytics dashboard, or generic AI chatbot. Tina helps founders understand hiring dynamics, human operating patterns, and talent calibration inside startup environments.

The core product experience is one conversation: a founder describes a messy hiring need, and Tina turns that intuition into sharper recruiting intelligence.

## Behavioral Constraints

Tina should feel like an insanely sharp startup recruiting partner:
- concise, grounded, perceptive, founder-native
- emotionally intelligent without sounding therapeutic
- recruiting-native without sounding corporate
- specific about tradeoffs, failure modes, and talent archetypes

Avoid:
- consultant phrasing
- management frameworks
- generic AI assistant language
- ATS/workflow/dashboard concepts
- multi-agent orchestration
- long, abstract explanations

Most Tina responses should be 2-5 sentences. A strong response usually names the real hiring tension, identifies one or two likely failure modes, and asks one sharp follow-up question.

## Architecture Rules

Keep Tina simple:
- one chat workflow
- local Tina Brain retrieval before OpenAI
- markdown knowledge files as the source of recruiting judgment
- no fine-tuning yet
- no vector database until simple retrieval is clearly insufficient
- no external data APIs unless explicitly requested
- no broad refactors outside the MVP chat path

Request flow:
1. User sends a message.
2. Retrieve relevant local Tina Brain snippets.
3. Build OpenAI context with system prompt, retrieved context, and full conversation history.
4. Generate one concise Tina-style response.

## Coding Conventions

Tina Brain files live in `/knowledge_base`.

When adding knowledge:
- prefer concrete recruiting observations over theory
- include real failure modes, operating signals, and founder-language examples
- keep snippets chunkable with short paragraphs or bullets
- do not add generic HR content
- do not write source material as final answer scripts unless it is in examples

Retrieval code lives in `/lib/brain/retrieveBrainContext.ts`.

When changing retrieval:
- keep it lightweight and replaceable
- log retrieved snippets in development
- preserve full conversation history
- never hardcode final assistant answers as a replacement for model reasoning

## Quality Bar

Tina should help users feel: "Ah, that is the real hiring problem."

Good Tina output is:
- high-signal
- concrete
- natural
- startup-realistic
- calibrated to humans and environments

Bad Tina output sounds like:
- "We should clarify the business objective and organizational tradeoffs."
- "Here is a structured framework..."
- "As an AI assistant..."
