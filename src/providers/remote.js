import { settings } from "@config";
import io from "socket.io-client";

async function getJSON(path) {
  const url = `${settings.REMOTE_PROVIDER}api/sensor${path}`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.json();
}

class Provider {
  constructor(url) {
    this.isReady = false;
    this.url = url.replace(/\/$/, "");
    this.connection = false;
    this.start = null;
    this.end = null;
    this.socket = io(url);
    this.socket.on("connect_error", (e) => {
      console.log("connect error", e);
      this.connection = false;
    });
    this.socket.on("error", function (error) {
      console.warn(error);
    });
    this.init().then(() => {
      this.isReady = true;
    });
  }

  async status() {
    try {
      const res = await fetch(`${settings.REMOTE_PROVIDER}api/sensor/cities`, { cache: 'no-store' });
      if (res.ok) {
        return true;
      }
    } catch (error) {
      console.log(error.message);
    }
    return false;
  }

  init() {
    return new Promise((resolve) => {
      this.socket.on("connect", () => {
        this.connection = true;
        resolve();
      });
    });
  }

  ready() {
    return new Promise((resolve) => {
      const t = setInterval(() => {
        if (this.isReady) {
          resolve();
          clearInterval(t);
        }
      }, 100);
    });
  }

  setStartDate(start) {
    this.start = start;
  }

  setEndDate(end) {
    this.end = end;
  }

  async lastValuesForPeriod(start, end, type) {
    try {
      const result = await getJSON(`/last/${start}/${end}/${type}`);
      return result?.result || {};
    } catch {
      return {};
    }
  }

  async maxValuesForPeriod(start, end, type) {
    try {
      const result = await getJSON(`/max/${start}/${end}/${type}`);
      return result?.result || {};
    } catch {
      return {};
    }
  }

  async messagesForPeriod(start, end) {
    try {
      const result = await getJSON(`/messages/${start}/${end}`);
      return result?.result || {};
    } catch {
      return {};
    }
  }

  async getHistoryBySensor(sensor) {
    try {
      const result = await getJSON(`/${sensor}`);
      return result?.result || [];
    } catch {
      return [];
    }
  }

  async getHistoryPeriodBySensor(sensor, start, end) {
    try {
      const result = await getJSON(`/${sensor}/${start}/${end}`);
      return result?.result || [];
    } catch {
      return [];
    }
  }

  async getHistoryPeriod(start, end) {
    try {
      const result = await getJSON(`/last/${start}/${end}`);
      return result?.result || {};
    } catch {
      return {};
    }
  }

  static async getMeasurements(start, end) {
    try {
      const result = await getJSON(`/measurements/${start}/${end}`);
      return result?.result || [];
    } catch {
      return [];
    }
  }

  watch(cb) {
    if (cb) {
      this.socket.on("update", (result) => {
        cb(result);
      });
    }
  }
}

export default Provider;
