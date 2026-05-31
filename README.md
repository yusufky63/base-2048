# Base 2048

![Category](https://img.shields.io/badge/Category-Game%20%2F%20Base%20Mini%20App-1f1f1f?style=flat-square&labelColor=141414&color=2b2b2b) ![Status](https://img.shields.io/badge/Status-public-1f1f1f?style=flat-square&labelColor=141414&color=2b2b2b)

Base-themed 2048 game with score tracking, local persistence, timer, undo, and leaderboard hooks.

## Links

- Live: https://base-2048.vercel.app
- Repository: https://github.com/yusufky63/base-2048
- Portfolio: https://codexsha.dev

## Overview

Base 2048 is part of the Codexsha product portfolio. The project is focused on shipping a compact, usable product surface rather than a demo-only prototype. This README is written to make the repository easier to understand, run, and evaluate.

## Key Features

- 4x4 2048 gameplay
- Score, timer, undo, and local best score
- Base-themed visual language
- Farcaster sharing hooks
- Leaderboard/on-chain score preparation

## Stack

- Next.js
- TypeScript
- OnchainKit
- Farcaster SDK
- Neynar
- Ethers
- Wagmi
- Viem
- Axios

## Role / Ownership

Built the game UI, state handling, score flow, and Farcaster/Base-ready integration points.

## Getting Started

```bash
npm install
npm run dev
npm run build
```

## Environment

Create a local environment file from the project conventions and configure only the values needed for the flow you are running. Do not commit secrets.

Typical values used by this project include:

- Farcaster mini app metadata
- OnchainKit configuration
- optional leaderboard/API URLs

## Project Notes

- Status: Public repository and live deployment.
- Private or sensitive implementation details are intentionally not documented in public-facing copy.
- The README should stay aligned with the live product and the Codexsha portfolio page.

## Maintainer

Built by Yusuf / Codexsha.

- GitHub: https://github.com/yusufky63
- X: https://x.com/codexsha
- Telegram: https://t.me/codexsha
