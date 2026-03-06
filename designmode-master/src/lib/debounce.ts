import { useCallback, useEffect, useMemo, useRef } from "preact/hooks"
import throttle from "lodash/throttle"
import debounce from "lodash/debounce"

function requestIdle(callback: () => void) {
  // safari does not support requestIdleCallback yet in stable release
  // and even though we do not technically support safari, it's nice to not break things for no reason
  if ("requestIdleCallback" in window) {
    return window.requestIdleCallback(() => callback())
  } else {
    return setTimeout(() => callback(), 0)
  }
}

function cancelIdle(id: ReturnType<typeof requestIdle>) {
  if ("requestIdleCallback" in window) {
    window.cancelIdleCallback(id as ReturnType<typeof window.requestIdleCallback>)
  } else {
    clearTimeout(id)
  }
}

// This hook is useful for debouncing expensive calculations that are not time-sensitive.
// It will only run the calculation when the browser is idle.
export function useIdleDebounce<F extends (...args: Parameters<F>) => ReturnType<F>>(callback: F) {
  const ref = useRef<F>(callback)
  const cancelRef = useRef<ReturnType<typeof requestIdle>>()

  useEffect(() => {
    ref.current = callback
  }, [callback])

  return useCallback((...args: Parameters<F>) => {
    if (cancelRef.current) cancelIdle(cancelRef.current)
    cancelRef.current = requestIdle(() => {
      ref.current(...args)
      cancelRef.current = undefined
    })
  }, [])
}

export function idleDebounce<F extends (...args: any[]) => any>(callback: F, timeout?: number) {
  let idleCallbackHandle: number | null = null

  return async function (...args: Parameters<F>): Promise<ReturnType<F>> {
    if (idleCallbackHandle !== null) {
      cancelIdleCallback(idleCallbackHandle)
    }

    return new Promise<ReturnType<F>>((resolve) => {
      idleCallbackHandle = requestIdleCallback(
        () => {
          resolve(callback(...args))
          idleCallbackHandle = null
        },
        { timeout },
      )
    })
  }
}

export function useDebounce<F extends (...args: Parameters<F>) => ReturnType<F>>(
  callback: F,
  delay?: number,
  options?: { leading?: boolean; trailing?: boolean },
) {
  const ref = useRef<F>(callback)

  useEffect(() => {
    ref.current = callback
  }, [callback])

  return useMemo(() => debounce((...args: Parameters<F>) => ref.current(...args), delay, options), [delay, options])
}

export function throttleOnePerFrame<T extends (...args: any[]) => void>(callback: T) {
  let frameId: number | undefined

  return (...args: Parameters<T>) => {
    if (frameId) return
    frameId = requestAnimationFrame(() => {
      callback(...args)
      frameId = undefined
    })
  }
}

export function useThrottle<F extends (...args: Parameters<F>) => ReturnType<F>>(
  callback: F,
  delay?: number,
  options?: { leading?: boolean; trailing?: boolean },
) {
  const ref = useRef<F>(callback)

  useEffect(() => {
    ref.current = callback
  }, [callback])

  return useMemo(() => throttle((...args: Parameters<F>) => ref.current(...args), delay, options), [delay, options])
}
