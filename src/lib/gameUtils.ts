import { GameStatus, SerializedGameState, TimerState, TilePosition, TileSpawn } from "./types";

export const GRID_SIZE = 4;
const SPAWN_VALUES = [
  { value: 2, weight: 0.9 },
  { value: 4, weight: 0.1 },
];

export const createEmptyBoard = (): number[][] =>
  Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(0));

const randomTileValue = () => {
  const roll = Math.random();
  let cumulative = 0;
  for (const { value, weight } of SPAWN_VALUES) {
    cumulative += weight;
    if (roll <= cumulative) {
      return value;
    }
  }
  return 2;
};

export type SpawnResult = {
  board: number[][];
  position?: TileSpawn;
};

export const spawnTile = (board: number[][]): SpawnResult => {
  const emptyCells: Array<{ row: number; col: number }> = [];
  board.forEach((row, rIdx) =>
    row.forEach((cell, cIdx) => {
      if (cell === 0) {
        emptyCells.push({ row: rIdx, col: cIdx });
      }
    }),
  );

  if (!emptyCells.length) {
    return { board };
  }

  const target = emptyCells[Math.floor(Math.random() * emptyCells.length)];
  const next = board.map((row) => [...row]);
  const value = randomTileValue();
  next[target.row][target.col] = value;
  return { board: next, position: { row: target.row, col: target.col, value } };
};

const slideRowLeft = (row: number[]) => {
  const filtered = row.filter((value) => value !== 0);
  const result = Array(GRID_SIZE).fill(0);
  let idx = 0;
  let gainedScore = 0;
  const merges: number[] = [];
  for (let i = 0; i < filtered.length; i += 1) {
    const current = filtered[i];
    const next = filtered[i + 1];
    if (next !== undefined && next === current) {
      const merged = current * 2;
      result[idx] = merged;
      gainedScore += merged;
       merges.push(idx);
      idx += 1;
      i += 1;
    } else {
      result[idx] = current;
      idx += 1;
    }
  }
  const moved = result.some((value, index) => value !== (row[index] ?? 0));
  return { row: result, moved, gainedScore, merges };
};

type MoveOutcome = {
  board: number[][];
  moved: boolean;
  gainedScore: number;
  merges: TilePosition[];
};

const moveLeft = (board: number[][]): MoveOutcome => {
  const next = createEmptyBoard();
  let moved = false;
  let gainedScore = 0;
  const merges: TilePosition[] = [];
  for (let r = 0; r < GRID_SIZE; r += 1) {
    const { row, moved: rowMoved, gainedScore: rowScore, merges: rowMerges } = slideRowLeft(board[r]);
    next[r] = row;
    if (rowMoved) moved = true;
    gainedScore += rowScore;
    rowMerges.forEach((col) => merges.push({ row: r, col }));
  }
  return { board: next, moved, gainedScore, merges };
};

const reverseRows = (board: number[][]) => board.map((row) => [...row].reverse());

const transpose = (board: number[][]) => {
  const transposed = createEmptyBoard();
  for (let r = 0; r < GRID_SIZE; r += 1) {
    for (let c = 0; c < GRID_SIZE; c += 1) {
      transposed[c][r] = board[r][c];
    }
  }
  return transposed;
};

const moveRight = (board: number[][]): MoveOutcome => {
  const reversed = reverseRows(board);
  const movement = moveLeft(reversed);
  return {
    board: reverseRows(movement.board),
    moved: movement.moved,
    gainedScore: movement.gainedScore,
    merges: movement.merges.map(({ row, col }) => ({
      row,
      col: GRID_SIZE - 1 - col,
    })),
  };
};

const moveUp = (board: number[][]): MoveOutcome => {
  const transposed = transpose(board);
  const movement = moveLeft(transposed);
  return {
    board: transpose(movement.board),
    moved: movement.moved,
    gainedScore: movement.gainedScore,
    merges: movement.merges.map(({ row, col }) => ({
      row: col,
      col: row,
    })),
  };
};

const moveDown = (board: number[][]): MoveOutcome => {
  const transposed = transpose(board);
  const movement = moveRight(transposed);
  return {
    board: transpose(movement.board),
    moved: movement.moved,
    gainedScore: movement.gainedScore,
    merges: movement.merges.map(({ row, col }) => ({
      row: col,
      col: row,
    })),
  };
};

export type MoveDirection = "up" | "down" | "left" | "right";

export const performMove = (board: number[][], direction: MoveDirection): MoveOutcome => {
  const handlers: Record<MoveDirection, () => MoveOutcome> = {
    left: () => moveLeft(board),
    right: () => moveRight(board),
    up: () => moveUp(board),
    down: () => moveDown(board),
  };
  return handlers[direction]();
};

export const hasAvailableMoves = (board: number[][]) => {
  for (let r = 0; r < GRID_SIZE; r += 1) {
    for (let c = 0; c < GRID_SIZE; c += 1) {
      if (board[r][c] === 0) return true;
      if (c < GRID_SIZE - 1 && board[r][c] === board[r][c + 1]) return true;
      if (r < GRID_SIZE - 1 && board[r][c] === board[r + 1][c]) return true;
    }
  }
  return false;
};

export const detectStatus = (board: number[][], currentStatus: GameStatus): GameStatus => {
  if (currentStatus === "won") return "won";
  const isWon = board.some((row) => row.some((cell) => cell >= 2048));
  if (isWon) return "won";
  const movesAvailable = hasAvailableMoves(board);
  if (!movesAvailable) return "lost";
  return "playing";
};

export const initialTimerState: TimerState = {
  isEnabled: true,
  isRunning: false,
  elapsedMs: 0,
};

export const createInitialState = (): SerializedGameState => {
  const first = spawnTile(createEmptyBoard());
  const second = spawnTile(first.board);
  return {
    board: second.board,
    score: 0,
    best: 0,
    moves: 0,
    timer: { ...initialTimerState },
    status: "idle",
  };
};

export const serializeState = (state: SerializedGameState) => JSON.stringify(state);

export const deserializeState = (value: string | null): SerializedGameState | null => {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as SerializedGameState;
    if (!Array.isArray(parsed.board)) return null;
    return parsed;
  } catch (error) {
    console.warn("Failed to deserialize game state", error);
    return null;
  }
};
