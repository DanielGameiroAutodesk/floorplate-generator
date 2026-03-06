// This is intentionally not exported to enforce usage of the factories for consistency.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const CustomDataSymbol = Symbol("CustomData")

export type CustomData = {
  __brand: typeof CustomDataSymbol
  [key: symbol]: unknown
}

export function createCustomData<T extends CustomData>(data: Omit<T, "__brand">): CustomData {
  return data as unknown as CustomData
}
