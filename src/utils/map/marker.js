import config, { sensors } from "@config";
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

export async function init(map, type, cb) {
  for (const index of Object.keys(messageTypes)) {
    try {
      messageIconType[index] = (
        await import(`../../assets/message/msg-${messageTypes[index]}.png`)
      ).default;
    } catch (error) {
      messageIconType[index] = (await import(`../../assets/message/msg-text.png`)).default;
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

  markersLayer = new L.MarkerClusterGroup({
    showCoverageOnHover: false,
    // zoomToBoundsOnClick: false,
    maxClusterRadius: 120,
    iconCreateFunction: iconCreate,
  });
  map.addLayer(markersLayer);

  pathsLayer = new L.layerGroup();
  map.addLayer(pathsLayer);
  moveLayer = new L.layerGroup();
  map.addLayer(moveLayer);

  for (const type of Object.values(messageTypes)) {
    messagesLayers[type] = new L.MarkerClusterGroup({
      showCoverageOnHover: false,
      // zoomToBoundsOnClick: false,
      maxClusterRadius: 120,
      iconCreateFunction: (cluster) => iconCreateMsg(cluster, type),
    });
  }
  if (config.SHOW_MESSAGES) {
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

    markersId.push(marker.options.data._id)

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
      markersLayer.eachLayer((m) => {
        if (m.options.data.sensor_id === sensor_id) {
          resolve(m);
        }
      });
    }
    resolve(false);
  });
}

function findMarkerMoved(sensor_id) {
  return new Promise((resolve) => {
    if (moveLayer) {
      moveLayer.eachLayer((m) => {
        if (m.options.data.sensor_id === sensor_id) {
          resolve(m);
        }
      });
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
  // return new L.DivIcon({
  //   html: `<div class='marker-cluster-circle' style='color:${colors.border};background-color: rgba(${colors.rgb}, 0.7);border-color: ${colors.border};'></div>`,
  //   className: "marker-cluster",
  //   iconSize: new L.Point(40, 40),
  // });

  return new L.DivIcon({
    html: `<div data-id="${id ?? ''}" class='marker-cluster-circle ${isBookmarked ? "sensor-bookmarked" : ''}' style='color:${colors.border};background-color: ${colors.basic};border-color: ${colors.border};'></div>`,
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
  // return L.circleMarker(new L.LatLng(coord[0], coord[1]), {
  //   radius: 15,
  //   fillColor: colors.basic,
  //   color: colors.border,
  //   weight: 2,
  //   // opacity: 0.7,
  //   fillOpacity: 0.7,
  //   data: data,
  //   typeMarker: "circle",
  // });
}

function createMarkerUser(coord, data) {
  return L.marker(new L.LatLng(coord[0], coord[1]), {
    icon: createIconMsg(data.measurement?.type || 0),
    data: data,
    typeMarker: "msg",
  });
}

function createMarker(point, colors) {
  const coord = [point.geo.lat, point.geo.lng];
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
    const coord = [point.geo.lat, point.geo.lng];
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

        /* + Broadcasting about new sensor */
        const bc = new BroadcastChannel("sensors");
        bc.postMessage(point);
        bc.close();
        /* - Broadcasting about new sensor */
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

function markercolor(value) {
  let color = null;
  const unit = localStorage.getItem("currentUnit") ?? null;
  const zones = measurements[unit].zones || "pm10";

  if (unit) {
    const match = zones.find((i) => value <= i?.value);
    if (match) {
      color = match?.color;
    } else {
      if (!zones[zones.length - 1]?.value) {
        color = zones[zones.length - 1]?.color;
      }
    }
  }

  return color || "#a1a1a1";
}

async function addMarker(point) {
  // Проверка координат: если они близки к 0, пропускаем создание маркера
  const tolerance = 0.001;
  const lat = Number(point.geo.lat);
  const lng = Number(point.geo.lng);
  if (Math.abs(lat) < tolerance && Math.abs(lng) < tolerance) {
    return; // Сенсор с нулевой геопозицией — не добавляем маркер
  }
  
  const colors = {
    basic: "#a1a1a1",
    border: "#999",
    rgb: [161, 161, 161],
  };
  if (!point.isEmpty) {
    colors.basic = "color-mix(in srgb, " + markercolor(point.value) + " 70%, transparent)";
    colors.border = "color-mix(in srgb, " + colors.basic + ", #000 10%)";

    // colors.basic = getColor(scale, point.value);
    // colors.border = getColorDarken(scale, point.value);
    // colors.rgb = getColorRGB(scale, point.value);
  }
  const marker = await findMarker(point.sensor_id);
  if (!marker) {
    const marker = createMarker(point, colors);
    marker.on("click", handlerClickMarker);
    if (markersLayer) {
      markersLayer.addLayer(marker);
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
    const coord = [point.geo.lat, point.geo.lng];
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
  // Проверка координат: если они близки к 0, пропускаем создание маркера
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
    const marker = createMarker(point, colors);
    marker.on("click", handlerClickMarker);
    if (
      point.measurement &&
      messageTypes[point.measurement.type] &&
      messagesLayers[messageTypes[point.measurement.type]]
    ) {
      messagesLayers[messageTypes[point.measurement.type]].addLayer(marker);
    }
  }
}

export function clear() {
  if (markersLayer) {
    markersLayer.clearLayers();

    /* + Broadcasting about removing all sensors */
    const bc = new BroadcastChannel("sensorsremoved");
    bc.postMessage(true);
    bc.close();
    /* - Broadcasting about removing all sensors */
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
