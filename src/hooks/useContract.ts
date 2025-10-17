import { useWriteContract, useReadContract } from 'wagmi';
import { parseEther } from 'viem';
import { waitForTransactionReceipt } from '@wagmi/core';
import { config } from '@/lib/wagmi';
import { useState } from 'react';

// Contract ABI - sadece gerekli fonksiyonlar
const CONTRACT_ABI = [
  {
    "inputs": [
      {"name": "player", "type": "address"},
      {"name": "score", "type": "uint256"},
      {"name": "moves", "type": "uint256"},
      {"name": "time", "type": "uint256"},
      {"name": "deadline", "type": "uint256"},
      {"name": "v", "type": "uint8"},
      {"name": "r", "type": "bytes32"},
      {"name": "s", "type": "bytes32"}
    ],
    "name": "submitScoreWithSig",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "feeAmount",
    "outputs": [{"name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"name": "player", "type": "address"}],
    "name": "getPlayerScore",
    "outputs": [
      {"name": "bestScore", "type": "uint256"},
      {"name": "bestMoves", "type": "uint256"},
      {"name": "bestTime", "type": "uint256"},
      {"name": "exists", "type": "bool"}
    ],
    "stateMutability": "view",
    "type": "function"
  }
] as const;

const CONTRACT_ADDRESS = (process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || '0xc9184bEEeA6EB0990DdbDDf6d8Ac6424397CfE72') as `0x${string}`;

export function useContract() {
  const { writeContractAsync, isPending, error } = useWriteContract();
  const [retryCount, setRetryCount] = useState(0);

  const submitScoreWithSignature = async (
    player: `0x${string}`,
    score: number,
    moves: number,
    time: number,
    deadline: number,
    signature: { v: number; r: `0x${string}`; s: `0x${string}` }
  ) => {
    // Validate signature
    if (!signature || signature.v === undefined || !signature.r || !signature.s) {
      throw new Error('Invalid signature data');
    }

    // Get current fee amount
    const feeAmount = await getCurrentFee();
    
    console.log('Submitting to contract:', {
      address: CONTRACT_ADDRESS,
      player,
      score,
      moves,
      time,
      deadline,
      signature,
      feeAmount
    });
    
    // Retry mechanism for RPC errors
    const maxRetries = 3;
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Transaction attempt ${attempt}/${maxRetries}`);
        setRetryCount(attempt);
        
        // Submit transaction and wait for confirmation
        const hash = await writeContractAsync({
          address: CONTRACT_ADDRESS as `0x${string}`,
          abi: CONTRACT_ABI,
          functionName: 'submitScoreWithSig',
          args: [
            player,
            BigInt(score),
            BigInt(moves),
            BigInt(time),
            BigInt(deadline),
            signature.v,
            signature.r,
            signature.s
          ],
          value: parseEther(feeAmount)
        });

        console.log('Waiting for transaction confirmation:', hash);
        
        if (!hash || typeof hash !== 'string' || !hash.startsWith('0x')) {
          throw new Error(`Invalid transaction hash: ${String(hash)}`);
        }
        const receipt = await waitForTransactionReceipt(config, {
          hash: hash as `0x${string}`,
          confirmations: 1
        });

        console.log('Transaction confirmed:', receipt);
        return receipt;
        
      } catch (error) {
        lastError = error as Error;
        console.error(`Transaction attempt ${attempt} failed:`, error);
        
        // Check if it's a retryable error
        const isRetryableError = error instanceof Error && (
          error.message.includes('RPC') ||
          error.message.includes('network') ||
          error.message.includes('timeout') ||
          error.message.includes('connection') ||
          error.message.includes('ECONNRESET') ||
          error.message.includes('ETIMEDOUT')
        );
        
        if (!isRetryableError || attempt === maxRetries) {
          throw error;
        }
        
        // Wait before retry (exponential backoff)
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        console.log(`Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError || new Error('Transaction failed after all retries');
  };

  const getCurrentFee = async (): Promise<string> => {
    try {
      // Try to get fee from API first
        const response = await fetch('/api/game/fee');
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data.feeAmount) {
          return data.data.feeAmount;
        }
      }
    } catch (error) {
      console.warn('Failed to get fee from API, using default:', error);
    }
    
    // Fallback to default fee amount
    return '0.000013'; // 0.000013 ETH
  };

  return {
    submitScoreWithSignature,
    isPending,
    error,
    contractAddress: CONTRACT_ADDRESS,
    retryCount
  };
}

export function usePlayerScore(address: `0x${string}` | undefined) {
  const { data, isLoading, error } = useReadContract({
    address: CONTRACT_ADDRESS as `0x${string}`,
    abi: CONTRACT_ABI,
    functionName: 'getPlayerScore',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address
    }
  });

  return {
    playerScore: data,
    isLoading,
    error
  };
}

