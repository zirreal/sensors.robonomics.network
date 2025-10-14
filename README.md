# sensors.social

---

## 📌 Overview

**sensors.social** is a decentralized application that visualizes data from sensors sending their measurements to the blockchain (Polkadot network, Robonomics parachain). The platform supports two modes of operation:

- **Peer-to-peer connectivity** for direct access to sensor data.
- **Federative concept** for accumulating sensor data and displaying measurement history.

For more details on connectivity and how to deploy your own map interface (or even a connectivity server), visit [Robonomics Academy](https://robonomics.academy/en/learn/sensors-connectivity-course/overview/).

---

## 🔧 How to work with the code locally

This section is intended for contributors working on the existing map and developers setting up their own map interface. For comprehensive instructions on configuring your own user interface, refer to the next sections.

1️⃣ **Fork & Clone the Repository**  

If you plan to contribute or customize the project extensively, consider forking it first. Then clone the repository:

```sh
  git clone <map repository>
```

If you plan to contribute or customize the project extensively, consider forking it first.

2️⃣ **Install Dependencies**

Ensure **Node.js** and **Yarn** are installed:

```sh
 node -v  # Should be >= 16
 yarn -v  # Should be installed
```

Then install the required dependencies:

```sh
 yarn install
```

3️⃣ **Start the Server Locally for Development**

```sh
 yarn dev
```

---


## 🗺️ How to setup your own map (for experienced users)

### Steps to fork

Follow these steps to deploy your own instance of **sensors.social** on GitHub Pages:

1️⃣ **Fork the repository**  
   - Click **Fork** on GitHub.  
   - In your fork, go to **Settings → Actions → General → Workflow permissions** and enable **Read and write permissions**.

2️⃣ **Adjust configuration**  
   - Copy the template config to your own folder:  
     ```sh
     cp -r src/config/template src/config/my-map
     ```  
   - Edit the files inside `src/config/my-map/` (`config.json`, `agents.json`, `pinned_sensors.js`, etc).  
     Any files missing in `my-map` will be loaded automatically from `src/config/default/`.  
   - Set the environment variable in GitHub:  
     ```
     VITE_CONFIG_ENV=my-map
     ```  
     (Settings → Secrets and variables → Variables).

3️⃣ **Prepare for deployment**

  - If you want to host the map **not at the root of a domain** (for example, the default GitHub Pages URL like `https://<username>.github.io/<repo>/`), set the base path to your repository name:

      ```js
      // vite.config.js
      base: mode === "production" ? "/<repo>/" : "/",
      ```

      In this case, you do **not** need to set the `PAGES_CNAME` variable.

  - If you want to host the map **at the root of a domain** (for example, when you configure a custom domain such as `https://example.com` or use the root Pages site of a user/organization), set the base path to `/`:

      ```js
      // vite.config.js
      base: "/",
      ```

      And set the repository variable `PAGES_CNAME` to your domain:

      ```sh
      PAGES_CNAME=example.com
      ```

4️⃣ **Enable GitHub Actions**  
   - A workflow file is already provided in `.github/workflows/`. It builds the project and pushes the `dist` folder into the `gh-pages` branch. The workflow runs on every push to `master` or `main`.
   - Before the first deployment, create an empty `gh-pages` branch manually in your fork:

  ```sh
  git checkout --orphan gh-pages
  git commit --allow-empty -m "Initialize gh-pages branch"
  git push origin gh-pages
  ```

   - Go to **Settings → Pages → Build and deployment**.  
   - Choose **Deploy from a branch**, set **Branch: gh-pages**, **Folder: /(root)**.  

After the workflow completes, your map will be available at the GitHub Pages URL (or your custom domain if configured).

### Basic configuration

Configuration files are located in `src/config/`.  
By default, the project uses `src/config/default/`.  
You can override any file by creating your own folder and specifying its name in `.env`:

```env
VITE_CONFIG_ENV=my-project
```

In this case, files will be loaded from `src/config/my-project/` with fallback to `src/config/default/`.

#### config.json

```json
{
  "LIBP2P": "object. Configuration for initializing the LIBP2P library.",

  "REMOTE_PROVIDER": "string. Server URL for Rozman data.",
  "WIND_PROVIDER": "string. Server URL for wind data.",

  "MAP": {
    "zoom": "number. Initial zoom level.",
    "position": {
      "lat": "number. Initial latitude.",
      "lng": "number. Initial longitude."
    },
    "boundsDelta": "number | object { lat: number, lng: number }. Optional. Creates a bounding box around position.",
    "measure": "string. Default measurement type, e.g. 'pm25'.",
    "theme": {
      "light": "string. Basemap key for light mode (e.g. 'carto-light').",
      "dark": "string. Basemap key for dark mode (e.g. 'carto-dark').",
      "invertForDark": "boolean. If true and dark theme is missing/invalid, a dark variant is generated by inverting the light theme."
    }
  },

  "SERVICES": {
    "accounts": "boolean. Enable accounts UI."
  },

  "SHOW_MESSAGES": "boolean. Show user messages on the map.",
  "DEFAULT_TYPE_PROVIDER": "string. Default data provider: 'realtime' (live) or 'remote' (24h recap).",
  "VALID_DATA_PROVIDERS": {
    "realtime": "string. Human label for realtime.",
    "remote": "string. Human label for daily recap."
  },

  "SERIES_MAX_VISIBLE": "number. Maximum number of points in a sensor chart before downsampling/grouping is applied.",

  "GEOCODER": {
    "urlTemplate": "string. Reverse geocoding URL template with placeholders {lat} {lon} {zoom} {addressdetails} {lang}",
    "cacheTtlDays": "number. Local cache TTL in days",
    "zoom": {
      "city": "number. Zoom level for city-level lookup",
      "address": "number. Zoom level for precise address lookup"
    }
  },

  "TITLE": "string. Project title.",
  "DESC": "string. Project description.",
  "SITE_NAME": "string. Website or project name.",
  "SITE_URL": "string. Website URL.",
  "REPO_NAME": "string. author/repo (for GitHub links).",
  "TWITTER": "string. @yourXaccount (optional, for Open Graph tags)."
}
```

**Example**: [config.json](https://github.com/airalab/sensors.social/blob/master/src/config/default/config.json)

### Reverse geocoding provider (addresses)

The map builds reverse‑geocoding requests from `GEOCODER.urlTemplate` using placeholders:

- `{lat}`, `{lon}` — coordinates
- `{zoom}` — use `GEOCODER.zoom.city` for city/locality or `GEOCODER.zoom.address` for precise address
- `{addressdetails}` — `0` or `1`
- `{lang}` — UI language

Default (Nominatim):

```json
"GEOCODER": {
  "urlTemplate": "https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat={lat}&lon={lon}&zoom={zoom}&addressdetails={addressdetails}&accept-language={lang}",
  "cacheTtlDays": 7,
  "zoom": { "city": 14, "address": 18 }
}
```

Alternative (Photon by Komoot):

```json
"GEOCODER": {
  "urlTemplate": "https://photon.komoot.io/reverse?lat={lat}&lon={lon}&lang={lang}",
  "cacheTtlDays": 7,
  "zoom": { "city": 14, "address": 18 }
}
```

Note: If your provider returns a schema different from Nominatim JSON, adjust the normalizer in `src/utils/map/utils.js` if needed.

#### Available map themes

You can configure map backgrounds using the following keys in `MAP.theme.light` or `MAP.theme.dark`:

- **osm** – Classic OpenStreetMap tiles.  
- **carto-light** – Light, minimalistic basemap from Carto.  
- **carto-dark** – Dark variant from Carto.  
- **opentopomap** – Topographic map with terrain and elevation (OSM + SRTM).  
- **esri-imagery** – Satellite imagery (Esri, Maxar, Earthstar).  
- **esri-topo** – Esri World Topo Map (streets + terrain).  
- **cyclosm** – Bicycle-focused map with cycling routes and infrastructure.  

If a theme key is missing or invalid:  
- For **light** → falls back to OpenStreetMap (default style).  
- For **dark** → if `invertForDark: true`, the light theme is auto-inverted to create a dark variant.

#### Adding custom themes

Define basemaps in `src/config/<env>/themes.js` (falls back to `src/config/default/themes.js`).  
Each entry has a `url` and `options` (Leaflet `tileLayer` options like `subdomains`, `attribution`, etc.):

```js
export default {
  "my-custom-theme": {
    url: "https://{s}.example.com/tiles/{z}/{x}/{y}.png",
    options: { subdomains: "abc", attribution: "© MyTiles" }
  }
};
```

Then reference the key in `config.json`:

```json
"MAP": {
  "theme": {
    "light": "my-custom-theme",
    "dark": "",
    "invertForDark": false
  }
}
```

---

### Libp2p agents configuration

File: `src/config/<env>/agents.json`  
Specify a list of libp2p identifiers from which data can be received via pubsub in realtime mode.

**Example**: [agents.json](https://github.com/airalab/sensors.social/blob/master/src/config/default/agents.json)

---

### Sensors configuration

File: `src/config/<env>/pinned_sensors.js`  
You can set an icon and a website link for a specific sensor:

```json
{
  "HASH_ID_SENSOR": {
    "icon": "Path to the icon file",
    "link": "URL of the website"
  }
}
```

**Example**: [pinned_sensors.js](https://github.com/airalab/sensors.social/blob/master/src/config/default/pinned_sensors.js)


---


## 💬 Localization & Translations

You can add a new language to the map by modifying the translation files located in `src/translate/`.  

### 📝 Adding a New Language  

1️⃣ **Create a new translation file** in `src/translate/`, e.g., `es.js`.  

2️⃣ **Update `index.js`** in the same folder:  
   - Import your newly created translation file:  

   ```js
   import es from "./es";
   
   export default { en, ru, es };
   ```

  - Add the new language to the language list:

  ```js
    export const languages = [
      { code: "en", title: "English" },
      { code: "ru", title: "Русский" },
      { code: "es", title: "Español" },
    ];
  ```
  
  ### 📏 Translating Measurements  

  Measurement values are located in `src/measurements/`.  
  To support multiple languages, update the relevant files in this folder.  

  #### Files to Update  

| Measurement Type        | File Name |
|-------------------------|-----------|
| Carbon Monoxide        | `co.js` |
| Background Radiation   | `gs.js` |
| Humidity              | `humidity.js` |
| Ammonia (NH₃)         | `nh3.js` |
| Nitrogen Dioxide (NO₂) | `no2.js` |
| Noise Levels          | `noise.js`, `noiseavg.js`, `noisemax.js` |
| PM10 Particulate Matter | `pm10.js` |
| PM2.5 Particulate Matter | `pm25.js` |
| Pressure              | `pressure.js` |
| Temperature           | `temperature.js` |

#### Example Translation Update (`humidity.js`)  

To add support for **Spanish (es)**, update the `name`, `nameshort`, and `zones` properties:  

```js

     name: {  
       en: "Humidity",  
       ru: "Влажность",  
       es: "Humedad"  
     },  
     nameshort: {  
       en: "Humidity",  
       ru: "Влажность",  
       es: "Humedad"  
     },  

     zones: [  
       {  
         value: 30,  
         color: "#ff4d00",  
         label: {  
           en: "Very dry",  
           ru: "Очень сухо",  
           es: "Muy seco"  
         }  
       }  
     ]  
  ```
  
### 🌍 Auto-Translation with OpenAI

You can automatically translate interface strings using OpenAI's API. To enable this:

1. **Set up your API key**

   Add your OpenAI key to the `.env` file as:

   ```env
   VITE_OPENAI_KEY=your-openai-api-key
   ```

2. **Mark translatable strings**

   Use the `$t()` function in your code to mark strings for translation:

   ```js
   $t('Geolocation');
   ```

3. **Configure translation behavior**

   Modify the config in `src/scripts/translate.js`:

   * **Languages**: Add/remove target languages in the `LANGUAGES` array.
   * **Preserve specific keys**: Add keys to `PRESERVE_KEYS` to keep them even if not found in `$t()` calls.
   * **Allow identifiers to be translated**: If certain keys look like code (e.g., `Model`, `Yes`) but should still be translated, add them to the `SHORT_LIST`.

4. **Run the translation script**

   Use the following command to generate or update translation files:

   ```bash
   yarn autotranslate
   ```

   Once complete, your translations will be available in the appropriate language files in `src/translate`.

---

## ❓ Support

For questions or suggestions, create an **issue** in the repository.

---
