# Base 2048 Web Client

Light-themed 2048 experience that follows the Base product/design spec. Built with Next.js (App Router), TypeScript, and Tailwind CSS v4 utilities.

## Feature Highlights

- 4×4 2048 board with merge/compress logic, input lock, keyboard shortcuts, and swipe gestures.
- Score, best score with local persistence, timer (auto/pause/resume), moves counter, and undo history (single-step stack).
- Win/lose modals with `Save to Base` and continue/try-again flows; settings panel for timer toggle and progress reset.
- Placeholder on-chain integration hooks that stub `submitScore` / `fetchLeaderboard` calls and surface Farcaster-ready leaderboard enrichment.
- Compact responsive layout, soft shadows, and neutral tile palette aligned with the light theme spec.

## Quick Start

```bash
npm install
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to play.

## Scripts

- `npm run dev` – start the development server.
- `npm run build` – create a production build.
- `npm run start` – run the built app.
- `npm run lint` – lint the codebase.

## Key Paths

- `src/lib/gameUtils.ts` – board creation, move resolution, spawn, and status helpers.
- `src/hooks/useGameState.ts` – core state machine, timer management, persistence, leaderboard bridge.
- `src/components/GameScreen.tsx` – UI composition (header, board, controls, modals, leaderboard).

## Next Steps

1. Replace `lib/leaderboardClient.ts` with real `viem`/`ethers` contract calls to the `BaseLeaderboard` contract.
2. Hook in wallet connection and Farcaster/Neynar identity overlays for leaderboard rows.
3. Add automated tests (`vitest`/`playwright`) for merge logic and happy-path E2E.
