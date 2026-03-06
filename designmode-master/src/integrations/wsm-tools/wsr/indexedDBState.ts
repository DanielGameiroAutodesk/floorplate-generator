export const IndexedDBState = {
  databaseName: "Forma_DB",
  storeName: "Forma_Store",

  // Create the store if it doesn't exist
  _handleUpgradeNeeded: (event: IDBVersionChangeEvent) => {
    const db = event.target?.result

    // Create the store if it doesn't exist
    if (!db.objectStoreNames.contains(IndexedDBState.storeName)) {
      db.createObjectStore(IndexedDBState.storeName, { keyPath: "id" })
    }
  },

  // Set a key-value pair
  async set(key: string, value: string) {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.databaseName, 2)

      request.onupgradeneeded = this._handleUpgradeNeeded

      request.onsuccess = function (event) {
        const db = event.target?.result
        const transaction = db.transaction(IndexedDBState.storeName, "readwrite")
        const store = transaction.objectStore(IndexedDBState.storeName)

        store.put({ id: key, value })

        transaction.oncomplete = function () {
          resolve(`Key "${key}" stored successfully.`)
        }

        transaction.onerror = function () {
          reject(new Error(`Failed to store key "${key}".`))
        }
      }

      request.onerror = function () {
        reject(new Error("Failed to open IndexedDB."))
      }
    })
  },

  // Get a value by key
  async get(key: string): Promise<string | undefined> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.databaseName, 2)

      request.onupgradeneeded = this._handleUpgradeNeeded

      request.onsuccess = function (event) {
        const db = event.target?.result
        const transaction = db.transaction(IndexedDBState.storeName, "readonly")
        const store = transaction.objectStore(IndexedDBState.storeName)

        const getRequest = store.get(key)

        getRequest.onsuccess = function () {
          resolve(getRequest.result ? getRequest.result.value : undefined)
        }

        getRequest.onerror = function () {
          reject(new Error(`Failed to retrieve key "${key}".`))
        }
      }

      request.onerror = function () {
        reject(new Error("Failed to open IndexedDB."))
      }
    })
  },

  // Delete a key-value pair
  async delete(key: string) {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.databaseName, 2)

      request.onupgradeneeded = this._handleUpgradeNeeded

      request.onsuccess = function (event) {
        const db = event.target?.result
        const transaction = db.transaction(IndexedDBState.storeName, "readwrite")
        const store = transaction.objectStore(IndexedDBState.storeName)

        const deleteRequest = store.delete(key)

        deleteRequest.onsuccess = function () {
          resolve(`Key "${key}" deleted successfully.`)
        }

        deleteRequest.onerror = function () {
          reject(new Error(`Failed to delete key "${key}".`))
        }
      }

      request.onerror = function () {
        reject(new Error("Failed to open IndexedDB."))
      }
    })
  },
}
