export class LRUCache<K, V> {
  private cache: Map<K, V>
  private capacity: number

  constructor(capacity: number) {
    this.capacity = capacity
    this.cache = new Map()
  }

  get(key: K): V | undefined {
    if (!this.cache.has(key)) {
      return undefined
    }
    const value = this.cache.get(key)!
    this.cache.delete(key) // Remove the item
    this.cache.set(key, value) // Re-insert it to update its position
    return value
  }

  set(key: K, value: V): void {
    if (this.cache.has(key)) {
      this.cache.delete(key) // Remove the existing item
    } else if (this.cache.size === this.capacity) {
      // Evict the least recently used (LRU) item
      const firstKey = this.cache.keys().next().value
      this.cache.delete(firstKey!)
    }
    this.cache.set(key, value) // Insert the new item
  }
}
