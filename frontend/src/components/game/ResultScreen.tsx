"use client";

import { motion } from "framer-motion";
import { MapPin, Target, Trophy, X } from "lucide-react";
import { formatDistance, formatScore } from "@/lib/game";

interface ResultScreenProps {
  distance: number;
  score: number;
  prize?: number;
  locationName?: string;
  onPlayAgain: () => void;
  onClose: () => void;
}

export function ResultScreen({ distance, score, prize = 0, locationName, onPlayAgain, onClose }: ResultScreenProps) {
  const scorePct = formatScore(score);
  const isPerfect = scorePct >= 99;
  const isGood = scorePct >= 70;
  const isOkay = scorePct >= 40;

  let grade = "Try Again";
  let color = "text-red-400";
  if (isPerfect) { grade = "Perfect!"; color = "text-yellow-400"; }
  else if (isGood) { grade = "Great!"; color = "text-green-400"; }
  else if (isOkay) { grade = "Good"; color = "text-blue-400"; }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
    >
      <div className="glass-panel glow-border p-8 max-w-md w-full relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-white/40 hover:text-white/70">
          <X className="w-5 h-5" />
        </button>

        <div className="flex flex-col items-center gap-6">
          <div className={`text-4xl font-bold ${color}`}>{grade}</div>

          <div className="relative">
            <svg className="w-32 h-32 -rotate-90" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="54" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="8" />
              <circle
                cx="60" cy="60" r="54"
                fill="none"
                stroke={isPerfect ? "#facc15" : isGood ? "#22c55e" : isOkay ? "#0c8ee6" : "#ef4444"}
                strokeWidth="8"
                strokeDasharray={`${2 * Math.PI * 54}`}
                strokeDashoffset={`${2 * Math.PI * 54 * (1 - scorePct / 100)}`}
                strokeLinecap="round"
                className="transition-all duration-1000"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className={`text-3xl font-bold ${color}`}>{scorePct}%</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 w-full">
            <div className="flex flex-col items-center gap-1 p-3 rounded-xl bg-white/5">
              <MapPin className="w-4 h-4 text-mapa-400" />
              <span className="text-xs text-white/40">Distance</span>
              <span className="text-lg font-bold text-white/90">{formatDistance(distance)}</span>
            </div>
            <div className="flex flex-col items-center gap-1 p-3 rounded-xl bg-white/5">
              <Trophy className="w-4 h-4 text-gold" />
              <span className="text-xs text-white/40">Prize</span>
              <span className="text-lg font-bold text-gold">{(prize / 1_000_000).toFixed(4)} XLM</span>
            </div>
          </div>

          {locationName && (
            <p className="text-sm text-white/50 text-center">
              <Target className="w-3 h-3 inline mr-1" />
              {locationName}
            </p>
          )}

          <button
            onClick={onPlayAgain}
            className="w-full py-3 rounded-xl bg-mapa-500 hover:bg-mapa-600 font-medium transition-all"
          >
            Play Again
          </button>
        </div>
      </div>
    </motion.div>
  );
}
