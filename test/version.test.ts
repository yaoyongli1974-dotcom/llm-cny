import { expect, test } from "bun:test"
import { isNewerVersion } from "../src/version.js"

test("更高版本才提示更新", () => {
  expect(isNewerVersion("2.0.1", "2.0.0")).toBe(true)
  expect(isNewerVersion("2.1.0", "2.0.9")).toBe(true)
  expect(isNewerVersion("3.0.0", "2.99.99")).toBe(true)
})

test("相同或更低版本不提示更新", () => {
  expect(isNewerVersion("2.0.0", "2.0.0")).toBe(false)
  expect(isNewerVersion("1.0.45", "2.0.0")).toBe(false)
  expect(isNewerVersion("1.9.9", "2.0.0")).toBe(false)
})

test("忽略预发布后缀", () => {
  expect(isNewerVersion("2.0.0-beta.1", "2.0.0")).toBe(false)
  expect(isNewerVersion("2.0.1-beta.1", "2.0.0")).toBe(true)
})

test("无法解析的版本不提示更新", () => {
  expect(isNewerVersion("latest", "2.0.0")).toBe(false)
  expect(isNewerVersion("2.x.0", "2.0.0")).toBe(false)
})
