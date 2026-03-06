import type { TSESTree } from "@typescript-eslint/utils"
import { ESLintUtils } from "@typescript-eslint/utils"
import * as ts from "typescript"
import { getTargetPathFromRoot, REPO_ROOT_POSIX } from "./utils"

/**
 * This rule supports using `@internal` as an JSDoc tag to prevent exports
 * from being used outside the scoped directory.
 *
 * A scope here is defined as: The app or core directory or a directory within
 * lib or integrations.
 */
export default ESLintUtils.RuleCreator.withoutDocs({
  meta: {
    type: "problem",
    messages: {
      unexpectedInternal: "The symbol '{{ name }}' is internal and not expected to be used from here",
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    const services = ESLintUtils.getParserServices(context)
    const tc = services.program.getTypeChecker()
    const currentPathFromRoot = getTargetPathFromRoot(context)

    function checkIdentifier(node: TSESTree.Identifier | TSESTree.JSXIdentifier) {
      function getSymbol() {
        const tsNode = services.esTreeNodeToTSNodeMap.get(node) as ts.Identifier

        // Handle destructuring assignments.
        if (ts.isBindingElement(tsNode.parent)) {
          return tc.getTypeAtLocation(tsNode.parent.parent).getProperty(tsNode.text)
        } else {
          return tc.getSymbolAtLocation(tsNode)
        }
      }

      if (node.type === "JSXIdentifier" && node.parent?.type === "JSXClosingElement") {
        return
      }

      // Exclude a few cases that are obviously not of interest.
      // Cases that fall-through will use the slower path via symbol
      // and be skipped for equal filename paths.
      switch (node.parent.type) {
        case "ArrowFunctionExpression":
        case "FunctionDeclaration":
        case "FunctionExpression":
        case "ImportSpecifier":
        case "MethodDefinition":
        case "TSEnumDeclaration":
        case "TSInterfaceDeclaration":
        case "TSMethodSignature":
        case "TSModuleDeclaration":
        case "TSPropertySignature":
        case "TSTypeAliasDeclaration":
        case "TSTypeParameter":
        case "VariableDeclarator":
          return
      }

      // Follow symbol aliases to handle tags on e.g. re-exports.
      function* symbols() {
        let symbol = getSymbol()
        if (!symbol) return
        yield symbol

        while (symbol.flags & ts.SymbolFlags.Alias) {
          symbol = tc.getImmediateAliasedSymbol(symbol)
          if (!symbol) return
          yield symbol
        }
      }

      for (const symbol of symbols()) {
        const declaration = symbol.declarations?.[0]
        if (!declaration) {
          return
        }

        const pathFromRoot = getPosixPathFromRoot(declaration.getSourceFile().fileName)

        if (!pathFromRoot || currentPathFromRoot === pathFromRoot) {
          continue
        }

        if (pathFromRoot.includes("node_modules/")) {
          return
        }

        if (!isSameScope(currentPathFromRoot, pathFromRoot) && findInternalTagWithParents(declaration)) {
          context.report({
            node: node,
            messageId: "unexpectedInternal",
            data: { name: node.name },
          })
          return
        }
      }
    }

    return {
      Identifier: checkIdentifier,
      JSXIdentifier: checkIdentifier,
    }
  },
})

function getPosixPathFromRoot(filenamePosix: string) {
  if (!filenamePosix.startsWith(REPO_ROOT_POSIX)) return
  return filenamePosix.substring(REPO_ROOT_POSIX.length).replace(/\\/g, "/")
}

function getScopePath(normalizedPath: string) {
  const parts = normalizedPath.split("/")
  if (parts[0] !== "src") return normalizedPath

  if (parts[1] === "app" || parts[1] === "core") {
    return parts.slice(0, 2).join("/")
  }

  if (parts[1] === "lib" || parts[1] === "integrations") {
    return parts.slice(0, 3).join("/")
  }

  return normalizedPath
}

function isSameScope(a: string, b: string) {
  return getScopePath(a) === getScopePath(b)
}

function findInternalTag(node: ts.Node) {
  const tags = ts.getJSDocTags(node)
  for (const tag of tags) {
    if (tag.tagName.text === "internal") {
      return tag
    }
  }
  return undefined
}

function findInternalTagWithParents(declaration: ts.Declaration) {
  const tag = findInternalTag(declaration)
  if (tag) return tag

  // Inherit tag from parent declarations.
  let node: ts.Node | undefined = declaration
  while (node && node.parent) {
    node = node.parent

    const tag = findInternalTag(node)
    if (tag) return tag
  }

  return undefined
}
