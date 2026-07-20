"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { WalletProvider } from "@/components/wallet/WalletProvider";
import { GoogleMapsProvider } from "@/components/game/GoogleMapsProvider";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <WalletProvider>
        <GoogleMapsProvider>{children}</GoogleMapsProvider>
      </WalletProvider>
    </QueryClientProvider>
  );
}
