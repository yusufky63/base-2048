"use client";

import type { ReactNode, TouchEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MoveDirection } from "@/lib/gameUtils";
import { useGameState } from "@/hooks/useGameState";
import { getScoreSignature } from "@/lib/apiClient";
import { useContract } from "@/hooks/useContract";
import { HoldButton } from "./HoldButton";
import { sdk } from "@farcaster/miniapp-sdk";
import { useAccount, useConnect, useDisconnect, type Connector } from "wagmi";
import appsData from "@/data/apps.json";
import toast from "react-hot-toast";
import { getFarcasterProfileByAddress } from "@/lib/neynarService";
import { useLeaderboardWithProfiles } from "@/hooks/useLeaderboardWithProfiles";
import { useNetworkSwitch } from "@/hooks/useNetworkSwitch";
import { CheckCircle, Loader2 } from "lucide-react";
import Image from "next/image";

const ACCENT = "#0A84FF";

const TILE_COLORS: Record<number, string> = {
  0: "bg-white border border-gray-300 border-dashed text-transparent",
  2: "bg-[#EEF5FF] border-[#C9DBFF] text-[#07204D]",
  4: "bg-[#E0EDFF] border-[#BBD3FF] text-[#061C45]",
  8: "bg-[#D1E4FF] border-[#AFC7FF] text-[#05173A]",
  16: "bg-[#BDD7FF] border-[#9DBDFF] text-[#03122E]",
  32: "bg-[#A6CAFF] border-[#89B8FF] text-[#021026]",
  64: "bg-[#8DBBFF] border-[#79AEFF] text-white",
  128: "bg-[#75ADFF] border-[#649FFF] text-white",
  256: "bg-[#5D9FFF] border-[#4B90FF] text-white",
  512: "bg-[#468EFF] border-[#377FFF] text-white",
  1024: "bg-[#2E7AFF] border-[#236CEE] text-white",
  2048: `bg-[${ACCENT}] border-[#0A6AE0] text-white`,
};

const formatElapsed = (elapsedMs: number) => {
  const totalSeconds = Math.floor(elapsedMs / 1000);
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
};

const truncateName = (name: string, maxLength: number = 15) => {
  if (name.length <= maxLength) return name;
  return name.slice(0, maxLength) + "...";
};

const directionArrows: Record<MoveDirection, string> = {
  up: "↑",
  down: "↓",
  left: "←",
  right: "→",
};

type TouchPoint = {
  x: number;
  y: number;
  time: number;
};

const MIN_SWIPE_DISTANCE = 30; // Optimal for mobile responsiveness
const MAX_SWIPE_DURATION = 300; // Better timing for quick swipes

const tileTextSize = (value: number) => {
  if (value >= 2048) return "text-[1.02rem] md:text-[1.32rem]";
  if (value >= 1024) return "text-[1.12rem] md:text-[1.4rem]";
  if (value >= 512) return "text-[1.2rem] md:text-[1.45rem]";
  if (value >= 128) return "text-[1.3rem] md:text-[1.55rem]";
  return "text-[1.38rem] md:text-[1.68rem]";
};

export const GameScreen = () => {
  const {
    game,
    hydrated,
    startNewGame,
    performAction,
    continueAfterWin,
    lastChange,
    recentMoves,
    leaderboard,
    inputLocked,
  } = useGameState();
  const [showWinModal, setShowWinModal] = useState(false);
  const [showLoseModal, setShowLoseModal] = useState(false);
  const [showLeaderboardModal, setShowLeaderboardModal] = useState(false);
  const [showDAppsModal, setShowDAppsModal] = useState(false);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [playerBestScore, setPlayerBestScore] = useState<number | null>(null);
  const [isLoadingPlayerScore, setIsLoadingPlayerScore] = useState(false);
  const [isShaking, setIsShaking] = useState(false);
  const shakeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [scoreSavedToBase, setScoreSavedToBase] = useState(false);
  const [isSubmittingScore, setIsSubmittingScore] = useState(false);
  const [transactionHash, setTransactionHash] = useState<string | null>(null);
  // const [userProfile, setUserProfile] = useState<FarcasterProfile | null>(null);
  const {
    submitScoreWithSignature,
    isPending: isContractPending,
    retryCount: contractRetryCount,
  } = useContract();
  const { connect, connectors, isPending } = useConnect();
  const { address } = useAccount();
  const { ensureBaseNetwork } = useNetworkSwitch();
  const touchStart = useRef<TouchPoint | null>(null);
  const lastTouchTime = useRef<number>(0);
  const lastKeyTime = useRef<number>(0);
  const previousBest = useRef(game.best);

  useEffect(() => {
    previousBest.current = game.best;
  }, [game.best]);

  // Cleanup shake timeout on unmount
  useEffect(() => {
    return () => {
      if (shakeTimeoutRef.current) {
        clearTimeout(shakeTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    setShowWinModal(game.status === "won");
    setShowLoseModal(game.status === "lost");
  }, [game.status]);

  // Initialize Farcaster SDK - call ready when interface is ready
  useEffect(() => {
    const initializeSDK = async () => {
      try {
        // Call ready when the interface is ready to be displayed
        // This hides the Farcaster splash screen
        await sdk.actions.ready();
        console.log("Farcaster splash screen hidden - app ready");
        
        // Prompt user to add the mini app to Farcaster
        try {
          await sdk.actions.addMiniApp();
          console.log("Mini app added to Farcaster successfully");
        } catch (addError) {
          if (addError instanceof Error && addError.name === 'RejectedByUser') {
            console.log("User rejected adding mini app to Farcaster");
          } else {
            console.log("Could not add mini app to Farcaster:", addError);
          }
        }
      } catch (error) {
        console.error("Failed to initialize Farcaster SDK:", error);
      }
    };

    // Call ready when component is mounted and hydrated
    if (hydrated) {
      initializeSDK();
    }
  }, [hydrated]); // Call when hydrated state changes

  // Fetch player's best score and Farcaster profile when wallet connects
  useEffect(() => {
    if (address) {
      const fetchPlayerData = async () => {
        setIsLoadingPlayerScore(true);
        try {
          // Fetch player score
          const scoreResponse = await fetch(`/api/game/player/${address}`);
          if (scoreResponse.ok) {
            const scoreData = await scoreResponse.json();
            if (scoreData.success && scoreData.data.exists) {
              setPlayerBestScore(parseInt(scoreData.data.bestScore));
            } else {
              setPlayerBestScore(0);
            }
          }

          // Fetch Farcaster profile
          const profile = await getFarcasterProfileByAddress(address);
          if (profile) {
            console.log("Farcaster profile loaded:", profile);
          } else {
            console.log("No Farcaster profile found for address:", address);
          }
        } catch (error) {
          console.error("Error fetching player data:", error);
          setPlayerBestScore(null);
        } finally {
          setIsLoadingPlayerScore(false);
        }
      };

      fetchPlayerData();
    } else {
      setPlayerBestScore(null);
      setIsLoadingPlayerScore(false);
    }
  }, [address]);

  const handleMove = useCallback(
    (direction: MoveDirection) => {
      // Don't process moves if already shaking or input is locked
      if (isShaking || inputLocked) return;

      const result = performAction(direction);

      // Only shake if it's a real invalid move (board didn't change)
      // Don't shake for input lock, game over, or other states
      if (!result.moved) {
        // Check if the game is in a state where moves should be ignored
        if (game.status === "lost" || game.status === "paused") {
          return; // Don't shake for game over or paused states
        }

        // Clear any existing shake timeout
        if (shakeTimeoutRef.current) {
          clearTimeout(shakeTimeoutRef.current);
        }

        setIsShaking(true);
        shakeTimeoutRef.current = setTimeout(() => {
          setIsShaking(false);
          shakeTimeoutRef.current = null;
        }, 200);
      }
    },
    [performAction, isShaking, game.status, inputLocked]
  );

  useEffect(() => {
    if (!hydrated) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const now = Date.now();

      // Prevent rapid key presses (debounce)
      if (now - lastKeyTime.current < 100) {
        return;
      }

      switch (event.key.toLowerCase()) {
        // Arrow keys
        case "arrowup":
        case "arrowdown":
        case "arrowleft":
        case "arrowright": {
          event.preventDefault();
          lastKeyTime.current = now;
          handleMove(
            event.key.replace("Arrow", "").toLowerCase() as MoveDirection
          );
          break;
        }
        // WASD keys
        case "w": {
          event.preventDefault();
          lastKeyTime.current = now;
          handleMove("up");
          break;
        }
        case "s": {
          event.preventDefault();
          lastKeyTime.current = now;
          handleMove("down");
          break;
        }
        case "a": {
          event.preventDefault();
          lastKeyTime.current = now;
          handleMove("left");
          break;
        }
        case "d": {
          event.preventDefault();
          lastKeyTime.current = now;
          handleMove("right");
          break;
        }
        // New game shortcuts
        case "r":
        case "n": {
          event.preventDefault();
          startNewGame();
          break;
        }
        default:
          break;
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleMove, startNewGame, hydrated]);

  const onTouchStart = useCallback((event: TouchEvent<HTMLDivElement>) => {
    event.preventDefault(); // Prevent scrolling on mobile
    const touch = event.touches[0];
    touchStart.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now(),
    };
  }, []);

  const onTouchEnd = useCallback(
    (event: TouchEvent<HTMLDivElement>) => {
      event.preventDefault(); // Prevent scrolling on mobile
      if (!touchStart.current) return;

      const now = Date.now();
      // Prevent rapid touches (debounce)
      if (now - lastTouchTime.current < 100) {
        touchStart.current = null;
        return;
      }
      lastTouchTime.current = now;

      const touch = event.changedTouches[0];
      const dx = touch.clientX - touchStart.current.x;
      const dy = touch.clientY - touchStart.current.y;
      const duration = now - touchStart.current.time;
      touchStart.current = null;

      // Check if it's a valid swipe
      if (duration > MAX_SWIPE_DURATION) return;
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);
      if (Math.max(absDx, absDy) < MIN_SWIPE_DISTANCE) return;

      // Determine direction with better sensitivity
      const direction: MoveDirection =
        absDx > absDy ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up";

      handleMove(direction);
    },
    [handleMove]
  );

  const bestImproved = game.score > previousBest.current;

  const spawnKey = useMemo(
    () =>
      lastChange.spawned
        ? `${lastChange.spawned.row}-${lastChange.spawned.col}`
        : null,
    [lastChange.spawned]
  );

  const mergedKeys = useMemo(
    () => new Set(lastChange.merges.map(({ row, col }) => `${row}-${col}`)),
    [lastChange.merges]
  );
  const prevScoreRef = useRef(game.score);
  const [displayScore, setDisplayScore] = useState(game.score);
  useEffect(() => {
    const from = prevScoreRef.current;
    const to = game.score;
    prevScoreRef.current = to;
    if (from === to) {
      setDisplayScore(to);
      return;
    }
    const duration = 420;
    const ease = (t: number) => 1 - Math.pow(1 - t, 3);
    let frame = 0;
    const start = performance.now();
    const step = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = ease(progress);
      setDisplayScore(Math.round(from + (to - from) * eased));
      if (progress < 1) {
        frame = requestAnimationFrame(step);
      }
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [game.score]);

  const leaderboardPreview = useMemo(
    () => leaderboard.entries.slice(0, 10),
    [leaderboard.entries]
  );

  const {
    enrichedEntries: enrichedLeaderboardPreview,
    isLoading: isEnrichingProfiles,
  } = useLeaderboardWithProfiles(leaderboardPreview);
  const {
    enrichedEntries: enrichedFullLeaderboard,
    isLoading: isEnrichingFullProfiles,
  } = useLeaderboardWithProfiles(leaderboard.entries);
  const formattedTimer = useMemo(
    () => formatElapsed(game.timer.elapsedMs),
    [game.timer.elapsedMs]
  );

  const latestMove = recentMoves[0] ?? null;

  const saveToBase = useCallback(async () => {
    if (!address) {
      toast.error("Please connect your wallet first");
      return;
    }

    // Ensure we're on Base network
    try {
      console.log("Ensuring Base network before transaction...");
      await ensureBaseNetwork();
      console.log("Base network confirmed, proceeding with transaction...");
    } catch (error) {
      console.error("Network switch failed:", error);
      toast.error("Please switch to Base network to save your score");
      return;
    }

    // Validate game state before submission
    if (game.score < 0 || game.moves < 0 || game.timer.elapsedMs < 0) {
      toast.error("Invalid game state. Please start a new game.");
      return;
    }

    // Reset saved state at the beginning of each attempt
    setScoreSavedToBase(false);
    setIsSubmittingScore(true);
    setTransactionHash(null);

    try {
      // Step 1: Get backend signature
      const submissionData = {
        score: game.score,
        moves: game.moves,
        time: Math.floor(game.timer.elapsedMs / 1000),
        board: game.board,
        playerAddress: address,
      };

      const signatureResult = await getScoreSignature(submissionData);

      if (!signatureResult.success) {
        const errorMessage = signatureResult.error || "Failed to get signature";
        const details = signatureResult.details
          ? ` Details: ${signatureResult.details.join(", ")}`
          : "";
        throw new Error(`${errorMessage}${details}`);
      }

      // Step 2: Submit to contract with user wallet
      const { signature } = signatureResult.data!;

      const receipt = await submitScoreWithSignature(
        address,
        game.score,
        game.moves,
        Math.floor(game.timer.elapsedMs / 1000),
        signature.deadline,
        {
          v: signature.v,
          r: signature.r as `0x${string}`,
          s: signature.s as `0x${string}`,
        }
      );

      // Only mark as saved if transaction was successful
      if (receipt && receipt.status === "success") {
        // Mark score as saved to Base ONLY on success
        setScoreSavedToBase(true);
        setTransactionHash(receipt.transactionHash);

        // Refresh player best score from contract after successful submission
        if (address) {
          try {
            const scoreResponse = await fetch(`/api/game/player/${address}`);
            if (scoreResponse.ok) {
              const scoreData = await scoreResponse.json();
              if (scoreData.success && scoreData.data.exists) {
                setPlayerBestScore(parseInt(scoreData.data.bestScore));
              }
            }
          } catch (error) {
            console.error("Error refreshing player score:", error);
          }
        }

        // Show success message with transaction details

        toast.success("Score saved Onchain! 🎉", {
          duration: 6000,
          style: {
            background: "#10B981",
            color: "#fff",
            borderRadius: "12px",
            border: "1px solid #059669",
            fontSize: "14px",
            fontWeight: "500",
          },
        });
      } else {
        throw new Error("Transaction failed");
      }
    } catch (error) {
      console.error("Error saving to Base:", error);

      // Show specific error message
      let errorMessage = "Failed to save score to Base. Please try again.";
      let isRetryable = false;

      if (error instanceof Error) {
        if (error.message.includes("User rejected")) {
          errorMessage = "Transaction was cancelled. Please try again.";
        } else if (error.message.includes("insufficient funds")) {
          errorMessage =
            "Insufficient funds for transaction. Please check your wallet.";
        } else if (
          error.message.includes("network") ||
          error.message.includes("RPC")
        ) {
          errorMessage =
            "Network error. Please check your connection and try again.";
          isRetryable = true;
        } else if (error.message.includes("Invalid game data")) {
          errorMessage = "Invalid game data. Please start a new game.";
        } else if (error.message.includes("Transaction failed")) {
          errorMessage = "Transaction failed. Please try again.";
        } else if (error.message.includes("timeout")) {
          errorMessage = "Transaction timeout. Please try again.";
          isRetryable = true;
        } else if (error.message.includes("Invalid signature data")) {
          errorMessage = "Invalid signature. Please try again.";
          isRetryable = true;
        } else if (error.message.includes("after all retries")) {
          errorMessage =
            "Transaction failed after multiple attempts. Please try again";
          isRetryable = true;
        } else {
          errorMessage = `Error: ${error.message}`;
        }
      }

      toast.error(
        `${errorMessage}${
          isRetryable ? '\nClick "Save to Base" to retry' : ""
        }`,
        {
          duration: 6000,
          style: {
            background: "#EF4444",
            color: "#fff",
            borderRadius: "12px",
            border: "1px solid #DC2626",
            fontSize: "14px",
            fontWeight: "500",
          },
        }
      );

      // Ensure saved state is false on error so user can retry
      setScoreSavedToBase(false);
    } finally {
      // Always reset loading state
      setIsSubmittingScore(false);
    }
  }, [
    game.score,
    game.moves,
    game.timer.elapsedMs,
    game.board,
    address,
    submitScoreWithSignature,
    ensureBaseNetwork,
  ]);

  const handleContinue = useCallback(() => {
    continueAfterWin();
    setShowWinModal(false);
  }, [continueAfterWin]);

  const handleTryAgain = useCallback(() => {
    startNewGame();
    setShowLoseModal(false);
    setScoreSavedToBase(false); // Reset saved state for new game
    setIsSubmittingScore(false); // Reset loading state for new game
    // Don't reset playerBestScore - keep contract data
  }, [startNewGame]);

  const shareCurrentRun = useCallback(async () => {
    const shareText = `🎮 I just scored ${game.score.toLocaleString()} points on Base 2048! Can you beat my score?`;
    const origin =
      typeof window !== "undefined"
        ? window.location.origin
        : "https://base-2048.vercel.app/";
    const shareUrl = `${origin}`;

    try {
      // Try to use Farcaster SDK first - using openUrl to open compose
      const composeUrl = `https://farcaster.xyz/~/compose?text=${encodeURIComponent(
        shareText
      )}&embeds[]=${encodeURIComponent(shareUrl)}`;
      await sdk.actions.openUrl(composeUrl);
    } catch (error) {
      console.log(
        "Farcaster SDK share failed, falling back to web share:",
        error
      );

      // Fallback to web share or external link
      const composed = `${shareText} ${shareUrl}`;
      if (typeof navigator !== "undefined" && navigator.share) {
        navigator.share({ text: shareText, url: shareUrl }).catch(() => {
          if (typeof window !== "undefined") {
            window.open(
              `https://farcaster.xyz/~/compose?text=${encodeURIComponent(
                composed
              )}`,
              "_blank",
              "noopener,noreferrer"
            );
          }
        });
      } else if (typeof window !== "undefined") {
        window.open(
          `https://farcaster.xyz/~/compose?text=${encodeURIComponent(
            composed
          )}`,
          "_blank",
          "noopener,noreferrer"
        );
      } else {
        console.info("Share to Farcaster:", composed);
      }
    }
  }, [game.score]);

  // Let Farcaster handle the splash screen - no custom loading screen needed

  return (
    <div className="min-h-screen bg-[#F7F8FA] text-[#1C2333] p-2">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-2">
        <header className="flex flex-col gap-3 rounded-2xl border border-[#C5D5FF] bg-white p-3.5 shadow-md sm:p-3 md:flex-row md:items-center md:justify-between ">
          <div className="flex w-full items-center justify-between gap-3">
            <div>
              <h1 className="text-[20px] font-semibold tracking-tight text-[#1C2333] border-2 border-[#0A84FF] rounded-sm flex items-center gap-2">
                <span className="text-sm md:text-base bg-[#0A84FF] text-white p-1.5">
                  Base
                </span>
                <span className="text-sm md:text-base  text-[#0A84FF] p-1.5 rounded-lg">
                  2048
                </span>
              </h1>
            </div>
            <ConnectWalletButton
              onOpenWalletModal={() => setShowWalletModal(true)}
              connectors={connectors}
              connect={connect}
              isPending={isPending}
            />
          </div>
        </header>

        <main className="flex flex-col gap-3 md:flex-row">
          <section className="flex w-full flex-col gap-3 md:w-2/3">
            {/* Game Board */}
            <div
              className={`game-board relative aspect-square w-full rounded-[22px] border border-[#C5D5FF] bg-white p-2.5 shadow-md sm:rounded-[24px] sm:p-3.5 md:p-3 touch-none select-none ${
                isShaking ? "animate-shake" : ""
              }`}
              onTouchStart={onTouchStart}
              onTouchEnd={onTouchEnd}
              style={{ touchAction: "none" }}
            >
              <div className="relative grid h-full w-full grid-cols-4 grid-rows-4 gap-2 sm:gap-3 md:gap-3">
                {game.board.map((row, rowIndex) =>
                  row.map((value, colIndex) => {
                    const cellKey = `${rowIndex}-${colIndex}`;
                    const isNew = spawnKey === cellKey;
                    const isMerged = mergedKeys.has(cellKey);
                    return (
                      <Tile
                        key={cellKey}
                        value={value}
                        isNew={isNew}
                        isMerged={isMerged}
                      />
                    );
                  })
                )}
              </div>
            </div>

            {/* New Game Button - Below game board (Desktop only) */}
            <div className="hidden md:block rounded-2xl border border-[#C5D5FF] bg-white p-3 shadow-md">
              <div className="flex flex-col gap-3">
                <div className="flex justify-center w-full">
                  <HoldButton
                    onHoldComplete={() => startNewGame()}
                    holdDuration={800}
                    className="w-full"
                  >
                    New Game
                  </HoldButton>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="flex-1 rounded-full border border-[#C5D5FF] px-3 py-1.5 text-xs font-semibold  transition hover:border-[#0A84FF] hover:bg-[#0A84FF]/5 shadow-sm cursor-pointer"
                    onClick={shareCurrentRun}
                  >
                    Share
                  </button>
                  <button
                    type="button"
                    className="flex-1 rounded-full border border-[#C5D5FF] px-3 py-1.5 text-xs font-semibold  transition hover:border-[#0A84FF] hover:bg-[#0A84FF]/5 shadow-sm cursor-pointer"
                    onClick={() => setShowDAppsModal(true)}
                  >
                    Other Apps
                  </button>
                </div>
              </div>
            </div>
          </section>

          <aside className="flex w-full flex-col gap-3 md:w-1/3">
            <div className="rounded-2xl border border-[#C5D5FF] bg-white p-3 shadow-md">
              <div className="flex flex-wrap items-center gap-3">
                <ScorePill
                  className="flex-1 min-w-[120px]"
                  label="Score"
                  value={displayScore}
                  highlight={bestImproved}
                />
                <ScorePill
                  className="flex-1 min-w-[120px]"
                  label="Best"
                  value={playerBestScore !== null ? playerBestScore : 0}
                  isLoading={isLoadingPlayerScore}
                />
              </div>
              <div className="mt-4 space-y-2 text-xs text-[#4C5A77]">
                <div className="flex items-center justify-between text-sm w-full">
                  <InfoChip
                    className="w-full"
                    label="Time elapsed"
                    value={formattedTimer}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <span>Total moves</span>
                  <span>{game.moves}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Last move</span>
                  <span className="flex items-center gap-1 font-semibold text-[#1C2333]">
                    {latestMove ? (
                      <>
                        <span className="text-sm">
                          {directionArrows[latestMove]}
                        </span>
                        <span>
                          {latestMove.charAt(0).toUpperCase() +
                            latestMove.slice(1)}
                        </span>
                      </>
                    ) : (
                      "—"
                    )}
                  </span>
                </div>
              </div>
            </div>

            {/* New Game Button - Mobile only (below Run Snapshot) */}
            <div className="md:hidden rounded-2xl border border-[#C5D5FF] bg-white p-3 shadow-md">
              <div className="flex flex-col gap-3">
                <div className="flex justify-center w-full">
                  <HoldButton
                    onHoldComplete={() => startNewGame()}
                    holdDuration={800}
                    className="w-full"
                  >
                    New Game
                  </HoldButton>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="flex-1 rounded-full border border-[#C5D5FF] px-3 py-1.5 text-xs font-semibold  transition hover:border-[#0A84FF] hover:bg-[#0A84FF]/5 shadow-sm cursor-pointer"
                    onClick={shareCurrentRun}
                  >
                    Share
                  </button>
                  <button
                    type="button"
                    className="flex-1 rounded-full border border-[#C5D5FF] px-3 py-1.5 text-xs font-semibold  transition hover:border-[#0A84FF] hover:bg-[#0A84FF]/5 shadow-sm cursor-pointer"
                    onClick={() => setShowDAppsModal(true)}
                  >
                    Other Apps
                  </button>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-[#C5D5FF] bg-white p-3 shadow-md">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-[#4C5A77]">
                Top Scores
              </h2>
              {leaderboard.isLoading || isEnrichingProfiles ? (
                <div className="mt-3 space-y-2">
                  {Array.from({ length: 10 }).map((_, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between gap-3 animate-pulse"
                    >
                      <span className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-full bg-gray-200"></div>
                        <div className="flex items-center gap-2">
                          <div className="h-5 w-5 rounded-full bg-gray-200"></div>
                          <div className="h-4 w-20 bg-gray-200 rounded"></div>
                        </div>
                      </span>
                      <div className="h-4 w-12 bg-gray-200 rounded"></div>
                    </div>
                  ))}
                </div>
              ) : leaderboard.error ? (
                <p className="mt-3 text-sm text-[#E54848]">
                  Leaderboard unavailable. {leaderboard.error}
                </p>
              ) : enrichedLeaderboardPreview.length ? (
                <>
                  <ul className="mt-3 space-y-2 text-sm text-[#222222]">
                    {enrichedLeaderboardPreview.map((entry, index) => (
                      <li
                        key={entry.address}
                        className="flex items-center justify-between gap-3"
                      >
                        <span className="flex items-center gap-2 text-[#4C5A77]">
                          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-[#C5D5FF] text-xs font-semibold text-[#1C2333]">
                            {entry.rank || index + 1}
                          </span>
                          <div className="flex items-center gap-2">
                            {entry.farcasterProfile?.pfpUrl ? (
                              <Image
                                src={entry.farcasterProfile.pfpUrl}
                                alt="avatar"
                                width={20}
                                height={20}
                                className="h-5 w-5 rounded-full object-cover"
                                unoptimized
                              />
                            ) : null}
                            <div
                              className="h-5 w-5 rounded-full bg-[#0A84FF] flex items-center justify-center text-white text-xs font-semibold"
                              style={{
                                display: entry.farcasterProfile?.pfpUrl
                                  ? "none"
                                  : "flex",
                              }}
                            >
                              {(
                                entry.farcasterProfile?.displayName ||
                                entry.farcasterProfile?.username ||
                                entry.displayName ||
                                entry.username ||
                                "?"
                              )
                                .charAt(0)
                                .toUpperCase()}
                            </div>
                            <span className="text-xs">
                              {truncateName(
                                entry.farcasterProfile?.displayName ||
                                entry.farcasterProfile?.username ||
                                entry.displayName ||
                                entry.username ||
                                entry.address.slice(0, 4) +
                                  "..." +
                                  entry.address.slice(-4)
                              )}
                            </span>
                          </div>
                        </span>
                        <div className="text-right">
                          <span className="font-semibold text-[#1C2333]">
                            {entry.score.toLocaleString()}
                          </span>
                          {entry.moves && (
                            <div className="text-xs text-[#4C5A77]">
                              {entry.moves} moves
                            </div>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                  {leaderboard.entries.length > leaderboardPreview.length ? (
                    <button
                      type="button"
                      className="mt-4 w-full rounded-full border border-[#C5D5FF] shadow-sm px-3 py-1.5 text-xs font-semibold  transition hover:border-[#0A84FF] hover:text-[#0A84FF]"
                      onClick={() => setShowLeaderboardModal(true)}
                    >
                      View full leaderboard
                    </button>
                  ) : null}
                </>
              ) : (
                <p className="mt-3 text-sm text-[#4C5A77]">
                  Connect with Farcaster to see rich profiles.
                </p>
              )}
            </div>
          </aside>
        </main>
      </div>

      {showWinModal ? (
        <Modal title="You made 2048!" onClose={handleContinue}>
          <p className="text-sm text-[#4C5A77]">
            Stellar merge streak! Save your score to Base, share the flex with
            Farcaster, or keep climbing.
          </p>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            {!scoreSavedToBase && (
              <button
                key={`save-button-${address ? "connected" : "disconnected"}`}
                type="button"
                className="w-full rounded-full px-4 py-2 text-sm font-semibold text-white transition cursor-pointer bg-[#0A84FF] hover:bg-[#0A76E5] disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={address ? saveToBase : () => setShowWalletModal(true)}
                disabled={address && (isContractPending || isSubmittingScore)}
              >
                {isSubmittingScore ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {contractRetryCount > 0
                      ? `Retrying... (${contractRetryCount}/3)`
                      : "Getting signature..."}
                  </div>
                ) : isContractPending ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Confirming transaction...
                  </div>
                ) : address ? (
                  contractRetryCount > 0 ? (
                    "Retry Save to Base"
                  ) : (
                    "Save to Base"
                  )
                ) : (
                  "Connect Wallet to Save"
                )}
              </button>
            )}
            {scoreSavedToBase && (
              <div className="w-full space-y-2">
                <div className="rounded-full px-4 py-2 text-sm font-semibold text-center bg-green-500 text-white flex items-center justify-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  Score Saved Onchain!
                </div>
                {transactionHash && (
                  <div className="text-center">
                    <a
                      href={`https://basescan.org/tx/${transactionHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-[#0A84FF] hover:text-[#0A76E5] underline"
                    >
                      View Transaction: {transactionHash.slice(0, 10)}...
                      {transactionHash.slice(-6)}
                    </a>
                  </div>
                )}
              </div>
            )}
            <button
              type="button"
              className="w-full rounded-full border border-[#C5D5FF] px-4 py-2 text-sm font-semibold text-[#0A84FF] transition hover:border-[#0A84FF] hover:text-[#0A84FF]"
              onClick={shareCurrentRun}
            >
              Share on Farcaster
            </button>
            <button
              type="button"
              className="w-full rounded-full border border-[#C5D5FF] px-4 py-2 text-sm font-semibold text-[#1C2333] transition hover:border-[#0A84FF] hover:text-[#0A84FF]"
              onClick={handleContinue}
            >
              Continue
            </button>
          </div>
        </Modal>
      ) : null}

      {showLoseModal ? (
        <Modal title="No more moves" onClose={handleTryAgain}>
          <p className="text-sm text-[#4C5A77]">
            Board is locked at {game.score.toLocaleString()} points. Ready to
            save, share, or give it another shot?
          </p>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            {!scoreSavedToBase && (
              <button
                key={`save-button-${address ? "connected" : "disconnected"}`}
                type="button"
                className="w-full rounded-full px-4 py-2 text-sm font-semibold text-white transition cursor-pointer bg-[#0A84FF] hover:bg-[#0A76E5] disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={address ? saveToBase : () => setShowWalletModal(true)}
                disabled={address && (isContractPending || isSubmittingScore)}
              >
                {isSubmittingScore ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {contractRetryCount > 0
                      ? `Retrying... (${contractRetryCount}/3)`
                      : "Getting signature..."}
                  </div>
                ) : isContractPending ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Confirming transaction...
                  </div>
                ) : address ? (
                  contractRetryCount > 0 ? (
                    "Retry Save to Base"
                  ) : (
                    "Save to Base"
                  )
                ) : (
                  "Connect Wallet to Save"
                )}
              </button>
            )}
            {scoreSavedToBase && (
              <div className="w-full space-y-2">
                <div className="rounded-full px-4 py-2 text-sm font-semibold text-center bg-green-500 text-white flex items-center justify-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  Score Saved Onchain!
                </div>
                {transactionHash && (
                  <div className="text-center">
                    <a
                      href={`https://basescan.org/tx/${transactionHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-[#0A84FF] hover:text-[#0A76E5] underline"
                    >
                      View Transaction: {transactionHash.slice(0, 10)}...
                      {transactionHash.slice(-6)}
                    </a>
                  </div>
                )}
              </div>
            )}
            <button
              type="button"
              className="w-full rounded-full border border-[#C5D5FF] px-4 py-2 text-sm font-semibold text-[#0A84FF] transition hover:border-[#0A84FF] hover:text-[#0A84FF]"
              onClick={shareCurrentRun}
            >
              Share on Farcaster
            </button>
            <button
              type="button"
              className="w-full rounded-full border border-[#C5D5FF] px-4 py-2 text-sm font-semibold text-[#1C2333] transition hover:border-[#0A84FF] hover:text-[#0A84FF]"
              onClick={handleTryAgain}
            >
              Try Again
            </button>
          </div>
        </Modal>
      ) : null}

      {showLeaderboardModal ? (
        <Modal
          title="Top 50 Leaderboard"
          onClose={() => setShowLeaderboardModal(false)}
        >
          <div className="max-h-[60vh] overflow-y-auto pr-1">
            {leaderboard.isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 20 }).map((_, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between gap-3 rounded-lg bg-[#F5F7FF] px-3 py-2 animate-pulse"
                  >
                    <span className="flex items-center gap-3">
                      <div className="h-7 w-7 rounded-full bg-gray-200"></div>
                      <div className="flex items-center gap-3">
                        <div className="h-6 w-6 rounded-full bg-gray-200"></div>
                        <div className="h-4 w-24 bg-gray-200 rounded"></div>
                      </div>
                    </span>
                    <div className="h-4 w-16 bg-gray-200 rounded"></div>
                  </div>
                ))}
              </div>
            ) : isEnrichingFullProfiles ? (
              <div className="space-y-2">
                {Array.from({ length: 20 }).map((_, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between gap-3 rounded-lg bg-[#F5F7FF] px-3 py-2 animate-pulse"
                  >
                    <span className="flex items-center gap-3">
                      <div className="h-7 w-7 rounded-full bg-gray-200"></div>
                      <div className="flex items-center gap-3">
                        <div className="h-6 w-6 rounded-full bg-gray-200"></div>
                        <div className="h-4 w-24 bg-gray-200 rounded"></div>
                      </div>
                    </span>
                    <div className="h-4 w-16 bg-gray-200 rounded"></div>
                  </div>
                ))}
              </div>
            ) : enrichedFullLeaderboard.length ? (
              <ol className="space-y-2 text-sm text-[#1C2333]">
                {enrichedFullLeaderboard.map((entry, index) => (
                  <li
                    key={`${entry.address}-${index}`}
                    className="flex items-center justify-between gap-3 rounded-lg bg-[#F5F7FF] px-3 py-2"
                  >
                    <span className="flex items-center gap-3 text-[#34415C]">
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white text-sm font-semibold text-[#1C2333]">
                        {entry.rank || index + 1}
                      </span>
                      <div className="flex items-center gap-2">
                        {entry.farcasterProfile?.pfpUrl ? (
                          <Image
                            src={entry.farcasterProfile.pfpUrl}
                            alt="avatar"
                            width={24}
                            height={24}
                            className="h-6 w-6 rounded-full object-cover"
                            unoptimized
                          />
                        ) : null}
                        <div
                          className="h-6 w-6 rounded-full bg-[#0A84FF] flex items-center justify-center text-white text-xs font-semibold"
                          style={{
                            display: entry.farcasterProfile?.pfpUrl
                              ? "none"
                              : "flex",
                          }}
                        >
                          {(
                            entry.farcasterProfile?.displayName ||
                            entry.farcasterProfile?.username ||
                            entry.displayName ||
                            entry.username ||
                            "?"
                          )
                            .charAt(0)
                            .toUpperCase()}
                        </div>
                        <span className="font-medium">
                          {truncateName(
                            entry.farcasterProfile?.displayName ||
                            entry.farcasterProfile?.username ||
                            entry.displayName ||
                            entry.username ||
                            entry.address.slice(0, 10)
                          )}
                        </span>
                      </div>
                    </span>
                    <div className="text-right">
                      <span className="font-semibold text-[#0A84FF]">
                        {entry.score.toLocaleString()}
                      </span>
                      {entry.moves && (
                        <div className="text-xs text-[#4C5A77]">
                          {entry.moves} moves
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-[#4C5A77]">
                Leaderboard will be ready once runs are saved on Base.
              </p>
            )}
          </div>
        </Modal>
      ) : null}

      {showDAppsModal ? (
        <Modal title="Other Apps" onClose={() => setShowDAppsModal(false)}>
          <div className="space-y-2 sm:space-y-3 max-h-[70vh] overflow-y-auto">
            <p className="text-sm text-[#4C5A77] px-1">
              Discover other amazing apps.
            </p>
            <div className="grid gap-2 sm:gap-3">
              {appsData.map((app) => (
                <button
                  key={app.id}
                  type="button"
                  className="group flex items-center gap-2 sm:gap-3 rounded-lg border border-[#C5D5FF] bg-white p-2 sm:p-3 text-left transition hover:border-[#0A84FF] hover:bg-[#0A84FF]/5 cursor-pointer hover:shadow-md"
                  onClick={() => {
                    console.log(`Navigate to ${app.name}`);
                    window.open(app.url, "_blank", "noopener,noreferrer");
                  }}
                >
                  <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-xl bg-[#0A84FF]/10 flex-shrink-0">
                    <Image
                      src={app.icon}
                      alt={`${app.name} icon`}
                      width={32}
                      height={32}
                      className="h-6 w-6 sm:h-8 sm:w-8 object-contain rounded-lg"
                      unoptimized
                    />
                    <span className="text-lg hidden">🎮</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-[#1C2333] text-sm sm:text-base truncate">{app.name}</h3>
                    <p className="text-xs text-[#4C5A77] line-clamp-2">{app.description}</p>
                  </div>
                  <div className="flex items-center justify-center flex-shrink-0">
                    <svg
                      className="h-4 w-4 text-[#4C5A77] transition-colors group-hover:text-[#0A84FF]"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                      />
                    </svg>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </Modal>
      ) : null}

      {/* Wallet Selection Modal */}
      {showWalletModal ? (
        <Modal title="Select Wallet" onClose={() => setShowWalletModal(false)}>
          <div className="flex flex-col gap-3">
            <p className="text-sm text-[#4C5A77] mb-4">
              Choose a wallet to connect:
            </p>
            <div className="flex flex-col gap-2">
              {connectors.map((connector: Connector) => (
                <button
                  key={connector.uid}
                  type="button"
                  className="flex items-center gap-3 rounded-lg border border-[#C5D5FF] bg-white p-3 text-left transition hover:border-[#0A84FF] hover:bg-[#0A84FF]/5 cursor-pointer hover:shadow-md"
                  onClick={() => {
                    connect({ connector });
                    setShowWalletModal(false);
                  }}
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#0A84FF]/10">
                    <span className="text-lg">
                      {connector.name === "Farcaster Mini App" ? "🔗" : "🦊"}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-[#1C2333]">
                      {connector.name}
                    </h3>
                    <p className="text-xs text-[#4C5A77]">
                      {connector.name === "Farcaster Mini App"
                        ? "Connect via Farcaster"
                        : "Browser wallet"}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
};

type ScorePillProps = {
  label: string;
  value: number;
  highlight?: boolean;
  className?: string;
  isLoading?: boolean;
};

const ScorePill = ({
  label,
  value,
  highlight = false,
  className = "",
  isLoading = false,
}: ScorePillProps) => (
  <div
    className={`flex min-w-[110px] flex-col items-center rounded-[16px] border border-[#C5D5FF] bg-white px-4 py-2 text-[#1C2333] shadow-sm transition-transform duration-300 ${
      highlight
        ? "scale-[1.03] border-[#0A84FF] shadow-[0_12px_24px_rgba(10,132,255,0.18)]"
        : ""
    } ${className}`}
    aria-live="polite"
  >
    <span className="text-xs uppercase text-[#4C5A77] tracking-wide">
      {label}
    </span>
    <span
      className={`text-lg font-semibold transition-colors tracking-tight ${
        highlight ? "text-[#0A84FF]" : ""
      }`}
    >
      {isLoading ? (
        <div className="flex items-center gap-1">
          <div className="h-4 w-4 animate-pulse bg-gray-300 rounded"></div>
          <div className="h-4 w-8 animate-pulse bg-gray-300 rounded"></div>
        </div>
      ) : (
        value.toLocaleString()
      )}
    </span>
  </div>
);

type InfoChipProps = {
  label: string;
  value: string;
  className?: string;
};

const InfoChip = ({ label, value, className = "" }: InfoChipProps) => (
  <div
    className={`inline-flex min-w-[96px] flex-col items-center justify-center rounded-[14px] border border-[#C5D5FF] bg-white px-3 py-2 text-[#334064] shadow-sm ${className}`}
  >
    <span className="text-[11px] uppercase tracking-[0.16em] text-[#7281A7]">
      {label}
    </span>
    <span className="text-sm font-semibold text-[#1C2333]">{value}</span>
  </div>
);

const ConnectWalletButton = ({
  onOpenWalletModal,
  connectors,
  connect,
  isPending,
}: {
  onOpenWalletModal: () => void;
  connectors: readonly Connector[];
  connect: (args: { connector: Connector }) => void;
  isPending: boolean;
}) => {
  const { isConnected, address } = useAccount();
  const { disconnect } = useDisconnect();
  const { isOnBaseNetwork, isSwitching } = useNetworkSwitch();

  const handleConnect = () => {
    // If only one connector (Farcaster), connect directly
    if (connectors.length === 1) {
      connect({ connector: connectors[0] });
    } else {
      // Multiple connectors, show modal
      onOpenWalletModal();
    }
  };

  const handleDisconnect = () => {
    disconnect();
  };

  if (isConnected) {
    return (
      <div className="flex items-center gap-2">
        {!isOnBaseNetwork && !isSwitching && (
          <span className="text-xs text-orange-600 font-medium">
            Switch to Base
          </span>
        )}
        {isSwitching && (
          <span className="text-xs text-blue-600 font-medium">
            Switching...
          </span>
        )}
        <HoldButton
          onHoldComplete={handleDisconnect}
          holdDuration={800}
          className="min-w-[80px] px-2 py-1 flex items-center justify-center"
        >
          <span className="text-[11px] font-medium text-center tracking-wide">
            {address
              ? `${address.slice(0, 4)}...${address.slice(-3)}`
              : "Connected"}
          </span>
        </HoldButton>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={handleConnect}
      disabled={isPending}
      className="relative rounded-full border border-[#C5D5FF] bg-white px-3.5 py-1.5 text-sm font-medium text-[#1C2333] shadow-sm transition hover:bg-[#0A84FF]/5 hover:border-[#0A84FF] hover:text-[#0A84FF] disabled:cursor-not-allowed disabled:opacity-50"
    >
      {isPending ? "Connecting..." : "Connect"}
    </button>
  );
};

type TileProps = {
  value: number;
  isNew: boolean;
  isMerged: boolean;
};

const Tile = ({ value, isNew, isMerged }: TileProps) => {
  const baseClass =
    "flex h-full w-full items-center justify-center rounded-[18px] border font-semibold transition-[background-color,border-color,color,transform] duration-320 ease-[cubic-bezier(0.2,0.8,0.2,1)] will-change-transform tracking-tight";
  const palette =
    TILE_COLORS[value] ?? "bg-[#3F7BFF] border-[#346EFA] text-white";
  const shadowClass = "shadow-sm";
  const ringClass = isNew
    ? "outline outline-2 outline-[#0A84FF]/40 outline-offset-[-3px]"
    : isMerged
    ? "outline outline-2 outline-[#0A84FF]/35 outline-offset-[-3px]"
    : "";
  const animationClass = isNew
    ? "animate-[tile-pop_220ms_cubic-bezier(0.2,0.75,0.2,1)_both]"
    : isMerged
    ? "animate-[tile-merge_260ms_cubic-bezier(0.2,0.7,0.2,1)_both]"
    : "";
  const displayValue = value === 0 ? "" : value.toLocaleString();
  const sizeClass = tileTextSize(value);
  return (
    <div
      className={`${baseClass} ${shadowClass} ${ringClass} ${palette} ${sizeClass} ${animationClass}`}
    >
      {displayValue}
    </div>
  );
};

const Modal = ({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) => {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl border border-[#C5D5FF] bg-white p-3 shadow-lg">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[#1C2333]">{title}</h2>
          <button
            type="button"
            className="rounded-full border border-transparent p-1.5 text-[#4C5A77] transition hover:border-[#C5D5FF] hover:text-[#1C2333] hover:bg-[#F7F8FA] cursor-pointer"
            onClick={onClose}
          >
            ✕
          </button>
        </div>
        <div className="mt-4 text-[#1C2333]">{children}</div>
      </div>
    </div>
  );
};
