import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  try {
    const { address } = await params;
    const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
    const rpcUrl = process.env.BASE_RPC_URL || 'https://base-mainnet.g.alchemy.com/v2/0Zc6p8Szd1xVg1TW7LX_1';

    console.log('Player API - Contract Address:', contractAddress);
    console.log('Player API - RPC URL:', rpcUrl);
    console.log('Player API - Player Address:', address);

    if (!contractAddress) {
      return NextResponse.json({
        success: false,
        error: 'Contract address not configured'
      }, { status: 500 });
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    
    const contractABI = [
      "function getPlayerScore(address player) view returns (uint256 bestScore, uint256 bestMoves, uint256 bestTime, bool exists)"
    ];
    
    const contract = new ethers.Contract(contractAddress, contractABI, provider);
    
    const [bestScore, bestMoves, bestTime, exists] = await contract.getPlayerScore(address);

    return NextResponse.json({
      success: true,
      data: {
        address: address,
        bestScore: bestScore.toString(),
        bestMoves: bestMoves.toString(),
        bestTime: bestTime.toString(),
        exists: exists
      }
    });

  } catch (error) {
    console.error('Error getting player score:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to get player score',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
