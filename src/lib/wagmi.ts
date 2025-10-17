import { http, createConfig } from 'wagmi'
import { base } from 'wagmi/chains'
import { farcasterMiniApp as miniAppConnector } from '@farcaster/miniapp-wagmi-connector'
import { injected } from 'wagmi/connectors'

export const config = createConfig({
  chains: [base],
  transports: {
    [base.id]: http('https://base-mainnet.g.alchemy.com/v2/0Zc6p8Szd1xVg1TW7LX_1'),
  },
  connectors: [
    miniAppConnector(),
    injected()
  ]
})
