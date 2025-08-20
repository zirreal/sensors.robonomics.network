import L from "leaflet";
import "leaflet-active-area";
// import "leaflet.locatecontrol";
// import "leaflet.locatecontrol/dist/L.Control.Locate.min.css";
import "leaflet.tilelayer.colorfilter";
import "leaflet/dist/leaflet.css";

import config from "@config";

let map;
let usermarker;
let boundsLimit; // null => глобальный режим
let mode = "world"; // "world" | "island"

const attrs = {
  attribution:
    '&copy; <a rel="nofollow" href="https://osm.org/copyright">OpenStreetMap</a> contributors',
};

function makeLight(noWrap) {
  return L.tileLayer.colorFilter(
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    { ...attrs, filter: ["grayscale:50%", "saturate:70%"], noWrap }
  );
}
function makeDark(noWrap) {
  return L.tileLayer.colorFilter(
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    {
      ...attrs,
      filter: ["invert:100%","grayscale:100%","bright:100%","saturate:0%","sepia:10%"],
      noWrap,
    }
  );
}

let layerMapLight;
let layerMapDark;

function n(v, def) {
  const x = Number(v);
  return Number.isFinite(x) ? x : def;
}
function hasFiniteNumber(v) {
  if (v === "" || v === null || v === undefined) return false;
  const x = Number(v);
  return Number.isFinite(x);
}

const WORLD_BOUNDS = L.latLngBounds([-85, -180], [85, 180]);

export function instanceMap() {
  if (map) return map;
  throw new Error("Must be initialized before using the mapd.");
}

export function removeMap() {
  if (map) {
    map.remove();
    map = undefined;
    boundsLimit = undefined;
    mode = "world";
  }
}

export function init(position, zoom, theme = "light") {
  boundsLimit = getBoundsFromConfigOrNull();
  mode = boundsLimit ? "island" : "world";

  const noWrap = mode === "island" ? true : true; // один мир в обоих режимах
  layerMapLight = makeLight(noWrap);
  layerMapDark = makeDark(noWrap);

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

  const cfgLat = n(config?.MAP?.position?.lat, 0);
  const cfgLng = n(config?.MAP?.position?.lng, 0);
  const cfgZoom = n(config?.MAP?.zoom, 3);

  const safeCenter = position ?? [cfgLat, cfgLng];
  const safeZoom = n(zoom, cfgZoom);

  // сначала стартовый центр/зум
  map.setView(safeCenter, safeZoom);

  // затем режимные ограничения
  if (mode === "island") {
    applyIslandBounds();
  } else {
    applyWorldBounds();
  }

  map.on("resize", () => {
    if (mode === "island") {
      applyIslandBounds(true);
    } else {
      applyWorldBounds(true);
    }
  });

  map.on("zoomend", () => {
    if (mode === "island") {
      const minZ = map.getMinZoom();
      if (map.getZoom() < minZ) map.setZoom(minZ);
      if (map.getZoom() === minZ) {
        map.fitBounds(boundsLimit, { animate: false, padding: [0, 0] });
      } else {
        clampInside(boundsLimit);
      }
      applyPanLock();
    } else {
      const minZ = map.getMinZoom();
      if (map.getZoom() < minZ) map.setZoom(minZ);
      clampInside(WORLD_BOUNDS);
    }
  });

  map.on("moveend", () => {
    clampInside(mode === "island" ? boundsLimit : WORLD_BOUNDS);
  });

  return map;
}

export function setTheme(theme) {
  const map = instanceMap();
  if (theme === "light") {
    if (map.hasLayer(layerMapDark)) map.removeLayer(layerMapDark);
    if (!map.hasLayer(layerMapLight)) map.addLayer(layerMapLight);
  } else {
    if (map.hasLayer(layerMapLight)) map.removeLayer(layerMapLight);
    if (!map.hasLayer(layerMapDark)) map.addLayer(layerMapDark);
  }
}

export function setview(position, zoom) {
  const map = instanceMap();
  if (!map) return;
  const z =
    mode === "island"
      ? (typeof zoom === "number" ? Math.max(zoom, map.getMinZoom()) : map.getZoom())
      : (typeof zoom === "number" ? Math.max(zoom, map.getMinZoom()) : map.getZoom());
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

function getBoundsFromConfigOrNull() {
  const b = config?.MAP?.bounds;
  if (b && Array.isArray(b) && b.length === 2) {
    return L.latLngBounds(b[0], b[1]);
  }
  const d = config?.MAP?.boundsDelta;
  const hasDLat = hasFiniteNumber(d?.lat) || typeof d === "number";
  const hasDLng = hasFiniteNumber(d?.lng) || typeof d === "number";
  if (d !== undefined && hasDLat && hasDLng) {
    const lat = n(config?.MAP?.position?.lat, 0);
    const lng = n(config?.MAP?.position?.lng, 0);
    const dLat = n(typeof d === "number" ? d : d?.lat, 0.5);
    const dLng = n(typeof d === "number" ? d : d?.lng, 0.5);
    return L.latLngBounds([lat - dLat, lng - dLng], [lat + dLat, lng + dLng]);
  }
  return null;
}

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

function applyWorldBounds(isResize = false) {
  const map = instanceMap();

  map.setMaxBounds(WORLD_BOUNDS);

  const worldMin = map.getBoundsZoom(WORLD_BOUNDS, true);
  map.setMinZoom(worldMin);

  if (map.getZoom() < worldMin) map.setZoom(worldMin);

  clampInside(WORLD_BOUNDS);

  if (isResize) {
    // на ресайзе пересчитать minZoom ещё раз (после изменения размеров)
    const recomputed = map.getBoundsZoom(WORLD_BOUNDS, true);
    map.setMinZoom(recomputed);
    if (map.getZoom() < recomputed) map.setZoom(recomputed);
    clampInside(WORLD_BOUNDS);
  }
}

function clampInside(limits) {
  if (!map || !limits) return;
  if (!limits.contains(map.getCenter())) {
    map.panInsideBounds(limits, { animate: false });
  }
  if (!limits.contains(map.getBounds())) {
    map.fitBounds(limits, { animate: false });
  }
}

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
