"use client";

import { useWallet } from "./WalletProvider";

export function WalletConnector() {
  const { publicKey, isConnected, isConnecting, connect, disconnect } = useWallet();

  if (isConnected && publicKey) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06]">
          <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse shadow-[0_0_6px_rgba(74,222,128,0.4)]" />
          <span className="text-xs text-white/60 font-mono tracking-wide">
            {publicKey.slice(0, 4)}...{publicKey.slice(-4)}
          </span>
        </div>
        <button
          onClick={disconnect}
          className="hidden sm:inline text-[10px] text-white/20 hover:text-white/50 transition-colors font-mono tracking-widest uppercase"
        >
          Exit
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={connect}
      disabled={isConnecting}
      className="px-4 py-1.5 rounded-lg bg-mapa-400/10 border border-mapa-400/20 hover:bg-mapa-400/20 hover:border-mapa-400/30 disabled:opacity-40 text-xs text-mapa-400 font-mono tracking-wider transition-all"
    >
      {isConnecting ? "CONNECTING..." : "CONNECT"}
    </button>
  );
}
