import type { RGBA } from "@opentui/core"
import { createSignal, For, Match, Show, Switch } from "solid-js"
import type { BalanceTrackedProvider, SessionCostSummary } from "../pricing.js"
import { PLUGIN_NAME } from "../version.js"
import { formatBalanceAmount, formatDetails, formatMoney, formatTime, formatTokens, truncateToWidth, visualWidth } from "./format.js"
import { balanceTone, type BalanceState } from "./state.js"
import type { Theme } from "./theme.js"


/** Shorter provider prefixes so model rows stay on one line in the narrow sidebar. */
const PROVIDER_SHORT: Record<string, string> = {
  "OpenCode Zen": "Zen",
}

export function providerShortName(label: string) {
  return PROVIDER_SHORT[label] ?? label
}

export function Header(props: {
  theme: Theme
  open: boolean
  onToggle: () => void
  canRefresh: boolean
  onRefresh: () => void
  /** Right-aligned summary shown while collapsed. */
  summaryText?: string
}) {
  const [hovered, setHovered] = createSignal(false)
  const refreshHovered = () => props.canRefresh && hovered()
  const summary = () => props.summaryText ?? ""

  return (
    <box flexDirection="row" justifyContent="space-between" gap={1}>
      <text fg={props.theme.text} selectable={false} onMouseUp={props.onToggle}>
        {props.open ? "▼ " : "▶ "}
        <b>LLM CNY</b>
      </text>
      <Show when={props.open && props.canRefresh}>
        <text
          fg={refreshHovered() ? props.theme.primary : props.theme.textMuted}
          bg={refreshHovered() ? props.theme.borderSubtle : undefined}
          selectable={false}
          onMouseOver={() => setHovered(true)}
          onMouseOut={() => setHovered(false)}
          onMouseDown={props.onRefresh}
        >
          {" 刷新 "}
        </text>
      </Show>
      <Show when={!props.open && summary() !== ""}>
        <text fg={props.theme.textMuted} selectable={false} onMouseUp={props.onToggle}>
          {summary()}
        </text>
      </Show>
    </box>
  )
}

export function UpdateBanner(props: {
  theme: Theme
  version: string
  activated: boolean
  onDismiss?: () => void
}) {
  return (
    <text fg={props.activated ? props.theme.warning : props.theme.textMuted} wrapMode="word" onMouseDown={props.onDismiss}>
      有新版本 {props.version}，运行 <b>opencode plugin {PLUGIN_NAME}@{props.version} --force</b> 更新
      <Show when={props.activated}>
        <span style={{ fg: props.theme.textMuted }}> · 点击关闭</span>
      </Show>
    </text>
  )
}

export function Summary(props: { theme: Theme; summary: SessionCostSummary; title?: string; width?: number }) {
  const anthropicModels = () => props.summary.models.filter((item) => item.providerID === "anthropic")
  const cacheWrite1hTotal = () => props.summary.cacheWrite1hCostCny
  const hasAnthropicCacheWrite = () => anthropicModels().some((item) => item.cacheWrite1hCostCny > 0)
  const modelValue = (item: SessionCostSummary["models"][number]) =>
    `${item.turns} 次 · ${item.costCny === 0 ? "免费" : formatMoney(item.costCny)}`
  const modelLabel = (item: SessionCostSummary["models"][number]) => {
    const label = `${providerShortName(item.providerLabel)} ${item.modelLabel}`
    const width = props.width ?? 0
    if (width <= 0) return label
    return truncateToWidth(label, width - visualWidth(modelValue(item)) - 1)
  }

  return (
    <box gap={0}>
      <MetricRow
        theme={props.theme}
        label="费用"
        value={`${props.summary.costCny === 0 ? "免费" : formatMoney(props.summary.costCny)} · ${props.summary.turns} 次`}
        strong
      />
      <text fg={props.theme.textMuted}>
        输入 {formatTokens(props.summary.cacheMissInputTokens)} · 缓存 {formatTokens(props.summary.cacheHitInputTokens)}
      </text>
      <text fg={props.theme.textMuted}>
        输出 {formatTokens(props.summary.outputTokens)} · 推理 {formatTokens(props.summary.reasoningTokens)}
      </text>
      <Show when={hasAnthropicCacheWrite()}>
        <text fg={props.theme.textMuted}>
          若 Claude 用 1h 缓存写入: +{formatMoney(cacheWrite1hTotal())}（未计入总费用）
        </text>
      </Show>
      <For each={props.summary.models}>
        {(item) => (
          <box gap={0}>
            <MetricRow
              theme={props.theme}
              label={modelLabel(item)}
              value={modelValue(item)}
            />
            <For each={item.warnings}>
              {(warning) => (
                <text fg={props.theme.warning} wrapMode="word">
                  {warning}
                </text>
              )}
            </For>
          </box>
        )}
      </For>
    </box>
  )
}

export function ActivationPrompt(props: { theme: Theme }) {
  return (
    <box gap={1}>
      <text fg={props.theme.textMuted} wrapMode="word">
        使用 DeepSeek、moonshot China、Xiaomi MiMo、ZhipuAI、Alibaba Cloud、xAI、Anthropic、OpenAI API Key 或 GitHub Copilot OAuth
        模型返回一次消息后激活
      </text>
    </box>
  )
}

export function EmptyUsage(props: { theme: Theme }) {
  return (
    <box gap={1}>
      <MetricRow theme={props.theme} label="费用" value="¥0.0000" strong />
      <text fg={props.theme.textMuted}>本会话暂无已支持模型用量</text>
    </box>
  )
}

/** Aggregate of every provider balance, shown above the per-provider rows. */
export function TotalBalance(props: {
  theme: Theme
  total: number
  currency: string
  counted: number
  expected: number
}) {
  const partial = () => props.counted < props.expected
  const value = () => {
    const amount = formatBalanceAmount(props.currency, props.total)
    return partial() ? `${amount} · ${props.counted}/${props.expected}` : amount
  }

  return (
    <MetricRow
      theme={props.theme}
      label="总余额"
      value={value()}
      color={balanceTone(props.theme, props.total)}
      strong
    />
  )
}

export function ProviderBalance(props: {
  theme: Theme
  provider: BalanceTrackedProvider
  state: BalanceState
}) {
  const amount = () => (props.state.status === "ready" ? props.state.balance.amount : undefined)
  const tone = () => balanceTone(props.theme, amount())

  const label = () => `余额 · ${props.provider.label}`

  return (
    <box gap={0}>
      <Switch>
        <Match when={props.state.status === "idle" || props.state.status === "loading"}>
          <MetricRow theme={props.theme} label={label()} value="正在读取..." />
        </Match>
        <Match when={props.state.status === "missing"}>
          <text fg={props.theme.warning} wrapMode="word">
            {label()} 未找到 API Key
          </text>
        </Match>
        <Match when={props.state.status === "error"}>
          <text fg={props.theme.error} wrapMode="word">
            {label()} {props.state.status === "error" && props.state.message ? props.state.message : "读取失败"}
          </text>
        </Match>
        <Match when={props.state.status === "ready"}>
          <box gap={0}>
            <MetricRow
              theme={props.theme}
              label={label()}
              value={`${props.state.status === "ready" && !props.state.balance.isAvailable ? "不可用 " : ""}${props.state.status === "ready" ? props.state.balance.currency : "CNY"} ${props.state.status === "ready" ? props.state.balance.totalBalance : "0"
                }`}
              color={tone()}
              strong
            />
            <Show when={props.state.status === "ready" && props.state.balance.details.length > 0}>
              <text fg={props.theme.textMuted}>
                {props.state.status === "ready" ? formatDetails(props.state.balance.details) : ""}
              </text>
            </Show>
            <Show when={amount() !== undefined && amount()! <= 3}>
              <text fg={tone()} wrapMode="word">
                余额偏低，建议去 {props.provider.label} 控制台充值
              </text>
            </Show>
            <text fg={props.theme.textMuted}>余额延迟约5分钟，可点「刷新」更新</text>
            <text fg={props.theme.textMuted}>
              {props.state.status === "ready" ? formatTime(props.state.updatedAt) : ""}
            </text>
          </box>
        </Match>
      </Switch>
    </box>
  )
}

export function MetricRow(props: {
  theme: Theme
  label: string
  value: string
  strong?: boolean
  color?: RGBA
}) {
  return (
    <box flexDirection="row" justifyContent="space-between" gap={1}>
      <text fg={props.theme.textMuted}>{props.label}</text>
      <text fg={props.color ?? (props.strong ? props.theme.success : props.theme.text)}>
        <Show when={props.strong} fallback={props.value}>
          <b>{props.value}</b>
        </Show>
      </text>
    </box>
  )
}

export function Divider(props: { theme: Theme; width?: number }) {
  return <text fg={props.theme.borderSubtle}>{"─".repeat(Math.max(1, props.width ?? 20))}</text>
}
