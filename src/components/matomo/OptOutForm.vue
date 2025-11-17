<template>
  <div class="optout-form">
    <p>{{ optDescr }}</p>
    <p>{{ optChoice }}</p>
    <label class="custom-checkbox">
      <input
        @change="onToggle($event)"
        type="checkbox"
        v-model="optOut"
        name="optout"
        value="optout"
        class="custom-checkbox__field"
      />
      <span class="custom-checkbox__content"></span>
      <strong>{{ optText }}</strong>
    </label>
  </div>
</template>

<script>
export default {
  data() {
    return {
      optOut: false,
      optText: this.$t("privacypolicy.matomolabel2"),
      optDescr: this.$t("privacypolicy.matomotext3"),
      optChoice: this.$t("privacypolicy.matomotext4"),
      paqCheckInterval: null, // for waiting until Matomo loads
    };
  },

  methods: {
    setOptOutText() {
      if (this.optOut) {
        this.optText = this.$t("privacypolicy.matomolabel1");
        this.optDescr = this.$t("privacypolicy.matomotext1");
        this.optChoice = this.$t("privacypolicy.matomotext2");
      } else {
        this.optText = this.$t("privacypolicy.matomolabel2");
        this.optDescr = this.$t("privacypolicy.matomotext3");
        this.optChoice = this.$t("privacypolicy.matomotext4");
      }
    },

    onToggle(event) {
      this.optOut = event.target.checked;
      this.setOptOutText();

      if (!window._paq || typeof window._paq.push !== "function") {
        console.warn("Matomo _paq not ready yet");
        return;
      }

      if (this.optOut) {
        window._paq.push(["optUserOut"]);
        console.log("User opted out");
      } else {
        window._paq.push(["forgetUserOptOut"]);
        console.log("User opted in");
      }
    },

    fetchOptOutState() {
      // Ensure Matomo and the tracker are available
      const matomoReady =
        typeof window.Matomo !== "undefined" && typeof window.Matomo.getTracker === "function";

      if (!matomoReady) return false; // Matomo not ready yet

      const tracker = window.Matomo.getTracker();
      if (!tracker) return false;

      // Safely read the user's opt-out state
      this.optOut = !!tracker.isUserOptedOut(); // force boolean
      this.setOptOutText();

      return true; // successfully fetched
    },

    waitForMatomo() {
      if (this.fetchOptOutState()) return;

      this.paqCheckInterval = setInterval(() => {
        if (this.fetchOptOutState()) {
          clearInterval(this.paqCheckInterval);
          this.paqCheckInterval = null;
        }
      }, 100);
    },
  },

  watch: {
    "$i18n.locale"() {
      this.setOptOutText();
    },
  },

  mounted() {
    this.setOptOutText();
    if (window._paq && typeof window._paq.push === "function") {
      window._paq.push(["disableCookies"]);
    }

    this.waitForMatomo(); // fetch current opt-out state once Matomo is ready
  },

  beforeUnmount() {
    if (this.paqCheckInterval) {
      clearInterval(this.paqCheckInterval);
    }
  },
};
</script>

<style scoped>
.optout-form {
  padding: 1.5rem 0.8rem;
  border: 2px solid #333;
}

.optout-form strong {
  padding-left: 10px;
}
</style>
