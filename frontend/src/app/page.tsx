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
      <nav className="flex items-center justify-between px-4 md:px-6 py-3 md:py-4 border-b border-white/5">
        <div className="flex items-center gap-2">
          <Coins className="w-5 h-5 md:w-6 md:h-6 text-mapa-400" />
          <span className="font-bold text-base md:text-lg">Mapa</span>
        </div>
        <WalletConnector />
      </nav>

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-12 md:py-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center w-full max-w-2xl"
        >
          <div className="inline-flex items-center gap-2 px-3 md:px-4 py-1 rounded-full bg-mapa-500/10 border border-mapa-500/20 text-mapa-300 text-xs md:text-sm mb-6 md:mb-8">
            <Star className="w-2.5 h-2.5 md:w-3 md:h-3" />
            Powered by Stellar Soroban
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-7xl font-bold mb-4 md:mb-6 bg-gradient-to-r from-mapa-300 via-white to-gold bg-clip-text text-transparent leading-tight">
            Guess the World,
            <br />
            Win on Stellar
          </h1>

          <p className="text-sm md:text-lg text-white/50 mb-8 md:mb-10 max-w-xs sm:max-w-md md:max-w-lg mx-auto">
            Stake XLM, drop a pin on the map. The closer you are to the mystery location,
            the more you win. Every guess is a chance to explore the world and earn.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 md:gap-4">
            <button
              onClick={() => router.push("/play")}
              className="w-full sm:w-auto px-6 md:px-8 py-3 rounded-full bg-mapa-500 hover:bg-mapa-600 font-medium text-base md:text-lg transition-all flex items-center justify-center gap-2"
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
          className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6 mt-16 md:mt-24 max-w-4xl w-full"
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
            <div key={i} className="glass-panel p-5 md:p-6 text-center hover:border-white/10 transition-all">
              <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-mapa-500/10 flex items-center justify-center mx-auto mb-3 md:mb-4">
                <feature.icon className="w-5 h-5 md:w-6 md:h-6 text-mapa-400" />
              </div>
              <h3 className="font-semibold mb-1 md:mb-2 text-sm md:text-base">{feature.title}</h3>
              <p className="text-xs md:text-sm text-white/40">{feature.desc}</p>
            </div>
          ))}
        </motion.div>
      </main>
    </div>
  );
}
