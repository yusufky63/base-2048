export type TimerState = {
  isEnabled: boolean;
  isRunning: boolean;
  elapsedMs: number;
};

export type SerializedGameState = {
  board: number[][];
  score: number;
  best: number;
  moves: number;
  timer: TimerState;
  status: GameStatus;
};

export type GameStatus = "idle" | "playing" | "won" | "lost" | "paused";

export type GameState = SerializedGameState & {
  history: SerializedGameState[];
};

export type TilePosition = {
  row: number;
  col: number;
};

export type TileSpawn = TilePosition & {
  value: number;
};

export type TileChange = {
  spawned?: TileSpawn;
  merges: TilePosition[];
};

export type LeaderboardEntry = {
  address: `0x${string}`;
  score: number;
  rank?: number;
  moves?: number;
  time?: number;
  displayName?: string;
  username?: string;
  avatarUrl?: string;
};

export type LeaderboardState = {
  isLoading: boolean;
  entries: LeaderboardEntry[];
  error?: string;
};
