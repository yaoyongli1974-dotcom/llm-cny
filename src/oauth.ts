import { readFile, writeFile } from "node:fs/promises"
import { homedir } from "node:os"
import { dirname, join } from "node:path"
import { isRecord } from "./utils.js"

export function authCandidatePaths(stateDir: string) {
  const candidates = new Set<string>([join(stateDir, "account.json")])
  const stateParent = dirname(stateDir)
  candidates.add(join(stateParent, "opencode", "account.json"))

  for (const base of [
    process.env.XDG_DATA_HOME,
    process.env.LOCALAPPDATA,
    process.env.APPDATA,
    join(homedir(), ".local", "share"),
    join(homedir(), "Library", "Application Support"),
  ]) {
    if (!base) continue
    candidates.add(join(base, "opencode", "account.json"))
    candidates.add(join(base, "opencode", "auth.json"))
  }

  return [...candidates]
}

export async function readOAuthCredential<T>(stateDir: string, parse: (value: unknown) => T | null): Promise<T | null> {
  const fromEnv = parse(JSON.parse(process.env.OPENCODE_AUTH_CONTENT ?? "null"))
  if (fromEnv) return fromEnv

  for (const filePath of authCandidatePaths(stateDir)) {
    try {
      const parsed = parse(JSON.parse(await readFile(filePath, "utf-8")))
      if (parsed) return parsed
    } catch {
      continue
    }
  }

  return null
}

/**
 * Reads the API key OpenCode stores for `providerID` (`auth.json` entries look like
 * `{ "<providerID>": { "type": "api", "key": "..." } }`). OpenCode does not expose
 * these keys through the provider list, so this is the only way to reach them.
 */
export function providerKeyFromAuth(value: unknown, providerID: string) {
  if (!isRecord(value)) return undefined
  const entry = value[providerID]
  if (!isRecord(entry)) return undefined
  const key = entry.key
  if (typeof key !== "string") return undefined

  const trimmed = key.trim()
  return trimmed === "" ? undefined : trimmed
}

export async function readStoredProviderKeys<T extends string>(
  stateDir: string,
  providerIDs: readonly T[],
): Promise<Partial<Record<T, string>>> {
  const keys: Partial<Record<T, string>> = {}
  await readOAuthCredential(stateDir, (value) => {
    for (const providerID of providerIDs) {
      const key = providerKeyFromAuth(value, providerID)
      if (key !== undefined) keys[providerID] = key
    }
    return Object.keys(keys).length > 0 ? keys : null
  })
  return keys
}

export async function writeOAuthCredential(stateDir: string, update: (value: unknown) => unknown | null): Promise<boolean> {
  for (const filePath of authCandidatePaths(stateDir)) {
    try {
      const raw = await readFile(filePath, "utf-8")
      const next = update(JSON.parse(raw))
      if (!next) continue
      await writeFile(filePath, JSON.stringify(next, null, 2), "utf-8")
      return true
    } catch {
      continue
    }
  }
  return false
}
