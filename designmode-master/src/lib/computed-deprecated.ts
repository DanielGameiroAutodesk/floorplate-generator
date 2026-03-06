import { computed } from "@preact/signals"

/**
 * The usages of this method preserves legacy behavior where
 * a function is re-recreated whenever the dependant state is modified.
 *
 * This by itself doesn't mean the method will produce different
 * output the next time it is invoked, but it _might_ do so.
 * A lot of legacy code relies on this behavior, and it triggers
 * a re-render of the component and a re-evaluation of the method.
 *
 * This mimics the old behavior of APIs that used useCallback,
 * with the state as dependencies.
 *
 * We should strive to avoid this pattern. Instead, we should use
 * signals with global or local (instance based) computed values.
 * Note that signals should not be exposed to e.g. modules loaded
 * from different builds such as most web-components we have,
 * as the signal state (each build will include their own signal
 * module) will not be in sync and the version might also differ.
 *
 * A major downside with the legacy behavior is that it calculates
 * state even if the state might not ever be used.
 *
 * This legacy behavior also means that old state can be preserved
 * in the function closure, which can lead to memory leaks.
 *
 * (This method is purely to preserve this documentation one place.)
 */
export const deprecatedComputed = computed
