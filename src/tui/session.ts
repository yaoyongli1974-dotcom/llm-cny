import type { SessionInfo, SessionMessageAssistant, SessionMessageInfo } from "@opencode/client"
import { BALANCE_TRACKED_PROVIDERS, TRACKED_PROVIDERS, trackedModel, type BalanceProviderID, type TrackedProviderID } from "../pricing.js"
import { isRecord } from "../utils.js"

/** The subset of `ProviderInfo` this plugin reads. */
export type ProviderInfoLike = {
  id: string
  settings?: unknown
}

const PROVIDER_ENV: Record<string, readonly string[]> = {
  openai: ["OPENAI_API_KEY"],
  "github-copilot": ["GITHUB_TOKEN", "GH_TOKEN"],
}

export function providerTokens(
  providers: ReadonlyArray<ProviderInfoLike>,
  config?: unknown,
  storedKeys: Partial<Record<BalanceProviderID, string>> = {},
) {
  const result: Partial<Record<BalanceProviderID, string>> = {}
  for (const provider of BALANCE_TRACKED_PROVIDERS) {
    result[provider.id] = findProviderApiKey(providers, config, storedKeys, provider)
  }
  return result
}

export function activeTrackedProviders(messages: ReadonlyArray<SessionMessageInfo>) {
  const ids = new Set<TrackedProviderID>()
  for (const item of messages) {
    const model = completedTrackedModel(item)
    if (model) ids.add(model.providerID)
  }
  return TRACKED_PROVIDERS.filter((item) => ids.has(item.id))
}

export function hasOpenAIOAuthProvider(providers: ReadonlyArray<ProviderInfoLike>) {
  const openai = providers.find((item) => item.id === "openai")
  if (!openai) return false
  return !hasProviderApiKey(openai)
}

export function hasCopilotOAuthProvider(providers: ReadonlyArray<ProviderInfoLike>) {
  const copilot = providers.find((item) => item.id === "github-copilot")
  if (!copilot) return false
  return !hasProviderApiKey(copilot)
}

function hasProviderApiKey(provider: ProviderInfoLike) {
  const candidates = [
    readString(provider.settings, "apiKey"),
    ...(PROVIDER_ENV[provider.id] ?? []).map((name) => process.env[name]),
  ]
  return candidates.some((item) => typeof item === "string" && item.trim() !== "")
}

export function hasOpenAIApiKeyProvider(providers: ReadonlyArray<ProviderInfoLike>, config?: unknown) {
  const openai = providers.find((item) => item.id === "openai")
  if (openai && hasProviderApiKey(openai)) return true
  const configApiKey = readProviderConfigString(config, "openai", "apiKey")
  return typeof configApiKey === "string" && configApiKey.trim() !== ""
}

export function hasOpenAIUsage(messages: ReadonlyArray<SessionMessageInfo>) {
  return messages.some((item) => modelRefOf(item)?.providerID.toLowerCase() === "openai")
}

export function hasCopilotUsage(messages: ReadonlyArray<SessionMessageInfo>) {
  return messages.some((item) => modelRefOf(item)?.providerID.toLowerCase() === "github-copilot")
}

export function completedTrackedReplyKey(messages: ReadonlyArray<SessionMessageInfo>) {
  return messages
    .flatMap((item) => {
      if (item.type !== "assistant") return []
      if (!completedTrackedModel(item)) return []
      return [`${item.id}:${item.time.completed}`]
    })
    .join("|")
}

export function usageRecords(messages: ReadonlyArray<SessionMessageInfo>) {
  return messages.flatMap((item) => {
    if (item.type !== "assistant") return []
    if (!item.tokens) return []
    return [
      {
        providerID: item.model.providerID.toLowerCase(),
        modelID: item.model.id.toLowerCase(),
        time: item.time,
        tokens: item.tokens,
      },
    ]
  })
}

export function childUsageRefreshKey(input: {
  sessionID: string
  session?: SessionInfo
  localChildSessionIDs: ReadonlyArray<string>
  messages: ReadonlyArray<SessionMessageInfo>
}) {
  return [
    input.sessionID,
    input.session?.time.updated ?? "",
    input.localChildSessionIDs.join(","),
    input.messages
      .map((item) => `${item.id}:${item.type === "assistant" ? (item.time.completed ?? "") : ""}`)
      .join("|"),
  ].join("|")
}

export function taskChildSessionIDs(messages: ReadonlyArray<SessionMessageInfo>) {
  const result = new Set<string>()
  for (const message of messages) {
    if (message.type !== "assistant") continue
    for (const content of message.content) {
      const sessionID = taskChildSessionID(content)
      if (sessionID) result.add(sessionID)
    }
  }
  return [...result].sort()
}

export function mergeMessages(...groups: ReadonlyArray<ReadonlyArray<SessionMessageInfo>>) {
  const result = new Map<string, SessionMessageInfo>()
  for (const group of groups) {
    for (const message of group) {
      result.set(message.id, message)
    }
  }
  return [...result.values()]
}

export function isSubagentSession(session: SessionInfo) {
  return session.parentID !== undefined
}

function findProviderApiKey(
  providers: ReadonlyArray<ProviderInfoLike>,
  config: unknown,
  storedKeys: Partial<Record<BalanceProviderID, string>>,
  tracked: (typeof BALANCE_TRACKED_PROVIDERS)[number],
) {
  const provider = providers.find((item) => item.id === tracked.id)
  const sources = [
    readString(provider?.settings, "apiKey"),
    ...tracked.env.map((name) => process.env[name]),
    readProviderConfigApiKey(config, tracked.id),
    // OpenCode keeps its own credentials outside the provider list; fall back to them last.
    storedKeys[tracked.id],
  ]

  return sources.find((item) => typeof item === "string" && item.trim() !== "")?.trim()
}

function readProviderConfigApiKey(config: unknown, providerID: BalanceProviderID) {
  return readProviderConfigString(config, providerID, "apiKey")
}

function readProviderConfigString(config: unknown, providerID: string, key: string) {
  if (!isRecord(config)) return undefined
  if (!isRecord(config.provider)) return undefined
  const provider = config.provider[providerID]
  if (!isRecord(provider)) return undefined
  if (!isRecord(provider.options)) return undefined
  return readString(provider.options, key)
}

function taskChildSessionID(part: SessionMessageAssistant["content"][number]) {
  if (part.type !== "tool" || part.name !== "task") return undefined
  const metadata = "metadata" in part.state ? part.state.metadata : undefined
  return readString(metadata, "sessionId")
}

function readString(value: unknown, key: string) {
  if (!isRecord(value)) return undefined
  return typeof value[key] === "string" ? value[key] : undefined
}

function modelRefOf(message: SessionMessageInfo) {
  if (message.type === "assistant" || message.type === "model-switched") return message.model
  return undefined
}

function completedTrackedModel(message: SessionMessageInfo) {
  if (message.type !== "assistant") return undefined
  if (message.time.completed === undefined) return undefined
  return trackedModel(message.model.providerID.toLowerCase(), message.model.id.toLowerCase())
}
