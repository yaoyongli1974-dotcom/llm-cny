/** @jsxImportSource @opentui/solid */
import type { BoxRenderable } from "@opentui/core"
import type { SessionMessageInfo } from "@opencode/client"
import { Plugin } from "@opencode/plugin/tui"
import type { Context } from "@opencode/plugin/tui/context"
import { createEffect, createMemo, createSignal, For, onCleanup, onMount, Show } from "solid-js"
import { fetchDisplayBalance } from "./balance.js"
import { fetchCopilotUsage, type CopilotQuota } from "./copilot-usage.js"
import { fetchCodexUsage, type CodexUsage } from "./codex-usage.js"
import { fetchUsdCnyRate } from "./exchange-rate.js"
import { readStoredProviderKeys } from "./oauth.js"
import {
  BALANCE_TRACKED_PROVIDERS,
  calculateTrackedSession,
  supportsBalance,
  type BalanceProviderID,
} from "./pricing.js"
import {
  ActivationPrompt,
  Divider,
  EmptyUsage,
  Header,
  ProviderBalance,
  Summary,
  TotalBalance,
  UpdateBanner,
} from "./tui/components.js"
import { CodexUsagePanel } from "./tui/codex-components.js"
import { CopilotQuotaPanel } from "./tui/copilot-components.js"
import { errorMessage, fitParts, formatBalanceAmount, formatMoney, visualWidth } from "./tui/format.js"
import { parseOptions, type Options } from "./tui/options.js"
import { randomCodexRefreshMs } from "./tui/refresh.js"
import {
  activeTrackedProviders,
  childUsageRefreshKey,
  completedTrackedReplyKey,
  hasCopilotOAuthProvider,
  hasCopilotUsage,
  hasOpenAIApiKeyProvider,
  hasOpenAIOAuthProvider,
  hasOpenAIUsage,
  mergeMessages,
  providerTokens,
  taskChildSessionIDs,
  usageRecords,
} from "./tui/session.js"
import { defaultStateDir } from "./tui/paths.js"
import { sumBalances, tokenSignature, type BalanceState, type BalanceStateMap } from "./tui/state.js"
import { themeFrom } from "./tui/theme.js"
import { isNewerVersion, PLUGIN_NAME, PLUGIN_VERSION } from "./version.js"

type CodexState =
  | { status: "idle" | "loading" }
  | { status: "ready"; usage: CodexUsage }
  | { status: "error"; message: string }
  | { status: "no-auth" }

type CopilotState =
  | { status: "idle" | "loading" }
  | { status: "ready"; quota: CopilotQuota }
  | { status: "error"; message: string }
  | { status: "no-auth" }

// Distinct from PLUGIN_NAME in version.ts: PLUGIN_NAME is the npm package name,
// pluginID is the OpenCode plugin slot id retained for backwards compatibility.
const pluginID = "opencode-tui-deepseek-cny"
let versionCheckDone = false

function View(props: { ctx: Context; options: Options; session_id: string }) {
  const theme = createMemo(() => themeFrom(props.ctx.theme))
  const providers = createMemo(() => props.ctx.data.location.provider.list(props.ctx.location) ?? [])
  const [balances, setBalances] = createSignal<BalanceStateMap>({})
  const [storedKeys, setStoredKeys] = createSignal<Partial<Record<BalanceProviderID, string>>>({})
  const [remoteChildMessages, setRemoteChildMessages] = createSignal<ReadonlyArray<SessionMessageInfo>>([])
  const session = createMemo(() => props.ctx.data.session.get(props.session_id))
  const messages = createMemo(() => props.ctx.data.session.message.list(props.session_id))
  const localChildSessionIDs = createMemo(() => taskChildSessionIDs(messages()))
  const localChildMessages = createMemo(() =>
    localChildSessionIDs().flatMap((sessionID) => props.ctx.data.session.message.list(sessionID)),
  )
  const usageMessages = createMemo(() => mergeMessages(messages(), localChildMessages(), remoteChildMessages()))
  const openAIApiKeyEnabled = createMemo(() => hasOpenAIApiKeyProvider(providers()))
  const costMessages = createMemo(() =>
    openAIApiKeyEnabled() ? usageMessages() : usageMessages().filter((item) => item.type !== "assistant" || item.model.providerID !== "openai"),
  )
  const tokens = createMemo(() => providerTokens(providers(), undefined, storedKeys()))
  const activeProviders = createMemo(() => activeTrackedProviders(costMessages()))
  const activeBalanceProviders = createMemo(() => activeProviders().filter(supportsBalance))
  const hasTrackedUsage = createMemo(() => activeProviders().length > 0)
  const needsUsdCnyRate = createMemo(() =>
    activeProviders().some((item) => item.id === "openrouter" || item.id === "xai" || item.id === "anthropic" || item.id === "openai" || item.id === "google" || item.id === "google-vertex"),
  )
  const codexEnabled = createMemo(() => hasOpenAIOAuthProvider(providers()) && hasOpenAIUsage(usageMessages()))
  const copilotEnabled = createMemo(
    () => hasCopilotOAuthProvider(providers()) && hasCopilotUsage(usageMessages()),
  )
  const activated = createMemo(() => hasTrackedUsage() || codexEnabled() || copilotEnabled())
  const completedTrackedReplies = createMemo(() => completedTrackedReplyKey(costMessages()))
  const childRefreshKey = createMemo(() =>
    childUsageRefreshKey({
      sessionID: props.session_id,
      session: session(),
      localChildSessionIDs: localChildSessionIDs(),
      messages: messages(),
    }),
  )
  const [usdCnyRate, setUsdCnyRate] = createSignal<number | undefined>()
  const summary = createMemo(() => calculateTrackedSession(usageRecords(costMessages()), { usdCnyRate: usdCnyRate() }))
  const visible = createMemo(() => props.options.showWhenEmpty || activated())
  // Sidebar starts collapsed to keep the panel to a single line; click the header to expand.
  const [open, setOpen] = createSignal(false)
  const toggleOpen = () => setOpen((value) => !value)
  const [panelWidth, setPanelWidth] = createSignal(0)
  let boxEl: BoxRenderable | undefined
  const measurePanel = () => {
    const width = boxEl?.width ?? 0
    if (width > 0) setPanelWidth(width)
  }
  const balanceTotal = createMemo(() =>
    sumBalances(activeBalanceProviders().map((provider) => balances()[provider.id])),
  )
  const summaryText = createMemo(() => {
    if (!activated()) return "未激活"
    if (summary().turns === 0) return "已激活"
    const parts = [summary().costCny === 0 ? "免费" : formatMoney(summary().costCny)]
    const total = balanceTotal()
    if (total.counted > 0) parts.push(`余额 ${formatBalanceAmount(total.currency, total.total)}`)
    parts.push(`${summary().turns} 次`)
    const width = panelWidth()
    if (width <= 0) return parts.join(" · ")
    // Keep the collapsed row on one line; the turn count is the first thing dropped.
    return fitParts(parts, Math.max(8, width - visualWidth("▶ LLM CNY") - 1))
  })
  const [updateVersion, setUpdateVersion] = createSignal<string | null>(null)
  const [updateBannerDismissed, setUpdateBannerDismissed] = createSignal(false)
  const showableUpdateVersion = createMemo(() => {
    const version = updateVersion()
    if (!version) return null
    if (activated() && updateBannerDismissed()) return null
    return version
  })
  const [codexState, setCodexState] = createSignal<CodexState>({ status: "idle" })
  const [copilotState, setCopilotState] = createSignal<CopilotState>({ status: "idle" })
  let updateBannerTimer: ReturnType<typeof setTimeout> | undefined

  const dismissUpdateBanner = () => {
    clearTimeout(updateBannerTimer)
    setUpdateBannerDismissed(true)
  }

  const controllers = new Map<BalanceProviderID, AbortController>()
  let previousTokenSignature = tokenSignature(tokens())
  let previousCompletedTrackedReplies = ""
  let childUsageRequest = 0
  let codexRefreshTimer: ReturnType<typeof setTimeout> | undefined
  let exchangeRateController: AbortController | undefined
  let disposed = false

  const setProviderBalance = (providerID: BalanceProviderID, state: BalanceState) => {
    setBalances((current) => ({
      ...current,
      [providerID]: state,
    }))
  }

  const refreshProvider = (providerID: BalanceProviderID, current = tokens()[providerID]) => {
    controllers.get(providerID)?.abort()
    if (!current) {
      setProviderBalance(providerID, { status: "missing" })
      return
    }

    const next = new AbortController()
    controllers.set(providerID, next)
    setProviderBalance(providerID, { status: "loading" })
    fetchDisplayBalance(providerID, current, next.signal).then(
      (result) => {
        if (next.signal.aborted || controllers.get(providerID) !== next) return
        if (!result.ok) {
          setProviderBalance(providerID, { status: "error", message: result.message })
          return
        }
        setProviderBalance(providerID, { status: "ready", balance: result.balance, updatedAt: Date.now() })
      },
      (cause) => {
        if (next.signal.aborted || controllers.get(providerID) !== next) return
        setProviderBalance(providerID, { status: "error", message: errorMessage(cause) })
      },
    )
  }

  const refreshChildUsage = async () => {
    const request = ++childUsageRequest
    try {
      const ids = new Set<string>(localChildSessionIDs())
      for (const child of props.ctx.data.session.list()) {
        if (child.parentID === props.session_id) ids.add(child.id)
      }

      if (ids.size === 0) {
        setRemoteChildMessages([])
        return
      }

      const responses = await Promise.all(
        [...ids].map((sessionID) => props.ctx.client.message.list({ sessionID })),
      )
      if (request !== childUsageRequest) return

      setRemoteChildMessages(responses.flatMap((response) => response.data))
    } catch {
      if (request === childUsageRequest) setRemoteChildMessages([])
    }
  }

  const refreshStoredKeys = async () => {
    try {
      const keys = await readStoredProviderKeys(
        defaultStateDir(),
        BALANCE_TRACKED_PROVIDERS.map((provider) => provider.id),
      )
      setStoredKeys(keys)
    } catch {
      // Keep the keys we already have when the credential store cannot be read.
    }
  }

  const refreshActive = () => {
    for (const provider of activeBalanceProviders()) {
      refreshProvider(provider.id)
    }
  }

  const refreshUsdCnyRate = () => {
    if (!needsUsdCnyRate()) return
    exchangeRateController?.abort()
    const next = new AbortController()
    exchangeRateController = next
    fetchUsdCnyRate(next.signal).then(
      (result) => {
        if (next.signal.aborted || exchangeRateController !== next) return
        if (result.ok) setUsdCnyRate(result.rate)
      },
      () => {
        // Keep the previous successful rate, or the pending warning if none was loaded yet.
      },
    )
  }

  let codexRequest = 0
  let copilotRequest = 0
  const clearCodexRefreshTimer = () => {
    clearTimeout(codexRefreshTimer)
    codexRefreshTimer = undefined
  }

  const scheduleCodexRefresh = () => {
    if (disposed || !codexEnabled()) return

    codexRefreshTimer = setTimeout(() => {
      void refreshCodexUsage()
    }, randomCodexRefreshMs())
  }

  const refreshCodexUsage = async () => {
    clearCodexRefreshTimer()
    if (disposed) return
    if (!codexEnabled()) {
      setCodexState({ status: "no-auth" })
      return
    }
    const request = ++codexRequest
    setCodexState((prev) => (prev.status === "ready" ? prev : { status: "loading" }))
    try {
      const stateDir = defaultStateDir()
      const result = await fetchCodexUsage(stateDir)
      if (disposed || request !== codexRequest) return
      if (result.ok) {
        setCodexState({ status: "ready", usage: result.usage })
      } else {
        setCodexState({ status: "error", message: result.message })
      }
    } catch (cause) {
      if (disposed || request !== codexRequest) return
      setCodexState({ status: "error", message: errorMessage(cause) })
    } finally {
      if (!disposed && request === codexRequest && codexEnabled()) {
        scheduleCodexRefresh()
      }
    }
  }

  let copilotRefreshTimer: ReturnType<typeof setTimeout> | undefined

  const clearCopilotRefreshTimer = () => {
    clearTimeout(copilotRefreshTimer)
    copilotRefreshTimer = undefined
  }

  const scheduleCopilotRefresh = () => {
    if (disposed || !copilotEnabled()) return
    copilotRefreshTimer = setTimeout(() => {
      void refreshCopilotUsage()
    }, randomCodexRefreshMs())
  }

  const refreshCopilotUsage = async () => {
    clearCopilotRefreshTimer()
    if (disposed) return
    if (!copilotEnabled()) {
      setCopilotState({ status: "no-auth" })
      return
    }
    const request = ++copilotRequest
    setCopilotState((prev) => (prev.status === "ready" ? prev : { status: "loading" }))
    try {
      const stateDir = defaultStateDir()
      const result = await fetchCopilotUsage(stateDir)
      if (disposed || request !== copilotRequest) return
      if (result.ok) {
        setCopilotState({ status: "ready", quota: result.quota })
      } else {
        setCopilotState({ status: "error", message: result.message })
      }
    } catch (cause) {
      if (disposed || request !== copilotRequest) return
      setCopilotState({ status: "error", message: errorMessage(cause) })
    } finally {
      if (!disposed && request === copilotRequest && copilotEnabled()) {
        scheduleCopilotRefresh()
      }
    }
  }

  createEffect(() => {
    const current = tokenSignature(tokens())
    if (current === previousTokenSignature) return
    previousTokenSignature = current
    if (!activated()) return
    refreshActive()
  })

  createEffect(() => {
    childRefreshKey()
    void refreshChildUsage()
  })

  createEffect(() => {
    if (needsUsdCnyRate() && usdCnyRate() === undefined) refreshUsdCnyRate()
  })

  createEffect(() => {
    const current = completedTrackedReplies()
    if (current === previousCompletedTrackedReplies) return
    previousCompletedTrackedReplies = current
    if (current === "") return
    refreshActive()
  })

  createEffect(() => {
    if (!activated() || !updateVersion() || updateBannerDismissed()) return
    clearTimeout(updateBannerTimer)
    updateBannerTimer = setTimeout(() => {
      setUpdateBannerDismissed(true)
    }, 7000)
    onCleanup(() => clearTimeout(updateBannerTimer))
  })

  createEffect(() => {
    if (!codexEnabled()) {
      clearCodexRefreshTimer()
      setCodexState({ status: "no-auth" })
      return
    }

    void refreshCodexUsage()
  })

  createEffect(() => {
    if (!copilotEnabled()) {
      clearCopilotRefreshTimer()
      setCopilotState({ status: "no-auth" })
      return
    }

    void refreshCopilotUsage()
  })

  onMount(() => {
    void refreshStoredKeys()
    const interval = setInterval(() => {
      void refreshStoredKeys()
      if (activated()) refreshActive()
      if (needsUsdCnyRate()) refreshUsdCnyRate()
    }, props.options.balanceRefreshMs)
    onCleanup(() => clearInterval(interval))

    if (!versionCheckDone) {
      versionCheckDone = true
      void checkLatestVersion(props.ctx, setUpdateVersion)
    }
  })

  onCleanup(() => {
    disposed = true
    clearTimeout(updateBannerTimer)
    clearCodexRefreshTimer()
    clearCopilotRefreshTimer()
    for (const controller of controllers.values()) {
      controller.abort()
    }
    exchangeRateController?.abort()
  })

  return (
    <Show when={visible()}>
      <box gap={0} ref={(el: BoxRenderable) => { boxEl = el }} onSizeChange={measurePanel}>
        <Header
          theme={theme()}
          open={open()}
          onToggle={toggleOpen}
          summaryText={summaryText()}
          canRefresh={
            (hasTrackedUsage() && activeBalanceProviders().some((item) => tokens()[item.id] !== undefined)) ||
            codexEnabled() ||
            copilotEnabled() ||
            needsUsdCnyRate()
          }
          onRefresh={() => {
            refreshActive()
            refreshUsdCnyRate()
            void refreshCodexUsage()
            void refreshCopilotUsage()
          }}
        />
        <Show when={showableUpdateVersion()}>
          {(version) => (
            <UpdateBanner
              theme={theme()}
              version={version()}
              activated={activated()}
              onDismiss={activated() ? dismissUpdateBanner : undefined}
            />
          )}
        </Show>
        <Show when={open()}>
          <Show when={activated()} fallback={<ActivationPrompt theme={theme()} />}>
            <Show when={hasTrackedUsage()}>
              <Show when={summary().turns > 0} fallback={<EmptyUsage theme={theme()} />}>
                <Summary theme={theme()} summary={summary()} title={session()?.title} width={panelWidth()} />
              </Show>
              <Divider theme={theme()} width={panelWidth()} />
            </Show>
            <Show when={codexEnabled()}>
              <CodexUsagePanel theme={theme()} state={codexState()} />
              <Show when={hasTrackedUsage() || copilotEnabled()}>
                <Divider theme={theme()} width={panelWidth()} />
              </Show>
            </Show>
            <Show when={copilotEnabled()}>
              <CopilotQuotaPanel theme={theme()} state={copilotState()} />
              <Show when={hasTrackedUsage()}>
                <Divider theme={theme()} width={panelWidth()} />
              </Show>
            </Show>
            <Show when={balanceTotal().counted > 0}>
              <TotalBalance
                theme={theme()}
                total={balanceTotal().total}
                currency={balanceTotal().currency}
                counted={balanceTotal().counted}
                expected={balanceTotal().expected}
              />
            </Show>
            <For each={activeBalanceProviders()}>
              {(provider) => (
                <ProviderBalance
                  theme={theme()}
                  provider={provider}
                  state={balances()[provider.id] ?? { status: "idle" }}
                />
              )}
            </For>
          </Show>
        </Show>
      </box>
    </Show>
  )
}

async function checkLatestVersion(ctx: Context, setUpdateVersion: (version: string) => void) {
  try {
    const res = await fetch(`https://registry.npmjs.org/${PLUGIN_NAME}`)
    if (!res.ok) return
    const data = (await res.json()) as { ["dist-tags"]?: { latest?: string } }
    const latest = data["dist-tags"]?.latest
    if (latest && isNewerVersion(latest, PLUGIN_VERSION)) {
      setUpdateVersion(latest)
      await ctx.attention.notify({
        title: "LLM CNY 有新版本",
        message: `发现 ${PLUGIN_NAME} ${latest}，运行 opencode plugin ${PLUGIN_NAME}@${latest} --force 更新`,
        notification: { when: "always" },
      })
    }
  } catch {
    // silently ignore network errors
  }
}

export default Plugin.define({
  id: pluginID,
  setup(ctx) {
    const options = parseOptions(ctx.options)
    return ctx.ui.slot({
      append: "sidebar.content",
      render: ({ sessionID }) => <View ctx={ctx} options={options} session_id={sessionID} />,
    })
  },
})
