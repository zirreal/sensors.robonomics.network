import { library } from "@fortawesome/fontawesome-svg-core";
import {
  faBars,
  faBookmark as faBookmarkSolid,
  faCircleExclamation,
  faCheck,
  faComment,
  faCompass,
  faCopy,
  faDownload,
  faExclamation,
  faFaceMeh,
  faGear,
  faInfo,
  faLink,
  faLocationArrow,
  faLocationDot,
  faMap,
  faMinus,
  faPlus,
  faSatellite,
  faSort,
  faStopwatch,
  faUser,
  faWind,
  faXmark,
  faShareFromSquare,
} from "@fortawesome/free-solid-svg-icons";
import {
  faBookmark as faBookmarkRegular,
  faComment as faCommentRegular,
  faMap as faMapRegular,
} from "@fortawesome/free-regular-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";

library.add(
  faBars,
  faBookmarkSolid,
  faBookmarkRegular,
  faCircleExclamation,
  faCheck,
  faComment,
  faCommentRegular,
  faCompass,
  faCopy,
  faDownload,
  faInfo,
  faExclamation,
  faFaceMeh,
  faGear,
  faLink,
  faLocationArrow,
  faLocationDot,
  faMap,
  faMapRegular,
  faMinus,
  faPlus,
  faSatellite,
  faSort,
  faStopwatch,
  faUser,
  faWind,
  faXmark,
  faShareFromSquare,
);

export function useIcons(app) {
  app.component("font-awesome-icon", FontAwesomeIcon);
}
