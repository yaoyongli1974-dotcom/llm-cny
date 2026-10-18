import { RGBA } from "@opentui/core"
import type { Theme } from "./theme.js"
import type { DisplayBalance } from "../balance.js"
import { BALANCE_TRACKED_PROVIDERS, TRACKED_PROVIDERS, type BalanceProviderID } from "../pricing.js"

export type BalanceState =
  | {
    status: "idle" | "loading" | "missing"
  }
  | {
    status: "ready"
    balance: DisplayBalance
    updatedAt: number
  }
  | {
    status: "error"
    message: string
  }

export type BalanceStateMap = Partial<Record<BalanceProviderID, BalanceState>>
export type TrackedProvider = (typeof TRACKED_PROVIDERS)[number]

export type BalanceTotal = {
  /** Providers whose balance is included in the sum. */
  counted: number
  /** Providers that were asked for a balance. */
  expected: number
  total: number
  currency: string
}

/**
 * Sums ready provider balances. Providers still loading, missing a key or failed are
 * skipped, and only the first currency seen is summed so mixed currencies never
 * produce a meaningless number; `counted < expected` then marks the sum as partial.
 */
export function sumBalances(states: ReadonlyArray<BalanceState | undefined>): BalanceTotal {
  const ready = states.filter(
    (state): state is Extract<BalanceState, { status: "ready" }> => state?.status === "ready",
  )
  const amounts = ready
    .map((state) => ({ amount: state.balance.amount, currency: state.balance.currency }))
    .filter((item): item is { amount: number; currency: string } => item.amount !== undefined)
  const currency = amounts[0]?.currency ?? "CNY"
  const included = amounts.filter((item) => item.currency === currency)

  return {
    counted: included.length,
    expected: states.length,
    total: included.reduce((sum, item) => sum + item.amount, 0),
    currency,
  }
}

const orange = RGBA.fromInts(255, 135, 0)

const LOW_BALANCE_CNY = 3
const HIGH_BALANCE_CNY = 9

export function balanceTone(theme: Theme, amount: number | undefined) {
  if (amount === undefined) return theme.success
  if (amount <= 0) return theme.error
  if (amount <= LOW_BALANCE_CNY) return orange
  if (amount <= HIGH_BALANCE_CNY) return theme.warning
  return theme.success
}

export function tokenSignature(tokens: Partial<Record<BalanceProviderID, string>>) {
  return BALANCE_TRACKED_PROVIDERS.map((provider) => `${provider.id}:${tokens[provider.id] ?? ""}`).join("|")
}
