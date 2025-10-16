const API_BASE_URL = '/api';

export interface GameSubmissionData {
  score: number;
  moves: number;
  time: number;
  board: number[][];
  playerAddress: string;
}

export interface PlayerScore {
  address: string;
  bestScore: string;
  bestMoves: string;
  bestTime: string;
  exists: boolean;
}

export interface LeaderboardEntry {
  rank: number;
  address: string;
  score: string;
  moves: string;
  time: string;
}

export interface ContractStats {
  totalPlayers: string;
  currentFee: string;
  feeRecipient: string;
  maxPlayers: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  details?: string[];
}

class ApiClient {
  private baseURL: string;

  constructor(baseURL: string = API_BASE_URL) {
    this.baseURL = baseURL;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const url = `${this.baseURL}${endpoint}`;
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        ...options,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      return data;
    } catch (error) {
      console.error('API request failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get backend signature for score submission
   */
  async getScoreSignature(data: GameSubmissionData): Promise<ApiResponse<{
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
  }>> {
    return this.request('/game/get-signature', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Submit a score to the blockchain (legacy - backend pays)
   */
  async submitScore(data: GameSubmissionData): Promise<ApiResponse<{
    transactionHash: string;
    blockNumber: number;
    feePaid: string;
    score: number;
    moves: number;
    time: number;
    maxTile: number;
  }>> {
    return this.request('/game/submit-score', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Get player's best score
   */
  async getPlayerScore(address: string): Promise<ApiResponse<PlayerScore>> {
    return this.request(`/game/player/${address}`);
  }

  /**
   * Get leaderboard
   */
  async getLeaderboard(limit: number = 10): Promise<ApiResponse<{
    leaderboard: LeaderboardEntry[];
    total: number;
    limit: number;
  }>> {
    return this.request(`/game/leaderboard?limit=${limit}`);
  }

  /**
   * Get game statistics
   */
  async getStats(): Promise<ApiResponse<ContractStats>> {
    return this.request('/game/stats');
  }

  /**
   * Get current fee amount
   */
  async getFee(): Promise<ApiResponse<{
    feeAmount: string;
    currency: string;
  }>> {
    return this.request('/game/fee');
  }

  /**
   * Validate game data without submitting
   */
  async validateGame(data: GameSubmissionData): Promise<ApiResponse<{
    score: number;
    moves: number;
    time: number;
    maxTile: number;
  }>> {
    return this.request('/game/validate', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Check if API is healthy
   */
  async healthCheck(): Promise<ApiResponse<{
    status: string;
    timestamp: string;
    version: string;
  }>> {
    return this.request('/health');
  }
}

export const apiClient = new ApiClient();

// Export individual methods for easier importing
export const getScoreSignature = (data: GameSubmissionData) => apiClient.getScoreSignature(data);
export const submitScore = (data: GameSubmissionData) => apiClient.submitScore(data);
export const getPlayerScore = (address: string) => apiClient.getPlayerScore(address);
export const getLeaderboard = (limit: number = 10) => apiClient.getLeaderboard(limit);
export const getStats = () => apiClient.getStats();
export const getFee = () => apiClient.getFee();
export const validateGame = (data: GameSubmissionData) => apiClient.validateGame(data);
export const healthCheck = () => apiClient.healthCheck();

export default apiClient;
