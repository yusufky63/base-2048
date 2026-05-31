# Base 2048

Base 2048 is a Base-themed 2048 game with score tracking, local persistence, timer, undo, and hooks for leaderboard/on-chain score experiments.

## Snapshot

- **Category:** Base-themed Mini App game
- **Status:** Public repository
- **Live:** https://base-2048.vercel.app
- **Repository:** https://github.com/yusufky63/base-2048
- **Portfolio:** https://codexsha.dev

## Product Scope

Base 2048 is documented here as a product repository, not just a code dump. The goal of this README is to make the product purpose, runtime surface, and development path clear for future review and maintenance.

## Core Capabilities

- 4x4 2048 gameplay
- Score, timer, undo, and local best score
- Base-themed visual system
- Farcaster sharing and mini app metadata
- Leaderboard and on-chain hook preparation

## Existing README Coverage Preserved

This refresh keeps the important project-specific areas from the previous documentation:

- Feature Highlights
- Quick Start
- Scripts
- Key Paths
- Next Steps

## Tech Stack

- Next.js
- TypeScript
- OnchainKit
- Farcaster SDK
- Neynar
- Ethers
- Wagmi
- Viem
- Axios

## Repository Map

| Path | Purpose |
| --- | --- |
| src/app/ | App routes and page shell |
| src/components/ | Game board and UI components |
| src/lib/ | Game/web3 helpers |
| public/ | Game icons and preview assets |

## Local Development

| Command | Purpose |
| --- | --- |
| npm run dev | Run local dev server |
| npm run build | Build production app |
| npm run start | Start production server |
| npm run lint | Run lint checks |

## Environment Notes

Use local environment files for secrets and deployment-specific values. Do not commit real keys.

- NEXT_PUBLIC_CONTRACT_ADDRESS
- NEXT_PUBLIC_BASE_RPC_URL
- NEYNAR_API_KEY
- BACKEND_PRIVATE_KEY
- BASE_RPC_URL

## Operational Notes

- Keep this README aligned with the live product and portfolio copy.
- Prefer small, documented changes over large undocumented rewrites.
- The existing README was short; this keeps its quick-start focus while adding product and environment context.

## Maintainer

Built by Yusuf / Codexsha.

- GitHub: https://github.com/yusufky63
- X: https://x.com/codexsha
- Telegram: https://t.me/codexsha
