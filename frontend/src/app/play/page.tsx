"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Loader2, MapPin, Target, ArrowLeft, Globe, Play, Coins, Users, Clock, Trophy } from "lucide-react";
import { WalletConnector } from "@/components/wallet/WalletConnector";
import { StreetView } from "@/components/game/StreetView";
import { MapView } from "@/components/game/MapView";
import { ResultScreen } from "@/components/game/ResultScreen";
import { useWallet } from "@/components/wallet/WalletProvider";
import {
  findMatch,
  submitGuess,
  leaveQueue,
  getRoom,
  getLocation,
  getRandomLocation,
  getMinStake,
  getQueueCount,
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
        const qc = await getQueueCount();
        setQueueCount(qc);
        const pollMatching = setInterval(async () => {
          const rId = await findMatch(publicKey!, stake, locationId, signTx);
          if (rId > 0) {
            clearInterval(pollMatching);
            setRoomId(rId);
            startPolling(rId);
            setPhase("playing");
          }
          const qc = await getQueueCount().catch(() => 0);
          setQueueCount(qc);
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
        <Globe className="w-14 h-14 md:w-16 md:h-16 text-mapa-400/50" />
        <h1 className="text-xl md:text-2xl font-bold text-center">Connect Your Wallet</h1>
        <p className="text-white/40 text-center max-w-sm md:max-w-md text-sm md:text-base">
          Connect your Stellar wallet to find a match and play GeoGuessr.
        </p>
        <button
          onClick={connect}
          className="px-8 py-3 rounded-full bg-mapa-500 hover:bg-mapa-600 font-medium transition-all text-sm md:text-base w-full max-w-xs"
        >
          Connect Wallet
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-3 py-3 md:p-6">
      <nav className="flex items-center justify-between mb-4 md:mb-6">
        <button
          onClick={() => (phase === "lobby" ? (window.location.href = "/") : handlePlayAgain())}
          className="flex items-center gap-1.5 md:gap-2 text-white/40 hover:text-white/70 transition-colors text-xs md:text-sm"
        >
          <ArrowLeft className="w-3.5 h-3.5 md:w-4 md:h-4" />
          {phase === "lobby" ? "Home" : "Leave"}
        </button>
        <div className="flex items-center gap-2 md:gap-3">
          <span className="text-xs md:text-sm text-white/30 font-mono hidden sm:inline">{publicKey?.slice(0, 6)}...</span>
          <WalletConnector />
        </div>
      </nav>

      {phase === "lobby" && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center min-h-[60vh] px-2"
        >
          <div className="glass-panel p-6 md:p-12 text-center w-full max-w-sm md:max-w-md">
            <Users className="w-12 h-12 md:w-16 md:h-16 text-mapa-400 mx-auto mb-4 md:mb-6" />
            <h2 className="text-xl md:text-2xl font-bold mb-2 md:mb-3">Find a Match</h2>
            <p className="text-white/40 mb-2 text-sm md:text-base">
              Min stake: <span className="text-gold font-bold">{formatStroops(minStake)} XLM</span>
            </p>
            <p className="text-xs md:text-sm text-white/30 mb-4 md:mb-6">
              Stake XLM against another player. Closest guess wins the pot!
            </p>

            <div className="mb-4 md:mb-6">
              <label className="block text-xs md:text-sm text-white/40 mb-2 text-left">Your Stake (XLM)</label>
              <input
                type="number"
                value={stakeAmount}
                onChange={(e) => setStakeAmount(e.target.value)}
                min={formatStroops(minStake)}
                step="1"
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white font-mono text-base md:text-lg focus:outline-none focus:border-mapa-400 transition-colors"
              />
              <p className="text-xs text-white/20 mt-1 text-left">
                Winner takes ~95% of the combined pot
              </p>
            </div>

            {matchError && (
              <p className="text-red-400 text-sm mb-4">{matchError}</p>
            )}

            <button
              onClick={handleFindMatch}
              disabled={loading}
              className="w-full py-3 rounded-xl bg-mapa-500 hover:bg-mapa-600 disabled:opacity-50 font-medium transition-all flex items-center justify-center gap-2 text-sm md:text-base"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
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
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center min-h-[60vh] gap-4 md:gap-6 px-4"
        >
          <Loader2 className="w-14 h-14 md:w-16 md:h-16 animate-spin text-mapa-400" />
          <h2 className="text-lg md:text-xl font-bold text-center">Searching for opponent...</h2>
          <p className="text-white/40 text-xs md:text-sm flex items-center gap-2">
            <Users className="w-3.5 h-3.5 md:w-4 md:h-4" />
            {queueCount > 0 ? `${queueCount} player(s) in queue` : "No one in queue yet"}
          </p>
          <button
            onClick={handleCancelMatch}
            className="px-5 md:px-6 py-2 rounded-full border border-white/10 hover:bg-white/5 text-xs md:text-sm transition-all"
          >
            Cancel
          </button>
        </motion.div>
      )}

      {(phase === "playing" || phase === "waiting") && currentLocation && (
        <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
          <div>
            <h3 className="text-xs md:text-sm text-white/40 mb-2 flex items-center gap-2">
              <Target className="w-3 h-3" />
              {phase === "playing" ? "Where is this?" : "Waiting for opponent..."}
            </h3>
            <StreetView lat={currentLocation.lat} lng={currentLocation.lng} />
          </div>

          <div>
            <h3 className="text-xs md:text-sm text-white/40 mb-2 flex items-center gap-2">
              <MapPin className="w-3 h-3" />
              {guess ? "You guessed here" : "Tap the map to place your guess"}
            </h3>
            <MapView
              onClick={phase === "playing" ? handleMapClick : undefined}
              guess={guess}
              interactive={phase === "playing"}
            />

            {phase === "waiting" && (
              <div className="mt-3 md:mt-4 glass-panel p-3 md:p-4 text-center">
                <Loader2 className="w-5 h-5 md:w-6 md:h-6 animate-spin text-mapa-400 mx-auto mb-2" />
                <p className="text-xs md:text-sm text-white/40">Waiting for opponent to submit their guess...</p>
              </div>
            )}

            {guess && phase === "playing" && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-3 md:mt-4 glass-panel p-3 md:p-4"
              >
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-xs text-white/40">Your Guess</p>
                    <p className="text-xs md:text-sm font-mono">
                      {guess.lat.toFixed(4)}°, {guess.lng.toFixed(4)}°
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleConfirmGuess}
                  disabled={loading}
                  className="w-full py-3 rounded-xl bg-green-500 hover:bg-green-600 disabled:opacity-50 font-medium transition-all flex items-center justify-center gap-2 text-sm md:text-base"
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    "Confirm Guess"
                  )}
                </button>
              </motion.div>
            )}
          </div>
        </div>
      )}

      {phase === "result" && currentLocation && room && (
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 mb-4 md:mb-6">
            <StreetView lat={currentLocation.lat} lng={currentLocation.lng} />
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

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-panel p-5 md:p-6 w-full max-w-sm md:max-w-lg mx-auto text-center"
          >
            <Trophy className={`w-10 h-10 md:w-12 md:h-12 mx-auto mb-2 md:mb-3 ${room.winner === publicKey ? "text-gold" : "text-white/20"}`} />
            <h2 className={`text-xl md:text-2xl font-bold mb-2 ${room.winner === publicKey ? "text-gold" : "text-white/60"}`}>
              {room.winner === publicKey ? "You Won!" : room.winner ? "You Lost" : "It's a Tie!"}
            </h2>

            <div className="grid grid-cols-2 gap-3 md:gap-4 mt-4 md:mt-6 mb-4 md:mb-6">
              <div className="glass-panel p-2 md:p-3">
                <p className="text-xs text-white/40 mb-1">{isPlayer1 ? "You" : "Opponent"}</p>
                <p className="text-base md:text-lg font-bold">{formatDistance(isPlayer1 ? room.distance1 : room.distance2)}</p>
              </div>
              <div className="glass-panel p-2 md:p-3">
                <p className="text-xs text-white/40 mb-1">{isPlayer1 ? "Opponent" : "You"}</p>
                <p className="text-base md:text-lg font-bold">{formatDistance(isPlayer1 ? room.distance2 : room.distance1)}</p>
              </div>
            </div>

            {opponentGuess && (
              <div className="glass-panel p-2 md:p-3 mb-4 md:mb-6">
                <p className="text-xs text-white/40 mb-1">Opponent's guess</p>
                <p className="text-xs md:text-sm font-mono">
                  {opponentGuess.lat.toFixed(4)}°, {opponentGuess.lng.toFixed(4)}°
                </p>
              </div>
            )}

            <button
              onClick={handlePlayAgain}
              className="w-full py-3 rounded-xl bg-mapa-500 hover:bg-mapa-600 font-medium transition-all text-sm md:text-base"
            >
              Play Again
            </button>
          </motion.div>
        </div>
      )}
    </div>
  );
}
