import type { DisplayBalance } from "../balance.js"

const money = new Intl.NumberFormat("zh-CN", {
  style: "currency",
  currency: "CNY",
  minimumFractionDigits: 4,
  maximumFractionDigits: 4,
})

export function formatMoney(value: number) {
  return money.format(value)
}

export function formatTokens(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`
  return value.toLocaleString("zh-CN")
}

export function formatTime(value: number) {
  return new Date(value).toLocaleTimeString("zh-CN", {
    hour12: false,
  })
}

export function formatDetails(details: DisplayBalance["details"]) {
  return details.map((item) => `${item.label} ${item.value}`).join(" · ")
}

/**
 * Terminal display width: CJK / fullwidth / emoji count as two columns.
 * Used to keep sidebar rows from wrapping in a narrow panel.
 */
const WIDE_RANGES: readonly (readonly [number, number])[] = [
  [0x1100, 0x115f],
  [0x2e80, 0x303e],
  [0x3041, 0x33ff],
  [0x3400, 0x4dbf],
  [0x4e00, 0x9fff],
  [0xa000, 0xa4cf],
  [0xac00, 0xd7a3],
  [0xf900, 0xfaff],
  [0xfe30, 0xfe6f],
  [0xff00, 0xff60],
  [0xffe0, 0xffe6],
  [0x1f300, 0x1f64f],
  [0x1f900, 0x1f9ff],
  [0x20000, 0x2fffd],
  [0x30000, 0x3fffd],
]

function isWideCodePoint(code: number) {
  return WIDE_RANGES.some(([start, end]) => code >= start && code <= end)
}

export function visualWidth(value: string) {
  let width = 0
  for (const char of value) {
    width += isWideCodePoint(char.codePointAt(0) ?? 0) ? 2 : 1
  }
  return width
}

/** Cut `value` to `max` display columns, appending an ellipsis when shortened. */
export function truncateToWidth(value: string, max: number) {
  if (max <= 0) return ""
  let width = 0
  let result = ""
  for (const char of value) {
    const charWidth = isWideCodePoint(char.codePointAt(0) ?? 0) ? 2 : 1
    if (width + charWidth > max) {
      let trimmed = result
      while (trimmed !== "" && visualWidth(`${trimmed}…`) > max) {
        trimmed = trimmed.slice(0, -1)
      }
      trimmed = trimmed.replace(/\s+$/u, "")
      return `${trimmed}…`
    }
    result += char
    width += charWidth
  }
  return value
}

export function errorMessage(cause: unknown) {
  if (cause instanceof Error) return cause.message
  return String(cause)
}
