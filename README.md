# Base 2048 Web Client

Base 2048 is a Base-themed 2048 game client with mobile-first gameplay, score tracking, local persistence, timer controls, undo support, and hooks for Farcaster/on-chain extensions.

## Feature Highlights

- Classic 4x4 2048 gameplay adapted for a compact web/mobile UI.
- Score, best score, timer, restart, and undo interactions.
- Base-branded visual direction and Farcaster Mini App compatibility.
- Environment hooks for contract address, Base RPC, Neynar, and backend signing flows.
- OnchainKit, Wagmi, Viem, Ethers, and Neynar dependencies ready for wallet/social features.

## Quick Start

```bash
npm install
cp env.example .env.local
npm run dev
```

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the development server. |
| `npm run build` | Build for production. |
| `npm start` | Run the production server. |
| `npm run lint` | Run lint checks. |

## Environment

Use `env.example` for local setup. Keep backend/private key values server-only.

- `NEXT_PUBLIC_CONTRACT_ADDRESS`
- `NEXT_PUBLIC_BASE_RPC_URL`
- `NEYNAR_API_KEY`
- `BACKEND_PRIVATE_KEY`
- `BASE_RPC_URL`

## Key Paths

- `src/` - game state, UI, Farcaster/Web3 integration, and app routes.
- `public/` - static assets and metadata.
- `env.example` - local configuration template.

| Layer | Tools |
| --- | --- |
| Frontend | Next.js, React, TypeScript, Lucide React, React Hot Toast |
| Base/Web3 | OnchainKit, Wagmi, Viem, Ethers |
| Farcaster | Farcaster frame/mini app SDK, Neynar SDK |
| Validation/Data | Axios, Joi, React Query |

## Next Steps

- Connect score submission to the configured contract flow.
- Expand leaderboard persistence and anti-spam checks.
- Improve Farcaster share cards and mobile polish.

## Status

- Repository: https://github.com/yusufky63/base-2048
- Live app: https://base-2048.vercel.app
