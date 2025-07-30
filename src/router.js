import { createRouter, createWebHashHistory } from "vue-router";
import Main from "./views/Main.vue";
import PrivacyPolicy from "./views/PrivacyPolicy.vue";
import AirMeasurements from "./views/AirMeasurements.vue";
import AltruistUseCases from "./views/AltruistUseCases.vue";
import AltruistTimeline from "./views/AltruistTimeline.vue";
import AltruistCompare from "./views/AltruistCompare.vue";
import Login from "./views/Login.vue";
// import SensorEmbed from "./views/SensorEmbed.vue";

const router = createRouter({
  history: createWebHashHistory(),
  scrollBehavior(to) {
    if (to.hash) {
      return { el: to.hash, top: 30 };
    }
  },
  routes: [
    {
      path: "/:provider?/:type?/:zoom?/:lat?/:lng?/:sensor?",
      name: "main",
      component: Main,
      props: (route) => {
        return Object.fromEntries(Object.entries(route.params).filter(([_, v]) => v !== ""));
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
    // {
    //   path: "/login/",
    //   name: "login",
    //   component: Login,
    // },
    // {
    //   path: "/embed/sensor/:id/",
    //   name: "sensor-embed",
    //   component: SensorEmbed,
    // },
  ],
});

export default router;
