import type { Price, ModelPriceEntry } from "./types.js"

export const flashPrice: Price = {
  cacheHitInput: 0.02,
  cacheMissInput: 1,
  output: 2,
  discounted: false,
}

export const proPrice: Price = {
  cacheHitInput: 0.025,
  cacheMissInput: 3,
  output: 6,
  discounted: false,
}

export const DEEPSEEK_ENTRIES: readonly ModelPriceEntry[] = [
  {
    providerID: "deepseek",
    providerLabel: "DeepSeek",
    modelID: "deepseek-v4-flash",
    modelLabel: "V4 Flash",
    priceFor: () => flashPrice,
  },
  {
    providerID: "deepseek",
    providerLabel: "DeepSeek",
    modelID: "deepseek-v4-pro",
    modelLabel: "V4 Pro",
    priceFor: () => proPrice,
  },
  // OpenCode 的 deepseek provider 把 V4 Flash 暴露为 `deepseek-flash`（旧 ID 才是 `deepseek-v4-flash`），
  // 这里补一条别名，否则该模型的会话不会被识别，侧栏一直停在激活提示。
  {
    providerID: "deepseek",
    providerLabel: "DeepSeek",
    modelID: "deepseek-flash",
    modelLabel: "V4 Flash",
    priceFor: () => flashPrice,
  },
]
