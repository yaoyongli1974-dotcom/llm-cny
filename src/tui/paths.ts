import { homedir } from "node:os"
import { join } from "node:path"

/**
 * Best-effort OpenCode data directory. OpenCode installs its account and
 * credential files here; `authCandidatePaths` still probes the platform
 * alternatives.
 */
export function defaultStateDir() {
  const base = process.env.XDG_DATA_HOME?.trim() || join(homedir(), ".local", "share")
  return join(base, "opencode")
}
