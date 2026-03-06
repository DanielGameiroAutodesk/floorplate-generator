import { glob } from "glob"

const config = {
  $schema: "https://typedoc.org/schema.json",
  excludeInternal: true,
  entryPoints: [
    ...[...glob.sync("./src/core/**/*.+(ts|tsx)", { absolute: true })]
      .sort()
      .filter((it) => !it.includes("internal"))
      .filter((it) => !it.includes(".test.")),
    "./src/integrations/draw/DrawAPI.tsx",
    "./src/integrations/ground-texture/GroundTextureAPI.ts",
    "./src/integrations/legacy-actions/ActionAPI.tsx",
    "./src/integrations/render-api/RenderAPI.ts",
  ],
  navigation: {
    includeGroups: false,
    includeFolders: true,
  },
  categorizeByGroup: true,
}

export default config
