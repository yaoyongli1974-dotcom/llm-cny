import { expect, test } from "bun:test"
import type { DisplayBalance } from "../src/balance.js"
import { sumBalances, type BalanceState } from "../src/tui/state.js"

function ready(currency: string, amount: number): BalanceState {
  const balance: DisplayBalance = {
    isAvailable: true,
    currency,
    totalBalance: amount.toFixed(4),
    amount,
    details: [],
  }
  return { status: "ready", balance, updatedAt: 0 }
}

test("sumBalances 汇总已就绪的余额", () => {
  const result = sumBalances([ready("CNY", 100), ready("CNY", 23.4567)])
  expect(result.total).toBeCloseTo(123.4567, 6)
  expect(result.counted).toBe(2)
  expect(result.expected).toBe(2)
  expect(result.currency).toBe("CNY")
})

test("sumBalances 跳过未就绪的 provider 并标记为部分", () => {
  const states: Array<BalanceState | undefined> = [
    ready("CNY", 100),
    { status: "missing" },
    { status: "loading" },
    { status: "error", message: "boom" },
    undefined,
  ]
  const result = sumBalances(states)
  expect(result.total).toBeCloseTo(100, 6)
  expect(result.counted).toBe(1)
  expect(result.expected).toBe(5)
})

test("sumBalances 只汇总第一种币种，避免混合币种相加", () => {
  const result = sumBalances([ready("CNY", 100), ready("USD", 20)])
  expect(result.total).toBeCloseTo(100, 6)
  expect(result.currency).toBe("CNY")
  expect(result.counted).toBe(1)
  expect(result.expected).toBe(2)
})

test("sumBalances 忽略没有数值的余额", () => {
  const broken: BalanceState = {
    status: "ready",
    balance: { isAvailable: true, currency: "CNY", totalBalance: "", amount: undefined, details: [] },
    updatedAt: 0,
  }
  const result = sumBalances([ready("CNY", 5), broken])
  expect(result.total).toBeCloseTo(5, 6)
  expect(result.counted).toBe(1)
  expect(result.expected).toBe(2)
})

test("sumBalances 在没有任何余额时返回 CNY 0", () => {
  expect(sumBalances([])).toEqual({ counted: 0, expected: 0, total: 0, currency: "CNY" })
  expect(sumBalances([{ status: "missing" }])).toEqual({
    counted: 0,
    expected: 1,
    total: 0,
    currency: "CNY",
  })
})
