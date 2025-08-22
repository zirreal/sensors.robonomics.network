import L from "leaflet";
import "leaflet-active-area";
import "leaflet.tilelayer.colorfilter";
import "leaflet/dist/leaflet.css";

import { settings, themes } from "@config";

let map;
let usermarker;
let boundsLimit; // null → global mode
let mode = "world"; // "world" | "island"

const WORLD_BOUNDS = L.latLngBounds([-85, -180], [85, 180]);

// Normalize theme options: object or function(noWrap) => object
function normalizeOptions(opt, noWrap) {
  if (!opt) return { noWrap };
  if (typeof opt === "function") return opt(noWrap) || { noWrap };
  return { ...opt, noWrap: opt.noWrap ?? noWrap };
}

// Create tile layer by theme key defined in config; optional invert via colorFilter
function layerFromThemeKey(themeKey, noWrap, invert = false) {
  const key = (themeKey || "").trim().toLowerCase();
  const def = themes && themes[key];
  if (!def || !def.url) return null;
  const opts = normalizeOptions(def.options, noWrap);
  if (invert) {
    return L.tileLayer.colorFilter(def.url, {
      ...opts,
      filter: ["invert:100%", "grayscale:100%", "bright:100%", "saturate:0%", "sepia:10%"],
    });
  }
  return L.tileLayer(def.url, opts);
}

let layerMapLight;
let layerMapDark;

// Numeric helpers
function n(v, def) {
  const x = Number(v);
  return Number.isFinite(x) ? x : def;
}
function hasFiniteNumber(v) {
  if (v === "" || v === null || v === undefined) return false;
  const x = Number(v);
  return Number.isFinite(x);
}

// Get existing map instance
export function instanceMap() {
  if (map) return map;
  throw new Error("Map must be initialized before usage.");
}

// Remove and reset map
export function removeMap() {
  if (map) {
    map.remove();
    map = undefined;
    boundsLimit = undefined;
    mode = "world";
  }
}

// Initialize map
export function init(position, zoom, theme = "light") {
  boundsLimit = getBoundsFromConfigOrNull();
  mode = boundsLimit ? "island" : "world";

  const themeCfg = settings?.MAP?.theme || {};
  const noWrap = true;

  // Light layer
  layerMapLight = layerFromThemeKey(themeCfg.light, noWrap);

  // Dark layer: prefer explicit dark; otherwise optionally invert light if invertForDark=true
  if (themeCfg.dark) {
    layerMapDark = layerFromThemeKey(themeCfg.dark, noWrap);
  } else if (themeCfg.invertForDark) {
    layerMapDark = layerFromThemeKey(themeCfg.light, noWrap, true);
  }

  // Soft fallback to OSM if nothing resolved
  if (!layerMapLight) layerMapLight = layerFromThemeKey("osm", noWrap);
  if (!layerMapDark) layerMapDark = layerFromThemeKey("osm", noWrap);

  map = L.map("map", {
    maxBounds: mode === "island" ? boundsLimit : WORLD_BOUNDS,
    maxBoundsViscosity: mode === "island" ? 1.0 : 0.7,
    inertia: mode === "island" ? false : true,
    worldCopyJump: false,
    zoomSnap: 1,
    zoomDelta: 1,
  });

  setTheme(theme);
  map.attributionControl.remove();
  map.zoomControl.remove();

  const cfgLat = n(settings?.MAP?.position?.lat, 0);
  const cfgLng = n(settings?.MAP?.position?.lng, 0);
  const cfgZoom = n(settings?.MAP?.zoom, 3);

  const safeCenter = position ?? [cfgLat, cfgLng];
  const safeZoom = n(zoom, cfgZoom);

  map.setView(safeCenter, safeZoom);

  if (mode === "island") applyIslandBounds();
  else applyWorldBounds();

  map.on("resize", () => {
    if (mode === "island") applyIslandBounds(true);
    else applyWorldBounds(true);
  });

  map.on("zoomend", () => {
    const minZ = map.getMinZoom();
    if (map.getZoom() < minZ) map.setZoom(minZ);

    if (mode === "island") {
      if (map.getZoom() === minZ) {
        map.fitBounds(boundsLimit, { animate: false, padding: [0, 0] });
      } else {
        clampInside(boundsLimit);
      }
      applyPanLock();
    } else {
      clampInside(WORLD_BOUNDS);
    }
  });

  map.on("moveend", () => {
    clampInside(mode === "island" ? boundsLimit : WORLD_BOUNDS);
  });

  return map;
}

// Switch map theme (light/dark)
export function setTheme(theme) {
  const map = instanceMap();
  if (theme === "light") {
    if (layerMapDark && map.hasLayer(layerMapDark)) map.removeLayer(layerMapDark);
    if (layerMapLight && !map.hasLayer(layerMapLight)) map.addLayer(layerMapLight);
  } else {
    if (layerMapLight && map.hasLayer(layerMapLight)) map.removeLayer(layerMapLight);
    if (layerMapDark && !map.hasLayer(layerMapDark)) map.addLayer(layerMapDark);
  }
}

// Set view and clamp to bounds
export function setview(position, zoom) {
  const map = instanceMap();
  if (!map) return;
  const z = typeof zoom === "number" ? Math.max(zoom, map.getMinZoom()) : map.getZoom();
  map.setView(position, z);
  if (mode === "island") {
    if (map.getZoom() === map.getMinZoom()) {
      map.fitBounds(boundsLimit, { animate: false, padding: [0, 0] });
    } else {
      clampInside(boundsLimit);
    }
    applyPanLock();
  } else {
    clampInside(WORLD_BOUNDS);
  }
}

// Draw user marker with zoom-based radius
export function drawuser(position, zoom) {
  const map = instanceMap();
  if (!map) return;

  if (usermarker) map.removeLayer(usermarker);

  const z = n(zoom, map.getZoom());
  let r = 100;
  if (z > 0) r = 10 * z;
  if (z > 4) r = 5 * z;
  if (z > 7) r = 2 * z;

  usermarker = new L.circleMarker(position, { radius: r, opacity: 0.2 });
  usermarker.addTo(map);
}

// Compute bounds from config (MAP.bounds or MAP.boundsDelta)
function getBoundsFromConfigOrNull() {
  const b = settings?.MAP?.bounds;
  if (b && Array.isArray(b) && b.length === 2) {
    return L.latLngBounds(b[0], b[1]);
  }
  const d = settings?.MAP?.boundsDelta;
  const hasDLat = hasFiniteNumber(d?.lat) || typeof d === "number";
  const hasDLng = hasFiniteNumber(d?.lng) || typeof d === "number";
  if (d !== undefined && hasDLat && hasDLng) {
    const lat = n(settings?.MAP?.position?.lat, 0);
    const lng = n(settings?.MAP?.position?.lng, 0);
    const dLat = n(typeof d === "number" ? d : d?.lat, 0.5);
    const dLng = n(typeof d === "number" ? d : d?.lng, 0.5);
    return L.latLngBounds([lat - dLat, lng - dLng], [lat + dLat, lng + dLng]);
  }
  return null;
}

// Apply bounds and minZoom for island mode
function applyIslandBounds(isResize = false) {
  const map = instanceMap();
  if (!boundsLimit) return;

  map.setMaxBounds(boundsLimit);
  const minZ = map.getBoundsZoom(boundsLimit, true);
  map.setMinZoom(minZ);

  if (!boundsLimit.contains(map.getBounds())) {
    map.fitBounds(boundsLimit, { animate: false });
  }
  if (!boundsLimit.contains(map.getCenter())) {
    map.panInsideBounds(boundsLimit, { animate: false });
  }
  if (!isResize && map.getZoom() < minZ) map.setZoom(minZ);

  applyPanLock();
}

// Apply world bounds and minZoom
function applyWorldBounds(isResize = false) {
  const map = instanceMap();

  map.setMaxBounds(WORLD_BOUNDS);

  const worldMin = map.getBoundsZoom(WORLD_BOUNDS, true);
  map.setMinZoom(worldMin);

  if (map.getZoom() < worldMin) map.setZoom(worldMin);

  clampInside(WORLD_BOUNDS);

  if (isResize) {
    const recomputed = map.getBoundsZoom(WORLD_BOUNDS, true);
    map.setMinZoom(recomputed);
    if (map.getZoom() < recomputed) map.setZoom(recomputed);
    clampInside(WORLD_BOUNDS);
  }
}

// Ensure map center/bounds are inside given limits
function clampInside(limits) {
  if (!map || !limits) return;
  if (!limits.contains(map.getCenter())) {
    map.panInsideBounds(limits, { animate: false });
  }
  if (!limits.contains(map.getBounds())) {
    map.fitBounds(limits, { animate: false });
  }
}

// Lock panning if at min zoom in island mode
function applyPanLock() {
  if (!map || mode !== "island") return;
  const atMin = map.getZoom() <= map.getMinZoom();
  if (atMin) {
    if (map.dragging.enabled()) map.dragging.disable();
    map.fitBounds(boundsLimit, { animate: false, padding: [0, 0] });
  } else {
    if (!map.dragging.enabled()) map.dragging.enable();
  }
}
