import type * as eslint from "eslint"
import { createImportRuleListener, getImportPathFromRoot, getTargetPathFromRoot } from "./utils"

/**
 * This rule restrict imports from "internal" directories and files to
 * only be allowed to siblings and descending files.
 *
 * A directory or file is "internal" if it is named either "internal" or includes ".internal.".
 */
class RestrictInternal implements eslint.Rule.RuleModule {
  create(context: eslint.Rule.RuleContext): eslint.Rule.RuleListener {
    const targetPathFromRoot = getTargetPathFromRoot(context)

    return createImportRuleListener((node, importPath) => {
      const importPathFromRoot = getImportPathFromRoot(context, importPath)
      if (!importPathFromRoot) return

      const match = importPathFromRoot.match(/^(.+?)\/(internal\/|[^/]+\.internal\.)/)
      if (!match) return

      const prefix = match[1]
      if (!targetPathFromRoot.startsWith(prefix)) {
        context.report({
          loc: node.loc,
          message: `The import is from internal code. You can only import from a sibling file. Please use another import or refactor`,
        })
      }
    })
  }
}

export default new RestrictInternal()
