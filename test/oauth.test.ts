import { expect, test } from "bun:test"
import { providerKeyFromAuth, readStoredProviderKeys } from "../src/oauth.js"

test("providerKeyFromAuth 读取 provider 的 key", () => {
  expect(providerKeyFromAuth({ deepseek: { type: "api", key: "sk-abc" } }, "deepseek")).toBe("sk-abc")
  expect(providerKeyFromAuth({ openai: { type: "oauth", key: "tok" } }, "openai")).toBe("tok")
})

test("providerKeyFromAuth 去掉首尾空白并忽略空字符串", () => {
  expect(providerKeyFromAuth({ deepseek: { key: "  sk-abc  " } }, "deepseek")).toBe("sk-abc")
  expect(providerKeyFromAuth({ deepseek: { key: "   " } }, "deepseek")).toBeUndefined()
})

test("providerKeyFromAuth 对缺失或异常结构返回 undefined", () => {
  expect(providerKeyFromAuth(null, "deepseek")).toBeUndefined()
  expect(providerKeyFromAuth(undefined, "deepseek")).toBeUndefined()
  expect(providerKeyFromAuth({}, "deepseek")).toBeUndefined()
  expect(providerKeyFromAuth({ deepseek: { key: 42 } }, "deepseek")).toBeUndefined()
  expect(providerKeyFromAuth({ deepseek: "sk-abc" }, "deepseek")).toBeUndefined()
  expect(providerKeyFromAuth({ openai: { key: "sk" } }, "deepseek")).toBeUndefined()
})

test("readStoredProviderKeys 读取已登录的多个 provider", async () => {
  const previous = process.env.OPENCODE_AUTH_CONTENT
  process.env.OPENCODE_AUTH_CONTENT = JSON.stringify({
    deepseek: { type: "api", key: "deepseek-key" },
    "moonshotai-cn": { type: "api", key: "moonshot-key" },
    opencode: { type: "api", key: "zen-key" },
  })
  try {
    const keys = await readStoredProviderKeys("/tmp/opencode/nonexistent-state", ["deepseek", "moonshotai-cn"])
    expect(keys).toEqual({ deepseek: "deepseek-key", "moonshotai-cn": "moonshot-key" })
  } finally {
    if (previous === undefined) delete process.env.OPENCODE_AUTH_CONTENT
    else process.env.OPENCODE_AUTH_CONTENT = previous
  }
})

test("readStoredProviderKeys 只返回被请求的 provider", async () => {
  const previous = process.env.OPENCODE_AUTH_CONTENT
  process.env.OPENCODE_AUTH_CONTENT = JSON.stringify({
    deepseek: { type: "api", key: "deepseek-key" },
    "moonshotai-cn": { type: "api", key: "moonshot-key" },
    opencode: { type: "api", key: "zen-key" },
  })
  try {
    const keys = await readStoredProviderKeys("/tmp/opencode/nonexistent-state", ["deepseek"])
    expect(keys).toEqual({ deepseek: "deepseek-key" })
  } finally {
    if (previous === undefined) delete process.env.OPENCODE_AUTH_CONTENT
    else process.env.OPENCODE_AUTH_CONTENT = previous
  }
})
