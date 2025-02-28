import { mergeDefault } from "../default";
import agents from "./agents.json";
import config from "./config.json";
import sensors from "./sensors";

export default mergeDefault(config);

export { agents, sensors };
