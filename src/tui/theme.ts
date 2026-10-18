import type { ResolvedTheme } from "@opencode/theme/tui"
import type { RGBA } from "@opentui/core"

/**
 * The flat color tokens this plugin renders with.
 *
 * OpenCode 2 themes expose semantic, nested tokens. The sidebar only needs a
 * handful of them, so map them once into a small shared shape instead of
 * threading `ResolvedTheme` through every component.
 */
export type Theme = {
  readonly text: RGBA
  readonly textMuted: RGBA
  readonly primary: RGBA
  readonly success: RGBA
  readonly warning: RGBA
  readonly error: RGBA
  readonly borderSubtle: RGBA
  readonly backgroundElement: RGBA
}

export function themeFrom(resolved: ResolvedTheme): Theme {
  return {
    text: resolved.text.base,
    textMuted: resolved.text.muted,
    primary: resolved.text.action.primary.base,
    success: resolved.text.feedback.success.base,
    warning: resolved.text.feedback.warning.base,
    error: resolved.text.feedback.error.base,
    borderSubtle: resolved.border.base,
    backgroundElement: resolved.background.raised.base,
  }
}
