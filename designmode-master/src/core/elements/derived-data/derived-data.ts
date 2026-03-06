import { plugins } from "./plugins"

interface DerivedDataHost {
  derivedDataDisposables: DisposableStore
}

interface Disposable {
  dispose(): void
}

export class DisposableStore {
  /**
   * Keep a weak reference to the disposables so that they can still be GC'd
   * when they are no longer referenced without being explicitly disposed.
   *
   * This is useful for the parameterized derived data controllers.
   */
  private disposables: WeakRef<Disposable>[] = []

  public registerDisposable(disposable: Disposable) {
    this.disposables.push(new WeakRef(disposable))
  }

  public dispose() {
    for (const item of this.disposables) {
      item.deref()?.dispose()
    }
    this.disposables.length = 0
  }
}

export class DerivedData<TReturn> implements Disposable {
  private data: { computed: false } | { computed: true; value: TReturn } = { computed: false }

  /** @internal */
  constructor(private provider: () => TReturn) {}

  static create<TTarget extends DerivedDataHost, TReturn>(
    target: TTarget,
    computeFn: (target: TTarget) => TReturn,
  ): DerivedData<TReturn> {
    const derived = new DerivedData<TReturn>(() => {
      for (const plugin of plugins) {
        plugin.markComputeStart?.()
      }

      const result = computeFn(target)

      for (const plugin of plugins) {
        plugin.markComputeEnd?.(computeFn, target, result)
      }

      target.derivedDataDisposables.registerDisposable(derived)

      return result
    })

    return derived
  }

  get(): TReturn {
    if (!this.data.computed) throw new Error("Accessing uncomputed DerivedData")
    return this.data.value
  }

  compute(): void {
    this.data = { computed: true, value: this.provider() }
  }

  isComputed(): boolean {
    return this.data.computed
  }

  getOrCompute(): TReturn {
    if (!this.isComputed()) this.compute()
    return this.get()
  }

  dispose() {
    this.data = { computed: false }
  }
}

export function createDerivedDataController<T extends DerivedDataHost, R>(
  compute: (target: T) => R,
): (target: T) => DerivedData<R> {
  const store = new WeakMap<T, DerivedData<R>>()
  return function (target: T) {
    return getOrCompute(store, target, () => {
      return DerivedData.create(target, compute)
    })
  }
}

export function createDerivedData<T extends DerivedDataHost, R>(target: T, compute: (target: T) => R): DerivedData<R> {
  return DerivedData.create(target, compute)
}

export function createParameterizedDerivedDataController<
  TTarget extends DerivedDataHost,
  TParams extends WeakKey,
  TReturn,
>(
  computeFn: (params: TParams) => (target: TTarget) => TReturn,
): (target: TTarget) => (params: TParams) => DerivedData<TReturn> {
  const store = new WeakMap<TTarget, [TParams, DerivedData<TReturn>]>()

  return (target: TTarget) => {
    return (params: TParams) => {
      const cacheEntry = store.get(target)
      if (cacheEntry && cacheEntry[0] === params) {
        return cacheEntry[1]
      }

      const derivedFn = computeFn(params)
      // Pass on name to assist with debugging.
      Object.defineProperty(derivedFn, "name", { value: computeFn.name })

      const derivedData = DerivedData.create(target, derivedFn)
      store.set(target, [params, derivedData])
      return derivedData
    }
  }
}

export type DerivedDataFactory<T> =
  | ((target: T) => DerivedData<unknown>)
  | ((target: T) => (params: any) => DerivedData<unknown>)

export type DerivedDataFactories<T> = {
  [key: string]: DerivedDataFactory<T>
}

function getOrCompute<K extends WeakKey, T>(cache: WeakMap<K, T>, key: K, compute: () => T) {
  let result = cache.get(key)
  if (!result) {
    result = compute()
    cache.set(key, result)
  }
  return result
}
