/**
 * Configuration for sensor filtering
 * 
 * @property {string} mode - Filter mode: 'exclude' (blacklist) or 'include-only' (whitelist)
 * @property {string[]} sensors - Array of sensor IDs to filter
 * 
 * Examples:
 * - exclude mode: hide sensors with IDs in the list
 * - include-only mode: show only sensors with IDs in the list (hide all others)
 */
export default {
  mode: 'exclude', // 'exclude' or 'include-only'
  sensors: [] // Array of sensor IDs
};

