import { homedir } from "node:os";
import { join } from "node:path";

/** Per-user data directory following OS conventions. Override with MODEDIAL_HOME. */
export function dataDir(env = process.env, platform = process.platform): string {
  if (env.MODEDIAL_HOME) return env.MODEDIAL_HOME;
  const home = homedir();
  if (platform === "win32") return join(env.APPDATA ?? join(home, "AppData", "Roaming"), "modedial");
  if (platform === "darwin") return join(home, "Library", "Application Support", "modedial");
  return join(env.XDG_DATA_HOME ?? join(home, ".local", "share"), "modedial");
}
