import { library } from "@fortawesome/fontawesome-svg-core";
import {
  faBars,
  faBookmark,
  faCheck,
  faCompass,
  faCopy,
  faExclamation,
  faFaceMeh,
  faGear,
  faInfo,
  faLink,
  faLocationArrow,
  faLocationDot,
  faSort,
  faStopwatch,
  faUser,
  faXmark,
  faShareFromSquare,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";

library.add(
  faBars,
  faBookmark,
  faCheck,
  faCompass,
  faCopy,
  faInfo,
  faExclamation,
  faFaceMeh,
  faGear,
  faLink,
  faLocationArrow,
  faLocationDot,
  faSort,
  faStopwatch,
  faUser,
  faXmark,
  faShareFromSquare,
);

export function useIcons(app) {
  app.component("font-awesome-icon", FontAwesomeIcon);
}
