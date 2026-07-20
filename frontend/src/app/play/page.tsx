"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Target, ArrowLeft, Coins, Trophy, Crosshair, Swords, Radio, Satellite, Search, Users, Clock, RotateCcw, LogOut, MapPin } from "lucide-react";
import { WalletConnector } from "@/components/wallet/WalletConnector";
import { StreetView } from "@/components/game/StreetView";
import { MapView } from "@/components/game/MapView";
import { useWallet } from "@/components/wallet/WalletProvider";
import { BackgroundGrid } from "@/components/BackgroundGrid";
import {
  autoMatch,
  joinRoom,
  submitGuess,
  leaveRoom,
  getRoom,
  getLocation,
  getRandomLocation,
  getMinStake,
  getOpenRooms,
  getPlayerRooms,
  Room,
  RoomState,
  OpenRoomInfo,
  Location,
  formatDistance,
  formatStroops,
} from "@/lib/game";

type Phase = "lobby" | "matching" | "playing" | "waiting" | "result";

type LobbyTab = "match" | "browse" | "history";

function shorten(pk: string) {
  return pk.slice(0, 4) + ".." + pk.slice(-2);
}

export default function PlayPage() {
  const { isConnected, publicKey, signTx, connect } = useWallet();
  const [phase, setPhase] = useState<Phase>("lobby");
  const [loading, setLoading] = useState(false);
  const [roomId, setRoomId] = useState<number | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [currentLocation, setCurrentLocation] = useState<Location | null>(null);
  const [guess, setGuess] = useState<{ lat: number; lng: number } | null>(null);
  const [stakeAmount, setStakeAmount] = useState("10");
  const [minStake, setMinStake] = useState(1000000);
  const [matchError, setMatchError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const waitingPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [opponentGuess, setOpponentGuess] = useState<{ lat: number; lng: number } | null>(null);
  const [openRooms, setOpenRooms] = useState<OpenRoomInfo[]>([]);
  const [searchRoomId, setSearchRoomId] = useState("");
  const [activeRooms, setActiveRooms] = useState<{ id: number; room: Room }[]>([]);
  const [completedRooms, setCompletedRooms] = useState<number[]>([]);
  const [lobbyTab, setLobbyTab] = useState<LobbyTab>("match");

  useEffect(() => {
    getMinStake().then(setMinStake).catch(() => {});
  }, []);

  useEffect(() => {
    if (!isConnected) handleReset();
  }, [publicKey]);

  useEffect(() => {
    if (phase === "lobby" && isConnected) {
      refreshLobby();
      const id = setInterval(refreshLobby, 5000);
      return () => clearInterval(id);
    }
  }, [phase, isConnected]);

  useEffect(() => {
    return () => {
      stopPolling();
      if (waitingPollRef.current) clearInterval(waitingPollRef.current);
    };
  }, []);

  function stopWaitingPoll() {
    if (waitingPollRef.current) { clearInterval(waitingPollRef.current); waitingPollRef.current = null; }
  }

  async function refreshLobby() {
    if (!publicKey) return;
    try {
      const [rooms, pRooms] = await Promise.all([getOpenRooms(), getPlayerRooms(publicKey)]);
      setOpenRooms(rooms);
      const active: { id: number; room: Room }[] = [];
      const completed: number[] = [];
      for (const id of pRooms) {
        try {
          const r = await getRoom(id);
          if (r.state >= RoomState.Completed) completed.push(id);
          else if (r.state >= RoomState.Ready) active.push({ id, room: r });
        } catch {}
      }
      setActiveRooms(active);
      setCompletedRooms(completed);
    } catch {}
  }

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
        const iGuessed = (r.player1 === publicKey && r.state === RoomState.Guessed1) ||
          (r.player2 === publicKey && r.state === RoomState.Guessed2);
        setOpponentGuess(null);
        if (iGuessed) setPhase("waiting");
      }
    } catch {}
  }

  function startPolling(rId: number) {
    stopPolling();
    updateRoom(rId);
    pollRef.current = setInterval(() => updateRoom(rId), 3000);
  }

  function stopPolling() {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }

  function handleReset() {
    stopPolling();
    stopWaitingPoll();
    setPhase("lobby");
    setRoomId(null);
    setRoom(null);
    setGuess(null);
    setOpponentGuess(null);
    setCurrentLocation(null);
    setMatchError(null);
  }

  async function handleRejoin(targetId: number) {
    setLoading(true);
    try {
      const r = await getRoom(targetId);
      if (r.state >= RoomState.Completed) return;
      setRoomId(targetId);
      setRoom(r);
      const loc = await getLocation(r.location_id).catch(() => null);
      if (loc) setCurrentLocation(loc);
      startPolling(targetId);
      setPhase(r.state === RoomState.Ready ? "playing" : "waiting");
    } catch (err: unknown) {
      setMatchError(err instanceof Error ? err.message : String(err));
    } finally { setLoading(false); }
  }

  async function handleAutoMatch() {
    setLoading(true);
    setMatchError(null);
    try {
      const stake = Math.round(parseFloat(stakeAmount || "0") * 1_000_000);
      if (stake < minStake) { setMatchError("Minimum: " + formatStroops(minStake) + " XLM"); setLoading(false); return; }
      const locationId = await getRandomLocation();
      const location = await getLocation(locationId);
      setCurrentLocation(location);
      const resultId = await autoMatch(publicKey!, stake, locationId, signTx);
      setRoomId(resultId);
      const r = await getRoom(resultId);
      setRoom(r);
      if (r.state === RoomState.Waiting) {
        setPhase("matching");
        waitingPollRef.current = setInterval(async () => {
          try {
            const updated = await getRoom(resultId);
            setRoom(updated);
            if (updated.state === RoomState.Ready) {
              stopWaitingPoll();
              startPolling(resultId);
              setPhase("playing");
            }
          } catch {}
        }, 3000);
      } else if (r.state === RoomState.Ready) {
        startPolling(resultId);
        setPhase("playing");
      }
    } catch (err: unknown) {
      setMatchError(err instanceof Error ? err.message : "Auto-match failed");
      setPhase("lobby");
    } finally { setLoading(false); }
  }

  async function handleJoinRoom(targetId: number) {
    setLoading(true);
    setMatchError(null);
    try {
      const r = await getRoom(targetId);
      if (r.player2 !== null) { setMatchError("Room full"); setLoading(false); return; }
      if (r.player1 === publicKey) { setMatchError("Can't join your own room"); setLoading(false); return; }
      await joinRoom(targetId, publicKey!, signTx);
      setRoomId(targetId);
      const loc = await getLocation(r.location_id);
      setCurrentLocation(loc);
      startPolling(targetId);
      setPhase("playing");
    } catch (err: unknown) {
      setMatchError(err instanceof Error ? err.message : "Failed to join");
    } finally { setLoading(false); }
  }

  async function handleCancelRoom() {
    stopWaitingPoll();
    if (roomId) { try { await leaveRoom(roomId, publicKey!, signTx); } catch {} }
    handleReset();
  }

  function handleConfirmGuess() {
    if (!guess || !roomId || !currentLocation || !room) return;
    setLoading(true);
    submitGuess(roomId, guess.lat, guess.lng, currentLocation.lat, currentLocation.lng, publicKey!, signTx)
      .then(() => { startPolling(roomId); setPhase("waiting"); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }

  const isPlayer1 = room && publicKey ? room.player1 === publicKey : true;

  if (!isConnected) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-5 p-6">
        <BackgroundGrid />
        <Satellite className="w-10 h-10 text-mapa-400/40" />
        <div className="text-center max-w-xs">
          <h1 className="text-lg font-bold mb-1">Connect Wallet</h1>
          <p className="text-xs text-white/40 font-mono">Authenticate to access the terminal.</p>
        </div>
        <button onClick={connect} className="px-6 py-2.5 rounded-lg bg-mapa-400 text-[#0d0f10] font-semibold text-sm hover:bg-mapa-300 transition-all flex items-center gap-2">
          <Radio className="w-3.5 h-3.5" />
          Connect
        </button>
      </div>
    );
  }

  const lobbyContent = (
    <div className="max-w-2xl mx-auto">
      <div className="flex gap-1 mb-4 p-0.5 rounded-lg bg-white/[0.03] border border-white/[0.04]">
        {(["match", "browse", "history"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setLobbyTab(tab)}
            className={`flex-1 py-1.5 text-[10px] font-mono tracking-wider uppercase rounded-md transition-all ${
              lobbyTab === tab
                ? "bg-mapa-400/10 text-mapa-400"
                : "text-white/25 hover:text-white/50"
            }`}
          >
            {tab === "match" ? "Play" : tab === "browse" ? "Rooms" : "History"}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {lobbyTab === "match" && (
          <motion.div key="match" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="border border-white/[0.06] rounded-lg p-4 mb-3">
              <div className="flex items-center gap-2 mb-3">
                <Swords className="w-3.5 h-3.5 text-mapa-400" />
                <span className="text-xs font-medium">New Match</span>
              </div>
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <div className="data-label mb-1">Stake (XLM) · Min {formatStroops(minStake)}</div>
                  <input
                    type="number"
                    value={stakeAmount}
                    onChange={(e) => setStakeAmount(e.target.value)}
                    min={formatStroops(minStake)}
                    step="1"
                    className="w-full px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06] text-white font-mono text-sm focus:outline-none focus:border-mapa-400/30 transition-all"
                  />
                </div>
                <button
                  onClick={handleAutoMatch}
                  disabled={loading}
                  className="px-4 py-2 rounded-lg bg-mapa-400 hover:bg-mapa-300 disabled:opacity-40 font-semibold text-[#0d0f10] text-xs transition-all flex items-center gap-1.5 whitespace-nowrap"
                >
                  {loading ? <div className="mini-spinner" /> : <Radio className="w-3 h-3" />}
                  Auto-Match
                </button>
              </div>
              {matchError && <p className="text-red text-[11px] font-mono mt-2">{matchError}</p>}
            </div>

            <div className="flex gap-2">
              <input
                type="number"
                value={searchRoomId}
                onChange={(e) => setSearchRoomId(e.target.value)}
                placeholder="Room ID"
                className="flex-1 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06] text-white font-mono text-xs focus:outline-none focus:border-mapa-400/30 transition-all"
              />
              <button
                onClick={() => { const id = parseInt(searchRoomId); if (id > 0) handleJoinRoom(id); }}
                disabled={loading || !searchRoomId}
                className="px-3 py-2 rounded-lg border border-white/[0.08] hover:bg-white/[0.04] disabled:opacity-40 text-xs font-mono tracking-wider text-white/50 transition-all flex items-center gap-1.5"
              >
                <Search className="w-3 h-3" />
                Join
              </button>
            </div>
          </motion.div>
        )}

        {lobbyTab === "browse" && (
          <motion.div key="browse" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="text-xs font-medium mb-3 flex items-center gap-2">
              <Users className="w-3.5 h-3.5 text-mapa-400" />
              Open Rooms
              <span className="text-white/25 font-mono text-[10px]">{openRooms.length}</span>
            </div>
            {openRooms.length === 0 ? (
              <p className="text-xs text-white/20 font-mono py-6 text-center">No open rooms.</p>
            ) : (
              <div className="space-y-1">
                {openRooms.map((r) => (
                  <div key={r.room_id} className="flex items-center justify-between px-3 py-2 rounded-lg border border-white/[0.04] hover:border-white/[0.08] transition-colors">
                    <div className="flex items-center gap-3 text-xs font-mono">
                      <span className="text-mapa-400">#{r.room_id}</span>
                      <span className="text-white/30">{shorten(r.player1)}</span>
                      <span className="text-gold">{formatStroops(r.stake)}</span>
                    </div>
                    <button
                      onClick={() => handleJoinRoom(r.room_id)}
                      disabled={loading}
                      className="px-2.5 py-1 rounded bg-mapa-400/10 hover:bg-mapa-400/20 text-mapa-400 text-[10px] font-mono tracking-wider transition-all disabled:opacity-40"
                    >
                      Join
                    </button>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {lobbyTab === "history" && (
          <motion.div key="history" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {activeRooms.length > 0 && (
              <div className="mb-4">
                <div className="text-xs font-medium mb-2 flex items-center gap-2">
                  <Target className="w-3.5 h-3.5 text-mapa-400" />
                  Active Games
                </div>
                <div className="space-y-1">
                  {activeRooms.map(({ id, room: r }) => (
                    <div key={id} className="flex items-center justify-between px-3 py-2 rounded-lg border border-mapa-400/10">
                      <div className="text-[11px] font-mono text-white/40">
                        <span className="text-mapa-400">#{id}</span>
                        <span className="ml-2">vs {r.player1 === publicKey ? shorten(r.player2 || "") : shorten(r.player1)}</span>
                      </div>
                      <button onClick={() => handleRejoin(id)} className="px-2 py-1 rounded bg-mapa-400/10 hover:bg-mapa-400/20 text-mapa-400 text-[9px] font-mono tracking-wider transition-all flex items-center gap-1">
                        <RotateCcw className="w-2.5 h-2.5" /> Rejoin
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {completedRooms.length > 0 && (
              <div>
                <div className="text-xs font-medium mb-2 flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-white/30" />
                  History
                </div>
                <div className="space-y-1">
                  {[...completedRooms].reverse().slice(0, 10).map((id) => (
                    <button
                      key={id}
                      onClick={async () => {
                        try {
                          const r = await getRoom(id);
                          setRoom(r); setRoomId(id);
                          setOpponentGuess(r.player1 === publicKey ? { lat: r.guess2_lat, lng: r.guess2_lng } : { lat: r.guess1_lat, lng: r.guess1_lng });
                          const loc = await getLocation(r.location_id).catch(() => null);
                          if (loc) setCurrentLocation(loc);
                          setPhase("result");
                        } catch {}
                      }}
                      className="w-full text-left px-3 py-2 rounded-lg border border-white/[0.04] hover:border-white/[0.08] transition-colors text-[11px] font-mono text-white/25"
                    >
                      Room #{id}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {activeRooms.length === 0 && completedRooms.length === 0 && (
              <p className="text-xs text-white/20 font-mono py-6 text-center">No games yet.</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  return (
    <div className="min-h-screen">
      <BackgroundGrid />
      <div className="relative z-10 px-3 md:px-6 py-3 max-w-7xl mx-auto">
        <nav className="flex items-center justify-between mb-4 h-9">
          <button
            onClick={() => (phase === "lobby" ? (window.location.href = "/") : handleReset())}
            className="flex items-center gap-1 text-white/30 hover:text-white/60 transition-colors text-[11px] font-mono tracking-wider"
          >
            <ArrowLeft className="w-3 h-3" />
            {phase === "lobby" ? "Exit" : "Back"}
          </button>
          <div className="flex items-center gap-2">
            <span className="text-[9px] text-white/15 font-mono tracking-widest hidden sm:inline uppercase">{publicKey?.slice(0, 6)}</span>
            <WalletConnector />
          </div>
        </nav>

        <AnimatePresence mode="wait">
          {phase === "lobby" && (
            <motion.div key="lobby" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {lobbyContent}
            </motion.div>
          )}

          {phase === "matching" && (
            <motion.div key="matching" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center min-h-[70vh] gap-5"
            >
              <div className="relative w-16 h-16">
                <div className="absolute inset-0 rounded-full border border-mapa-400/20 animate-ping-subtle" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Radio className="w-5 h-5 text-mapa-400" />
                </div>
              </div>
              <div className="text-center">
                <p className="text-sm font-medium mb-0.5">Awaiting Opponent</p>
                {roomId && <p className="text-[11px] font-mono text-white/30">Room #{roomId} · {formatStroops(room?.stake || 0)} XLM</p>}
              </div>
              <button onClick={handleCancelRoom} className="px-4 py-1.5 rounded-lg border border-white/[0.08] hover:bg-white/[0.04] text-[11px] text-white/40 font-mono transition-all flex items-center gap-1.5">
                <LogOut className="w-3 h-3" /> Cancel
              </button>
            </motion.div>
          )}

          {(phase === "playing" || phase === "waiting") && currentLocation && (
            <motion.div key="playing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <Target className="w-3 h-3 text-mapa-400" />
                  <span className="text-[10px] font-mono text-white/30 tracking-wide">
                    {phase === "playing" ? "ACQUIRE TARGET" : "AWAITING OPPONENT"}
                  </span>
                </div>
                {room && (
                  <div className="flex items-center gap-2 text-[10px] font-mono text-white/20">
                    <span>#{roomId}</span>
                    <span>{formatStroops(room.stake)} XLM</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="border border-white/[0.04] rounded-lg overflow-hidden">
                  <StreetView lat={currentLocation.lat} lng={currentLocation.lng} />
                </div>

                <div className="flex flex-col gap-3">
                  <div className="border border-white/[0.04] rounded-lg overflow-hidden">
                    <MapView
                      onClick={phase === "playing" ? (lat, lng) => setGuess({ lat, lng }) : undefined}
                      guess={guess}
                      interactive={phase === "playing"}
                    />
                  </div>

                  {guess && phase === "playing" && (
                    <div className="border border-mapa-400/15 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[9px] font-mono tracking-wider text-white/30 uppercase">Target</span>
                        <span className="coord-badge">
                          {guess.lat.toFixed(4)}N {guess.lng.toFixed(4)}E
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 mb-3">
                        <div className="data-row">
                          <span className="data-label">Latitude</span>
                          <span className="data-value">{guess.lat.toFixed(4)}</span>
                        </div>
                        <div className="data-row">
                          <span className="data-label">Longitude</span>
                          <span className="data-value">{guess.lng.toFixed(4)}</span>
                        </div>
                      </div>
                      <button
                        onClick={handleConfirmGuess}
                        disabled={loading}
                        className="w-full py-2.5 rounded-lg bg-mapa-400 hover:bg-mapa-300 disabled:opacity-40 font-semibold text-[#0d0f10] text-xs transition-all flex items-center justify-center gap-2"
                      >
                        {loading ? <div className="mini-spinner" /> : <><Crosshair className="w-3 h-3" /> Confirm Strike</>}
                      </button>
                    </div>
                  )}

                  {phase === "waiting" && (
                    <div className="border border-white/[0.04] rounded-lg p-4 text-center">
                      <p className="text-[11px] text-white/30 font-mono">Waiting for opponent guess...</p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {phase === "result" && currentLocation && room && (
            <motion.div key="result" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="max-w-lg mx-auto"
            >
              <div className="border border-white/[0.04] rounded-lg overflow-hidden mb-4">
                <StreetView lat={currentLocation.lat} lng={currentLocation.lng} />
              </div>
              <div className="border border-white/[0.04] rounded-lg overflow-hidden mb-4">
                <MapView
                  lat={currentLocation.lat} lng={currentLocation.lng}
                  guess={isPlayer1 ? { lat: room.guess1_lat, lng: room.guess1_lng } : { lat: room.guess2_lat, lng: room.guess2_lng }}
                  actual={{ lat: currentLocation.lat, lng: currentLocation.lng }}
                  interactive={false}
                />
              </div>

              <div className="border border-white/[0.06] rounded-lg p-5 text-center">
                <Trophy className={`w-8 h-8 mx-auto mb-2 ${room.winner === publicKey ? "text-gold" : "text-white/10"}`} />
                <h2 className={`text-lg font-bold mb-0.5 ${room.winner === publicKey ? "text-gold" : "text-white/40"}`}>
                  {room.winner === publicKey ? "VICTORY" : room.winner ? "DEFEAT" : "STANDOFF"}
                </h2>
                <p className="text-[10px] text-white/25 font-mono mb-4">
                  {room.winner === publicKey ? "Prize sent to your wallet" : room.winner ? "Better luck next time" : "Neither found the mark"}
                </p>

                <div className="grid grid-cols-2 gap-2 mb-4">
                  <div className="border border-white/[0.04] rounded-lg p-3">
                    <div className="data-label mb-1">{isPlayer1 ? "You" : "Opponent"}</div>
                    <div className="text-base font-bold font-mono">{formatDistance(isPlayer1 ? room.distance1 : room.distance2)}</div>
                  </div>
                  <div className="border border-white/[0.04] rounded-lg p-3">
                    <div className="data-label mb-1">{isPlayer1 ? "Opponent" : "You"}</div>
                    <div className="text-base font-bold font-mono">{formatDistance(isPlayer1 ? room.distance2 : room.distance1)}</div>
                  </div>
                </div>

                {opponentGuess && (
                  <div className="border border-white/[0.04] rounded-lg p-3 mb-4">
                    <div className="data-label mb-1">Enemy Coordinates</div>
                    <p className="text-xs font-mono text-white/40">{opponentGuess.lat.toFixed(4)}N, {opponentGuess.lng.toFixed(4)}E</p>
                  </div>
                )}

                <button onClick={handleReset} className="w-full py-2.5 rounded-lg bg-mapa-400 hover:bg-mapa-300 font-semibold text-[#0d0f10] text-sm transition-all">
                  Play Again
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
