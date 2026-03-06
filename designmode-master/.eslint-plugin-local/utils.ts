import type { TSESLint } from "@typescript-eslint/utils"
import type * as eslint from "eslint"
import type { TSESTree } from "@typescript-eslint/types"
import resolve from "eslint-module-utils/resolve"
import * as path from "node:path"

// Workaround for weird import issue on Windows.
// Haven't been able to figure out why this is different on Windows vs Linux/Mac.
// See https://spacemakercore.slack.com/archives/C03525QAXM2/p1730387470799769
// @ts-expect-error - Workaround, see text above.
const resolve2 = (resolve.default ?? resolve) as typeof resolve

export const REPO_ROOT = path.normalize(path.join(import.meta.dirname, "../"))
export const REPO_ROOT_POSIX = REPO_ROOT.replace(/\\/g, "/")

// Origin: https://github.com/microsoft/vscode/blob/684f9d47a4a97d7ea747915f4d1595f86f98aaad/.eslintplugin/utils.ts
export function createImportRuleListener(
  validateImport: (node: TSESTree.Literal, value: string) => any,
): eslint.Rule.RuleListener {
  function _checkImport(node: TSESTree.Node | null) {
    if (node && node.type === "Literal" && typeof node.value === "string") {
      validateImport(node, node.value)
    }
  }

  return {
    // import ??? from 'module'
    ImportDeclaration: (node: any) => {
      _checkImport((<TSESTree.ImportDeclaration>node).source)
    },
    // import('module').then(...) OR await import('module')
    ['CallExpression[callee.type="Import"][arguments.length=1] > Literal']: (node: any) => {
      _checkImport(node)
    },
    // import foo = ...
    ["TSImportEqualsDeclaration > TSExternalModuleReference > Literal"]: (node: any) => {
      _checkImport(node)
    },
    // export ?? from 'module'
    ExportAllDeclaration: (node: any) => {
      _checkImport((<TSESTree.ExportAllDeclaration>node).source)
    },
    // export {foo} from 'module'
    ExportNamedDeclaration: (node: any) => {
      _checkImport((<TSESTree.ExportNamedDeclaration>node).source)
    },
  }
}

export function getTargetPathFromRoot(
  context: eslint.Rule.RuleContext | TSESLint.RuleContext<string, unknown[]>,
): string {
  const filename = path.normalize(context.filename)
  return filename.substring(REPO_ROOT.length).replace(/\\/g, "/")
}

export function getImportPathFromRoot(context: eslint.Rule.RuleContext, importPath: string) {
  const resolvedImportPath = resolve2(importPath, context)
  if (resolvedImportPath == null) return
  if (!resolvedImportPath.startsWith(REPO_ROOT)) return
  return resolvedImportPath.substring(REPO_ROOT.length).replace(/\\/g, "/")
}

export function withoutExt(path: string) {
  return path.replace(/\.[^/.]+$/, "")
}
