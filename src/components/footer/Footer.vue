<template>
  <div class="mapcontrols">
    <div class="flexline">
      <input type="date" v-model="start" :max="maxDate" :disabled="currentProvider == 'realtime'" />

      <Measures
        :startTime="startTimestamp"
        :endTime="endTimestamp"
        :current="measuretype.toLowerCase()"
      />
      <div v-if="isLoad">{{ $t("isLoad") }}</div>
    </div>

    <div class="flexline">
      <div id="mapsettings" class="popover-bottom-right popover" popover>
        <section>
          <input id="realtime" v-model="realtime" type="checkbox" :checked="realtime" />
          <label for="realtime">{{ $t("provider.realtime") }}</label>
        </section>
        <section>
          <input
            id="wind"
            v-model="wind"
            type="checkbox"
            :disabled="!realtime"
            :checked="wind && realtime"
          />
          <label for="wind">{{ $t("layer.wind") }}</label>
        </section>
        <section>
          <input id="messages" v-model="messages" type="checkbox" :checked="messages" />
          <label for="messages">{{ $t("layer.messages") }}</label>
        </section>
        <hr />
        <section>
          <h3>{{ $t("history.title") }}</h3>
          <HistoryImport />
        </section>
      </div>
      <button class="popovercontrol" popovertarget="mapsettings">
        <font-awesome-icon icon="fa-solid fa-gear" />
      </button>

      <div id="bookmarks" class="popover-bottom-right popover" popover>
        <h3>{{ $t("bookmarks.listtitle") }}</h3>
        <Bookmarks />
      </div>
      <button
        class="popovercontrol bookmarksbutton"
        :class="bookmarks && bookmarks?.length > 0 ? 'active' : null"
        popovertarget="bookmarks"
      >
        <font-awesome-icon icon="fa-solid fa-bookmark" />
        <b v-if="bookmarks?.length > 0">{{bookmarks?.length}}</b>
      </button>

      <slot />
    </div>
  </div>
</template>

<script>
import { useStore } from "@/store";
import config from "@config";
import moment from "moment";
import Bookmarks from "../../components/Bookmarks.vue";
import Measures from "../../components/measures/Measures.vue";
import { instanceMap } from "../../utils/map/instance";
import { switchMessagesLayer } from "../../utils/map/marker";
import { switchLayer } from "../../utils/map/wind";
import HistoryImport from "./HistoryImport.vue";

export default {
  emits: ["history"],
  props: ["currentProvider", "canHistory", "measuretype", "isLoad"],
  components: { HistoryImport, Measures, Bookmarks },

  data() {
    return {
      store: useStore(),
      isActive: false,
      isActiveMenu: false,
      isMeasuresPopupOpen: false,

      realtime: this.currentProvider === "realtime",
      wind: false,
      messages: config.SHOW_MESSAGES,
      start: moment().format("YYYY-MM-DD"),
      maxDate: moment().format("YYYY-MM-DD"),
    };
  },
  computed: {
    startTimestamp: function () {
      return Number(moment(this.start + " 00:00:00", "YYYY-MM-DD HH:mm:ss").format("X"));
    },
    endTimestamp: function () {
      return Number(moment(this.start + " 23:59:59", "YYYY-MM-DD HH:mm:ss").format("X"));
    },
    bookmarks: function () {
      return this.store.idbBookmarks;
    },
  },
  watch: {
    async realtime(v) {
      await this.$router.push({
        name: "main",
        params: {
          provider: v ? "realtime" : "remote",
          type: this.$route.params.type,
          zoom: this.$route.params.zoom,
          lat: this.$route.params.lat,
          lng: this.$route.params.lng,
          sensor: this.$route.params.sensor,
        },
      });
      this.$router.go(0);
    },
    start() {
      this.getHistory();
    },
    canHistory: {
      handler(newValue) {
        if (newValue) {
          this.getHistory();
        }
      },
      immediate: true,
    },
    wind(value) {
      switchLayer(instanceMap(), value);
    },
    messages(value) {
      switchMessagesLayer(instanceMap(), value);
    },
  },

  methods: {
    getHistory() {
      if (this.realtime) {
        return;
      }
      this.$emit("history", {
        start: this.startTimestamp,
        end: this.endTimestamp,
      });
    },
  },
};
</script>

<style>
.popovercontrol.active {
  border-color: var(--color-green);
}

.popovercontrol.active path {
  fill: var(--color-green) !important;
}
</style>


<style scoped>
.mapcontrols {
  bottom: 0;
  box-sizing: border-box;
  display: flex;
  justify-content: space-between;
  left: 0;
  padding: 0 var(--app-controlsgap) var(--app-controlsgap);
  position: absolute;
  right: 0;
  z-index: 12;
  pointer-events: none;
}

.mapcontrols > * {
  pointer-events: all;
}

.popover-bottom-right,
.popover-bottom-left {
  bottom: calc(var(--app-inputheight) + var(--app-controlsgap) * 2);
  max-width: calc(100vw - var(--app-controlsgap) * 2);
}

.popover-bottom-right {
  right: var(--app-controlsgap);
}

.popover-bottom-left {
  left: var(--app-controlsgap);
}

.bookmarksbutton {
  position: relative;
}

.bookmarksbutton b {
  font-size: 80%;
  position: absolute;
  top: -10px;
  right: -10px;
  background-color: var(--color-orange);
  border-radius: 10px;
  color: var(--color-light);
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>