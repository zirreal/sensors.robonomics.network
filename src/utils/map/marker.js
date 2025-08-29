// src/utils/map/marker.js

import { settings, sensors } from "@config";
import Queue from "js-queue";
import L from "leaflet";
import "leaflet-arrowheads";
import "leaflet.markercluster";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import { getMeasurementByName } from "../../measurements/tools";
import generate, { getColor, getColorDarkenRGB, getColorRGB } from "../../utils/color";

import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

import measurements from "../../measurements";

const queue = new Queue();
let scale;
let markersLayer;
let pathsLayer;
let moveLayer;
let handlerClickMarker;

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
  // Make sure the marker receives hover/click events
  el.style.pointerEvents = "auto";
  // Raise z-index to avoid spider legs or cluster SVG paths intercepting mouse events
  el.style.zIndex = el.style.zIndex || "500000";
  // Add a helper CSS class (optional for styling/debugging)
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
  /// Apply interactivity immediately if icon already exists
  ensureInteractiveIcon(marker);

  // Keep references for debugging if needed
  marker.__hoverHandlers = { onOver, onOut, onAdd };
}

// attach both highlight and micro-spiderfy to a marker in one call
function attachEnhancements(marker, map, layerGroup) {
  attachHighlightHandlers(marker);
  attachMicroSpiderfyHandlers(marker, map, layerGroup);
}

/* - Helpers for hover effect */

/* +++++ Mini‑spiderfy (fan-out) helpers +++++++++++++++++++++++++++++++++++++ */

/**
 * Find markers that overlap with a given marker in screen space.
 * Checks distance in pixels between layer points to detect overlaps.
 */
function getOverlappingMarkers(map, marker, layerGroup, pxRadius = 24) {
  const p0 = map.latLngToLayerPoint(marker.getLatLng());
  const pool = [];
  layerGroup?.eachLayer?.((x) => {
    if (x instanceof L.Marker && x._icon) pool.push(x);
  });

  const out = [];
  for (const m of pool) {
    if (m === marker) continue;
    const p = map.latLngToLayerPoint(m.getLatLng());
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

/* ----- Mini‑spiderfy helpers end ------------------------------------------ */

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


export async function init(map, type, cb) {
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
  scale = generate(scaleParams.colors, scaleParams.range);

  markersLayer = createLooseClusterGroup(iconCreate);
  map.addLayer(markersLayer);

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
  const markers = cluster.getAllChildMarkers();
  const childCount = cluster.getChildCount();
  let childCountCalc = 0;
  let sum = 0;
  const markersId = [];

  markers.forEach((marker) => {
    if (marker.options.data.value === undefined && marker.options.data.value !== "") {
      return;
    }

    markersId.push(marker.options.data._id);

    childCountCalc++;
    sum += Number(marker.options.data.value);
  });
  if (childCountCalc > 0) {
    sum = sum / childCountCalc;
  }
  const color = getColorRGB(scale, sum);
  const colorBorder = getColorDarkenRGB(scale, sum);
  const isDark = scale(sum).luminance() < 0.4;

  return new L.DivIcon({
    html: `<div class='marker-cluster-circle' style='color:${
      isDark ? "#eee" : "#333"
    };background-color: rgba(${color}, 0.7);border-color: rgba(${colorBorder}, 1);' data-children="${markersId}"><span>${childCount}</span></div>`,
    className: "marker-cluster",
    iconSize: new L.Point(40, 40),
  });
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
  if (point.sensor_id === "ab9de1c7a82d9b193fd9f169d8af1b64ce4f7b391d9f50f9ac127a49615a9693") {
    console.log("GRAY PM10", point);
  }

  if (point.sensor_id === "3eb468d90d6640bcef0b0b792a947d05bcc4da1b11316b283dda59e79336fdaa") {
    console.log("GREEN PM10", point);
  }

  queue.add(makeRequest.bind(queue, point));
  async function makeRequest(point) {
    try {
      if (point.model === 1) {
        console.log(point);
      } else if (point.model === 2) {
        await addMarker(point);
      } else if (point.model === 3) {
        await addMarker(point);
        await addPointPath(point);
      } else if (point.model === 4) {
        await addMarkerUser(point);
      }
    } catch (error) {
      console.log(error);
    }
    this.next();
  }
}

function markercolor(value, aqi) {
  let color = null;
  const unit = localStorage.getItem("currentUnit") ?? null;
  const zones = measurements[unit]?.zones || "pm10";

  if (unit && unit !== 'aqi') {
    const match = zones.find((i) => value <= i?.value);
    if (match) {
      color = match?.color;
    } else {
      if (!zones[zones.length - 1]?.value) {
        color = zones[zones.length - 1]?.color;
      }
    }
  }

  if(aqi) {
    return aqi.Final_Color
  }

  return color || "#a1a1a1";
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
    colors.basic = "color-mix(in srgb, " + markercolor(point.value, point.aqi) + " 70%, transparent)";
    colors.border = "color-mix(in srgb, " + colors.basic + ", #000 10%)";
    // colors.basic = getColor(scale, point.value);
    // colors.border = getColorDarken(scale, point.value);
    // colors.rgb = getColorRGB(scale, point.value);
  }
  const marker = await findMarker(point.sensor_id);
  if (!marker) {
    const m = createMarker(point, colors);
    m.on("click", handlerClickMarker);

    attachEnhancements(m, map, markersLayer);

    if (markersLayer) {
      markersLayer.addLayer(m);
    } else {
      console.log("Not found markersLayer");
    }
  } else if (!point.isEmpty) {
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
