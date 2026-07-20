"use client";

import { useRef, useEffect, useState } from "react";
import { useGoogleMaps } from "./GoogleMapsProvider";

interface MapViewProps {
  lat?: number;
  lng?: number;
  onClick?: (lat: number, lng: number) => void;
  guess?: { lat: number; lng: number } | null;
  actual?: { lat: number; lng: number } | null;
  interactive?: boolean;
}

export function MapView({ lat = 20, lng = 0, onClick, guess, actual, interactive = true }: MapViewProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [markers, setMarkers] = useState<google.maps.Marker[]>([]);
  const { isLoaded, error: mapsError } = useGoogleMaps();

  useEffect(() => {
    if (mapsError || !isLoaded || !mapRef.current) return;

    const gMap = new google.maps.Map(mapRef.current, {
      center: { lat, lng },
      zoom: 2,
      styles: [
        { elementType: "geometry", stylers: [{ color: "#1a1a2e" }] },
        { elementType: "labels.text.stroke", stylers: [{ color: "#1a1a2e" }] },
        { elementType: "labels.text.fill", stylers: [{ color: "#8e8ea0" }] },
        {
          featureType: "road",
          elementType: "geometry",
          stylers: [{ color: "#2c2c44" }],
        },
        {
          featureType: "water",
          elementType: "geometry",
          stylers: [{ color: "#0f0f23" }],
        },
      ],
      disableDefaultUI: !interactive,
      clickableIcons: false,
    });

    setMap(gMap);

    if (interactive && onClick) {
      gMap.addListener("click", (e: google.maps.MapMouseEvent) => {
        const clickLat = e.latLng!.lat();
        const clickLng = e.latLng!.lng();
        onClick(clickLat, clickLng);
      });
    }
  }, [isLoaded, mapsError, lat, lng, interactive, onClick]);

  useEffect(() => {
    if (!map) return;

    markers.forEach((m) => m.setMap(null));

    const newMarkers: google.maps.Marker[] = [];

    if (guess) {
      const marker = new google.maps.Marker({
        position: guess,
        map,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: "#facc15",
          fillOpacity: 1,
          strokeColor: "#000",
          strokeWeight: 2,
        },
        label: { text: "?", color: "#000", fontSize: "14px", fontWeight: "bold" },
      });
      newMarkers.push(marker);
    }

    if (actual) {
      const marker = new google.maps.Marker({
        position: actual,
        map,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: "#22c55e",
          fillOpacity: 1,
          strokeColor: "#000",
          strokeWeight: 2,
        },
        label: { text: "✓", color: "#000", fontSize: "14px", fontWeight: "bold" },
      });
      newMarkers.push(marker);

      if (guess) {
        const line = new google.maps.Polyline({
          path: [guess, actual],
          geodesic: true,
          strokeColor: "#ef4444",
          strokeOpacity: 0.6,
          strokeWeight: 2,
          map,
        });
        newMarkers.push(line as any);
      }
    }

    setMarkers(newMarkers);

    return () => {
      newMarkers.forEach((m) => m.setMap(null));
    };
  }, [map, guess, actual]);

  return (
    <div className="glass-panel overflow-hidden">
      <div ref={mapRef} className="map-container" style={{ height: "400px" }} />
    </div>
  );
}
