import { createRouter, createWebHistory } from "vue-router";
import AirMeasurements from "./views/AirMeasurements.vue";
import AltruistCompare from "./views/AltruistCompare.vue";
import AltruistTimeline from "./views/AltruistTimeline.vue";
import AltruistUseCases from "./views/AltruistUseCases.vue";
import Login from "./views/Login.vue";
import Main from "./views/Main.vue";
import PrivacyPolicy from "./views/PrivacyPolicy.vue";
// import SensorEmbed from "./views/SensorEmbed.vue";

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  scrollBehavior(to) {
    if (to.hash) {
      return { el: to.hash, top: 30 };
    }
  },
  routes: [
    {
      path: "/",
      // path: "/:provider?/:type?/:zoom?/:lat?/:lng?/:sensor?",
      name: "main",
      component: Main,
      props: (route) => {
        return route.query;
      },
    },
    {
      path: "/privacy-policy/",
      name: "privacy-policy",
      component: PrivacyPolicy,
    },
    {
      path: "/air-measurements/",
      name: "air-measurements",
      component: AirMeasurements,
    },
    {
      path: "/altruist-use-cases/",
      name: "altruist-use-cases",
      component: AltruistUseCases,
    },
    {
      path: "/altruist-timeline/",
      name: "altruist-timeline",
      component: AltruistTimeline,
    },
    {
      path: "/altruist-compare/",
      name: "altruist-compare",
      component: AltruistCompare,
    },
    {
      path: "/login/",
      name: "login",
      component: Login,
    },
    // {
    //   path: "/embed/sensor/:id/",
    //   name: "sensor-embed",
    //   component: SensorEmbed,
    // },
  ],
});

// Support old urls
(async () => {
  if (window.location.hash) {
    const routes = router.options.routes.map((item) => item.path.split("/")[1]);
    const [, provider, type, zoom, lat, lng, sensor] = window.location.hash.split("/");
    if (routes.includes(provider)) {
      window.location.href = `${provider}/`;
      return;
    }
    const options = {
      name: "main",
      query: {
        provider: provider,
        type: type,
        zoom: zoom,
        lat: lat,
        lng: lng,
        sensor: sensor,
      },
    };
    window.location.href = router.resolve(options).href;
  }
})();

export default router;
