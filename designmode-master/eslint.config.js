import importPlugin from "eslint-plugin-import"
import js from "@eslint/js"
import prettier from "eslint-config-prettier"
import globals from "globals"
import * as tseslint from "typescript-eslint"
import react from "eslint-plugin-react"
import hooksPlugin from "eslint-plugin-react-hooks"
import local from "./.eslint-plugin-local/index.js"

export default tseslint.config(
  {
    ignores: ["packages/*/dist/**"],
  },
  prettier,
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    ...importPlugin.flatConfigs.recommended,
    // Avoid the default rules.
    rules: {},
  },
  react.configs.flat.recommended,
  {
    plugins: {
      "react-hooks": hooksPlugin,
      local,
    },
    settings: {
      react: {
        version: "18",
      },
      "import/parsers": {
        "@typescript-eslint/parser": [".ts", ".tsx"],
      },
      "import/resolver": {
        typescript: {
          alwaysTryTypes: true,
        },
      },
    },
    languageOptions: {
      globals: {
        ...globals.browser,
      },
      parserOptions: {
        project: true,
      },
    },
    rules: {
      ...hooksPlugin.configs.recommended.rules,
      "import/no-duplicates": "off",
      "import/no-named-as-default-member": "off",
      // TODO: Should probably fix these?
      "import/no-unresolved": "off",
      "local/no-signals-subscribe-in-reactive-hooks": "error",
      "local/no-signals-hooks-with-dependencies": "error",
      "local/no-signals-effect-async": "error",
      "local/signals-explicit-naming": "error",
      "local/import-src-path": "warn",
      "local/restrict-internal": "error",
      "local/restrict-internal-tag": "error",
      "local/no-anchestor-index-imports": "error",
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off",
      "no-unused-vars": "off",
      "@typescript-eslint/consistent-type-imports": "warn",
      "@typescript-eslint/no-unused-vars": "warn",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/no-namespace": "off",
      "@typescript-eslint/no-inferrable-types": "off",
      "@typescript-eslint/no-this-alias": "off",
      "@typescript-eslint/no-empty-function": "off",
      "@typescript-eslint/no-meaningless-void-operator": "error",
      "@typescript-eslint/no-redundant-type-constituents": "off",
      // Disabling many rules as we currently have a lot of _any_ types
      // making it very inconvenient to work with. Would be nice if
      // we could enable some of these later.
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-return": "off",
      "@typescript-eslint/no-unsafe-enum-comparison": "off",
      "@typescript-eslint/no-unused-expressions": "off",
      "prefer-const": "error",
      "no-undef": "off",
      "react-hooks/exhaustive-deps": [
        "warn",
        {
          additionalHooks: "(useRecoilCallback|useRecoilTransaction_UNSTABLE)",
        },
      ],
      "import/no-self-import": "error",
      "import/no-restricted-paths": [
        "error",
        {
          zones: [
            {
              target: "./src/!(app)/**/*",
              from: "./src/app/**/*",
              message: "Nothing should import from src/app",
            },
            {
              target: "./src/lib",
              from: "./src/!(lib|i18n)/**/*",
              message: "Lib code not allowed to import from outside lib folder",
            },
            {
              target: "./src/i18n",
              from: "./src/!(i18n)/**/*",
              message: "i18n code not allowed to import from outside i18n folder",
            },
            {
              target: "./src/integrations/**/*",
              from: "./src/!(lib|integrations|core|i18n)/**/*",
              message: "Integrations should not import from here - consider refactoring",
            },
            {
              target: "./src/core",
              from: "./src/!(lib|core|i18n)/**/*",
              except: [
                // Until derived data is moved out of core this avoids some cluttering.
                "**/src/integrations/renderables/**/*",
                "**/src/integrations/snapping/snapping.ts",
              ],
              message: "Core should not import from here",
            },
            {
              target: "./src/!(app)/**/*",
              from: "./src/core/**/apponly/**/*",
              message: "Only app should import from this layer",
            },
          ],
        },
      ],
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "lodash",
              message: "Please import lodash functions directly from lodash/<method>",
            },
          ],
        },
      ],
      "no-unused-private-class-members": "off",
    },
  },
  // Relax rules on integrations and a few other files.
  {
    files: ["**/sceneManager.ts", "**/*.js", "src/integrations/**/*.+(ts|tsx|js|jsx)"],
    rules: {
      "prefer-const": "off",
      "@typescript-eslint/no-unsafe-call": "off",
    },
  },
  // Avoid opting out of rules a few places.
  {
    files: ["src/core/**/*.+(ts|tsx)"],
    ignores: ["**/sceneManager.ts"],
    rules: {
      "@typescript-eslint/no-unsafe-argument": "error",
      "@typescript-eslint/no-unsafe-assignment": "error",
      "@typescript-eslint/no-unsafe-member-access": "error",
      "@typescript-eslint/no-unsafe-return": "error",
      "@typescript-eslint/no-unsafe-enum-comparison": "error",
      "@typescript-eslint/no-unused-expressions": "error",
    },
  },
  {
    ignores: ["node_modules/", "dist/", "docs/", "public/", ".vite/", "checkly/playwright-report/**"],
  },
  // The following is generated in the repo forma-embedded-view-host and shouldn't be linted so strictly
  {
    files: ["src/integrations/extensions/EmbeddedViews/generated-types.d.ts"],
    rules: {
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/consistent-type-imports": "off", // .d.ts files are always type-only
    },
  },
  {
    files: ["src/integrations/building-systems-site-study/iterative/**/*"],
    rules: {
      "import/order": [
        "warn",
        {
          groups: ["builtin", "external", "internal", "parent", "sibling", "index", "object"],
          "newlines-between": "always",
          pathGroups: [
            { pattern: "src/{core,lib,i18n}/**", group: "external", position: "after" }, // "lib", "core" and "i18n" are considered "external"
          ],
        },
      ],
      "import/first": "error",
      "import/no-self-import": "error",
      "import/no-default-export": "error",
      "import/no-duplicates": "error",
      "import/newline-after-import": "error",
      "import/no-import-module-exports": "error",
      "import/no-internal-modules": [
        "error",
        {
          allow: [
            "preact/**",
            "three/**",
            "@spacemakerai/line-buildings-shared/**",
            "src/core/**",
            "src/lib/**",
            "src/i18n/**",
            "src/integrations/renderables/**",
            "src/integrations/render-api/**",
            "src/integrations/basic-elements/**",
            "src/integrations/tools-common/**",
            "src/integrations/snapping/**",
            "src/integrations/raycast/**",
            "src/integrations/cursors/**",
            "src/integrations/toolbar/**",
            "src/integrations/GuideText/**",
            "src/integrations/Toolbars/**",
            "src/integrations/composition-row-house-generator/**",
            "src/integrations/building-systems-line-buildings/**",
            "src/integrations/building-systems-site-study/**",
            "src/integrations/building-systems-basic-building/**",
            "src/integrations/building-systems-common/**",
            "src/integrations/composition-site-graph-parcel/**",
          ],
        },
      ],
    },
  },
  {
    files: ["packages/line-buildings-shared/**/*"],
    rules: {
      "prefer-const": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unnecessary-type-assertion": "off",
    },
  },
)
