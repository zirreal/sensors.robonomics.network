<template>
  <MetaInfo
    :pageTitle="$t('Altruist Setup Guide — Urban & Insight')"
    :pageDescription="
      $t(
        'Step-by-step setup instructions for Altruist Urban outdoor sensor and Altruist Insight indoor monitor. Connect to Wi-Fi, configure GPS, and join the open sensor map.'
      )
    "
  />
  <PageTextLayout>
    <h1>{{ $t("Altruist Setup Guide") }}</h1>

    <section class="pagetext-highlight">
      <p>
        {{ $t("Follow these steps to set up your Altruist sensor and connect it to the open sensor network at sensors.social.") }}
      </p>
    </section>

    <nav class="setup-nav">
      <a href="#urban">{{ $t("Altruist Urban") }}</a>
      <a href="#insight">{{ $t("Altruist Insight") }}</a>
      <a href="#specs">{{ $t("Technical Specifications") }}</a>
    </nav>

    <!-- URBAN SETUP -->
    <section id="urban">
      <h2>{{ $t("Set Up Your Altruist Urban") }}</h2>
      <p>
        {{ $t("Altruist Urban is an outdoor air quality monitor measuring particulate matter (PM2.5 / PM10), temperature, humidity, atmospheric pressure, and noise level.") }}
      </p>

      <p>
        <img :src="urbanSetupImg" :alt="$t('Altruist Urban setup diagram')" class="setup-diagram" />
      </p>

      <h3>{{ $t("Step 1 — Power") }}</h3>
      <p>
        {{ $t("Connect the sensor to a USB-C power source. Minimum requirement: 5V / 1A.") }}
      </p>

      <h3>{{ $t("Step 2 — Connect to the Altruist") }}</h3>
      <ol>
        <li>{{ $t("Scan the QR code with your phone camera, or find the Wi-Fi network «Altruist-xxxxxxxxx» in your device settings.") }}</li>
        <li>{{ $t("The access point becomes active shortly after powering on.") }}</li>
        <li>{{ $t("Enter the password:") }} <code>123456789</code></li>
      </ol>

      <h3>{{ $t("Step 3 — Connect to Your Wi-Fi") }}</h3>
      <ol>
        <li>
          <b>3.1</b> {{ $t("Open your browser and go to") }} <code>192.168.4.1</code>
        </li>
        <li>{{ $t("Enter your home Wi-Fi network name and password in «WIFI SETTINGS».") }}</li>
        <li>{{ $t("Click «Save configuration and restart».") }}</li>
        <li>
          <b>3.2</b> {{ $t("After restart the device shows status «CONNECTED!» and a new IP address (e.g. 192.168.10.3).") }}
        </li>
        <li>{{ $t("Copy the new IP address of the Altruist.") }}</li>
      </ol>

      <h3>{{ $t("Step 4 — Connect to the Sensor Map") }}</h3>
      <ol>
        <li>
          <b>4.1</b> {{ $t("Open the new IP address in your browser. Click «Configuration».") }}
        </li>
        <li>
          <b>4.2</b> {{ $t("Go to «GPS & Sensors» and enter the GPS coordinates of your sensor's location.") }}
        </li>
        <li>
          {{ $t("Use") }}
          <a href="https://www.latlong.net/convert-address-to-lat-long.html" target="_blank" rel="noopener">latlong.net</a>
          {{ $t("to find coordinates by address.") }}
        </li>
        <li>{{ $t("Click «Save configuration and restart».") }}</li>
      </ol>

      <p class="pagetext-highlight">
        {{ $t("Done! After a few minutes your sensor will appear on the open sensor map at") }}
        <a href="https://sensors.social" target="_blank" rel="noopener">sensors.social</a>
      </p>

      <h3>{{ $t("Mounting") }}</h3>
      <p>
        {{ $t("You can mount the sensor on a vertical surface using the included holder.") }}
      </p>
      <ul>
        <li>{{ $t("Mounting is optional — the Altruist is stable on any flat horizontal surface.") }}</li>
        <li>{{ $t("For UV protection from direct sunlight, we recommend an additional sun visor.") }}</li>
        <li>{{ $t("Wall mount (adhesive sticker): max height 3 m, operating temperature −10 °C to +35 °C.") }}</li>
        <li>{{ $t("Recommended installation height: 3 m or above.") }}</li>
      </ul>
    </section>

    <!-- INSIGHT SETUP -->
    <section id="insight">
      <h2>{{ $t("Set Up Your Altruist Insight") }}</h2>
      <p>
        {{ $t("Altruist Insight is an indoor air quality monitor with an e-ink display, measuring CO2, temperature, humidity, and atmospheric pressure.") }}
      </p>

      <p>
        <img :src="insightSetupImg" :alt="$t('Altruist Insight setup diagram')" class="setup-diagram" />
      </p>

      <h3>{{ $t("Step 1 — Power") }}</h3>
      <p>
        {{ $t("Connect the sensor to a USB-C power source. Minimum requirement: 5V / 1A.") }}
      </p>

      <h3>{{ $t("Step 2 — Connect to the Altruist") }}</h3>
      <ol>
        <li>{{ $t("Scan the QR code with your phone camera, or find the Wi-Fi network «Altruist-xxxxxxxxx» in your device settings.") }}</li>
        <li>{{ $t("The access point becomes active shortly after powering on.") }}</li>
        <li>{{ $t("Enter the password:") }} <code>123456789</code></li>
      </ol>

      <h3>{{ $t("Step 3 — Connect to Your Wi-Fi") }}</h3>
      <ol>
        <li>
          <b>3.1</b> {{ $t("Open your browser and go to") }} <code>192.168.4.1</code>
        </li>
        <li>{{ $t("Enter your home Wi-Fi network name and password in «WIFI SETTINGS».") }}</li>
        <li>{{ $t("Click «Save configuration and restart».") }}</li>
        <li>
          <b>3.2</b> {{ $t("After restart the device shows status «CONNECTED!» and a new IP address (e.g. 192.168.10.3).") }}
        </li>
        <li>{{ $t("Copy the new IP address of the Altruist.") }}</li>
      </ol>

      <h3>{{ $t("Step 4 — Connect to the Sensor Map") }}</h3>
      <ol>
        <li>
          <b>4.1</b> {{ $t("Open the new IP address in your browser. Click «Configuration».") }}
        </li>
        <li>
          <b>4.2</b> {{ $t("Go to «GPS & Sensors» and enter the GPS coordinates of your sensor's location.") }}
        </li>
        <li>
          {{ $t("Use") }}
          <a href="https://www.latlong.net/convert-address-to-lat-long.html" target="_blank" rel="noopener">latlong.net</a>
          {{ $t("to find coordinates by address.") }}
        </li>
        <li>{{ $t("Click «Save configuration and restart».") }}</li>
      </ol>

      <p class="pagetext-highlight">
        {{ $t("Done! After a few minutes your sensor will appear on the open sensor map at") }}
        <a href="https://sensors.social" target="_blank" rel="noopener">sensors.social</a>
      </p>

      <h3>{{ $t("E-ink Display") }}</h3>
      <p>
        {{ $t("The display shows data from your Altruist Insight sensor and a connected Altruist Urban sensor on the same Wi-Fi network.") }}
      </p>
      <ul>
        <li>{{ $t("LEDs around the perimeter indicate the current air quality level.") }}</li>
        <li>{{ $t("Three buttons on the back panel let you switch screens and browse data.") }}</li>
      </ul>
    </section>

    <!-- COMMON -->
    <section>
      <h2>{{ $t("Connect to Home Assistant") }}</h2>
      <p>
        {{ $t("Home Assistant integration lets you track air quality directly in your automation system. You can also create automation scenarios with other devices in your home.") }}
      </p>
      <p>
        {{ $t("Step-by-step guide:") }}
        <a href="https://wiki.robonomics.network/docs/altruist/#home-assistant" target="_blank" rel="noopener">
          wiki.robonomics.network/docs/altruist/#home-assistant
        </a>
      </p>
    </section>

    <!-- SPECS -->
    <section id="specs">
      <h2>{{ $t("Technical Specifications") }}</h2>

      <h3>{{ $t("Altruist Urban") }}</h3>
      <table>
        <tbody>
          <tr>
            <td><b>{{ $t("Power") }}</b></td>
            <td>5V (USB-C)</td>
          </tr>
          <tr>
            <td><b>{{ $t("Wireless") }}</b></td>
            <td>Wi-Fi 2.4 GHz (802.11 b/g/n)</td>
          </tr>
          <tr>
            <td><b>{{ $t("Sensors") }}</b></td>
            <td>
              SDS011 — PM2.5 / PM10 (µg/m³)<br />
              BME280 — {{ $t("Temperature (°C/°F), Humidity (%), Pressure (hPa)") }}<br />
              ICS43434 — {{ $t("Noise (dB)") }}
            </td>
          </tr>
          <tr>
            <td><b>{{ $t("In the box") }}</b></td>
            <td>
              {{ $t("Sensor module, USB-A to USB-C cable, wall mount, double-sided tape (×2), external antenna, user manual") }}
            </td>
          </tr>
        </tbody>
      </table>

      <h3>{{ $t("Altruist Insight") }}</h3>
      <table>
        <tbody>
          <tr>
            <td><b>{{ $t("Power") }}</b></td>
            <td>5V (USB-C)</td>
          </tr>
          <tr>
            <td><b>{{ $t("Wireless") }}</b></td>
            <td>Wi-Fi 2.4 GHz (802.11 b/g/n)</td>
          </tr>
          <tr>
            <td><b>{{ $t("Sensors") }}</b></td>
            <td>
              SCD41 — CO2 (ppm)<br />
              BME680 — {{ $t("Temperature (°C/°F), Humidity (%), Pressure (hPa)") }}
            </td>
          </tr>
          <tr>
            <td><b>{{ $t("In the box") }}</b></td>
            <td>
              {{ $t("Sensor module with e-ink display, USB-A to USB-C cable, user manual") }}
            </td>
          </tr>
        </tbody>
      </table>
    </section>

    <section class="pagetext-highlight">
      <p>
        {{ $t("Need help? Contact support:") }}
        <a href="https://support.cyberpunks.shop" target="_blank" rel="noopener">support.cyberpunks.shop</a>
      </p>
    </section>
  </PageTextLayout>
</template>

<script setup>
import { onMounted } from "vue";
import { useRouter } from "vue-router";
import MetaInfo from "../components/MetaInfo.vue";
import PageTextLayout from "../components/layouts/PageText.vue";

import urbanSetupImg from "@/assets/images/pages/altruist-setup/altruist-setup-urban.webp";
import insightSetupImg from "@/assets/images/pages/altruist-setup/altruist-setup-insight.webp";

const router = useRouter();

onMounted(() => {
  const waitForMatomo = setInterval(() => {
    if (typeof window.Matomo !== "undefined" && typeof window.Matomo.getTracker === "function") {
      clearInterval(waitForMatomo);

      const trackPage = () => {
        const tracker = window.Matomo.getTracker();
        if (tracker && !tracker.isUserOptedOut()) {
          window._paq.push(["setCustomUrl", router.currentRoute.value.fullPath]);
          window._paq.push(["setDocumentTitle", document.title]);
          window._paq.push(["trackPageView"]);
        }
      };

      trackPage();
    }
  }, 100);
});
</script>

<style scoped>
.setup-nav {
  display: flex;
  gap: 2rem;
  flex-wrap: wrap;
  margin-bottom: 2rem;
  font-weight: 900;
}

.setup-nav a {
  border-bottom: 2px solid currentColor;
  text-decoration: none;
}

code {
  background: rgba(0, 0, 0, 0.06);
  padding: 0.15em 0.4em;
  border-radius: 4px;
  font-family: monospace;
}

.setup-diagram {
  display: block;
  width: 100%;
  max-width: 900px;
  margin: 1rem 0;
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 8px;
}
</style>
