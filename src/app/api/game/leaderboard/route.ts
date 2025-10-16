import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10');
    
    const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
    const rpcUrl = process.env.BASE_RPC_URL || 'https://base-mainnet.g.alchemy.com/v2/0Zc6p8Szd1xVg1TW7LX_1';

    console.log('Leaderboard API - Contract Address:', contractAddress);
    console.log('Leaderboard API - RPC URL:', rpcUrl);
    console.log('Leaderboard API - Limit:', limit);

    if (!contractAddress) {
      return NextResponse.json({
        success: false,
        error: 'Contract address not configured'
      }, { status: 500 });
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    
    const contractABI = [
      "function getLeaderboard(uint256 limit) view returns (address[] memory, uint256[] memory, uint256[] memory, uint256[] memory)"
    ];
    
    const contract = new ethers.Contract(contractAddress, contractABI, provider);
    
    const [addresses, scores, moves, times] = await contract.getLeaderboard(limit);

    const leaderboard = addresses.map((address: string, index: number) => ({
      rank: index + 1,
      address: address,
      score: scores[index].toString(),
      moves: moves[index].toString(),
      time: times[index].toString()
    }));

    return NextResponse.json({
      success: true,
      data: {
        leaderboard: leaderboard,
        total: leaderboard.length,
        limit: limit
      }
    });

  } catch (error) {
    console.error('Error getting leaderboard:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to get leaderboard',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
