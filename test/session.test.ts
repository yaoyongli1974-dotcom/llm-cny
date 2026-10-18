import type { SessionMessageInfo } from "@opencode/client"
import { expect, test } from "bun:test"
import {
  activeTrackedProviders,
  hasCopilotUsage,
  hasOpenAIApiKeyProvider,
  hasOpenAIOAuthProvider,
} from "../src/tui/session.js"

function assistantMessage(input: {
  providerID: string
  modelID: string
  completed?: number
}): SessionMessageInfo {
  return {
    id: `${input.providerID}-${input.modelID}`,
    type: "assistant",
    agent: "build",
    model: { providerID: input.providerID, id: input.modelID },
    content: [],
    time: input.completed === undefined ? { created: 0 } : { created: 0, completed: input.completed },
  } as SessionMessageInfo
}

function modelSelected(input: { providerID: string }): SessionMessageInfo {
  return {
    id: `model-${input.providerID}`,
    type: "model-switched",
    time: { created: 0 },
    model: { providerID: input.providerID, id: "m" },
  } as SessionMessageInfo
}

test("流式中的受支持回复不会激活 provider", () => {
  const providers = activeTrackedProviders([
    assistantMessage({
      providerID: "deepseek",
      modelID: "deepseek-v4-flash",
    }),
  ])

  expect(providers).toEqual([])
})

test("完成后的受支持回复会激活 provider", () => {
  const providers = activeTrackedProviders([
    assistantMessage({
      providerID: "deepseek",
      modelID: "deepseek-v4-flash",
      completed: 1,
    }),
  ])

  expect(providers.map((item) => item.id)).toEqual(["deepseek"])
})

test("OpenCode 实际暴露的 deepseek-flash 模型 ID 也会激活 provider", () => {
  const providers = activeTrackedProviders([
    assistantMessage({
      providerID: "deepseek",
      modelID: "deepseek-flash",
      completed: 1,
    }),
  ])

  expect(providers.map((item) => item.id)).toEqual(["deepseek"])
})

test("OpenCode Zen 的免费模型 deepseek-v4.1-flash-free 也会激活 provider", () => {
  const providers = activeTrackedProviders([
    assistantMessage({
      providerID: "opencode",
      modelID: "deepseek-v4.1-flash-free",
      completed: 1,
    }),
  ])

  expect(providers.map((item) => item.id)).toEqual(["opencode"])
})

test("完成后的 Xiaomi MiMo 回复会激活 provider", () => {
  const providers = activeTrackedProviders([
    assistantMessage({
      providerID: "xiaomi",
      modelID: "mimo-v2.5",
      completed: 1,
    }),
  ])

  expect(providers.map((item) => item.id)).toEqual(["xiaomi"])
})

test("完成后的 MiniMax M3 回复会激活 provider", () => {
  const providers = activeTrackedProviders([
    assistantMessage({
      providerID: "minimax-cn",
      modelID: "minimax-m3",
      completed: 1,
    }),
  ])

  expect(providers.map((item) => item.id)).toEqual(["minimax-cn"])
})

test("OpenAI OAuth provider 会激活 Codex 面板", () => {
  expect(
    hasOpenAIOAuthProvider([
      {
        id: "openai",
      },
    ]),
  ).toBe(true)
})

test("OpenAI API Key 模式不会激活 Codex 面板", () => {
  expect(
    hasOpenAIOAuthProvider([
      {
        id: "openai",
        settings: { apiKey: "sk-test" },
      },
    ]),
  ).toBe(false)
})

test("OpenAI API Key 模式会启用 OpenAI 价格统计", () => {
  expect(
    hasOpenAIApiKeyProvider([
      {
        id: "openai",
        settings: { apiKey: "sk-test" },
      },
    ]),
  ).toBe(true)
})

test("OpenAI OAuth 模式不会启用 OpenAI 价格统计", () => {
  const original = process.env.OPENAI_API_KEY
  process.env.OPENAI_API_KEY = ""
  try {
    expect(
      hasOpenAIApiKeyProvider([
        {
          id: "openai",
        },
      ]),
    ).toBe(false)
  } finally {
    if (original === undefined) {
      delete process.env.OPENAI_API_KEY
    } else {
      process.env.OPENAI_API_KEY = original
    }
  }
})

test("没有 Copilot 对话时不检测到 Copilot 额度", () => {
  expect(hasCopilotUsage([])).toBe(false)
  expect(
    hasCopilotUsage([
      assistantMessage({ providerID: "openai", modelID: "gpt-4o", completed: 1 }),
      modelSelected({ providerID: "openai" }),
    ]),
  ).toBe(false)
})

test("Copilot 助手回复会激活 Copilot 额度检测", () => {
  expect(
    hasCopilotUsage([
      assistantMessage({ providerID: "github-copilot", modelID: "gpt-4o", completed: 1 }),
    ]),
  ).toBe(true)
})

test("用户切换到 Copilot 模型也会激活", () => {
  expect(
    hasCopilotUsage([modelSelected({ providerID: "github-copilot" })]),
  ).toBe(true)
})
