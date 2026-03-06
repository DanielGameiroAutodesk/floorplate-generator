import { useEffect, useMemo, useState } from "preact/hooks"
import { isDefined } from "./array"

export function useCachedCallback<TReturn>(func: () => TReturn) {
  return useMemo<() => TReturn>(() => {
    let cache: TReturn | undefined
    return () => {
      if (!isDefined(cache)) cache = func()
      return cache
    }
  }, [func])
}

export function useAsyncMemo<T>(func: () => T, init: T, delay: number = 0) {
  const asyncMemo = useAsyncCalculation(func, delay)

  return useMemo(() => {
    return asyncMemo ?? init
  }, [asyncMemo, init])
}

export function useAsyncCalculation<T>(func: () => T, delay: number = 0): T | undefined {
  const [val, setVal] = useState<T | undefined>()

  useEffect(() => {
    setTimeout(() => {
      setVal(func())
    }, delay)
  }, [delay, func])

  return val
}
