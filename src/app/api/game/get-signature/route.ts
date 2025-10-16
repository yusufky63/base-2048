import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';
import Joi from 'joi';

// Game validation schema
const gameDataSchema = Joi.object({
  score: Joi.number().integer().min(0).max(1000000).required(),
  moves: Joi.number().integer().min(0).max(10000).required(),
  time: Joi.number().integer().min(0).max(3600).required(),
  board: Joi.array().items(
    Joi.array().items(Joi.number().integer().min(0).max(2048))
  ).length(4).required(),
  playerAddress: Joi.string().pattern(/^0x[a-fA-F0-9]{40}$/).required()
});

// Game data interface
interface GameData {
  score: number;
  moves: number;
  time: number;
  board: number[][];
  playerAddress: string;
}

// Game validation service
class GameValidationService {
  private gameDataSchema = gameDataSchema;

  validateGameData(gameData: unknown): {
    isValid: boolean;
    errors: string[];
    type: string;
    data?: GameData;
    maxTile?: number;
  } {
    const { error, value } = this.gameDataSchema.validate(gameData);
    
    if (error) {
      return {
        isValid: false,
        errors: error.details.map(detail => detail.message),
        type: 'schema_validation'
      };
    }

    const validation = this.validateGameLogic(value);
    return {
      isValid: validation.isValid,
      data: validation.isValid ? value : null,
      errors: validation.errors,
      type: validation.type,
      maxTile: this.calculateMaxTile(value.board)
    };
  }

  private validateGameLogic(data: GameData): {
    isValid: boolean;
    errors: string[];
    type: string;
  } {
    const { score, moves, time, board } = data;

    if (!this.isScoreAchievable(score, moves, board)) {
      return {
        isValid: false,
        errors: ['Score not achievable with given moves'],
        type: 'logic_validation'
      };
    }

    if (!this.isTimeReasonable(time, moves)) {
      return {
        isValid: false,
        errors: ['Time not reasonable for given moves'],
        type: 'logic_validation'
      };
    }

    return { isValid: true, errors: [], type: 'success' };
  }

  private isScoreAchievable(score: number, moves: number, _board: number[][]) {
    if (score < 0 || score > 1000000) return false;
    if (moves === 0 && score === 0) return true;
    
    const maxReasonableScore = moves * 1000;
    return score <= maxReasonableScore;
  }

  private isTimeReasonable(time: number, moves: number) {
    if (moves === 0 && time === 0) return true;
    if (moves === 0) return time <= 60;
    
    const minTime = Math.max(0, moves * 0.1);
    const maxTime = moves * 30;
    return time >= minTime && time <= maxTime;
  }

  private calculateMaxTile(board: number[][]) {
    let maxTile = 0;
    for (const row of board) {
      for (const cell of row) {
        if (cell > maxTile) maxTile = cell;
      }
    }
    return maxTile;
  }
}

// Contract service
class ContractService {
  private provider: ethers.JsonRpcProvider;
  private contract: ethers.Contract;
  private wallet: ethers.Wallet;

  constructor() {
    const rpcUrl = process.env.BASE_RPC_URL || 'https://base-mainnet.g.alchemy.com/v2/0Zc6p8Szd1xVg1TW7LX_1';
    const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
    const privateKey = process.env.BACKEND_PRIVATE_KEY;

    if (!contractAddress || !privateKey) {
      throw new Error('Missing required environment variables');
    }

    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.wallet = new ethers.Wallet(privateKey, this.provider);
    
    const contractABI = [
      "function nonces(address owner) view returns (uint256)",
      "function DOMAIN_SEPARATOR() view returns (bytes32)"
    ];
    
    this.contract = new ethers.Contract(contractAddress, contractABI, this.wallet);
  }

  async generateSignature(gameData: GameData): Promise<{
    signature: {
      v: number;
      r: string;
      s: string;
      deadline: number;
      nonce: string;
    };
    score: number;
    moves: number;
    time: number;
    maxTile: number;
  }> {
    const { playerAddress, score, moves, time } = gameData;
    
    const nonce = await this.contract.nonces(playerAddress);
    const deadline = Math.floor(Date.now() / 1000) + 60; // 1 minute deadline
    const network = await this.provider.getNetwork();
    const chainId = Number(network.chainId);
    
    const domain = {
      name: 'Base2048',
      version: '1',
      chainId: chainId,
      verifyingContract: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS
    };

    const types = {
      Score: [
        { name: 'player', type: 'address' },
        { name: 'score', type: 'uint256' },
        { name: 'moves', type: 'uint256' },
        { name: 'time', type: 'uint256' },
        { name: 'nonce', type: 'uint256' },
        { name: 'deadline', type: 'uint256' }
      ]
    };

    const value = {
      player: playerAddress,
      score: score,
      moves: moves,
      time: time,
      nonce: nonce,
      deadline: deadline
    };

    const signature = await this.wallet.signTypedData(domain, types, value);
    const sig = ethers.Signature.from(signature);

    return {
      signature: {
        v: sig.v,
        r: sig.r,
        s: sig.s,
        deadline: deadline,
        nonce: nonce.toString()
      },
      score: score,
      moves: moves,
      time: time,
      maxTile: this.calculateMaxTile(gameData.board)
    };
  }

  private calculateMaxTile(board: number[][]) {
    let maxTile = 0;
    for (const row of board) {
      for (const cell of row) {
        if (cell > maxTile) maxTile = cell;
      }
    }
    return maxTile;
  }
}

export async function POST(request: NextRequest) {
  try {
    const gameData = await request.json();
    
    const validationService = new GameValidationService();
    const validation = validationService.validateGameData(gameData);

    if (!validation.isValid) {
      return NextResponse.json({
        success: false,
        error: 'Invalid game data',
        details: validation.errors,
        type: validation.type
      }, { status: 400 });
    }

    const contractService = new ContractService();
    const signatureResult = await contractService.generateSignature(validation.data!);

    return NextResponse.json({
      success: true,
      message: 'Signature generated successfully',
      data: signatureResult
    });

  } catch (error) {
    console.error('Error generating signature:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
