import type * as eslint from "eslint"
import { createImportRuleListener, getImportPathFromRoot, getTargetPathFromRoot } from "./utils"

/**
 * This rule prevents us from importing from a index file higher up in the
 * directory structure.
 *
 * This can often lead to re-entrance issues and import cycles and should
 * be prevented by default.
 */
class NoAnchestorIndexImports implements eslint.Rule.RuleModule {
  create(context: eslint.Rule.RuleContext): eslint.Rule.RuleListener {
    const targetPathFromRoot = getTargetPathFromRoot(context)

    return createImportRuleListener((node, importPath) => {
      const importPathFromRoot = getImportPathFromRoot(context, importPath)
      if (!importPathFromRoot) return

      const match = importPathFromRoot.match(/^(.+?)\/index\.m?(jsx?|tsx?)$/)
      if (!match) return

      const prefix = match[1]
      if (targetPathFromRoot.startsWith(prefix)) {
        context.report({
          loc: node.loc,
          message: `Avoid importing from anchestor index: ${importPathFromRoot} - import from a specific file or restructure`,
        })
      }
    })
  }
}

export default new NoAnchestorIndexImports()
