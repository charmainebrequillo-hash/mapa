"use client";

import { useRef, useEffect, useState } from "react";
import { Compass, Loader2 } from "lucide-react";
import { useGoogleMaps } from "./GoogleMapsProvider";

interface StreetViewProps {
  lat?: number;
  lng?: number;
  heading?: number;
  pitch?: number;
}

export function StreetView({ lat = 48.8566, lng = 2.3522, heading = 0, pitch = 0 }: StreetViewProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const panoramaRef = useRef<google.maps.StreetViewPanorama | null>(null);
  const { isLoaded, error: mapsError } = useGoogleMaps();

  const displayError = error || mapsError;

  useEffect(() => {
    if (!ref.current || !isLoaded) return;

    setLoading(true);
    setError(null);

    const sv = new google.maps.StreetViewService();
    sv.getPanorama({ location: { lat, lng }, radius: 50, preference: google.maps.StreetViewPreference.BEST }, (data, status) => {
      if (status === google.maps.StreetViewStatus.OK && data?.location?.pano) {
        const panorama = new google.maps.StreetViewPanorama(ref.current!, {
          pano: data.location.pano,
          pov: { heading, pitch },
          zoom: 1,
          addressControl: false,
          showRoadLabels: false,
          motionTracking: false,
          motionTrackingControl: false,
          linksControl: false,
          panControl: false,
          enableCloseButton: false,
          clickToGo: false,
          scrollwheel: false,
          disableDefaultUI: true,
        });
        panoramaRef.current = panorama;
        setLoading(false);
      } else {
        setError("No street view available for this location");
        setLoading(false);
      }
    });
  }, [lat, lng, isLoaded, mapsError]);

  return (
    <div className="street-view-container glass-panel relative">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
          <Loader2 className="w-8 h-8 animate-spin text-mapa-400" />
        </div>
      )}
      {displayError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 z-10 gap-3">
          <Compass className="w-12 h-12 text-white/20" />
          <p className="text-white/40 text-sm">{displayError}</p>
        </div>
      )}
      <div ref={ref} className="w-full h-full" />
    </div>
  );
}
