const buffer = new BigUint64Array(1)
export function generateId() {
  return crypto.getRandomValues(buffer)[0].toString(36).substring(0, 10)
}
