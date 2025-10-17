import { useAccount, useSwitchChain } from 'wagmi'
import { base } from 'wagmi/chains'
import { useCallback, useEffect, useRef, useState } from 'react'
import { watchAccount, watchChainId } from '@wagmi/core'
import { config } from '@/lib/wagmi'

// Simplified hook - Farcaster mini apps always run on Base network

export function useNetworkSwitch() {
  const { isConnected, connector, chainId: accountChainId } = useAccount()
  const { switchChainAsync, isPending: isSwitching } = useSwitchChain()
  const [chainId, setChainId] = useState<number | undefined>(accountChainId ?? undefined)
  const lastAutoSwitchAttemptRef = useRef<number | undefined>(undefined)

  // Check if we're using the Farcaster mini app connector
  const isFarcasterConnector = connector?.id === 'farcaster'

  const readActiveChainId = useCallback(async () => {
    if (connector?.getChainId) {
      try {
        const connectorChainId = await connector.getChainId()
        if (typeof connectorChainId === 'number') {
          setChainId(connectorChainId)
          return connectorChainId
        }
      } catch (error) {
        console.warn('[useNetworkSwitch] Failed to read chain ID from connector:', error)
      }
    }

    if (typeof window !== 'undefined') {
      const provider = (window as unknown as {
        ethereum?: { request?: (args: { method: string }) => Promise<string> }
      }).ethereum

      if (provider?.request) {
        try {
          const hexChainId = await provider.request({ method: 'eth_chainId' })
          const parsedChainId = Number.parseInt(hexChainId, 16)

          if (Number.isInteger(parsedChainId)) {
            setChainId(parsedChainId)
            return parsedChainId
          }
        } catch (error) {
          console.warn('[useNetworkSwitch] Failed to read chain ID from window.ethereum:', error)
        }
      }
    }

    return chainId
  }, [connector, chainId])

  const ensureBaseNetwork = useCallback(async () => {
    if (!isConnected) {
      throw new Error('Wallet is not connected')
    }

    // Handle Farcaster mini app environment FIRST
    // Farcaster mini apps always work with Base network
    if (isFarcasterConnector) {
      console.log('[useNetworkSwitch] Farcaster environment - Base network is always available, ready for transactions')
      return base.id
    }

    const activeChainId = await readActiveChainId()
    console.log(
      '[useNetworkSwitch] Network check - Current chain ID:',
      activeChainId,
      'Base chain ID:',
      base.id,
    )

    if (activeChainId === base.id) {
      console.log('[useNetworkSwitch] Already on Base network - ready for transactions')
      return base.id
    }

    if (!switchChainAsync) {
      throw new Error(
        'Automatic network switching is not supported by this wallet. Please switch to Base manually.',
      )
    }

    try {
      console.log('[useNetworkSwitch] Switching to Base network...', {
        currentChainId: activeChainId,
        targetChainId: base.id,
      })

      const switchedChain = await switchChainAsync({ chainId: base.id })
      const confirmedChainId = switchedChain?.id ?? (await readActiveChainId())

      console.log('[useNetworkSwitch] Switch completed - Chain ID:', confirmedChainId)

      if (confirmedChainId !== base.id) {
        throw new Error(
          'Unable to confirm Base network after switching. Please switch manually and retry.',
        )
      }

      return confirmedChainId
    } catch (error) {
      console.error('[useNetworkSwitch] Failed to switch to Base network:', error)
      throw new Error('Failed to switch to Base network. Please switch manually and try again.')
    }
  }, [isConnected, readActiveChainId, switchChainAsync, isFarcasterConnector])

  useEffect(() => {
    // Prime state on mount
    readActiveChainId().catch((error) => {
      console.warn('[useNetworkSwitch] Initial chain ID read failed:', error)
    })

    const unwatchAccount = watchAccount(config, {
      onChange(account) {
        if (typeof account.chainId === 'number') {
          setChainId(account.chainId)
        } else if (!account.address) {
          setChainId(undefined)
          lastAutoSwitchAttemptRef.current = undefined
        }
      },
    })

    const unwatchChainId = watchChainId(config, {
      onChange(nextChainId) {
        if (typeof nextChainId === 'number') {
          setChainId(nextChainId)
        } else if (nextChainId === undefined) {
          setChainId(undefined)
        }
      },
    })

    return () => {
      unwatchAccount?.()
      unwatchChainId?.()
    }
  }, [readActiveChainId])

  useEffect(() => {
    if (typeof accountChainId === 'number') {
      setChainId(accountChainId)
    } else if (!isConnected) {
      setChainId(undefined)
    }
  }, [accountChainId, isConnected])

  useEffect(() => {
    if (!isConnected) {
      lastAutoSwitchAttemptRef.current = undefined
      return
    }

    if (typeof chainId !== 'number' || chainId === base.id) {
      return
    }

    if (lastAutoSwitchAttemptRef.current === chainId) {
      return
    }

    lastAutoSwitchAttemptRef.current = chainId

    // For Farcaster connector, no need to switch - Base is always available
    if (isFarcasterConnector) {
      console.log('[useNetworkSwitch] Farcaster connector detected - Base network always available, no switch needed')
      return
    }

    ensureBaseNetwork().catch((error) => {
      console.warn('[useNetworkSwitch] Automatic Base switch attempt failed:', error)
    })
  }, [chainId, ensureBaseNetwork, isConnected, isFarcasterConnector])

  return {
    ensureBaseNetwork,
    // For Farcaster connector, always show as Base network to provide better UX
    isOnBaseNetwork: isFarcasterConnector ? true : chainId === base.id,
    isSwitching,
    // For Farcaster connector, show Base chain ID to keep UI consistent
    chainId: isFarcasterConnector ? base.id : chainId,
    isFarcasterConnector,
  }
}
