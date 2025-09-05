import { settings } from "@config";
import L from "leaflet";
import "leaflet-velocity";
import "leaflet-velocity/dist/leaflet-velocity.css";

export const immediate = false;

let windLayer;

export async function init() {
  const res = await fetch(settings.WIND_PROVIDER);
  if (!res.ok) throw new Error('Failed to load wind data');
  const data = await res.json();
  windLayer = L.velocityLayer({
    displayValues: false,
    data,
    maxVelocity: 15,
    velocityScale: 0.01,
    colorScale: ["rgb(60,157,194)", "rgb(128,205,193)", "rgb(250,112,52)", "rgb(245,64,32)"],
  });
}

export function switchLayer(map, enabled = false) {
  if (windLayer) {
    if (enabled) {
      map.addLayer(windLayer);
    } else {
      map.removeLayer(windLayer);
    }
  }
}
