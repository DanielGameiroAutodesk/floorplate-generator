import { defineConfig, defaultExclude } from "vitest/config"
import tsconfigPaths from "vite-tsconfig-paths"

export default defineConfig({
  define: {
    __SENTRY_RELEASE__: '"dummy"',
    __THREE_MESH_BVH_VERSION__: '"0.0.0"',
  },
  plugins: [tsconfigPaths()],
  optimizeDeps: {
    exclude: ["@spacemakerai/web-sketch-renderer"],
  },
  test: {
    environment: "jsdom",
    exclude: [...defaultExclude, "checkly/**", "docs/**"],
    environmentOptions: {
      jsdom: {
        html: '<canvas id="design-mode-canvas"></canvas>',
      },
    },
    setupFiles: ["./vitest.setup.ts"],
    alias: {
      // This is needed to ensure we import esm version of recoil in test. Without, we end up with duplicate versions
      // of recoil
      recoil: "recoil/es/index",
    },
  },
})
