import type * as eslint from "eslint"
import resolve from "eslint-module-utils/resolve"
import * as path from "node:path"
import { createImportRuleListener, getImportPathFromRoot, getTargetPathFromRoot, REPO_ROOT_POSIX } from "./utils"

// Workaround for weird import issue on Windows.
// Haven't been able to figure out why this is different on Windows vs Linux/Mac.
// See https://spacemakercore.slack.com/archives/C03525QAXM2/p1730387470799769
// @ts-expect-error - Workaround, see text above.
const resolve2 = (resolve.default ?? resolve) as typeof resolve

class ImportPathFromSrc implements eslint.Rule.RuleModule {
  readonly meta: eslint.Rule.RuleMetaData = {
    fixable: "code",
  }

  create(context: eslint.Rule.RuleContext): eslint.Rule.RuleListener {
    const targetPathFromRoot = getTargetPathFromRoot(context)
    const targetDirFromRoot = path.posix.dirname(targetPathFromRoot)

    return createImportRuleListener((node, importPath) => {
      if (!resolve2(importPath, context)) return

      const importPathFromRoot = getImportPathFromRoot(context, importPath)
      if (!importPathFromRoot?.startsWith("src")) return

      if (importPath.startsWith("../")) {
        // Convert parent imports to src/... imports.
        const updatedPathAbs = path.posix.resolve(path.posix.dirname(targetPathFromRoot), importPath)
        if (updatedPathAbs.startsWith(REPO_ROOT_POSIX)) {
          const updatedPath = updatedPathAbs.substring(REPO_ROOT_POSIX.length)
          if (updatedPath.startsWith("src/")) {
            context.report({
              loc: node.loc,
              message: `Replace ${importPath} with ${updatedPath}`,
              fix: (fixer) => fixer.replaceText(node, node.raw.replace(importPath, updatedPath)),
            })
          }
        }
      } else if (importPath.startsWith("src/")) {
        // Convert src/... imports to relative imports if inside target directory.
        const isWithinTree = importPath.startsWith(targetDirFromRoot + "/")
        if (isWithinTree) {
          const updatedPath = "./" + importPath.substring(targetDirFromRoot.length + 1)
          context.report({
            loc: node.loc,
            message: `Replace ${importPath} with ${updatedPath}`,
            fix: (fixer) => fixer.replaceText(node, node.raw.replace(importPath, updatedPath)),
          })
        }
      }
    })
  }
}

export default new ImportPathFromSrc()
