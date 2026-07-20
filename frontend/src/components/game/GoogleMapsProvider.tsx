"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Loader } from "@googlemaps/js-api-loader";

interface GoogleMapsContextType {
  isLoaded: boolean;
  error: string | null;
}

const GoogleMapsContext = createContext<GoogleMapsContextType>({
  isLoaded: false,
  error: null,
});

export function useGoogleMaps() {
  return useContext(GoogleMapsContext);
}

const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

export function GoogleMapsProvider({ children }: { children: ReactNode }) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(
    !apiKey ? "Google Maps API key not configured" : null
  );

  useEffect(() => {
    if (!apiKey) return;

    const loader = new Loader({
      apiKey,
      version: "weekly",
      libraries: ["maps", "streetView"],
    });

    loader
      .load()
      .then(() => setIsLoaded(true))
      .catch((e) => setError(e.message));
  }, []);

  return (
    <GoogleMapsContext.Provider value={{ isLoaded, error }}>
      {children}
    </GoogleMapsContext.Provider>
  );
}
