"use client";

import { motion } from "framer-motion";
import { MapPin, Trophy, Target, ArrowRight, Globe, Compass, Star, Coins } from "lucide-react";
import { WalletConnector } from "@/components/wallet/WalletConnector";
import { useWallet } from "@/components/wallet/WalletProvider";
import { useRouter } from "next/navigation";

export default function LandingPage() {
  const { isConnected } = useWallet();
  const router = useRouter();

  return (
    <div className="min-h-screen flex flex-col">
      <nav className="flex items-center justify-between px-6 py-4 border-b border-white/5">
        <div className="flex items-center gap-2">
          <Coins className="w-6 h-6 text-mapa-400" />
          <span className="font-bold text-lg">Mapa</span>
        </div>
        <WalletConnector />
      </nav>

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center max-w-2xl"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-mapa-500/10 border border-mapa-500/20 text-mapa-300 text-sm mb-8">
            <Star className="w-3 h-3" />
            Powered by Stellar Soroban
          </div>

          <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-mapa-300 via-white to-gold bg-clip-text text-transparent">
            Guess the World,
            <br />
            Win on Stellar
          </h1>

          <p className="text-lg text-white/50 mb-10 max-w-lg mx-auto">
            Stake XLM, drop a pin on the map. The closer you are to the mystery location,
            the more you win. Every guess is a chance to explore the world and earn.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => router.push("/play")}
              className="px-8 py-3 rounded-full bg-mapa-500 hover:bg-mapa-600 font-medium text-lg transition-all flex items-center gap-2"
            >
              {isConnected ? "Play Now" : "Connect to Play"}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-24 max-w-4xl w-full"
        >
          {[
            {
              icon: Compass,
              title: "Explore",
              desc: "See random street views from anywhere on Earth",
            },
            {
              icon: MapPin,
              title: "Guess",
              desc: "Pin your guess on an interactive map",
            },
            {
              icon: Trophy,
              title: "Earn",
              desc: "Win XLM based on how close you are",
            },
          ].map((feature, i) => (
            <div key={i} className="glass-panel p-6 text-center hover:border-white/10 transition-all">
              <div className="w-12 h-12 rounded-full bg-mapa-500/10 flex items-center justify-center mx-auto mb-4">
                <feature.icon className="w-6 h-6 text-mapa-400" />
              </div>
              <h3 className="font-semibold mb-2">{feature.title}</h3>
              <p className="text-sm text-white/40">{feature.desc}</p>
            </div>
          ))}
        </motion.div>
      </main>
    </div>
  );
}
