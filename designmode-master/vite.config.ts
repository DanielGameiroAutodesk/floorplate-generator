import { preact } from "@preact/preset-vite"
import { cspHeadersPlugin } from "@spacemakerai/vite-csp-plugin"
import fs from "fs"
import os from "os"
import postcssNesting from "postcss-nesting"
import { type CommonServerOptions, splitVendorChunkPlugin, type UserConfig, type ViteDevServer } from "vite"
import tsconfigPaths from "vite-tsconfig-paths"

let HOST: string
let BASE_URL: string

function proxyConfigs() {
  const config: CommonServerOptions["proxy"] = {}

  function addProxy(condition: any, prefix: string, bundlename: string, originalname: string) {
    if (condition) {
      config![prefix] = {
        target: "https://local.autodeskforma.eu:3001",
        changeOrigin: true,
        secure: false,
        rewrite: (path: string) => (path === prefix + bundlename ? prefix + originalname : path),
      }
    }
  }

  addProxy(process.env.LOCAL_KEY_FIGURES, "/web-components/key-figures-v2/", "key-figures-v2.js", "src/index.ts")
  addProxy(process.env.LOCAL_DETAILS, "/buildingdesign/", "", "")
  addProxy(
    process.env.LOCAL_CARBON_ANALYSIS,
    "/web-components/forma-embodied-carbon-analysis/",
    "forma-embodied-carbon-analysis.js",
    process.env.PREVIEW_MODE ? "forma-embodied-carbon-analysis.js" : "src/wc/index.tsx",
  )
  addProxy(
    process.env.LOCAL_OPERATIONAL_CARBON_ANALYSIS,
    "/web-components/forma-operational-carbon-analysis/",
    "forma-operational-carbon-analysis.js",
    process.env.PREVIEW_MODE ? "forma-operational-carbon-analysis.js" : "src/wc/index.tsx",
  )

  if (process.env.LOCAL_DESIGN_SYSTEM_V1) {
    config["^/design-system/(forma|v1/sm-.+)/.+"] = {
      target: "http://local.autodeskforma.eu:8080",
      changeOrigin: true,
      rewrite: (path: string) => path.replace("/design-system/", "/"),
      secure: false,
    }
  }

  if (process.env.LOCAL_DESIGN_SYSTEM_V2) {
    config["^/design-system/v2/.+"] = {
      target: "https://local.autodeskforma.eu:8080",
      changeOrigin: true,
      rewrite: (path: string) => path.replace("/design-system/v2/", "/"),
      secure: false,
    }
  }

  if (process.env.LOCAL_FORMA_NAVBAR) {
    config["/web-components/forma-navbar"] = {
      target: "https://local.autodeskforma.eu:3001",
      changeOrigin: true,
      rewrite: (path) => path.replace("forma-navbar.js", "src/index.ts"),
      secure: false,
    }
  }

  if (process.env.LOCAL_SPACE) {
    config["/spacemaker"] = {
      target: "https://local.autodeskforma.eu:3001",
      changeOrigin: true,
      secure: false,
    }
  }

  if (process.env.LOCAL_LIBRARY) {
    config["/web-components/sm-library-v2/sm-library-v2.js"] = {
      target: "https://local.autodeskforma.eu:3001",
      changeOrigin: true,
      rewrite: (path: string) => path.replace("sm-library-v2.js", "src/index.ts"),
      secure: false,
    }
    config["^/web-components/sm-library-v2/((?!sm-library-v2.js).)*$"] = {
      target: "https://local.autodeskforma.eu:3001",
      changeOrigin: true,
      secure: false,
    }
  }

  if (process.env.LOCAL_ORDERS) {
    config["/web-components/order-sidebar/order-sidebar.js"] = {
      target: "https://local.autodeskforma.eu:3001",
      changeOrigin: true,
      rewrite: (path: string) => path.replace("order-sidebar.js", "src/index.tsx"),
      secure: false,
    }
    config["^/web-components/order-sidebar/((?!order-sidebar.js).)*$"] = {
      target: "https://local.autodeskforma.eu:3001",
      changeOrigin: true,
      secure: false,
    }
  }
  if (process.env.LOCAL_SCENARIO_MODEL_LIST) {
    config["/web-components/scenario-model-list/"] = {
      target: "https://local.forma.stg.usa.autodesk.com:3001",
      changeOrigin: true,
      rewrite: (path: string) => path.replace("scenario-model-list.js", "src/main.tsx"),
      secure: false,
    }
  }

  if (process.env.LOCAL_ORDER_SERVICE) {
    config["^/api/atlas/"] = {
      target: "http://localhost:3130/offline/",
      rewrite: (path: string) => path.replace("/api/atlas/", ""),
    }
  }

  if (process.env.LOCAL_ATTRIBUTION) {
    config["/web-components/attribution-component/attribution-component.js"] = {
      target: "https://local.autodeskforma.eu:3001",
      changeOrigin: true,
      rewrite: (path: string) => path.replace("attribution-component.js", "src/index.tsx"),
      secure: false,
    }
    config["^/web-components/attribution-component/((?!attribution-component.js).)*$"] = {
      target: "https://local.autodeskforma.eu:3001",
      changeOrigin: true,
      secure: false,
    }
  }
  if (process.env.LOCAL_INVITEONLYTOGGLE) {
    config["/web-components/forma-invite-only-toggle-component/forma-invite-only-toggle-component.js"] = {
      target: "https://local.autodeskforma.eu:3001",
      changeOrigin: true,
      rewrite: (path: string) => path.replace("forma-invite-only-toggle-component.js", "src/index.tsx"),
      secure: false,
    }
    config["^/web-components/forma-invite-only-toggle-component/((?!forma-invite-only-toggle-component.js).)*$"] = {
      target: "https://local.autodeskforma.eu:3001",
      changeOrigin: true,
      secure: false,
    }
  }
  if (process.env.LOCAL_PROPOSAL_LIST) {
    config["/web-components/proposal-list-v2/proposal-list-v2.js"] = {
      target: "https://local.autodeskforma.eu:3001",
      changeOrigin: true,
      secure: false,
      rewrite: (path: string) => path.replace("proposal-list-v2.js", "src/index.ts"),
    }
    config["^/web-components/proposal-list-v2/((?!proposal-list-v2.js).)*$"] = {
      target: "https://local.autodeskforma.eu:3001",
      changeOrigin: true,
      secure: false,
    }
  }

  if (process.env.LOCAL_FLOOR_PLAN_SKETCHER) {
    config["/web-components/sm-floor-plan-sketcher-elements/floor-plan-sketcher.js"] = {
      target: "https://local.autodeskforma.eu:3001",
      changeOrigin: true,
      rewrite: (path: string) => path.replace("floor-plan-sketcher.js", "src/index.js"),
      secure: false,
    }
    config["^/web-components/sm-floor-plan-sketcher-elements/((?!floor-plan-sketcher.js).)*$"] = {
      target: "https://local.autodeskforma.eu:3001",
      changeOrigin: true,
      secure: false,
    }
  }
  if (process.env.LOCAL_PROJECT_SETTINGS) {
    config["/web-components/forma-project-settings"] = {
      target: "https://local.autodeskforma.eu:3002",
      changeOrigin: true,
      rewrite: (path) => path.replace("project-settings.js", "src/main.tsx"),
      secure: false,
    }
  }
  if (process.env.LOCAL_WIND_SURROGATE) {
    config["/rapid-analyses/forma-rapid-wind/forma-rapid-wind.js"] = {
      target: "https://local.autodeskforma.eu:3001",
      changeOrigin: true,
      rewrite: (path: string) => path.replace("forma-rapid-wind.js", "src/index.ts"),
      secure: false,
    }
    config["^/rapid-analyses/forma-rapid-wind/((?!forma-rapid-wind.js).)*$"] = {
      target: "https://local.autodeskforma.eu:3001",
      changeOrigin: true,
      secure: false,
    }
  }
  if (process.env.LOCAL_CARBON_PROPERTIES_EDITOR) {
    config["/web-components/ec-properties-editor-wc/ec-properties-editor-wc.js"] = {
      target: "https://local.autodeskforma.eu:3001",
      changeOrigin: true,
      rewrite: (path: string) => path.replace("ec-properties-editor-wc.js", "src/index.tsx"),
      secure: false,
    }
    config["^/web-components/ec-properties-editor-wc/((?!ec-properties-editor-wc.js).)*$"] = {
      target: "https://local.autodeskforma.eu:3001",
      changeOrigin: true,
      secure: false,
    }
  }
  if (process.env.LOCAL_PREDICTIVE_NOISE) {
    config["/rapid-analyses/forma-rapid-noise/forma-rapid-noise.js"] = {
      target: "https://local.autodeskforma.eu:3001",
      changeOrigin: true,
      rewrite: (path: string) => path.replace("forma-rapid-noise.js", "src/index.ts"),
      secure: false,
    }
    config["^/rapid-analyses/forma-rapid-noise/((?!forma-rapid-noise.js).)*$"] = {
      target: "https://local.autodeskforma.eu:3001",
      changeOrigin: true,
      secure: false,
    }
  }

  if (process.env.LOCAL_COLORBAR) {
    config["/web-components/forma-analysis-colorbar/forma-analysis-colorbar.mjs"] = {
      target: "https://local.autodeskforma.eu:3001",
      changeOrigin: true,
      rewrite: (path: string) => path.replace("forma-analysis-colorbar.mjs", "src/index.tsx"),
      secure: false,
    }
    config["^/web-components/forma-analysis-colorbar/((?!forma-analysis-colorbar.mjs).)*$"] = {
      target: "https://local.autodeskforma.eu:3001",
      changeOrigin: true,
      secure: false,
    }
  }

  if (process.env.LOCAL_COLORBAR_V2) {
    config["/web-components/forma-analysis-colorbar-v2/forma-analysis-colorbar-v2.mjs"] = {
      target: "https://local.autodeskforma.eu:3002",
      changeOrigin: true,
      rewrite: (path: string) => path.replace("forma-analysis-colorbar-v2.mjs", "src/index.tsx"),
      secure: false,
    }
    config["^/web-components/forma-analysis-colorbar-v2/((?!forma-analysis-colorbar-v2.mjs).)*$"] = {
      target: "https://local.autodeskforma.eu:3002",
      changeOrigin: true,
      secure: false,
    }
  }

  if (process.env.LOCAL_PROPOSAL_DOCS_MIRROR) {
    config["^/api/proposal-docs-mirror"] = {
      target: "http://localhost:3001",
      changeOrigin: true,
      rewrite: (path: string) => path.replace("/api/proposal-docs-mirror", "/prod"),
      secure: false,
    }
  }

  if (process.env.LOCAL_WSM_MODEL_TREE) {
    config["/web-components/wsm-model-tree"] = {
      target: "https://local.autodeskforma.eu:3010",
      changeOrigin: true,
      rewrite: (path: string) => path.replace("wsm-model-tree.mjs", "src/index.ts"),
      secure: false,
    }
  }

  if (process.env.LOCAL_HELP_PANEL) {
    config["/web-components/help-panel/"] = {
      target: "https://local.autodeskforma.eu:3001",
      changeOrigin: true,
      rewrite: (path: string) => path.replace("help-panel.es.js", "src/index.ts"),
      secure: false,
    }
  }

  if (process.env.ANALYSIS_CATALOG_HOST) {
    config["^/web-components/forma-analysis-catalog/.*$"] = {
      target: process.env.ANALYSIS_CATALOG_HOST,
      rewrite: (path: string) => path.substring("/web-components/forma-analysis-catalog".length),
      changeOrigin: true,
      secure: false,
    }
  }

  if (process.env.DEV_PROPOSALS) {
    config["/api/proposal/elements"] = {
      target: `https://n3vum82fhg.execute-api.eu-west-1.amazonaws.com`,
      rewrite: (path: string) => path.replace("/api/proposal/elements", "/dev"),
      changeOrigin: true,
      secure: false,
    }
  }

  if (process.env.LOCAL_ANALYSIS_MENU) {
    config["/web-components/forma-analysis-menu/forma-analysis-menu.js"] = {
      target: "https://local.autodeskforma.eu:3001",
      changeOrigin: true,
      rewrite: (path: string) => path.replace("forma-analysis-menu.js", "src/index.tsx"),
      secure: false,
    }
    config["^/web-components/forma-analysis-menu/((?!forma-analysis-menu.js).)*$"] = {
      target: "https://local.autodeskforma.eu:3001",
      changeOrigin: true,
      secure: false,
    }
  }

  if (process.env.LOCAL_INTEGRATE_API) {
    config["^/api/integrate/.*$"] = {
      target: "http://localhost:3110",
      changeOrigin: true,
      rewrite: (path: string) => path.replace("/api/integrate", "/prod"),
      secure: false,
    }
  }

  if (process.env.LOCAL_PROJECT_INVITE_API) {
    config["^/api/project-invite/.*$"] = {
      target: "http://localhost:4000",
      changeOrigin: true,
      rewrite: (path: string) => path.replace("/api/project-invite", "/local"),
      secure: false,
    }
  }

  if (process.env.LOCAL_IMPORT_SERVICE) {
    config["^/api/import-service"] = {
      target: "http://localhost:3100",
      changeOrigin: true,
      rewrite: (path: string) => path.replace("/api/import-service", "/prod"),
      secure: false,
    }
  }

  if (process.env.LOCAL_FILE_IMPORT) {
    config["^/web-components/forma-file-import/"] = {
      target: "https://local.autodeskforma.eu:3007",
      secure: false,
    }
  }

  if (process.env.LOCAL_APP_STORE) {
    config["^/web-components/forma-app-store/"] = {
      target: "https://local.autodeskforma.eu:3008",
      secure: false,
    }
  }

  if (process.env.LOCAL_EMBEDDED_VIEW_HOST) {
    config["^/web-components/forma-embedded-view-host/"] = {
      target: "https://local.autodeskforma.eu:3005",
      secure: false,
    }
  }

  if (process.env.LOCAL_GENERATORS_API) {
    config["^/api/generator-service/.*$"] = {
      target: "http://localhost:3120",
      changeOrigin: true,
      rewrite: (path: string) => path.replace("/api/generator-service", "/prod"),
      secure: false,
    }
  }

  if (process.env.LOCAL_GENERATOR_ADAPTER) {
    config["^/web-components/forma-generator-adapter/"] = {
      target: "https://local.autodeskforma.eu:3002",
      secure: false,
    }
  }

  if (process.env.LOCAL_EXTENSION_SERVICE_API) {
    config["^/api/extension-service/"] = {
      target: "http://localhost:3130/offline/",
      rewrite: (path: string) => path.replace("/api/extension-service/", ""),
    }
  }

  if (process.env.LOCAL_DD_RUM) {
    config["^/datadog-rum/"] = {
      target: "https://local.autodeskforma.eu:3050",
      changeOrigin: true,
      secure: false,
    }
  }

  if (process.env.CAMERA_TOOL_WC_HOST) {
    config["/web-components/forma-camera-tool"] = {
      target: process.env.CAMERA_TOOL_WC_HOST,
      rewrite: (pathname: string) => pathname.substring("/web-components/forma-camera-tool".length),
      changeOrigin: true,
      secure: false,
    }
  }

  if (process.env.VISIBILITY_MENU_WC_HOST) {
    config["/web-components/forma-visibility-menu"] = {
      target: process.env.VISIBILITY_MENU_WC_HOST,
      changeOrigin: true,
      secure: false,
      rewrite: (path: string) => path.replace("forma-visibility-menu.js", "src/main.tsx"),
    }
  }

  if (process.env.LOCAL_TERRAIN_WC) {
    config["/web-components/forma-terrain/forma-terrain.js"] = {
      target: "https://local.autodeskforma.eu:3001",
      changeOrigin: true,
      secure: false,
      rewrite: (path: string) => path.replace("forma-terrain.js", "src/index.tsx"),
    }
    config["^/web-components/forma-terrain/((?!forma-terrain.js).)*$"] = {
      target: "https://local.autodeskforma.eu:3001",
      changeOrigin: true,
      secure: false,
    }
  }

  if (process.env.LOCAL_VISUALIZER) {
    config["/visualizer"] = {
      target: `https://${regions[process.env.REGION as string].host}:3004`,
      changeOrigin: true,
      secure: false,
    }
    config["/viewport-threejs"] = {
      target: `https://${regions[process.env.REGION as string].host}:3004`,
      changeOrigin: true,
      secure: false,
    }
  }

  if (process.env.ANALYSIS_CATALOG_V2_HOST) {
    config["/web-components/forma-analysis-catalog-v2"] = {
      target: process.env.ANALYSIS_CATALOG_V2_HOST,
      rewrite: (path: string) => path.substring("/web-components/forma-analysis-catalog-v2".length),
      changeOrigin: true,
      secure: false,
    }
  }

  if (process.env.ANALYSIS_MODAL_HOST) {
    config["/web-components/forma-analysis-modal"] = {
      target: process.env.ANALYSIS_MODAL_HOST,
      changeOrigin: true,
      secure: false,
      rewrite: (path: string) => path.substring("/web-components/forma-analysis-modal".length),
    }
  }

  if (process.env.LOCAL_PARAMETRIC_API) {
    config["^/api/parametric/.*$"] = {
      target: `https://${regions[process.env.REGION as string].host}:3110`,
      changeOrigin: true,
      secure: false,
    }
  }

  if (process.env.LOCAL_GEOLOCATION_PICKER_HOST) {
    config["/web-components/forma-geolocation-picker/forma-geolocation-picker.js"] = {
      target: process.env.LOCAL_GEOLOCATION_PICKER_HOST,
      changeOrigin: true,
      secure: false,
      rewrite: (path: string) => path.replace("forma-geolocation-picker.js", "src/index.tsx"),
    }
    config["^/web-components/forma-geolocation-picker/((?!forma-geolocation-picker.js).)*$"] = {
      target: process.env.LOCAL_GEOLOCATION_PICKER_HOST,
      changeOrigin: true,
      secure: false,
    }
  }

  config["^/(?!designmode).*$"] = {
    target: `${BASE_URL}/`,
    changeOrigin: true,
  }

  const websocketProxyOptions = {
    target: `wss://${new URL(BASE_URL).host}`,
    changeOrigin: true,
    ws: true,
  }

  config["^/api/analysis-catalog-ws"] = websocketProxyOptions
  config["^/api/multiplayer/websocket"] = websocketProxyOptions

  return config
}

const relativeUrlPlugin = () => ({
  name: "fix-proxied-relative-urls",
  transformIndexHtml(html: string) {
    return html.replace(/#REL#/g, "")
  },
})

const checkAuthCookiePlugin = () => ({
  name: "auth-cookie",
  configureServer(server: ViteDevServer) {
    server.middlewares.use((req: any, res, next) => {
      // Handle the auth token endpoint
      if (req.url === "/api/auth/get-token") {
        const cookieHeader = req.headers.cookie || ""
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        const cookies = cookieHeader.split(";").reduce((acc: Record<string, string>, cookie: string) => {
          const [key, value] = cookie.trim().split("=")
          if (key) acc[key] = value || ""
          return acc
        }, {})

        const smAuthToken = cookies["_sm_auth"] || cookies["sm_auth"]

        res.setHeader("Content-Type", "application/json")
        res.statusCode = smAuthToken ? 200 : 404
        return res.end(
          JSON.stringify({
            token: smAuthToken || null,
            error: smAuthToken ? null : "No auth token found in cookies",
          }),
        )
      }

      // Original auth check
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      if (!(req.headers.cookie || "").includes("_sm_auth=")) {
        res.statusCode = 302
        res.statusCode = 302
        const self = `https://${HOST}:3000${req.url}`
        return res.setHeader("Location", `${BASE_URL}/auth/login?rd=${encodeURIComponent(self)}`).end()
      }
      next()
    })
  },
})

const addAuthHeaderUrls: RegExp[] = []
if (process.env.DEV_PROPOSALS) {
  addAuthHeaderUrls.push(new RegExp("/api/proposal/elements"))
}

const createAuthHeaderPlugin = (urls: RegExp[]) => ({
  name: "auth-header",
  configureServer(server: ViteDevServer) {
    server.middlewares.use((req, res, next) => {
      if (req.headers.cookie) {
        if (urls.some((regex) => req.url!.match(regex))) {
          const cookieHeader = req.headers.cookie
          if (cookieHeader) {
            const parts = `; ${cookieHeader}`.split(`; _sm_auth=`)
            if (parts && parts.length === 2) {
              const element = parts.pop()
              const token = element ? element.split(";").shift() : undefined
              if (token) {
                const tok = token.trim()

                req.headers.Authorization = `Bearer ${tok}`
              }
            }
          }
        }
      }

      next()
    })
  },
})

// https://vitejs.dev/config/
const config: UserConfig = {
  base: "/designmode/",
  plugins: [
    splitVendorChunkPlugin(),
    checkAuthCookiePlugin(),
    ...[process.env.DEV_SERVER ? [createAuthHeaderPlugin(addAuthHeaderUrls)] : []],
    // The prefresh plugin cannot be loaded by multiple scripts at the same time.
    // This is a problem when multiple Preact applications is loaded in watch mode
    // at the same time.
    // Set SKIP_PREFRESH=1 to exclude the plugin.

    preact({
      // Disable prefresh for now, as a bug causes many rerenders which spams proposal service
      prefreshEnabled: false,
      // Disable dev tools by default as it easily causes memory leaks and memory issues.
      devToolsEnabled: !!process.env.ENABLE_PREACT_DEV_TOOLS,
    }),

    // preact().filter((it) => !process.env.SKIP_PREFRESH || it.name !== "prefresh"),
    relativeUrlPlugin(),
    tsconfigPaths(),
    cspHeadersPlugin(),
  ],
  define: {
    __SENTRY_RELEASE__: JSON.stringify(process.env.SENTRY_RELEASE),
    __THREE_MESH_BVH_VERSION__: JSON.stringify(
      JSON.parse(fs.readFileSync("node_modules/three-mesh-bvh/package.json", "utf-8")).version,
    ),
  },
  css: {
    postcss: {
      plugins: [postcssNesting],
    },
  },
  esbuild: { logOverride: { "this-is-undefined-in-esm": "silent" } },
  //target: esnext will make Vite target browser versions that have support for dynamic imports, top level awaits, etc.
  build: { sourcemap: true, target: "esnext" },
  // Vite complains that the package.json is not correct for forma-units. Removing it from the optimized build as a temporary workaround
  // Vite does not complain about web-sketch-renderer, however, if optimizeDeps is not set to exclude it,
  // it has runtime errors.
  optimizeDeps: {
    exclude: ["@spacemakerai/forma-units", "@spacemakerai/web-sketch-renderer"],
  },
  worker: {
    format: "es",
    plugins: () => [tsconfigPaths()],
  },
}

const regions: Record<string, { baseUrl: string; host: string }> = {
  eu: { baseUrl: "https://app.autodeskforma.eu", host: "local.autodeskforma.eu" },
  us: { baseUrl: "https://app.autodeskforma.com", host: "local.autodeskforma.com" },
  chaos: { baseUrl: "https://app.spacemakerai.eu", host: "local.spacemakerai.eu" },
  stg: { baseUrl: "https://forma.stg.usa.autodesk.com", host: "local.forma.stg.usa.autodesk.com" },
}

if (process.env.DEV_SERVER) {
  const REGION = process.env.REGION
  if (!REGION) {
    throw new Error("Usage: REGION=eu|us|chaos pnpm start")
  }

  const regionConfig = regions[REGION]
  if (!regionConfig) {
    throw new Error("Invalid region " + REGION)
  }

  BASE_URL = regionConfig.baseUrl
  HOST = regionConfig.host

  config.preview = {
    open: true,
    host: HOST,
    port: 3000,
    https: {
      key: fs.readFileSync(os.homedir() + "/.spacemaker-cli/server.pem"),
      cert: fs.readFileSync(os.homedir() + "/.spacemaker-cli/cert.pem"),
    },
    proxy: proxyConfigs(),
  }
  config.server = { ...config.preview, hmr: !process.env.NO_HMR }
}

export default config
