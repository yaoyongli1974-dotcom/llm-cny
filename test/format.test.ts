import { expect, test } from "bun:test"
import { fitParts, formatBalanceAmount, truncateToWidth, visualWidth } from "../src/tui/format.js"

test("visualWidth 把 ASCII 按 1 列计算", () => {
  expect(visualWidth("LLM CNY")).toBe(7)
  expect(visualWidth("")).toBe(0)
})

test("visualWidth 把中日韩字符按 2 列计算", () => {
  expect(visualWidth("免费")).toBe(4)
  expect(visualWidth("91 次 · 免费")).toBe(12)
})

test("truncateToWidth 在超宽时截断并加省略号", () => {
  expect(truncateToWidth("Zen DeepSeek V4.1 Flash Free", 20)).toBe("Zen DeepSeek V4.1 F…")
  expect(visualWidth(truncateToWidth("Zen DeepSeek V4.1 Flash Free", 20))).toBeLessThanOrEqual(20)
})

test("truncateToWidth 不裁剪放得下的文本", () => {
  expect(truncateToWidth("short", 20)).toBe("short")
  expect(truncateToWidth("DeepSeek V4 Flash", 17)).toBe("DeepSeek V4 Flash")
})

test("truncateToWidth 保留双宽字符的列预算", () => {
  expect(truncateToWidth("免费模型很长很长", 7)).toBe("免费模…")
  expect(visualWidth(truncateToWidth("免费模型很长很长", 7))).toBeLessThanOrEqual(7)
  expect(truncateToWidth("任意文本", 0)).toBe("")
})

test("fitParts 只保留放得下的整段", () => {
  const parts = ["¥0.0250", "余额 ¥41.8500", "9 次"]
  expect(fitParts(parts, 27)).toBe("¥0.0250 · 余额 ¥41.8500")
  expect(fitParts(parts, 34)).toBe("¥0.0250 · 余额 ¥41.8500 · 9 次")
  expect(visualWidth(fitParts(parts, 27))).toBeLessThanOrEqual(27)
})

test("fitParts 放不下首段时才会截断", () => {
  expect(fitParts(["费用 ¥0.0250"], 6)).toBe("费用…")
  expect(fitParts(["费用 ¥0.0250"], 3)).toBe("费…")
  expect(fitParts(["费用 ¥0.0250"], 2)).toBe("…")
  expect(fitParts([], 10)).toBe("")
})

test("formatBalanceAmount 用人民币符号表示 CNY", () => {
  expect(formatBalanceAmount("CNY", 41.85)).toBe("¥41.8500")
  expect(formatBalanceAmount("USD", 1.5)).toBe("USD 1.5000")
})
