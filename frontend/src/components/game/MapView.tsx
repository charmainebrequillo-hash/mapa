"use client";

import { useRef, useEffect, useState } from "react";
import { useGoogleMaps } from "./GoogleMapsProvider";
import { calculateDistance } from "@/lib/game";

interface MapViewProps {
  lat?: number;
  lng?: number;
  onClick?: (lat: number, lng: number) => void;
  guess?: { lat: number; lng: number } | null;
  actual?: { lat: number; lng: number } | null;
  interactive?: boolean;
}

const PIN_SVG = {
  path: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z",
  anchor: { x: 12, y: 24 },
};

export function MapView({ lat = 20, lng = 0, onClick, guess, actual, interactive = true }: MapViewProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [overlays, setOverlays] = useState<(google.maps.Marker | google.maps.Polyline)[]>([]);
  const { isLoaded, error: mapsError } = useGoogleMaps();
  const [distance, setDistance] = useState<number | null>(null);

  useEffect(() => {
    if (mapsError || !isLoaded || !mapRef.current) return;

    const gMap = new google.maps.Map(mapRef.current, {
      center: { lat, lng },
      zoom: 2,
      minZoom: 2,
      styles: [
        { elementType: "geometry", stylers: [{ color: "#1a1a2e" }] },
        { elementType: "labels.text.stroke", stylers: [{ color: "#1a1a2e" }] },
        { elementType: "labels.text.fill", stylers: [{ color: "#8e8ea0" }] },
        { featureType: "road", elementType: "geometry", stylers: [{ color: "#2c2c44" }] },
        { featureType: "water", elementType: "geometry", stylers: [{ color: "#0f0f23" }] },
        { featureType: "poi", stylers: [{ visibility: "off" }] },
        { featureType: "transit", stylers: [{ visibility: "off" }] },
      ],
      disableDefaultUI: !interactive,
      clickableIcons: false,
      draggableCursor: interactive ? "crosshair" : "grab",
    });

    setMap(gMap);

    if (interactive && onClick) {
      gMap.addListener("click", (e: google.maps.MapMouseEvent) => {
        const clickLat = e.latLng!.lat();
        const clickLng = e.latLng!.lng();
        onClick(clickLat, clickLng);
      });
    }
  }, [isLoaded, mapsError, interactive, onClick]);

  useEffect(() => {
    if (!map) return;

    overlays.forEach((o) => o.setMap(null));

    const newOverlays: (google.maps.Marker | google.maps.Polyline)[] = [];
    let dist: number | null = null;

    if (guess && actual) {
      dist = calculateDistance(guess.lat, guess.lng, actual.lat, actual.lng);

      const guessPin = new google.maps.Marker({
        position: guess,
        map,
        icon: {
          path: PIN_SVG.path,
          fillColor: "#fed639",
          fillOpacity: 1,
          strokeColor: "#000",
          strokeWeight: 2,
          scale: 1.8,
          anchor: new google.maps.Point(PIN_SVG.anchor.x, PIN_SVG.anchor.y),
        },
        label: { text: "?", color: "#000", fontSize: "11px", fontWeight: "bold" },
      });
      newOverlays.push(guessPin);

      const actualPin = new google.maps.Marker({
        position: actual,
        map,
        icon: {
          path: PIN_SVG.path,
          fillColor: "#22c55e",
          fillOpacity: 1,
          strokeColor: "#000",
          strokeWeight: 2,
          scale: 1.8,
          anchor: new google.maps.Point(PIN_SVG.anchor.x, PIN_SVG.anchor.y),
        },
        label: { text: "✓", color: "#000", fontSize: "11px", fontWeight: "bold" },
      });
      newOverlays.push(actualPin);

      const line = new google.maps.Polyline({
        path: [guess, actual],
        geodesic: true,
        strokeColor: "#fed639",
        strokeOpacity: 0.5,
        strokeWeight: 2,
        map,
      });
      newOverlays.push(line);

      const bounds = new google.maps.LatLngBounds();
      bounds.extend(guess);
      bounds.extend(actual);
      map.fitBounds(bounds, 80);
    } else if (guess) {
      const pin = new google.maps.Marker({
        position: guess,
        map,
        icon: {
          path: PIN_SVG.path,
          fillColor: "#00f2ff",
          fillOpacity: 1,
          strokeColor: "#fff",
          strokeWeight: 1.5,
          scale: 1.6,
          anchor: new google.maps.Point(PIN_SVG.anchor.x, PIN_SVG.anchor.y),
        },
        animation: google.maps.Animation.DROP,
      });
      newOverlays.push(pin);

      map.setCenter(guess);
      map.setZoom(4);
    }

    setDistance(dist);
    setOverlays(newOverlays);

    return () => {
      newOverlays.forEach((o) => o.setMap(null));
    };
  }, [map, guess, actual]);

  if (mapsError) {
    return (
      <div className="map-container flex items-center justify-center" style={{ height: "400px" }}>
        <p className="text-red-400/60 text-xs font-mono">MAP LOAD ERROR</p>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="map-container flex items-center justify-center" style={{ height: "400px" }}>
        <div className="flex flex-col items-center gap-2">
          <div className="w-5 h-5 border-2 border-mapa-400/30 border-t-mapa-400 rounded-full animate-spin" />
          <span className="text-[10px] text-white/20 font-mono">LOADING SATELLITE FEED...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-xl">
      <div ref={mapRef} className="map-container" style={{ height: "400px" }} />
      {distance !== null && (
        <div className="absolute bottom-3 left-3 glass-panel-strong px-3 py-1.5 z-10">
          <span className="text-[10px] text-white/30 font-mono tracking-wider">DISTANCE </span>
          <span className="text-sm font-mono font-bold text-white/80">
            {distance < 1000 ? `${Math.round(distance)}m` : `${(distance / 1000).toFixed(1)}km`}
          </span>
        </div>
      )}
    </div>
  );
}
