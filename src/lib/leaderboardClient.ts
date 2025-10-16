import type { LeaderboardEntry } from "@/lib/types";
import { submitScore as apiSubmitScore } from "./apiClient";

const API_BASE_URL = '/api';

export const fetchLeaderboard = async (): Promise<LeaderboardEntry[]> => {
  try {
    const response = await fetch(`${API_BASE_URL}/game/leaderboard?limit=50`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Failed to fetch leaderboard');
    }
    
    // Convert contract data to LeaderboardEntry format
    const entries: LeaderboardEntry[] = data.data.leaderboard.map((item: {
      address: string;
      score: string;
      moves: string;
      time: string;
    }, index: number) => ({
      address: item.address,
      score: parseInt(item.score),
      rank: index + 1,
      moves: parseInt(item.moves),
      time: parseInt(item.time)
    }));
    
    return entries;
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    // Return empty array on error instead of throwing
    return [];
  }
};

export const submitScore = async (entry: LeaderboardEntry) => {
  try {
    // No localStorage - get game data from current state
    // This will be passed from the component
    const submissionData = {
      score: entry.score,
      moves: entry.moves || 0,
      time: entry.time || 0,
      board: [], // Will be passed from component
      playerAddress: entry.address
    };
    
    const result = await apiSubmitScore(submissionData);
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to submit score');
    }
    
    console.log('Score submitted successfully:', result);
    return result;
  } catch (error) {
    console.error('Error submitting score:', error);
    throw error;
  }
};

