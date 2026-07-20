"use client";

import { motion } from "framer-motion";
import { MapPin, Trophy, Target, ArrowRight, Globe, Compass, Star, Crosshair, Zap, Shield, Timer, Swords, Coins, Radio } from "lucide-react";
import { WalletConnector } from "@/components/wallet/WalletConnector";
import { useWallet } from "@/components/wallet/WalletProvider";
import { useRouter } from "next/navigation";
import { BackgroundGrid } from "@/components/BackgroundGrid";
import { useEffect, useState } from "react";
import { getMinStake, getOpenRooms, formatStroops } from "@/lib/game";
import { CONTRACTS } from "@/lib/contract-ids";

const ease = [0.25, 0.46, 0.45, 0.94] as const;

const stagger = {
  container: { animate: { transition: { staggerChildren: 0.12 } } },
  item: {
    initial: { opacity: 0, y: 24 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.6, ease } },
  },
};

const slideUp = {
  initial: { opacity: 0, y: 40 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" },
  transition: { duration: 0.7, ease },
};

export default function LandingPage() {
  const { isConnected } = useWallet();
  const router = useRouter();
  const [minStake, setMinStake] = useState<number | null>(null);
  const [openRoomCount, setOpenRoomCount] = useState<number | null>(null);

  useEffect(() => {
    getMinStake().then(setMinStake).catch(() => {});
    getOpenRooms().then((r) => setOpenRoomCount(r.length)).catch(() => {});
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <BackgroundGrid />

      <nav className="sticky top-0 z-50 backdrop-blur-2xl bg-[#111417]/70 border-b border-white/[0.03]">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-5 md:px-8 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-mapa-400/10 border border-mapa-400/20 flex items-center justify-center">
              <Crosshair className="w-3.5 h-3.5 text-mapa-400" />
            </div>
            <span className="font-semibold tracking-tight text-base">Mapa</span>
            <span className="hidden sm:inline text-[10px] uppercase tracking-[0.2em] text-white/20 ml-1 font-mono">Terminal</span>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push("/play")}
              className="hidden md:inline-flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors font-mono tracking-wide"
            >
              <Swords className="w-3 h-3" />
              Play
            </button>
            <WalletConnector />
          </div>
        </div>
      </nav>

      <main className="flex-1">
        <section className="relative min-h-[85vh] flex items-center justify-center px-5 py-24 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#111417] pointer-events-none z-10" />

          <motion.div
            variants={stagger.container}
            initial="initial"
            animate="animate"
            className="relative z-20 text-center max-w-3xl mx-auto"
          >
            <motion.div variants={stagger.item} className="mb-8">
              <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-mapa-400/[0.06] border border-mapa-400/15 text-mapa-400 text-xs font-mono tracking-wider">
                <div className="w-1.5 h-1.5 rounded-full bg-mapa-400 animate-pulse" />
                LIVE ON STELLAR SOROBAN
              </span>
            </motion.div>

            <motion.h1
              variants={stagger.item}
              className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold leading-[0.9] tracking-tight mb-6"
            >
              <span className="bg-gradient-to-r from-white via-white to-white/60 bg-clip-text text-transparent">
                Guess the World,
              </span>
              <br />
              <span className="bg-gradient-to-r from-mapa-400 via-mapa-300 to-gold bg-clip-text text-transparent">
                Win on Stellar
              </span>
            </motion.h1>

            <motion.p
              variants={stagger.item}
              className="text-base sm:text-lg text-white/40 max-w-lg mx-auto mb-10 leading-relaxed"
            >
              <span className="font-mono text-white/50 text-sm">[</span> A multiplayer geography game on Stellar Soroban.
              Stake XLM, guess the location, and win the pot.
              <span className="font-mono text-white/50 text-sm"> ]</span>
            </motion.p>

            <motion.div variants={stagger.item} className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                onClick={() => router.push("/play")}
                className="group relative px-8 py-3.5 rounded-xl bg-mapa-400 text-[#111417] font-semibold text-base transition-all duration-300 hover:bg-mapa-300 flex items-center gap-2.5 overflow-hidden"
              >
                <span className="relative z-10 flex items-center gap-2.5">
                  {isConnected ? "Enter the Arena" : "Connect to Play"}
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </span>
                <div className="absolute inset-0 bg-mapa-glow opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </button>
            </motion.div>

            {openRoomCount !== null && (
              <motion.div variants={stagger.item} className="mt-12">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-white/[0.04] text-xs text-white/30 font-mono">
                  <Radio className="w-3 h-3 text-mapa-400/60" />
                  <span>OPEN ROOMS: <span className="text-white/50">{openRoomCount}</span> room{openRoomCount !== 1 ? "s" : ""} available</span>
                  {minStake !== null && (
                    <span className="ml-2 text-white/20">| MIN STAKE: <span className="text-gold/60">{formatStroops(minStake)} XLM</span></span>
                  )}
                </div>
              </motion.div>
            )}
          </motion.div>
        </section>

        <section className="px-5 py-24 max-w-6xl mx-auto">
          <motion.div {...slideUp} className="text-center mb-16">
            <span className="text-[10px] font-mono tracking-[0.25em] text-mapa-400/60 uppercase mb-3 block">
              Protocol Overview
            </span>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
              How the Terminal Works
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              {
                icon: MapPin,
                title: "Scan Sector",
                desc: "You're dropped into a random Street View anywhere on Earth. Every match is a unique coordinate.",
                color: "text-mapa-400",
                border: "border-mapa-400/20",
                bg: "bg-mapa-400/5",
              },
              {
                icon: Crosshair,
                title: "Acquire Target",
                desc: "Drop a pin on the satellite map. Your goal: get as close as possible to the actual location.",
                color: "text-stellar-light",
                border: "border-stellar/20",
                bg: "bg-stellar/5",
              },
              {
                icon: Trophy,
                title: "Collect Reward",
                desc: "The closest guess wins the XLM pot. Funds are released instantly via Soroban smart contract.",
                color: "text-gold",
                border: "border-gold/20",
                bg: "bg-gold/5",
              },
            ].map((feature, i) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: i * 0.15, ease }}
                className="group relative"
              >
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-white/[0.03] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className={`relative glass-panel p-7 md:p-8 ${feature.border} hover:border-white/10 transition-all duration-300 h-full`}>
                  <div className={`w-11 h-11 rounded-xl ${feature.bg} border ${feature.border} flex items-center justify-center mb-5`}>
                    <feature.icon className={`w-5 h-5 ${feature.color}`} />
                  </div>
                  <h3 className="text-lg font-semibold mb-2.5">{feature.title}</h3>
                  <p className="text-sm text-white/40 leading-relaxed">{feature.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        <section className="relative px-5 py-24 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-mapa-400/[0.02] via-transparent to-stellar/[0.02] pointer-events-none" />

          <motion.div {...slideUp} className="max-w-5xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">
              <div>
                <span className="text-[10px] font-mono tracking-[0.25em] text-mapa-400/60 uppercase mb-3 block">
                  Smart Contract
                </span>
                <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-5">
                  Stellar-Powered
                  <br />
                  <span className="text-mapa-400">Prize Pools</span>
                </h2>
                <p className="text-sm text-white/40 leading-relaxed mb-6">
                  Every match locks the stake into a Soroban smart contract. Once both players submit their
                  guesses, the contract calculates the winner and releases funds — no middlemen, no delays.
                </p>
                <div className="space-y-3">
                  {[
                    { icon: Zap, text: "Sub-second finality on Stellar testnet" },
                    { icon: Shield, text: "Non-custodial — funds stay in contract until resolution" },
                    { icon: Timer, text: "Auto-resolution if opponent disconnects" },
                  ].map((item) => (
                    <div key={item.text} className="flex items-start gap-3">
                      <div className="w-5 h-5 rounded bg-mapa-400/10 flex items-center justify-center shrink-0 mt-0.5">
                        <item.icon className="w-3 h-3 text-mapa-400" />
                      </div>
                      <span className="text-sm text-white/50">{item.text}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="glass-panel p-7">
                <div className="text-center mb-5">
                  <div className="text-[10px] font-mono tracking-[0.25em] text-white/20 uppercase mb-3">
                    Contract
                  </div>
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse shadow-[0_0_6px_rgba(74,222,128,0.4)]" />
                    <span className="text-xs font-mono text-white/40">Deployed on Testnet</span>
                  </div>
                </div>
                <div className="space-y-3">
                  <div>
                    <div className="text-[10px] text-white/20 font-mono tracking-wider uppercase mb-1">Game Contract</div>
                    <div className="text-xs font-mono text-white/40 truncate bg-white/[0.02] rounded-lg p-2.5 border border-white/[0.03]">
                      {CONTRACTS.mapaGame}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-white/20 font-mono tracking-wider uppercase mb-1">Vault Contract</div>
                    <div className="text-xs font-mono text-white/40 truncate bg-white/[0.02] rounded-lg p-2.5 border border-white/[0.03]">
                      {CONTRACTS.mapaLocationVault}
                    </div>
                  </div>
                  {minStake !== null && (
                    <div>
                      <div className="text-[10px] text-white/20 font-mono tracking-wider uppercase mb-1">Minimum Stake</div>
                      <div className="text-sm font-bold text-gold font-mono">{formatStroops(minStake)} XLM</div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </section>

        <footer className="border-t border-white/[0.03] px-5 py-8">
          <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Crosshair className="w-4 h-4 text-mapa-400/40" />
              <span className="text-sm font-medium">Mapa</span>
              <span className="text-[10px] text-white/20 font-mono tracking-wider">v0.1</span>
            </div>
            <div className="flex items-center gap-6">
              {["Docs", "GitHub", "Terms"].map((link) => (
                <button key={link} className="text-xs text-white/20 hover:text-white/40 transition-colors font-mono tracking-wider">
                  {link}
                </button>
              ))}
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
