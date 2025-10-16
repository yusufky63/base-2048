import { useCallback, useEffect, useRef, useState } from "react";
import {
  GameState,
  GameStatus,
  LeaderboardEntry,
  LeaderboardState,
  SerializedGameState,
  TileChange,
  TimerState,
} from "@/lib/types";
import {
  createEmptyBoard,
  createInitialState,
  detectStatus,
  performMove,
  spawnTile,
  type MoveDirection,
} from "@/lib/gameUtils";
import { fetchLeaderboard, submitScore } from "@/lib/leaderboardClient";

// No localStorage - fresh start on every page reload for security

const HISTORY_LIMIT = 3;

const withHistory = (state: SerializedGameState, history: SerializedGameState[]): GameState => ({
  ...state,
  history: history.slice(0, HISTORY_LIMIT),
});


const initialSerialized = createInitialState();

export type MoveResult = {
  moved: boolean;
  status: GameStatus;
};

export const useGameState = () => {
  const [game, setGame] = useState<GameState>(() => withHistory(initialSerialized, []));
  const [hydrated, setHydrated] = useState(false);
  const [leaderboard, setLeaderboard] = useState<LeaderboardState>({
    isLoading: true,
    entries: [],
  });
  const [inputLocked, setInputLocked] = useState(false);
  const [lastChange, setLastChange] = useState<TileChange>({ merges: [] });
  const [recentMoves, setRecentMoves] = useState<MoveDirection[]>([]);
  const lockTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastTimestampRef = useRef<number | null>(null);

  useEffect(() => {
    setHydrated(true);
    if (typeof window === "undefined") return;

    // Always start fresh - no localStorage for security
    setGame(withHistory(initialSerialized, []));
    setLastChange({ merges: [] });
    setRecentMoves([]);
  }, []);

  useEffect(() => {
    let active = true;
    setLeaderboard((prev) => ({ ...prev, isLoading: true }));
    fetchLeaderboard()
      .then((entries) => {
        if (!active) return;
        setLeaderboard({ isLoading: false, entries });
      })
      .catch((error: unknown) => {
        if (!active) return;
        setLeaderboard({
          isLoading: false,
          entries: [],
          error: error instanceof Error ? error.message : "Failed to load leaderboard",
        });
      });
    return () => {
      active = false;
    };
  }, []);

  // No localStorage saving - fresh start on every page reload for security

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    if (!game.timer.isEnabled || !game.timer.isRunning) {
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
      }
      rafRef.current = null;
      lastTimestampRef.current = null;
      return undefined;
    }

    const step = (timestamp: number) => {
      if (lastTimestampRef.current === null) {
        lastTimestampRef.current = timestamp;
      }
      const delta = timestamp - lastTimestampRef.current;
      lastTimestampRef.current = timestamp;
      setGame((prev) => {
        if (!prev.timer.isEnabled || !prev.timer.isRunning) return prev;
        return {
          ...prev,
          timer: {
            ...prev.timer,
            elapsedMs: prev.timer.elapsedMs + delta,
          },
        };
      });
      rafRef.current = window.requestAnimationFrame(step);
    };

    rafRef.current = window.requestAnimationFrame(step);

    return () => {
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      lastTimestampRef.current = null;
    };
  }, [game.timer.isEnabled, game.timer.isRunning]);

  useEffect(
    () => () => {
      if (lockTimeoutRef.current) {
        clearTimeout(lockTimeoutRef.current);
        lockTimeoutRef.current = null;
      }
      if (rafRef.current && typeof window !== "undefined") {
        window.cancelAnimationFrame(rafRef.current);
      }
    },
    [],
  );

  const lockInput = useCallback(() => {
    if (lockTimeoutRef.current) {
      clearTimeout(lockTimeoutRef.current);
    }
    setInputLocked(true);
    lockTimeoutRef.current = setTimeout(() => {
      setInputLocked(false);
      lockTimeoutRef.current = null;
    }, 300);
  }, []);

  const updateTimer = useCallback((timerUpdate: Partial<TimerState>) => {
    setGame((prev) => ({
      ...prev,
      timer: {
        ...prev.timer,
        ...timerUpdate,
      },
    }));
  }, []);

  const setStatus = useCallback((status: GameStatus) => {
    setGame((prev) => ({
      ...prev,
      status,
    }));
  }, []);

  const startNewGame = useCallback(
    (bestOverride?: number) => {
      const fresh = {
        ...createInitialState(),
        best: bestOverride ?? game.best,
        status: "playing" as GameStatus,
      };
      setGame({
        ...fresh,
        history: [],
      });
      updateTimer({ elapsedMs: 0, isRunning: true, isEnabled: true });
      setLastChange({ merges: [] });
      setRecentMoves([]);
    },
    [game.best, updateTimer],
  );

  const restartWithCurrentSeed = useCallback(() => {
    setGame((prev) => {
      const first = spawnTile(createEmptyBoard());
      const second = spawnTile(first.board);
      return {
        ...prev,
        board: second.board,
        score: 0,
        moves: 0,
        status: "playing",
        timer: {
          ...prev.timer,
          elapsedMs: 0,
          isRunning: prev.timer.isEnabled,
        },
        history: [],
      };
    });
    setLastChange({ merges: [] });
    setRecentMoves([]);
  }, []);

  const performAction = useCallback(
    (direction: MoveDirection): MoveResult => {
      if (inputLocked) {
        return { moved: false, status: game.status };
      }
      if (game.status === "paused" || game.status === "lost") {
        return { moved: false, status: game.status };
      }
      const movement = performMove(game.board, direction);
      if (!movement.moved) {
        return { moved: false, status: game.status };
      }

      lockInput();
      const spawnResult = spawnTile(movement.board);
      const postMoveBoard = spawnResult.board;
      const nextScore = game.score + movement.gainedScore;
      const nextBest = Math.max(game.best, nextScore);
      const nextStatus = detectStatus(postMoveBoard, game.status === "idle" ? "playing" : game.status);
      const snapshot: SerializedGameState = {
        board: game.board.map((row) => [...row]),
        score: game.score,
        best: game.best,
        moves: game.moves,
        timer: game.timer,
        status: game.status,
      };

      setGame((prev) =>
        withHistory(
          {
            board: postMoveBoard,
            score: nextScore,
            best: nextBest,
            moves: prev.moves + 1,
            timer: {
              ...prev.timer,
              isRunning: nextStatus === "lost" ? false : prev.timer.isRunning,
            },
            status: nextStatus,
          },
          [snapshot, ...prev.history],
        ),
      );

      setLastChange({
        spawned: spawnResult.position,
        merges: movement.merges,
      });
      setRecentMoves((prev) => [direction, ...prev].slice(0, 6));

      if (nextStatus === "playing" && game.status !== "playing") {
        updateTimer({ isRunning: true });
      }
      if (nextStatus === "lost") {
        updateTimer({ isRunning: false });
      }

      return { moved: true, status: nextStatus };
    },
    [game, inputLocked, lockInput, updateTimer],
  );

  const undo = useCallback(() => {
    if (!game.history.length) return;
    const [last, ...rest] = game.history;
    setGame(withHistory(last, rest));
    setLastChange({ merges: [] });
    setRecentMoves((prev) => prev.slice(1));
  }, [game.history]);

  const togglePause = useCallback(() => {
    setGame((prev) => {
      const nextStatus = prev.status === "paused" ? "playing" : "paused";
      return {
        ...prev,
        status: nextStatus,
        timer: {
          ...prev.timer,
          isRunning: nextStatus === "playing" && prev.timer.isEnabled,
        },
      };
    });
  }, []);

  const setTimerEnabled = useCallback((isEnabled: boolean) => {
    setGame((prev) => ({
      ...prev,
      timer: {
        ...prev.timer,
        isEnabled,
        isRunning: isEnabled ? prev.status === "playing" : false,
      },
    }));
  }, []);

  const continueAfterWin = useCallback(() => {
    setGame((prev) => {
      if (prev.status !== "won") return prev;
      return {
        ...prev,
        status: "playing",
        timer: {
          ...prev.timer,
          isRunning: prev.timer.isEnabled,
        },
      };
    });
    setLastChange({ merges: [] });
  }, []);

  const recordPendingScore = useCallback(
    (entry: LeaderboardEntry) => {
      setLeaderboard((prev) => ({ ...prev, isLoading: true }));
      submitScore(entry)
        .then(() =>
          fetchLeaderboard().then((entries) => setLeaderboard({ isLoading: false, entries })),
        )
        .catch((error: unknown) => {
          setLeaderboard((prev) => ({
            ...prev,
            isLoading: false,
            error: error instanceof Error ? error.message : "Failed to submit score",
          }));
        });
    },
    [],
  );

  return {
    game,
    hydrated,
    inputLocked,
    startNewGame,
    restartWithCurrentSeed,
    performAction,
    undo,
    togglePause,
    setTimerEnabled,
    continueAfterWin,
    setStatus,
    updateTimer,
    lastChange,
    recentMoves,
    leaderboard,
    recordPendingScore,
  };
};
