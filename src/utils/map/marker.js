import { settings, sensors } from "@config";
import Queue from "js-queue";
import L from "leaflet";
import "leaflet-arrowheads";
import "leaflet.markercluster";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import { getMeasurementByName } from "../../measurements/tools";
import generate, { getColor, getColorDarkenRGB, getColorRGB } from "../../utils/color";
import { calculateAQIIndex as calculateAQIIndexUS, aqiFromConc } from "../aqiIndex/us";
import { calculateAQIIndex as calculateAQIIndexEU, aqiFromConc as aqiFromConcEU } from "../aqiIndex/eu";
import aqiMeasurement from "../../measurements/aqi";
import aqiUSZones from "../../measurements/aqi_us";
import aqiEUZones from "../../measurements/aqi_eu";

import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

import measurements from "../../measurements";
import { useMapStore } from "../../stores/map";

const queue = new Queue();
let scale;
let markersLayer;
let pathsLayer;
let moveLayer;
let handlerClickMarker;
let map;

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const messageTypes = {
  0: "text",
  1: "air",
  2: "garbage",
  3: "water",
  4: "fire",
  5: "forest",
  6: "alert",
  7: "notif",
  8: "recycle",
  9: "parking",
  42: "gank",
};
let messageIconName = {};
let messageIconType = {};
const messagesLayers = Object.values(messageTypes).reduce((result, item) => {
  result[item] = null;
  return result;
}, {});

// AQI version selector
function getAQICalculator(version = 'us') {
  switch (version) {
    case 'us':
      return calculateAQIIndexUS;
    case 'eu':
      return calculateAQIIndexEU;
    default:
      return calculateAQIIndexUS;
  }
}

/*
  Less aggressive clustering + "spiderfying" nearby points.
  We override default MarkerClusterGroup settings so that:
   - Clusters form later (smaller radius).
   - At high zoom levels clustering is disabled.
   - Spiderfy is used instead of zoom-to-bounds on click.
*/
function createLooseClusterGroup(iconCreateFn) {
  return new L.MarkerClusterGroup({
    showCoverageOnHover: false,
    maxClusterRadius(zoom) {
      // Smaller radius → clusters form later; radius shrinks as zoom increases
      return Math.max(6, 20 - zoom * 3.2);
    },
    disableClusteringAtZoom: 18,
    spiderfyOnEveryZoom: false,
    spiderfyOnMaxZoom: true,
    spiderfyDistanceMultiplier: 1.8,
    zoomToBoundsOnClick: false, // we implement custom click handling
    spiderfyOnClick: false, // we handle spiderfy manually
    chunkedLoading: true, // performance boost for many markers
    chunkDelay: 30,
    chunkInterval: 200,
    removeOutsideVisibleBounds: true,
    iconCreateFunction: iconCreateFn,
  });
}

/* + Helpers for hover effect */

// Lightweight hover/touch highlight helpers
const IS_HOVERABLE =
  typeof window !== "undefined" &&
  window.matchMedia &&
  window.matchMedia("(hover: hover) and (pointer: fine)").matches;

const IS_TOUCH =
  typeof window !== "undefined" &&
  ("ontouchstart" in window || navigator.maxTouchPoints > 0);

// ensure marker icon DOM is always interactive and above spider legs
function ensureInteractiveIcon(marker) {
  const el = marker && marker._icon;
  if (!el) return;
  el.style.pointerEvents = "auto";
  el.style.zIndex = el.style.zIndex || "500000";
  el.classList.add("hoverable");
}

/**
 * Attach highlight handlers to a Leaflet marker.
 * Idempotent: if already attached, does nothing.
 *
 * - On desktop: toggles `.is-hovered` class on mouseover/out.
 * - On touch devices: flashes `.tap-highlight` briefly on tap.
 * - On (re)add: ensures the marker icon stays interactive.
 */
function attachHighlightHandlers(marker) {
  if (marker.__hoverBound) return; // prevent duplicate bindings
  marker.__hoverBound = true;

  const onOver = () => marker._icon && marker._icon.classList.add("is-hovered");
  const onOut  = () => marker._icon && marker._icon.classList.remove("is-hovered");
  marker.on("mouseover", onOver);
  marker.on("mouseout", onOut);

  // Ensure interactivity each time the marker is added back to the map
  const onAdd = () => ensureInteractiveIcon(marker);
  marker.on("add", onAdd);

  // Touch-specific "flash" effect
  const addTouchFlash = () => {
    if (!IS_TOUCH) return;
    marker.on("click", () => {
      const el = marker._icon;
      if (!el) return;
      el.classList.add("tap-highlight");
      setTimeout(() => el.classList.remove("tap-highlight"), 550);
    });
  };

  addTouchFlash();
  // Apply interactivity immediately if icon already exists
  ensureInteractiveIcon(marker);

  marker.__hoverHandlers = { onOver, onOut, onAdd };
}

// attach both highlight and micro-spiderfy to a marker in one call
function attachEnhancements(marker, map, layerGroup) {
  attachHighlightHandlers(marker);
  attachMicroSpiderfyHandlers(marker, map, layerGroup);
}

/* - Helpers for hover effect */

/* +++++ Mini-spiderfy (fan-out) helpers +++++++++++++++++++++++++++++++++++++ */

/**
 * Find markers that overlap with a given marker in screen space.
 * Checks distance in pixels between layer points to detect overlaps.
 */
function getOverlappingMarkers(map, marker, layerGroup, pxRadius = 24) {
  if (!map || !map.latLngToLayerPoint) return [];
  
  const p0 = map.latLngToLayerPoint(marker.getLatLng());
  if (!p0) return [];
  
  const pool = [];
  layerGroup?.eachLayer?.((x) => {
    if (x instanceof L.Marker && x._icon) pool.push(x);
  });

  const out = [];
  for (const m of pool) {
    if (m === marker) continue;
    const p = map.latLngToLayerPoint(m.getLatLng());
    if (!p) continue;
    const dx = p.x - p0.x;
    const dy = p.y - p0.y;
    if (Math.hypot(dx, dy) <= pxRadius) out.push(m);
  }
  return out;
}

/**
 * Fan out a group of overlapping markers around the anchor marker.
 * Applies temporary CSS transforms and raises z-index so each marker becomes targetable.
 */
function fanOutOverlapped(anchor, overlapped, radiusPx = 16) {
  anchor._fanOut = anchor._fanOut || { applied: false, items: [] };
  if (anchor._fanOut.applied) return;

  const all = [anchor, ...overlapped];
  const n = all.length;

  all.forEach((m, i) => {
    const ang = (i / n) * 2 * Math.PI;
    const dx = Math.cos(ang) * radiusPx;
    const dy = Math.sin(ang) * radiusPx;

    const el = m._icon;
    if (!el) return;
    const prevTransform = el.style.transform || "";
    const prevZ = el.style.zIndex || "";

    el.style.transform = `${prevTransform} translate(${dx}px, ${dy}px)`;
    el.style.zIndex = "400000";
    m.setZIndexOffset(2000);

    anchor._fanOut.items.push({ m, el, prevTransform, prevZ });
  });

  anchor._fanOut.applied = true;
}

/** Restore markers after fanOutOverlapped(...) */
function restoreOverlapped(anchor) {
  if (!anchor._fanOut || !anchor._fanOut.applied) return;
  for (const { m, el, prevTransform, prevZ } of anchor._fanOut.items) {
    if (el) {
      el.style.transform = prevTransform;
      el.style.zIndex = prevZ;
    }
    m.setZIndexOffset(0);
  }
  anchor._fanOut.items = [];
  anchor._fanOut.applied = false;
}

/**
 * Attach micro-spiderfy handlers to a marker.
 * Idempotent: binds only once per marker.
 *
 * - On mouseover: detect overlapping markers in the same layer and fan them out slightly.
 * - On mouseout: restore markers to their original positions.
 * - On touch click: temporarily fan out and restore after a short delay.
 * - On remove: cleanup (restore transforms/z-index).
 */
function attachMicroSpiderfyHandlers(marker, map, layerGroup) {
  if (!marker || marker.__microBound) return;
  marker.__microBound = true;

  marker.on("mouseover", () => {
    const overlaps = getOverlappingMarkers(map, marker, layerGroup, 24);
    if (overlaps.length) fanOutOverlapped(marker, overlaps, 16);
  });

  marker.on("mouseout", () => {
    restoreOverlapped(marker);
  });

  // Touch-friendly: do a short fan-out on tap/click
  marker.on("click", () => {
    if (!IS_TOUCH) return;
    const overlaps = getOverlappingMarkers(map, marker, layerGroup, 24);
    if (overlaps.length) {
      fanOutOverlapped(marker, overlaps, 16);
      setTimeout(() => restoreOverlapped(marker), 650);
    }
  });

  // Safety: when marker removed from map, ensure cleanup
  marker.on("remove", () => restoreOverlapped(marker));
}

/* ----- Mini-spiderfy helpers end ------------------------------------------ */

/**
 * Apply a deterministic "jitter" to coordinates based on a unique seed.
 *
 * Purpose:
 *   Sensors or markers located very close to each other often overlap visually on the map.
 *   This function slightly offsets each point (by up to ~`meters`) in a deterministic way
 *   so that nearby points become distinguishable without randomly "jumping" on reload.
 *
 * How it works:
 *   - Converts input lat/lng to numbers, safely handling invalid values.
 *   - Generates a pseudo-random but deterministic hash from the `seed` (e.g. sensor_id).
 *   - Uses that hash to pick an angle and a distance within the given radius (`meters`).
 *   - Converts the offset from meters to degrees, accounting for latitude distortion.
 *   - Returns a slightly shifted [lat, lng] that is stable for the same `seed`.
 *
 * @param {[number|string, number|string]} coords  Original [lat, lng] (may be strings).
 * @param {string|number} seed  Unique identifier (e.g. sensor_id) to ensure deterministic offset.
 * @param {number} [meters=15]  Maximum jitter radius in meters.
 * @returns {[number, number]}  Adjusted coordinates with jitter applied.
 */
function jitterCoord([latRaw, lngRaw], seed, meters = 15) {
  const lat0 = Number(latRaw);
  const lng0 = Number(lngRaw);

  // If lat/lng cannot be parsed as numbers, return as-is
  if (!Number.isFinite(lat0) || !Number.isFinite(lng0)) return [lat0, lng0];

  // Create a deterministic hash from the seed
  let h = 5381 >>> 0;
  const s = String(seed);
  for (let i = 0; i < s.length; i++) {
    h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  }

  // Generate repeatable pseudo-random values in [0, 1)
  const rnd01 = (x) => ((x >>> 0) % 1000) / 1000;

  // Pick jitter direction (angle) and distance
  const ang = rnd01(h) * 2 * Math.PI;
  const dist = rnd01(h ^ 0x9e3779b9) * meters;

  // Offset in meters
  const dx = Math.cos(ang) * dist;
  const dy = Math.sin(ang) * dist;

  // Convert meter offsets to degrees
  const dLat = dy / 111111; // ~111.1 km per degree latitude
  const cosLat = Math.cos((lat0 * Math.PI) / 180);
  const denom = 111111 * (Math.abs(cosLat) < 1e-6 ? 1e-6 : cosLat); // Avoid poles
  const dLng = dx / denom;

  const lat = lat0 + dLat;
  const lng = lng0 + dLng;

  // Only return jittered coords if valid numbers
  return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : [lat0, lng0];
}


export async function init(mapInstance, type, cb) {
  map = mapInstance;
  
  // Clean expired AQI cache entries on initialization
  aqiCache.cleanExpired();
  for (const index of Object.keys(messageTypes)) {
    try {
      messageIconType[index] = (
        await import(`../../assets/images/message/msg-${messageTypes[index]}.png`)
      ).default;
    } catch (error) {
      messageIconType[index] = (await import(`../../assets/images/message/msg-text.png`)).default;
    }
    messageIconName[messageTypes[index]] = messageIconType[index];
  }
  handlerClickMarker = (event) => {
    if (
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    ) {
      map.setActiveArea({
        position: "absolute",
        top: "90px",
        left: "0px",
        right: "0px",
        height: "20%",
      });
    } else {
      map.setActiveArea({
        position: "absolute",
        top: "0px",
        left: "0px",
        right: "50%",
        height: "100%",
      });
    }

    map.panTo(event.latlng);
    cb(event.target.options.data);
  };

  const scaleParams = getMeasurementByName(type);
  // Build range and colors strictly from zones
  const zones = scaleParams?.zones || [];
  const dynamicRange = zones
    .map((z) => (typeof z.valueMax === 'number' ? z.valueMax : undefined))
    .filter((v) => typeof v === 'number');
  
  // Convert CSS variables to actual colors by reading from computed styles
  const cssVarToColor = (cssVar) => {
    if (!cssVar.startsWith('var(--')) return cssVar;
    
    // Create a temporary element to get computed CSS variable value
    const tempEl = document.createElement('div');
    tempEl.style.color = cssVar;
    document.body.appendChild(tempEl);
    const computedColor = getComputedStyle(tempEl).color;
    document.body.removeChild(tempEl);
    
    // Convert rgb() to hex if needed
    if (computedColor.startsWith('rgb')) {
      const rgb = computedColor.match(/\d+/g);
      if (rgb && rgb.length >= 3) {
        const hex = '#' + rgb.map(x => {
          const hex = parseInt(x).toString(16);
          return hex.length === 1 ? '0' + hex : hex;
        }).join('');
        return hex;
      }
    }
    
    return computedColor || cssVar;
  };
  
  // Generate colors from zones, converting CSS vars to actual colors
  const dynamicColors = zones.map(z => cssVarToColor(z.color));
  
  scale = generate(dynamicColors, [0, ...dynamicRange]);

  markersLayer = createLooseClusterGroup(iconCreate);
  map.addLayer(markersLayer);

  // keep map draggable after animations/spiderfy
  // Safety: after zoom / spiderfy / any animation we make sure the map is draggable again
  let isEnsuringDraggable = false;
  const ensureMapDraggable = () => {
    if (isEnsuringDraggable) return; // Prevent recursion
    isEnsuringDraggable = true;
    
    try {
      // Simple, single timeout to avoid recursion
      setTimeout(() => {
        if (map) {
          if (!map.dragging.enabled()) {
      map.dragging.enable();
          }
          if (!map.scrollWheelZoom.enabled()) {
      map.scrollWheelZoom.enable();
          }
          if (map.boxZoom && !map.boxZoom.enabled()) {
            map.boxZoom.enable();
          }
          if (map.keyboard && !map.keyboard.enabled()) {
            map.keyboard.enable();
          }
        }
        isEnsuringDraggable = false;
      }, 50);
    } catch (error) {
      console.warn('Failed to re-enable map interactions:', error);
      isEnsuringDraggable = false;
    }
  };

  // Run once now (in case something disabled these before init)
  ensureMapDraggable();

  // Re-enable on common lifecycle events (avoid events that can cause recursion)
  map.on("zoomend", ensureMapDraggable);
  // Remove moveend and animationend to reduce potential conflicts
  // map.on("moveend", ensureMapDraggable);
  // map.on("animationend", ensureMapDraggable);
  
  // Prevent infinite recursion in panInsideBounds and setView
  let isPanningInsideBounds = false;
  let isSettingView = false;
  
  const originalPanInsideBounds = map.panInsideBounds;
  map.panInsideBounds = function(bounds, options) {
    if (isPanningInsideBounds) {
      console.warn('Prevented recursive panInsideBounds call');
      return this;
    }
    isPanningInsideBounds = true;
    try {
      const result = originalPanInsideBounds.call(this, bounds, options);
      return result;
    } finally {
      setTimeout(() => {
        isPanningInsideBounds = false;
      }, 100);
    }
  };
  
  const originalSetView = map.setView;
  map.setView = function(center, zoom, options) {
    if (isSettingView) {
      console.warn('Prevented recursive setView call');
      return this;
    }
    isSettingView = true;
    try {
      const result = originalSetView.call(this, center, zoom, options);
      return result;
    } finally {
      setTimeout(() => {
        isSettingView = false;
      }, 100);
    }
  };
  
  // MarkerCluster emits these on fan-out / collapse
  markersLayer.on("spiderfied", ensureMapDraggable);
  markersLayer.on("unspiderfied", ensureMapDraggable);
  // ---------------------------------------------------------------------------

  /**
   * Custom cluster click handling for sensor markers:
   * - If the map is still far away OR cluster has many children:
   *    → zoom in smoothly to the cluster bounds, then spiderfy.
   * - If already close:
   *    → spiderfy immediately without zooming.
   * 
   * This prevents "disappearing markers" and makes cluster expansion predictable.
   */
  markersLayer.on("clusterclick", (e) => {
    const cluster = e.layer;
    const nowZoom = map.getZoom();
    
    const targetZoom = map.getBoundsZoom(cluster.getBounds(), true);
    const MAX_SPIDER_CHILDREN = 20; // threshold for direct spiderfy
    const ZOOM_DELTA_THRESHOLD = 1; // minimum zoom difference to trigger zooming
    const PADDING = [40, 40]; // visual padding around zoomed cluster

    // if we are far enough OR the cluster has many children — zoom in first
    if ((targetZoom - nowZoom) >= ZOOM_DELTA_THRESHOLD || cluster.getChildCount() > MAX_SPIDER_CHILDREN) {
      e.originalEvent?.preventDefault?.();
      e.originalEvent?.stopPropagation?.();

      const onZoomEnd = () => {
        map.off("zoomend", onZoomEnd);
        // Cluster might dissolve after zoom; find visible parent
        const parent = markersLayer.getVisibleParent(cluster) || cluster;
        if (parent && typeof parent.spiderfy === "function") {
          try { parent.spiderfy(); } catch {}
        }
      };

      map.on("zoomend", onZoomEnd);
      // smooth zoom to the cluster bounds
      map.fitBounds(cluster.getBounds(), {
        padding: PADDING,
        animate: true,
        maxZoom: Math.min(targetZoom, 18),
      });
    } else {
      // if already close to the points — spiderfy immediately without changing zoom
      try { cluster.spiderfy(); } catch {}
    }
  });

  // When a cluster spiderfies, re-attach hover/micro-spiderfy to all exposed children
  markersLayer.on("spiderfied", (e) => {
    // e.markers is an array of child markers now visible around the cluster
    if (Array.isArray(e.markers)) {
      // сначала делаем иконки кликабельными и наверху, затем навешиваем обработчики (идемпотентно)
      e.markers.forEach((m) => {
        ensureInteractiveIcon(m);
        attachEnhancements(m, map, markersLayer);
      });
    }
  });


  pathsLayer = new L.layerGroup();
  map.addLayer(pathsLayer);
  moveLayer = new L.layerGroup();
  map.addLayer(moveLayer);

  // for (const type of Object.values(messageTypes)) {
  //   messagesLayers[type] = createLooseClusterGroup((cluster) => iconCreateMsg(cluster, type));
  // }
  for (const type of Object.values(messageTypes)) {
    const layer = createLooseClusterGroup((cluster) => iconCreateMsg(cluster, type));

    /**
     * Same hybrid cluster click logic applied to message layers:
     * - Zoom in + spiderfy if far or many children.
     * - Direct spiderfy if already close.
     */

    layer.on("clusterclick", (e) => {
      const cluster = e.layer;
      const nowZoom = map.getZoom();
      const targetZoom = map.getBoundsZoom(cluster.getBounds(), true);
      const MAX_SPIDER_CHILDREN = 20;
      const ZOOM_DELTA_THRESHOLD = 1;
      const PADDING = [40, 40];

      if ((targetZoom - nowZoom) >= ZOOM_DELTA_THRESHOLD || cluster.getChildCount() > MAX_SPIDER_CHILDREN) {
        e.originalEvent?.preventDefault?.();
        e.originalEvent?.stopPropagation?.();

        const onZoomEnd = () => {
          map.off("zoomend", onZoomEnd);
          const parent = layer.getVisibleParent(cluster) || cluster;
          if (parent && typeof parent.spiderfy === "function") {
            try { parent.spiderfy(); } catch {}
          }
        };

        map.on("zoomend", onZoomEnd);
        map.fitBounds(cluster.getBounds(), {
          padding: PADDING,
          animate: true,
          maxZoom: Math.min(targetZoom, 18),
        });
      } else {
        try { cluster.spiderfy(); } catch {}
      }
    });

    layer.on("spiderfied", ensureMapDraggable);
    layer.on("unspiderfied", ensureMapDraggable);

    layer.on("spiderfied", (e) => {
      if (Array.isArray(e.markers)) {
        e.markers.forEach((m) => {
          ensureInteractiveIcon(m);
          attachEnhancements(m, map, layer);
        });
      }
    });

    messagesLayers[type] = layer;
  }

  if (settings.SHOW_MESSAGES) {
    for (const messagesLayer of Object.values(messagesLayers)) {
      map.addLayer(messagesLayer);
    }
  }
}

export function isReadyLayers() {
  if (markersLayer && pathsLayer && moveLayer) {
    return true;
  }
  return false;
}

function iconCreate(cluster) {
  try {
  const markers = cluster.getAllChildMarkers();
  const childCount = cluster.getChildCount();
  let childCountCalc = 0;
  let sum = 0;
  const markersId = [];
    const unit = localStorage.getItem("currentUnit") ?? null;
    let winningColor = "#a1a1a1"; // default color
    
    
    
    // Early return if no markers
    if (childCount === 0 || markers.length === 0) {
      
      return new L.DivIcon({
        html: `<div class='marker-cluster-circle' style='color:#333;background-color: color-mix(in srgb, #a1a1a1 70%, transparent);border-color: #999;' data-children=""><span>${childCount}</span></div>`,
        className: "marker-cluster",
        iconSize: new L.Point(40, 40),
      });
    }
  
  
  
  

  


  // For AQI, use simplified logic - just use the first marker's color
  if (unit === 'aqi') {
    const mapStore = useMapStore();
    const currentDate = mapStore.currentDate;
    
    // Simple approach: use the first marker's color
    let clusterColor = "#a1a1a1"; // default gray
    
    for (const marker of markers) {
      const data = marker.options.data;
      if (data?.logs && data.logs.length > 0) {
        // Use cached AQI value if available
        let aqiValue;
        if (aqiCache.has(data.sensor_id, data.logs.length, currentDate)) {
          aqiValue = aqiCache.get(data.sensor_id, data.logs.length, currentDate);
          
        } else {
          // Check if logs have sufficient time coverage first
          if (!hasSufficientTimeCoverage(data.logs)) {
            // Don't calculate AQI for insufficient data
            continue;
          }
          
          const calculateAQIIndex = getAQICalculator(mapStore.aqiVersion);
          aqiValue = calculateAQIIndex(data.logs);
          // Only cache if we have a valid AQI value
          if (aqiValue !== null && aqiValue !== undefined) {
            aqiCache.set(data.sensor_id, data.logs.length, aqiValue, currentDate);
          }
        }
        if (aqiValue !== null) {
          clusterColor = getColorForValue(aqiValue, 'aqi', data);
          
          break; // Use first valid color
        }
      } else {
        // No logs yet — try latest cached AQI by sensorId for immediate color
        const latest = aqiCache.getLatestBySensorId(data.sensor_id, currentDate);
        if (latest !== null) {
          const zones = mapStore.aqiVersion === 'eu' ? 
            aqiEUZones : 
            aqiUSZones;
          const match = zones.find((i) => latest <= i?.valueMax);
          if (match) {
            clusterColor = match.color;
            
            break;
          } else if (zones.length > 0 && !zones[zones.length - 1]?.valueMax) {
            clusterColor = zones[zones.length - 1].color;
            
            break;
          }
        }
      }
      markersId.push(data._id);
    }
    
    // Convert color to RGB for border calculation
    let colorBorder = "#999";
    let isDark = false;
    
    if (clusterColor && clusterColor !== "#a1a1a1") {
      const tempEl = document.createElement('div');
      tempEl.style.color = clusterColor;
      document.body.appendChild(tempEl);
      const computedColor = getComputedStyle(tempEl).color;
      document.body.removeChild(tempEl);
      
      if (computedColor.startsWith('rgb')) {
        const rgb = computedColor.match(/\d+/g);
        if (rgb && rgb.length >= 3) {
          const r = parseInt(rgb[0]);
          const g = parseInt(rgb[1]);
          const b = parseInt(rgb[2]);
          colorBorder = `rgb(${Math.max(0, r - 30)}, ${Math.max(0, g - 30)}, ${Math.max(0, b - 30)})`;
          isDark = (r * 0.299 + g * 0.587 + b * 0.114) < 128;
        }
      }
    }
    
    
    return new L.DivIcon({
      html: `<div class='marker-cluster-circle' style='color:${
        isDark ? "#eee" : "#333"
      };background-color: color-mix(in srgb, ${clusterColor} 70%, transparent);border-color: ${colorBorder};' data-children="${markersId}"><span>${childCount}</span></div>`,
      className: "marker-cluster",
      iconSize: new L.Point(40, 40),
    });
  } else {
    // Regular measurement handling - count zones instead of averaging
    const zoneCounts = new Map(); // zone color -> count
    
    // Sort markers by sensor_id for consistent results across zooms
    const sortedMarkers = [...markers].sort((a, b) => {
      const idA = a.options.data?.sensor_id || '';
      const idB = b.options.data?.sensor_id || '';
      return idA.localeCompare(idB);
    });
    
    sortedMarkers.forEach((marker) => {
      // Skip markers without data
      if (marker.options.data.value === undefined || marker.options.data.value === "") {
      return;
    }

    markersId.push(marker.options.data._id);

    childCountCalc++;
      const value = marker.options.data.value;

      
      // Get color for this marker's value using unified method
      const markerColor = getColorForValue(value, unit, marker.options.data);
      
      // Count this zone
      zoneCounts.set(markerColor, (zoneCounts.get(markerColor) || 0) + 1);
    });
    
    // Find the winning zone (most common color)
    let maxCount = 0;
    for (const [color, count] of zoneCounts) {
      if (count > maxCount) {
        maxCount = count;
        winningColor = color;
      }
    }
  }
  
  // For regular measurements, use the winning zone color
  let color = "#a1a1a1"; // default color
  let colorBorder = "#999";
  let isDark = false;
  
  if (unit && unit !== 'aqi' && childCountCalc > 0) {
    // Use the winning color from zone counting
    color = winningColor;
    
    // Convert color to RGB for border calculation
    const tempEl = document.createElement('div');
    tempEl.style.color = color;
    document.body.appendChild(tempEl);
    const computedColor = getComputedStyle(tempEl).color;
    document.body.removeChild(tempEl);
    
    if (computedColor.startsWith('rgb')) {
      const rgb = computedColor.match(/\d+/g);
      if (rgb && rgb.length >= 3) {
        const r = parseInt(rgb[0]);
        const g = parseInt(rgb[1]);
        const b = parseInt(rgb[2]);
        colorBorder = `rgb(${Math.max(0, r - 30)}, ${Math.max(0, g - 30)}, ${Math.max(0, b - 30)})`;
        isDark = (r * 0.299 + g * 0.587 + b * 0.114) < 128;
      }
    }
  } else if (unit === 'aqi') {
    // This should not happen as AQI is handled above, but just in case
    color = "#a1a1a1";
    colorBorder = "#999";
  }


  return new L.DivIcon({
    html: `<div class='marker-cluster-circle' style='color:${
      isDark ? "#eee" : "#333"
    };background-color: color-mix(in srgb, ${color} 70%, transparent);border-color: ${colorBorder};' data-children="${markersId}"><span>${childCount}</span></div>`,
    className: "marker-cluster",
    iconSize: new L.Point(40, 40),
  });
  } catch (error) {
    console.error(`iconCreate error: ${error.message}`, error);
    // Return default cluster on error
    return new L.DivIcon({
      html: `<div class='marker-cluster-circle' style='color:#333;background-color: color-mix(in srgb, #a1a1a1 70%, transparent);border-color: #999;' data-children=""><span>${cluster.getChildCount()}</span></div>`,
    className: "marker-cluster",
    iconSize: new L.Point(40, 40),
  });
  }
}

function iconCreateMsg(cluster, type = "text") {
  const childCount = cluster.getChildCount();
  return new L.DivIcon({
    html: `<div class="marker-cluster-msg" style='background-image: url(${messageIconName[type]});'><span class='count-${type}'>${childCount}</span></div>`,
    className: "marker-cluster",
    iconSize: new L.Point(40, 40),
  });
}

function findMarker(sensor_id) {
  return new Promise((resolve) => {
    if (markersLayer) {
      let found = false;
      markersLayer.eachLayer((m) => {
        if (!found && m.options.data.sensor_id === sensor_id) {
          found = m;
        }
      });
      if (found) return resolve(found);
    }
    resolve(false);
  });
}

function findMarkerMoved(sensor_id) {
  return new Promise((resolve) => {
    if (moveLayer) {
      let found = false;
      moveLayer.eachLayer((m) => {
        if (!found && m.options.data.sensor_id === sensor_id) {
          found = m;
        }
      });
      if (found) return resolve(found);
    }
    resolve(false);
  });
}

function createIconBrand(sensor_id, colorRgb) {
  return L.divIcon({
    html: `<img src="${sensors[sensor_id].icon}" alt="" class="marker-icon-brand" style="border: 3px solid rgba(${colorRgb}, 0.7);">`,
    iconSize: [40, 40],
    className: "marker-icon",
  });
}

function createIconMsg(type = 0) {
  return L.divIcon({
    html: `<img src="${messageIconType[type]}" alt="" class="marker-icon-msg">`,
    iconSize: [40, 40],
    className: "marker-icon",
  });
}

function createIconArrow(dir, speed, color) {
  return L.divIcon({
    className: "",
    html: `<div class="icon-arrow-container" style="transform: rotate(${dir + 90}deg);">
      <div class="icon-arrow" style="border-color: ${color} ${color} transparent transparent;">
        <div style="background-color: ${color};"></div>
      </div>
      <div class="label-arrow">${speed} m/s</div>
    </div>`,
    iconSize: new L.Point(40, 40),
  });
}

function iconCreateCircle(colors, isBookmarked, id) {
  return new L.DivIcon({
    html: `<div data-id="${id ?? ""}" class='marker-cluster-circle ${isBookmarked ? "sensor-bookmarked" : ""}' style='color:${colors.border};background-color: ${colors.basic};border-color: ${colors.border};'></div>`,
    className: "marker-cluster",
    iconSize: new L.Point(40, 40),
  });
}


function createMarkerBrand(coord, data, colors) {
  return L.marker(new L.LatLng(coord[0], coord[1]), {
    icon: createIconBrand(data.sensor_id, colors.rgb),
    data: data,
    typeMarker: "brand",
  });
}

function createMarkerArrow(coord, data, colors) {
  return L.marker(new L.LatLng(coord[0], coord[1]), {
    icon: createIconArrow(data.data.windang, data.data.windspeed, colors.basic),
    data: data,
    typeMarker: "arrow",
  });
}

function createMarkerCircle(coord, data, colors) {
  return L.marker(new L.LatLng(coord[0], coord[1]), {
    icon: iconCreateCircle(colors, data.isBookmarked, data.sensor_id),
    data: data,
    typeMarker: "circle",
  });
}

function createMarkerUser(coord, data) {
  return L.marker(new L.LatLng(coord[0], coord[1]), {
    icon: createIconMsg(data.measurement?.type || 0),
    data: data,
    typeMarker: "msg",
  });
}

function createMarker(point, colors) {
  // применяем «jitter» для визуального разведения близких точек
  const coord = jitterCoord([point.geo.lat, point.geo.lng], point.sensor_id);
  let marker;
  if (sensors[point.sensor_id] && sensors[point.sensor_id].icon) {
    marker = createMarkerBrand(coord, point, colors);
  } else if (point.data.windang) {
    marker = createMarkerArrow(coord, point, colors);
  } else if (point.model === 4) {
    marker = createMarkerUser(coord, point);
  } else {
    marker = createMarkerCircle(coord, point, colors);
  }
  return marker;
}

function updateMarker(marker, point, colors) {
  // Update marker data first
  marker.options.data = point;
  
  // Recalculate colors for AQI if needed
  if (localStorage.getItem("currentUnit") === 'aqi' && !point.isEmpty) {
    const color = markercolor(point.value, point);
    colors.basic = "color-mix(in srgb, " + color + " 70%, transparent)";
    colors.border = "color-mix(in srgb, " + colors.basic + ", #000 10%)";
  }
  
  if (marker.options.typeMarker === "brand") {
    marker.setIcon(createIconBrand(point.sensor_id, colors.rgb));
  } else if (
    marker.options.typeMarker === "arrow" &&
    Object.prototype.hasOwnProperty.call(point.data, "windang")
  ) {
    marker.setIcon(createIconArrow(point.data.windang, point.data.windspeed, colors.basic));
  } else {
    marker.setIcon(iconCreateCircle(colors, point.isBookmarked, point.sensor_id));
  }
  if (point.model === 3) {
    const coord = jitterCoord([point.geo.lat, point.geo.lng], point.sensor_id);
    marker.setLatLng(new L.LatLng(coord[0], coord[1]));
  }
}

export async function addPoint(point) {
  queue.add(makeRequest.bind(queue, point));
  async function makeRequest(point) {
    try {
      if (point.model === 1) {
        // Handle model 1 if needed
      } else if (point.model === 2) {
        await addMarker(point);
      } else if (point.model === 3) {
        await addMarker(point);
        await addPointPath(point);
      } else if (point.model === 4) {
        await addMarkerUser(point);
      }
    } catch (error) {
      // Handle error silently
    }
    this.next();
  }
}

// Cache for points data with localStorage and TTL based on date
const POINTS_CACHE_PREFIX = 'points_cache_';
const POINTS_CACHE_TTL = 3600; // 1 hour in seconds

// Helper function to get points cache key for a specific date
function getPointsCacheKey(date) {
  return `${POINTS_CACHE_PREFIX}${date}`;
}

// Helper function to check if date is today
function isToday(dateString) {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
  return dateString === today;
}

// Helper function to check if logs have sufficient time coverage (≥2 hours)
function hasSufficientTimeCoverage(logs) {
  if (!Array.isArray(logs) || logs.length < 2) {
    return false;
  }
  
  // Get timestamps and sort them
  const timestamps = logs
    .map(log => log.timestamp)
    .filter(ts => Number.isFinite(ts))
    .sort((a, b) => a - b);
  
  if (timestamps.length < 2) {
    return false;
  }
  
  // Check time span between first and last log
  const firstLog = timestamps[0];
  const lastLog = timestamps[timestamps.length - 1];
  const timeSpanHours = (lastLog - firstLog) / 3600; // Convert seconds to hours
  
  return timeSpanHours >= 2;
}

// Points Cache with localStorage and simple TTL logic
const pointsCache = {
  // Save full sensor data for specific date
  set(date, sensors, permanent = false) {
    try {
      if (!date || !Array.isArray(sensors)) {
        return;
      }
      
      const cacheKey = getPointsCacheKey(date);
      const cacheData = {
        sensors: sensors,
        timestamp: Math.floor(Date.now() / 1000),
        date: date,
        permanent: permanent // true = бессрочный, false = TTL 1 час
      };
      
      localStorage.setItem(cacheKey, JSON.stringify(cacheData));
    } catch (error) {
      console.warn('Points cache set error:', error);
    }
  },
  
  // Get full sensor data for specific date
  get(date) {
    try {
      if (!date) {
        return null;
      }
      
      const cacheKey = getPointsCacheKey(date);
      const cached = localStorage.getItem(cacheKey);
      
      if (!cached) {
        return null;
      }
      
      const cacheData = JSON.parse(cached);
      
      // If cache is marked as permanent, return immediately
      if (cacheData.permanent === true) {
        return cacheData.sensors;
      }
      
      // For non-permanent cache, check TTL (1 hour)
      const now = Math.floor(Date.now() / 1000);
      if (now - cacheData.timestamp > POINTS_CACHE_TTL) {
        // Remove expired cache
        localStorage.removeItem(cacheKey);
        return null;
      }
      
      return cacheData.sensors;
    } catch (error) {
      console.warn('Points cache get error:', error);
      return null;
    }
  },
  
  // Check if cache exists for specific date
  has(date) {
    return this.get(date) !== null;
  },
  
  // Clear cache for specific date
  clear(date) {
    try {
      if (date) {
        const cacheKey = getPointsCacheKey(date);
        localStorage.removeItem(cacheKey);
    } else {
        // Clear all points caches if no date specified
        const keys = Object.keys(localStorage);
        keys.forEach(key => {
          if (key.startsWith(POINTS_CACHE_PREFIX)) {
            localStorage.removeItem(key);
          }
        });
      }
    } catch (error) {
      console.warn('Points cache clear error:', error);
    }
  }
};

// AQI Cache with localStorage and TTL based on date
const aqiCache = {
  // Get cached AQI value for specific date
  get(sensorId, logsLength, date) {
    try {
      if (!date) return null;
      
      const cacheKey = getCacheKey(date);
      const sensorCacheKey = `${sensorId}_${logsLength}`;
      const cached = localStorage.getItem(cacheKey);
      
      if (!cached) {
        return null;
      }
      
      const cacheData = JSON.parse(cached);
      const item = cacheData[sensorCacheKey];
      
      if (!item) {
        return null;
      }
      
      // For past dates, cache is permanent (no TTL check)
      if (!isToday(date)) {
        return item.aqiValue;
      }
      
      // For today's date, check TTL
      const now = Math.floor(Date.now() / 1000);
      if (now - item.timestamp > AQI_CACHE_TTL) {
        // Remove expired item
        delete cacheData[sensorCacheKey];
        localStorage.setItem(cacheKey, JSON.stringify(cacheData));
        return null;
      }
      
      return item.aqiValue;
    } catch (error) {
      console.warn('AQI cache get error:', error);
      return null;
    }
  },

  // Set cached AQI value for specific date
  set(sensorId, logsLength, aqiValue, date) {
    try {
      if (!date) return;
      
      const cacheKey = getCacheKey(date);
      const sensorCacheKey = `${sensorId}_${logsLength}`;
      const cached = localStorage.getItem(cacheKey);
      let cacheData = cached ? JSON.parse(cached) : {};
      
      cacheData[sensorCacheKey] = {
        aqiValue: aqiValue,
        timestamp: Math.floor(Date.now() / 1000),
        date: date,
        isToday: isToday(date)
      };
      
      localStorage.setItem(cacheKey, JSON.stringify(cacheData));
    } catch (error) {
      console.warn('AQI cache set error:', error);
    }
  },
  
  // Check if cache has value for specific date
  has(sensorId, logsLength, date) {
    return this.get(sensorId, logsLength, date) !== null;
  },
  
  // Clear cache for specific date
  clear(date) {
    try {
      if (date) {
        const cacheKey = getCacheKey(date);
        localStorage.removeItem(cacheKey);
      } else {
        // Clear all AQI caches if no date specified
        const keys = Object.keys(localStorage);
        keys.forEach(key => {
          if (key.startsWith(AQI_CACHE_PREFIX)) {
            localStorage.removeItem(key);
          }
        });
      }
    } catch (error) {
      console.warn('AQI cache clear error:', error);
    }
  },
  
  // Clean expired entries (only for today's caches)
  cleanExpired() {
    try {
      const today = new Date().toISOString().split('T')[0];
      const cacheKey = getCacheKey(today);
      const cached = localStorage.getItem(cacheKey);
      
      if (!cached) return;
      
      const cacheData = JSON.parse(cached);
      const now = Math.floor(Date.now() / 1000);
      let hasChanges = false;
      
      for (const key in cacheData) {
        const item = cacheData[key];
        if (now - item.timestamp > AQI_CACHE_TTL) {
          delete cacheData[key];
          hasChanges = true;
        }
      }
      
      if (hasChanges) {
        localStorage.setItem(cacheKey, JSON.stringify(cacheData));
      }
    } catch (error) {
      console.warn('AQI cache clean error:', error);
    }
  },
  
  // Get the latest valid AQI value for a sensorId regardless of logs length for specific date
  getLatestBySensorId(sensorId, date) {
    try {
      if (!date) return null;
      
      const cacheKey = getCacheKey(date);
      const cached = localStorage.getItem(cacheKey);
      if (!cached) return null;
      
      const cacheData = JSON.parse(cached);
      const now = Math.floor(Date.now() / 1000);
      let best = null;
      let bestTs = -1;
      const prefix = `${sensorId}_`;
      
      for (const key in cacheData) {
        if (!key.startsWith(prefix)) continue;
        const item = cacheData[key];
        if (!item || typeof item.timestamp !== 'number') continue;
        
        // For past dates, no TTL check
        if (!isToday(date)) {
          if (item.timestamp > bestTs) {
            best = item;
            bestTs = item.timestamp;
          }
        } else {
          // For today's date, check TTL
          if (now - item.timestamp <= AQI_CACHE_TTL && item.timestamp > bestTs) {
            best = item;
            bestTs = item.timestamp;
          }
        }
      }
      
      return best ? best.aqiValue ?? null : null;
    } catch (error) {
      console.warn('AQI cache getLatestBySensorId error:', error);
      return null;
    }
  }
};


/**
 * Universal color calculation method for both individual markers and clusters
 * @param {number|null} value - The value to get color for
 * @param {string} unit - The measurement unit (pm10, pm25, temperature, etc.)
 * @param {Object} point - The point data (for AQI calculation)
 * @returns {string} - The color for the value
 */
function getColorForValue(value, unit, point = null) {
  
  // Handle AQI calculation with localStorage caching
  if (unit === 'aqi' && point) {
    const mapStore = useMapStore();
    const currentDate = mapStore.currentDate;
    
    // If logs are present, prefer precise cache by logs length; otherwise use latest by sensorId
    if (point.logs && aqiCache.has(point.sensor_id, point.logs.length, currentDate)) {
      const aqiValue = aqiCache.get(point.sensor_id, point.logs.length, currentDate);
      if (aqiValue !== null) {
        const zones = mapStore.aqiVersion === 'eu' ? 
          aqiEUZones : 
          aqiUSZones;
        
        
        const match = zones.find((i) => aqiValue <= i?.valueMax);
        if (match) {
          return match.color;
        }
        if (zones.length > 0 && !zones[zones.length - 1]?.valueMax) {
          return zones[zones.length - 1].color;
        }
      }
    }

    // If no logs yet or no cache hit for logs-length — try latest by sensorId
    if (!point.logs || !Array.isArray(point.logs) || point.logs.length === 0) {
      const latest = aqiCache.getLatestBySensorId(point.sensor_id, currentDate);
      if (latest !== null) {
        const zones = mapStore.aqiVersion === 'eu' ? 
          aqiEUZones : 
          aqiUSZones;
        const match = zones.find((i) => latest <= i?.valueMax);
        if (match) return match.color;
        if (zones.length > 0 && !zones[zones.length - 1]?.valueMax) return zones[zones.length - 1].color;
      }
    }

    // If logs exist but no cache — calculate, store, and return
    if (point.logs && Array.isArray(point.logs) && point.logs.length > 0) {
      try {
        // Check if logs have sufficient time coverage first
        if (!hasSufficientTimeCoverage(point.logs)) {
          return "#a1a1a1"; // Return gray for insufficient data
        }
        
        const calculateAQIIndex = getAQICalculator(mapStore.aqiVersion);
        const aqiValue = calculateAQIIndex(point.logs);
        
        // Only cache if we have a valid AQI value
        if (aqiValue !== null && aqiValue !== undefined) {
          aqiCache.set(point.sensor_id, point.logs.length, aqiValue, currentDate);
          
          const zones = mapStore.aqiVersion === 'eu' ? 
            aqiEUZones : 
            aqiUSZones;
          const match = zones.find((i) => aqiValue <= i?.valueMax);
          if (match) {
            return match.color;
          }
          if (zones.length > 0 && !zones[zones.length - 1]?.valueMax) {
            return zones[zones.length - 1].color;
          }
        }
      } catch (error) {
        console.error(`Error calculating AQI for ${point.sensor_id}:`, error);
      }
    }

    // If no cache and no logs, try to calculate from current PM data
    if (point.data) {
      try {
        const pm25 = point.data.pm25 || point.data.pm2_5;
        const pm10 = point.data.pm10;
        
        console.log(`Marker point data:`, {
          sensor_id: point.sensor_id,
          pointData: point.data,
          pm25,
          pm10
        });
        
        // Calculate AQI from PM values using the selected version's logic
        let aqiValue = null;
        
        // Calculate AQI from PM values using the appropriate version
        const aqiFromConcFunction = mapStore.aqiVersion === 'eu' ? aqiFromConcEU : aqiFromConc;
        const aqiPM25 = pm25 !== null && pm25 !== undefined ? aqiFromConcFunction(pm25, 'pm25') : null;
        const aqiPM10 = pm10 !== null && pm10 !== undefined ? aqiFromConcFunction(pm10, 'pm10') : null;
        aqiValue = aqiPM25 !== null || aqiPM10 !== null ? Math.round(Math.max(aqiPM25 || 0, aqiPM10 || 0)) : null;
        
        
        if (aqiValue !== null && aqiValue !== undefined) {
          // Cache the calculated value
          aqiCache.set(point.sensor_id, 0, aqiValue, currentDate); // Use 0 as logs length for simple calculation
          
          // Use appropriate zones based on version
          const zones = mapStore.aqiVersion === 'eu' ? 
            aqiEUZones : 
            aqiUSZones;
            
          const match = zones.find((i) => aqiValue <= i?.valueMax);
          if (match) return match.color;
          if (zones.length > 0 && !zones[zones.length - 1]?.valueMax) return zones[zones.length - 1].color;
        }
      } catch (_) {}
    }

    return "#a1a1a1";
  }
  else if (unit === 'aqi') {
    return "#a1a1a1";
  }
  
  // Regular measurement handling
  if (value === null || value === undefined || isNaN(value)) {
    return "#a1a1a1"; // Default color for no data
  }
  
  const scaleParams = getMeasurementByName(unit);
  const zones = scaleParams?.zones || [];
  if (unit && zones.length > 0) {
    const match = zones.find((i) => value <= i?.valueMax);
    if (match) {
      return match.color;
    } else if (!zones[zones.length - 1]?.valueMax) {
      return zones[zones.length - 1].color;
    }
  }

  return "#a1a1a1"; // Default color
}

function markercolor(value, point = null) {
  const unit = localStorage.getItem("currentUnit") ?? null;
  
  if (unit === 'aqi') {
    
  }
  return getColorForValue(value, unit, point);
}

async function addMarker(point) {
  // пропускаем датчики с «нулевой» геопозицией
  const tolerance = 0.001;
  const lat = Number(point.geo.lat);
  const lng = Number(point.geo.lng);
  if (Math.abs(lat) < tolerance && Math.abs(lng) < tolerance) {
    return;
  }

  const colors = {
    basic: "#a1a1a1",
    border: "#999",
    rgb: [161, 161, 161],
  };
  if (!point.isEmpty) {
    // For AQI, we need to pass the full point object with logs
    
    const color = markercolor(point.value, point);
    colors.basic = "color-mix(in srgb, " + color + " 70%, transparent)";
    colors.border = "color-mix(in srgb, " + colors.basic + ", #000 10%)";
  } else {
    // Even without logs, if current unit is AQI and cache has a recent value, color immediately
    const unit = localStorage.getItem("currentUnit") ?? null;
    if (unit === 'aqi') {
      const colorImmediate = markercolor(point.value, point);
      if (colorImmediate && colorImmediate !== "#a1a1a1") {
        colors.basic = "color-mix(in srgb, " + colorImmediate + " 70%, transparent)";
        colors.border = "color-mix(in srgb, " + colors.basic + ", #000 10%)";
      }
    }
  }
  const marker = await findMarker(point.sensor_id);
  if (!marker) {
    const m = createMarker(point, colors);
    m.on("click", handlerClickMarker);

    attachEnhancements(m, map, markersLayer);

    if (markersLayer) {
      markersLayer.addLayer(m);
    }
    } else {
    // Always update existing marker, even if empty
    // Recalculate colors for AQI if needed
    if (localStorage.getItem("currentUnit") === 'aqi') {
      const color = markercolor(point.value, point);
      if (color && color !== "#a1a1a1") {
        colors.basic = "color-mix(in srgb, " + color + " 70%, transparent)";
        colors.border = "color-mix(in srgb, " + colors.basic + ", #000 10%)";
      }
    }
    updateMarker(marker, point, colors);
  }
}

export async function moveMarkerTime(sensor_id, point, stop = false) {
  let marker;
  if (stop) {
    marker = await findMarkerMoved(sensor_id);
    if (marker && moveLayer && markersLayer) {
      moveLayer.removeLayer(marker);
      markersLayer.addLayer(marker);
    }
  } else {
    marker = await findMarker(sensor_id);
    if (marker && moveLayer && markersLayer) {
      markersLayer.removeLayer(marker);
      moveLayer.addLayer(marker);
    } else {
      marker = await findMarkerMoved(sensor_id);
    }
  }

  if (marker) {
    const coord = jitterCoord([point.geo.lat, point.geo.lng], sensor_id);
    marker.setLatLng(new L.LatLng(coord[0], coord[1]));
  }
}

const paths = {};
export async function addPointPath(point) {
  const color = point.isEmpty ? "#bb4506" : getColor(scale, point.value);
  const coord = [point.geo.lat, point.geo.lng];

  const path = paths[point.sensor_id] || null;
  if (path) {
    const points = path.getLatLngs();
    if (
      points[points.length - 1].lat === Number(coord[0]) &&
      points[points.length - 1].lng === Number(coord[1])
    ) {
      return;
    }

    if (points.length === 1) {
      path
        .arrowheads({
          yawn: 30,
          fill: true,
          frequency: "allvertices",
          size: "15px",
        })
        .setStyle({
          color: color,
        })
        .addLatLng(coord);
    } else {
      path
        .setStyle({
          color: color,
        })
        .addLatLng(coord);
    }
  } else {
    const polyline = L.polyline([coord], {
      color: color,
      weight: 2,
      opacity: 0.8,
      data: point,
    });
    paths[point.sensor_id] = polyline;
  }
}

export async function showPath(sensor_id) {
  const path = paths[sensor_id] || null;
  if (path && pathsLayer) {
    pathsLayer.addLayer(path);
  }
}

export async function hidePath(sensor_id) {
  const path = paths[sensor_id] || null;
  if (path && pathsLayer && pathsLayer.hasLayer(path)) {
    pathsLayer.removeLayer(path);
  }
}

async function addMarkerUser(point) {
  // пропускаем «нулевые» координаты
  const tolerance = 0.001;
  const lat = Number(point.geo.lat);
  const lng = Number(point.geo.lng);
  if (Math.abs(lat) < tolerance && Math.abs(lng) < tolerance) {
    return;
  }

  const colors = {
    basic: "#f99981",
    border: "#999",
    rgb: [161, 161, 161],
  };
  const marker = await findMarker(point.sensor_id);
  if (!marker) {
    const m = createMarker(point, colors);
    m.on("click", handlerClickMarker);

    // figure out the layer where this user marker will live
    const layer =
      point.measurement &&
      messageTypes[point.measurement.type] &&
      messagesLayers[messageTypes[point.measurement.type]]
        ? messagesLayers[messageTypes[point.measurement.type]]
        : null;

    attachEnhancements(m, map, layer || markersLayer);

    if (
      point.measurement &&
      messageTypes[point.measurement.type] &&
      messagesLayers[messageTypes[point.measurement.type]]
    ) {
      messagesLayers[messageTypes[point.measurement.type]].addLayer(m);
    }
  }
}

export function clear() {
  if (markersLayer) {
    markersLayer.clearLayers();
  }
  if (pathsLayer) {
    pathsLayer.clearLayers();
  }
  for (const messagesLayer of Object.values(messagesLayers)) {
    if (messagesLayer) {
      messagesLayer.clearLayers();
    }
  }
}

export function switchMessagesLayer(map, enabled = false) {
  for (const messagesLayer of Object.values(messagesLayers)) {
    if (messagesLayer) {
      if (enabled) {
        map.addLayer(messagesLayer);
      } else {
        map.removeLayer(messagesLayer);
      }
    }
  }
}

export function refreshClusters() {
  if (markersLayer) {
    markersLayer.refreshClusters();
  }
}

// Export cache management functions
export { aqiCache, pointsCache };
export function clearAQICache(date = null) {
  aqiCache.clear(date);
}
export function clearPointsCache(date = null) {
  pointsCache.clear(date);
}

export function cleanExpiredAQICache() {
  aqiCache.cleanExpired();
}

// Function to set all markers to gray color (loading state)
export function setAllMarkersGray() {
  if (!markersLayer) return;
  
  const grayColors = {
    basic: "#a1a1a1",
    border: "#999",
    rgb: [161, 161, 161],
  };
  
  // Update all markers in the layer
  markersLayer.eachLayer((layer) => {
    if (layer.options.typeMarker === "brand") {
      layer.setIcon(createIconBrand(layer.options.data.sensor_id, grayColors.rgb));
    } else if (layer.options.typeMarker === "arrow") {
      layer.setIcon(createIconArrow(0, 0, grayColors.basic));
    } else if (layer.options.typeMarker === "circle") {
      layer.setIcon(iconCreateCircle(grayColors, false, layer.options.data.sensor_id));
    }
  });
  
  // Refresh clusters to update their colors
  refreshClusters();
}