"use client";

import { createContext, useContext, useCallback, useState, useEffect, ReactNode } from "react";
import {
  StellarWalletsKit,
  Networks,
  KitEventType,
} from "@creit.tech/stellar-wallets-kit";
import { FreighterModule } from "@creit.tech/stellar-wallets-kit/modules/freighter";
import { xBullModule } from "@creit.tech/stellar-wallets-kit/modules/xbull";
import { LobstrModule } from "@creit.tech/stellar-wallets-kit/modules/lobstr";
import { HanaModule } from "@creit.tech/stellar-wallets-kit/modules/hana";

const network =
  process.env.NEXT_PUBLIC_STELLAR_NETWORK === "pubnet"
    ? Networks.PUBLIC
    : Networks.TESTNET;

const networkPassphrase =
  process.env.NEXT_PUBLIC_STELLAR_NETWORK === "pubnet"
    ? "Public Global Stellar Network ; September 2015"
    : "Test SDF Network ; September 2015";

interface WalletContextType {
  publicKey: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  signTx: (tx: string) => Promise<string>;
}

const WalletContext = createContext<WalletContextType>({
  publicKey: null,
  isConnected: false,
  isConnecting: false,
  connect: async () => {},
  disconnect: () => {},
  signTx: async (tx: string) => tx,
});

export function useWallet() {
  return useContext(WalletContext);
}

let kitInitialized = false;

function ensureKit() {
  if (!kitInitialized) {
    StellarWalletsKit.init({
      modules: [
        new FreighterModule(),
        new xBullModule(),
        new LobstrModule(),
        new HanaModule(),
      ],
      network,
    });
    kitInitialized = true;
  }
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    ensureKit();

    const unsub = StellarWalletsKit.on(KitEventType.STATE_UPDATED, (event) => {
      if (event.payload.address) {
        setPublicKey(event.payload.address);
      } else {
        setPublicKey(null);
      }
    });

    StellarWalletsKit.getAddress()
      .then(({ address }) => {
        setPublicKey(address);
      })
      .catch(() => {});

    return () => {
      unsub();
    };
  }, []);

  const connect = useCallback(async () => {
    setIsConnecting(true);
    try {
      ensureKit();
      const { address } = await StellarWalletsKit.authModal();
      setPublicKey(address);
    } catch (err) {
      console.error("Failed to connect wallet:", err);
      throw err;
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    try {
      await StellarWalletsKit.disconnect();
    } catch {
      // ignore
    }
    setPublicKey(null);
  }, []);

  const signTx = useCallback(
    async (tx: string): Promise<string> => {
      const { signedTxXdr } = await StellarWalletsKit.signTransaction(tx, {
        networkPassphrase,
      });
      return signedTxXdr;
    },
    []
  );

  return (
    <WalletContext.Provider
      value={{
        publicKey,
        isConnected: !!publicKey,
        isConnecting,
        connect,
        disconnect,
        signTx,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}
