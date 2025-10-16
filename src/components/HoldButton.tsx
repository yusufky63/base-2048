'use client';

import type { ReactNode, TouchEvent, MouseEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

type HoldButtonProps = {
  onHoldComplete: () => void;
  holdDuration?: number;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
};

export const HoldButton = ({ 
  onHoldComplete, 
  holdDuration = 1000, 
  children, 
  className = "",
  disabled = false 
}: HoldButtonProps) => {
  const [isHolding, setIsHolding] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);
  const holdTimerRef = useRef<NodeJS.Timeout | null>(null);
  const progressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);

  const startHold = useCallback(() => {
    if (disabled) return;
    
    setIsHolding(true);
    setHoldProgress(0);
    startTimeRef.current = Date.now();
    
    // Start progress animation
    const updateProgress = () => {
      const elapsed = Date.now() - startTimeRef.current;
      const progress = Math.min((elapsed / holdDuration) * 100, 100);
      setHoldProgress(progress);
      
      if (progress < 100) {
        progressTimerRef.current = setTimeout(updateProgress, 16); // ~60fps
      }
    };
    updateProgress();
    
    // Set timer for hold completion
    holdTimerRef.current = setTimeout(() => {
      onHoldComplete();
      setIsHolding(false);
      setHoldProgress(0);
    }, holdDuration);
  }, [disabled, holdDuration, onHoldComplete]);

  const stopHold = useCallback(() => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    if (progressTimerRef.current) {
      clearTimeout(progressTimerRef.current);
      progressTimerRef.current = null;
    }
    setIsHolding(false);
    setHoldProgress(0);
  }, []);

  const handleMouseDown = useCallback((e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    startHold();
  }, [startHold]);

  const handleMouseUp = useCallback(() => {
    stopHold();
  }, [stopHold]);

  const handleMouseLeave = useCallback(() => {
    stopHold();
  }, [stopHold]);

  const handleTouchStart = useCallback((e: TouchEvent<HTMLButtonElement>) => {
    e.preventDefault();
    startHold();
  }, [startHold]);

  const handleTouchEnd = useCallback((e: TouchEvent<HTMLButtonElement>) => {
    e.preventDefault();
    stopHold();
  }, [stopHold]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
      if (progressTimerRef.current) clearTimeout(progressTimerRef.current);
    };
  }, []);

  return (
    <button
      type="button"
      disabled={disabled}
      className={`relative min-w-[92px] rounded-full border border-[#C5D5FF] bg-white px-3.5 py-1.5 text-sm font-medium text-[#1C2333] shadow-sm transition hover:border-[#0A84FF] hover:text-[#0A84FF] disabled:cursor-not-allowed disabled:opacity-50 overflow-hidden ${className}`}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Progress bar background */}
      {isHolding && (
        <div 
          className="absolute inset-0 bg-[#0A84FF]/20 transition-all duration-75 ease-out"
          style={{ width: `${holdProgress}%` }}
        />
      )}
      
      {/* Button content */}
      <span className="relative z-10">
        {isHolding ? "Hold..." : children}
      </span>
    </button>
  );
};
