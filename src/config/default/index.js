import { mergeDeep } from "../../utils/utils";
import agents from "./agents.json";
import configDefault from "./config.json";
import sensors from "./sensors";

export default configDefault;

export function mergeDefault(config) {
  return mergeDeep(configDefault, config);
}

export { agents, sensors };
