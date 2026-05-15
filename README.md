# Tina

Tina is a local MVP for hiring intelligence before sourcing begins. It is not an ATS, scheduler, offer tool, pipeline tracker, or HR admin system.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

If the local workspace has too many watched files open, use the production preview instead:

```bash
npm run build
npm run start -- --hostname 127.0.0.1 --port 3000
```

## What is included

- Minimal homepage with a natural-language hiring need input
- Kickoff conversation with short Tina replies
- Live right-side hiring workspace
- Directional market shift cards
- Sample candidate archetype profiles with feedback
- Local feedback loop that changes archetype weighting and the workspace
- Kickoff Intelligence Brief at `/brief`

## Architecture

The Tina brain is separate from the UI:

- `lib/tina-brain/calibration-engine.ts`
- `lib/tina-brain/response-style.ts`
- `lib/tina-brain/candidate-archetypes.ts`
- `lib/tina-brain/market-tradeoffs.ts`
- `lib/tina-brain/founder-coaching-responses.ts`
- `lib/mock-candidates.ts`

The UI only renders local state:

- `components/tina/kickoff-chat.tsx`
- `components/tina/live-workspace.tsx`
- `components/tina/market-shift-card.tsx`
- `components/tina/candidate-profile-card.tsx`
- `components/tina/brief-view.tsx`

No external APIs, database, auth, LinkedIn scraping, or real candidate sourcing are used.
