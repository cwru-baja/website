"use client";

import "leaflet/dist/leaflet.css";

import L from "leaflet";
import { useEffect, useRef, useState } from "react";

import type { TrailPoint } from "@/lib/liveTelemetry";
import styles from "./LiveMap.module.css";
import { MapFrame } from "./MapFrame";

const TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors';
const START_ZOOM = 17;

type MapParts = { map: L.Map; line: L.Polyline; dot: L.CircleMarker };

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * The car on a map, with the last stretch of its path. Loaded only on /live,
 * in the browser (see LiveTelemetry). The map is made on the first GPS fix and
 * follows the car, moving only when it nears an edge, until someone drags it.
 */
export default function LiveMap({ trail }: { trail: TrailPoint[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const partsRef = useRef<MapParts | null>(null);
  const [following, setFollowing] = useState(true);
  const hasFix = trail.length > 0;
  // The map is made once, but where it starts is wherever the car is then.
  const trailRef = useRef(trail);
  useEffect(() => {
    trailRef.current = trail;
  }, [trail]);

  useEffect(() => {
    const container = containerRef.current;
    const start = trailRef.current[trailRef.current.length - 1];
    if (!hasFix || !container || !start) return;

    const livery = getComputedStyle(document.documentElement).getPropertyValue("--livery").trim() || "#26b0bd";
    const still = reducedMotion();
    // One finger scrolls the page on a phone; two pinch the map.
    const touch = window.matchMedia("(pointer: coarse)").matches;

    const map = L.map(container, {
      zoomControl: false,
      attributionControl: false,
      scrollWheelZoom: false,
      dragging: !touch,
      zoomAnimation: !still,
      fadeAnimation: !still,
      markerZoomAnimation: !still,
    }).setView([start.lat, start.lon], START_ZOOM);
    L.control.zoom({ position: "topright" }).addTo(map);
    L.control.attribution({ prefix: false }).addTo(map);
    L.tileLayer(TILE_URL, { maxZoom: 19, attribution: ATTRIBUTION }).addTo(map);

    const line = L.polyline([], {
      color: livery,
      weight: 3,
      opacity: 0.85,
      lineCap: "round",
      lineJoin: "round",
      interactive: false,
    }).addTo(map);
    const dot = L.circleMarker([start.lat, start.lon], {
      radius: 7,
      color: "#0a0a0a",
      weight: 2,
      fillColor: livery,
      fillOpacity: 1,
      interactive: false,
    }).addTo(map);

    map.on("dragstart", () => setFollowing(false));
    partsRef.current = { map, line, dot };

    return () => {
      partsRef.current = null;
      map.remove();
    };
  }, [hasFix]);

  useEffect(() => {
    const parts = partsRef.current;
    if (!parts || trail.length === 0) return;
    const car = trail[trail.length - 1];
    parts.line.setLatLngs(trail.map((point) => [point.lat, point.lon]));
    parts.dot.setLatLng([car.lat, car.lon]);
    if (!following) return;
    // Only pan when the car nears an edge, so the map mostly holds still.
    const comfortable = parts.map.getBounds().pad(-0.25);
    if (!comfortable.contains([car.lat, car.lon])) {
      parts.map.panTo([car.lat, car.lon], { animate: !reducedMotion(), duration: 0.6 });
    }
  }, [trail, following]);

  const recentre = () => {
    const parts = partsRef.current;
    const car = trail[trail.length - 1];
    if (parts && car) parts.map.setView([car.lat, car.lon], parts.map.getZoom(), { animate: !reducedMotion() });
    setFollowing(true);
  };

  return (
    <MapFrame
      innerRef={containerRef}
      innerClassName={styles.map}
      message={hasFix ? null : "Waiting for a GPS fix"}
    >
      {!following && (
        <button
          type="button"
          onClick={recentre}
          className="absolute bottom-3 left-3 z-[1000] min-h-11 border border-white/10 bg-bg px-4 font-clash text-xs font-medium uppercase tracking-[0.16em] text-white hover:bg-livery hover:text-on-livery"
        >
          Follow the car
        </button>
      )}
    </MapFrame>
  );
}
