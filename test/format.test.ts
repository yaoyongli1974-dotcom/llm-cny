import { expect, test } from "bun:test"
import { truncateToWidth, visualWidth } from "../src/tui/format.js"

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
