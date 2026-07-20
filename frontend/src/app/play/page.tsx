"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, MapPin, Target, ArrowLeft, Globe, Play, Coins, Users, Clock, Trophy, Crosshair, Swords, Radio, Satellite } from "lucide-react";
import { WalletConnector } from "@/components/wallet/WalletConnector";
import { StreetView } from "@/components/game/StreetView";
import { MapView } from "@/components/game/MapView";
import { ResultScreen } from "@/components/game/ResultScreen";
import { useWallet } from "@/components/wallet/WalletProvider";
import { BackgroundGrid } from "@/components/BackgroundGrid";
import {
  findMatch,
  submitGuess,
  leaveQueue,
  getRoom,
  getLocation,
  getRandomLocation,
  getMinStake,
  getQueueCount,
  getPlayerRooms,
  Room,
  RoomState,
  Location,
  formatDistance,
  formatStroops,
} from "@/lib/game";

type Phase = "lobby" | "matching" | "playing" | "waiting" | "result";

export default function PlayPage() {
  const { isConnected, publicKey, signTx, connect } = useWallet();
  const [phase, setPhase] = useState<Phase>("lobby");
  const [loading, setLoading] = useState(false);
  const [roomId, setRoomId] = useState<number | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [currentLocation, setCurrentLocation] = useState<Location | null>(null);
  const [guess, setGuess] = useState<{ lat: number; lng: number } | null>(null);
  const [stakeAmount, setStakeAmount] = useState<string>("10");
  const [minStake, setMinStake] = useState<number>(1000000);
  const [queueCount, setQueueCount] = useState(0);
  const [matchError, setMatchError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [opponentGuess, setOpponentGuess] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    getMinStake().then(setMinStake).catch(() => {});
  }, []);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  async function updateRoom(rId: number) {
    try {
      const r = await getRoom(rId);
      setRoom(r);
      if (r.state >= RoomState.Completed) {
        stopPolling();
        setOpponentGuess(
          r.player1 === publicKey
            ? { lat: r.guess2_lat, lng: r.guess2_lng }
            : { lat: r.guess1_lat, lng: r.guess1_lng }
        );
        setPhase("result");
      } else if (r.state === RoomState.Guessed1 || r.state === RoomState.Guessed2) {
        const myKey = publicKey!;
        const iGuessed = (r.player1 === myKey && r.state === RoomState.Guessed1) ||
          (r.player2 === myKey && r.state === RoomState.Guessed2);
        setOpponentGuess(null);
        if (iGuessed) {
          setPhase("waiting");
        }
      }
    } catch {}
  }

  function startPolling(rId: number) {
    stopPolling();
    updateRoom(rId);
    pollRef.current = setInterval(() => updateRoom(rId), 3000);
  }

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  async function handleFindMatch() {
    setLoading(true);
    setMatchError(null);
    try {
      const stake = Math.round(parseFloat(stakeAmount || "0") * 1_000_000);
      if (stake < minStake) {
        setMatchError(`Minimum stake is ${formatStroops(minStake)} XLM`);
        setLoading(false);
        return;
      }

      const locationId = await getRandomLocation();
      const location = await getLocation(locationId);
      setCurrentLocation(location);

      setPhase("matching");
      const result = await findMatch(publicKey!, stake, locationId, signTx);

      if (result === 0) {
        const existingRooms = await getPlayerRooms(publicKey!);
        setQueueCount(await getQueueCount());
        const pollMatching = setInterval(async () => {
          try {
            const rooms = await getPlayerRooms(publicKey!);
            const newRooms = rooms.filter((id) => !existingRooms.includes(id));
            if (newRooms.length > 0) {
              clearInterval(pollMatching);
              const rId = newRooms[newRooms.length - 1];
              setRoomId(rId);
              startPolling(rId);
              setPhase("playing");
            }
            setQueueCount(await getQueueCount());
          } catch {}
        }, 3000);
      } else {
        setRoomId(result);
        startPolling(result);
        setPhase("playing");
      }
    } catch (err: any) {
      setMatchError(err.message || "Failed to find match");
      setPhase("lobby");
    } finally {
      setLoading(false);
    }
  }

  async function handleCancelMatch() {
    stopPolling();
    try {
      await leaveQueue(publicKey!, signTx);
    } catch {}
    setPhase("lobby");
  }

  function handleMapClick(lat: number, lng: number) {
    setGuess({ lat, lng });
  }

  async function handleConfirmGuess() {
    if (!guess || !roomId || !currentLocation || !room) return;
    setLoading(true);
    try {
      await submitGuess(roomId, guess.lat, guess.lng, currentLocation.lat, currentLocation.lng, publicKey!, signTx);
      startPolling(roomId);
      setPhase("waiting");
    } catch (err: any) {
      console.error("Failed to submit guess:", err);
    } finally {
      setLoading(false);
    }
  }

  function handlePlayAgain() {
    stopPolling();
    setPhase("lobby");
    setRoomId(null);
    setRoom(null);
    setGuess(null);
    setOpponentGuess(null);
    setCurrentLocation(null);
    setMatchError(null);
  }

  const isPlayer1 = room && publicKey ? room.player1 === publicKey : true;

  if (!isConnected) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 p-6">
        <BackgroundGrid />
        <Satellite className="w-14 h-14 text-mapa-400/40" />
        <div className="text-center max-w-sm">
          <h1 className="text-xl font-bold mb-2">Authentication Required</h1>
          <p className="text-white/40 text-sm leading-relaxed font-mono">
            [Connect your Stellar wallet to initialize the terminal and begin matchmaking.]
          </p>
        </div>
        <button
          onClick={connect}
          className="px-8 py-3 rounded-xl bg-mapa-400 text-[#111417] font-semibold text-sm transition-all hover:bg-mapa-300 flex items-center gap-2 shadow-[0_0_24px_rgba(0,242,255,0.25)]"
        >
          <Radio className="w-4 h-4" />
          Connect Wallet
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <BackgroundGrid />
      <div className="relative z-10 px-4 py-3 md:p-6 max-w-7xl mx-auto">
        <nav className="flex items-center justify-between mb-5">
          <button
            onClick={() => (phase === "lobby" ? (window.location.href = "/") : handlePlayAgain())}
            className="flex items-center gap-1.5 text-white/30 hover:text-white/60 transition-colors text-xs font-mono tracking-wider"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            {phase === "lobby" ? "Terminal" : "Disengage"}
          </button>
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-white/15 font-mono tracking-widest hidden sm:inline uppercase">
              {publicKey?.slice(0, 6)}
            </span>
            <WalletConnector />
          </div>
        </nav>

        <AnimatePresence mode="wait">
          {phase === "lobby" && (
            <motion.div
              key="lobby"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex flex-col items-center justify-center min-h-[70vh]"
            >
              <div className="glass-panel p-8 md:p-10 text-center w-full max-w-sm">
                <div className="w-14 h-14 rounded-2xl bg-mapa-400/5 border border-mapa-400/10 flex items-center justify-center mx-auto mb-5">
                  <Swords className="w-6 h-6 text-mapa-400" />
                </div>
                <h2 className="text-xl font-bold mb-1">Initiate Match</h2>
                <p className="text-xs text-white/30 font-mono mb-2">
                  MIN STAKE: <span className="text-gold">{formatStroops(minStake)} XLM</span>
                </p>
                <p className="text-xs text-white/20 leading-relaxed mb-6">
                  Stake XLM against another player. Closest guess wins the pot.
                </p>

                <div className="mb-5">
                  <label className="block text-[10px] text-white/20 font-mono tracking-wider uppercase mb-2 text-left">
                    Stake Amount (XLM)
                  </label>
                  <input
                    type="number"
                    value={stakeAmount}
                    onChange={(e) => setStakeAmount(e.target.value)}
                    min={formatStroops(minStake)}
                    step="1"
                    className="w-full px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-white font-sans text-lg tracking-tight focus:outline-none focus:border-mapa-400/30 focus:bg-mapa-400/[0.02] transition-all"
                  />
                  <p className="text-[10px] text-white/15 font-mono mt-1.5 text-left">
                    Winner receives ~97.5% of combined pot
                  </p>
                </div>

                {matchError && (
                  <p className="text-red-400/80 text-xs font-mono mb-4">{matchError}</p>
                )}

                <button
                  onClick={handleFindMatch}
                  disabled={loading}
                  className="w-full py-3.5 rounded-xl bg-mapa-400 hover:bg-mapa-300 disabled:opacity-40 font-semibold text-[#111417] transition-all flex items-center justify-center gap-2 text-sm shadow-[0_0_24px_rgba(0,242,255,0.2)] hover:shadow-[0_0_32px_rgba(0,242,255,0.35)]"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Play className="w-4 h-4" />
                      Find Match
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          )}

          {phase === "matching" && (
            <motion.div
              key="matching"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center min-h-[70vh] gap-6"
            >
              <div className="relative w-32 h-32">
                <div className="absolute inset-0 rounded-full border border-mapa-400/10 animate-[ping_3s_ease-in-out_infinite]" />
                <div className="absolute inset-4 rounded-full border border-mapa-400/15 animate-[ping_3s_ease-in-out_0.5s_infinite]" />
                <div className="absolute inset-8 rounded-full border border-mapa-400/20 animate-[ping_3s_ease-in-out_1s_infinite]" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Radio className="w-8 h-8 text-mapa-400 animate-pulse" />
                </div>
              </div>
              <div className="text-center">
                <h2 className="text-lg font-bold mb-1.5">Scanning for Opponent</h2>
                <div className="flex items-center justify-center gap-2 mb-1">
                  <div className="flex gap-0.5">
                    {[0, 1, 2].map((i) => (
                      <div
                        key={i}
                        className="w-1 h-3 rounded-full bg-mapa-400/60 animate-bounce"
                        style={{ animationDelay: `${i * 0.15}s`, animationDuration: "1.2s" }}
                      />
                    ))}
                  </div>
                  <span className="text-xs text-white/30 font-mono">
                    {queueCount > 0
                      ? `${queueCount} player${queueCount !== 1 ? "s" : ""} in queue`
                      : "Waiting for players..."}
                  </span>
                </div>
                <p className="text-[10px] text-white/15 font-mono tracking-wider">BROADCASTING ON TESTNET</p>
              </div>
              <button
                onClick={handleCancelMatch}
                className="px-6 py-2 rounded-lg border border-white/10 hover:border-white/20 text-xs text-white/30 hover:text-white/50 font-mono tracking-wider transition-all"
              >
                Cancel
              </button>
            </motion.div>
          )}

          {(phase === "playing" || phase === "waiting") && currentLocation && (
            <motion.div
              key="playing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="max-w-6xl mx-auto"
            >
              <div className="flex items-center justify-between mb-3 px-1">
                <div className="flex items-center gap-2">
                  <Target className="w-3.5 h-3.5 text-mapa-400" />
                  <span className="text-xs font-mono text-white/30 tracking-wide">
                    {phase === "playing" ? "ACQUIRE TARGET" : "AWAITING OPPONENT..."}
                  </span>
                </div>
                {room && (
                  <div className="flex items-center gap-1.5">
                    <Coins className="w-3 h-3 text-white/20" />
                    <span className="text-xs font-mono text-white/20">{formatStroops(room.stake)} XLM</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="glass-panel p-1.5">
                  <StreetView lat={currentLocation.lat} lng={currentLocation.lng} />
                </div>

                <div className="flex flex-col gap-4">
                  <div className="glass-panel p-1.5">
                    <MapView
                      onClick={phase === "playing" ? handleMapClick : undefined}
                      guess={guess}
                      interactive={phase === "playing"}
                    />
                  </div>

                  {phase === "waiting" && (
                    <div className="glass-panel p-4 text-center">
                      <Loader2 className="w-5 h-5 animate-spin text-mapa-400/60 mx-auto mb-2" />
                      <p className="text-xs text-white/30 font-mono">Waiting for opponent to transmit coordinates...</p>
                    </div>
                  )}

                  {guess && phase === "playing" && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ type: "spring", stiffness: 200, damping: 20 }}
                      className="glass-panel p-4 border-mapa-400/20"
                    >
                      <div className="flex items-center justify-between mb-3 pb-3 border-b border-white/[0.04]">
                        <div className="flex items-center gap-2">
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-mapa-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-mapa-400" />
                          </span>
                          <p className="text-[10px] text-white/20 font-mono tracking-wider uppercase">Target Locked</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-mono text-mapa-400 tabular-nums">
                            {guess.lat.toFixed(4)}N
                          </p>
                          <p className="text-xs font-mono text-mapa-400 tabular-nums">
                            {guess.lng.toFixed(4)}E
                          </p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 mb-3">
                        <div className="bg-white/[0.03] rounded-lg p-2.5">
                          <p className="text-[9px] text-white/20 font-mono tracking-wider uppercase mb-0.5">Latitude</p>
                          <p className="text-xs font-mono text-white/60">{guess.lat.toFixed(4)}</p>
                        </div>
                        <div className="bg-white/[0.03] rounded-lg p-2.5">
                          <p className="text-[9px] text-white/20 font-mono tracking-wider uppercase mb-0.5">Longitude</p>
                          <p className="text-xs font-mono text-white/60">{guess.lng.toFixed(4)}</p>
                        </div>
                      </div>
                      <button
                        onClick={handleConfirmGuess}
                        disabled={loading}
                        className="w-full py-3 rounded-xl bg-mapa-400 hover:bg-mapa-300 disabled:opacity-40 font-semibold text-[#111417] transition-all flex items-center justify-center gap-2 text-sm shadow-[0_0_16px_rgba(0,242,255,0.15)] hover:shadow-[0_0_24px_rgba(0,242,255,0.3)]"
                      >
                        {loading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <Crosshair className="w-4 h-4" />
                            Confirm Strike
                          </>
                        )}
                      </button>
                    </motion.div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {phase === "result" && currentLocation && room && (
            <motion.div
              key="result"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="max-w-5xl mx-auto"
            >
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
                <div className="glass-panel p-1.5">
                  <StreetView lat={currentLocation.lat} lng={currentLocation.lng} />
                </div>
                <div className="glass-panel p-1.5">
                  <MapView
                    lat={currentLocation.lat}
                    lng={currentLocation.lng}
                    guess={
                      isPlayer1
                        ? { lat: room.guess1_lat, lng: room.guess1_lng }
                        : { lat: room.guess2_lat, lng: room.guess2_lng }
                    }
                    actual={{ lat: currentLocation.lat, lng: currentLocation.lng }}
                    interactive={false}
                  />
                </div>
              </div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="glass-panel p-6 md:p-8 w-full max-w-lg mx-auto text-center"
              >
                <Trophy className={`w-12 h-12 mx-auto mb-3 ${room.winner === publicKey ? "text-gold drop-shadow-[0_0_12px_rgba(254,214,57,0.4)]" : "text-white/10"}`} />
                <h2 className={`text-2xl font-bold mb-1 ${room.winner === publicKey ? "text-gold" : "text-white/40"}`}>
                  {room.winner === publicKey ? "VICTORY" : room.winner ? "DEFEAT" : "STANDOFF"}
                </h2>
                <p className="text-xs text-white/20 font-mono mb-5">
                  {room.winner === publicKey ? "Prize transmitted to your wallet" : room.winner ? "Better luck next sortie" : "Neither player found the mark"}
                </p>

                <div className="grid grid-cols-2 gap-3 mb-5">
                  <div className="glass-panel p-3">
                    <p className="text-[10px] text-white/20 font-mono tracking-wider uppercase mb-1">
                      {isPlayer1 ? "You" : "Opponent"}
                    </p>
                    <p className="text-xl font-bold">{formatDistance(isPlayer1 ? room.distance1 : room.distance2)}</p>
                  </div>
                  <div className="glass-panel p-3">
                    <p className="text-[10px] text-white/20 font-mono tracking-wider uppercase mb-1">
                      {isPlayer1 ? "Opponent" : "You"}
                    </p>
                    <p className="text-xl font-bold">{formatDistance(isPlayer1 ? room.distance2 : room.distance1)}</p>
                  </div>
                </div>

                {opponentGuess && (
                  <div className="glass-panel p-3 mb-5">
                    <p className="text-[10px] text-white/20 font-mono tracking-wider uppercase mb-1">Enemy Coordinates</p>
                    <p className="text-sm font-mono text-white/50">
                      {opponentGuess.lat.toFixed(4)}N, {opponentGuess.lng.toFixed(4)}E
                    </p>
                  </div>
                )}

                <button
                  onClick={handlePlayAgain}
                  className="w-full py-3.5 rounded-xl bg-mapa-400 hover:bg-mapa-300 font-semibold text-[#111417] transition-all text-sm shadow-[0_0_24px_rgba(0,242,255,0.2)] hover:shadow-[0_0_32px_rgba(0,242,255,0.35)]"
                >
                  Deploy Again
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
