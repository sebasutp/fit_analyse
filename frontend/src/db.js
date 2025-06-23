// db.js
import Dexie from "dexie";

export const db = new Dexie("fit_analyse");
db.version(1).stores({
  activities: "activity_id, name, owner_id, distance, activity_time, elevation_gain, date, last_modified, data, static_map, activity_type, laps_data, fit_file, fit_file_parsed_at, tags"
});
