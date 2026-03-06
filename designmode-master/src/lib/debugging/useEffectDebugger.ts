import type { EffectCallback } from "preact/hooks"
import { useEffect, useRef } from "preact/hooks"

const usePrevious = <T>(value: T, initialValue: T) => {
  const ref = useRef(initialValue)
  useEffect(() => {
    ref.current = value
  })
  return ref.current
}

export const useEffectDebugger = (
  effectHook: EffectCallback,
  dependencies: ReadonlyArray<any>,
  dependencyNames: string[] = [],
) => {
  const previousDeps = usePrevious(dependencies, [])

  const changedDeps = dependencies.reduce((accum, dependency, index) => {
    if (dependency !== previousDeps[index]) {
      const keyName = dependencyNames[index] || index
      return {
        ...accum,
        [keyName]: {
          before: previousDeps[index],
          after: dependency,
        },
      }
    }

    return accum
  }, {})

  if (Object.keys(changedDeps).length) {
    console.log("[use-effect-debugger] ", changedDeps)
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(effectHook, dependencies)
}
