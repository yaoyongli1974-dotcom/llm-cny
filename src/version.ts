export const PLUGIN_NAME = "llm-cny"
export const PLUGIN_VERSION = "2.0.0"

/**
 * Whether the registry version is newer than the running one. Pre-release
 * suffixes are ignored, which is enough for the plain `x.y.z` versions this
 * package publishes.
 */
export function isNewerVersion(latest: string, current: string) {
  const parse = (value: string) =>
    value
      .split("-", 1)[0]!
      .split(".")
      .map((part) => Number.parseInt(part, 10))

  const next = parse(latest)
  const running = parse(current)
  for (let index = 0; index < Math.max(next.length, running.length); index++) {
    const left = next[index] ?? 0
    const right = running[index] ?? 0
    if (!Number.isFinite(left) || !Number.isFinite(right)) return false
    if (left !== right) return left > right
  }
  return false
}
