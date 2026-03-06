type Plugin = {
  markComputeStart?(): void
  markComputeEnd?(computeFn: unknown, container: unknown, value: unknown): void
}

/** @internal */
export const plugins = new Set<Plugin>()

export function registerDerivedDataPlugin(plugin: Plugin) {
  plugins.add(plugin)
  return () => {
    plugins.delete(plugin)
  }
}
