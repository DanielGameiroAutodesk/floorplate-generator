import type { TSESLint, TSESTree } from "@typescript-eslint/utils"
import { ESLintUtils } from "@typescript-eslint/utils"
import type * as ts from "typescript"

/**
 * This rule prevents us from passing non-pure variables into useSignalEffect
 * or useComputed that are not signals, as updates to those variables
 * would not cause the effect to rerun.
 */
export default ESLintUtils.RuleCreator.withoutDocs({
  meta: {
    type: "problem",
    messages: {
      unexpectedVariable:
        "Unexpected use of variable from render scope in {{ hookName }}. The effect will not rerun when '{{ variableName }}' is updated. You can use the useReadonlySignal utility to convert a variable to a signal that can be used in an effect",
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    const services = ESLintUtils.getParserServices(context)
    const scopeManager = context.sourceCode.scopeManager!

    function visitHook(node: TSESTree.Node, hookName: string) {
      const scope = scopeManager.acquire(node)!

      visitHookScopesRecursively(scope)

      function checkIsStable(node: TSESTree.Node) {
        function checkType(type: ts.Type) {
          // type A = ... becomes aliasSymbol with name A
          // interface A { ... } becomes symbol with name A
          const name = type.aliasSymbol?.name ?? type.symbol?.name
          if (!name) return false

          if (name === "Signal") return true
          if (name === "ReadonlySignal") return true
          if (name === "ReadonlySignalHack") return true

          // Allow SetterOrUpdater and Resetter from Recoil.
          if (type.aliasSymbol?.name === "SetterOrUpdater" || type.aliasSymbol?.name === "Resetter") {
            if (type.aliasSymbol.declarations?.[0]?.parent?.getSourceFile().fileName.includes("recoil")) {
              return true
            }
          }

          return false
        }

        const type = services.getTypeAtLocation(node)
        return type.isUnionOrIntersection() ? type.types.some((it) => checkType(it)) : checkType(type)
      }

      function visitHookScopesRecursively(currentScope: TSESLint.Scope.Scope) {
        for (const reference of currentScope.references) {
          if (!reference.resolved || reference.resolved.scope !== scope.upper) {
            continue
          }

          if (checkIsStable(reference.identifier)) {
            continue
          }

          context.report({
            node: reference.identifier,
            messageId: "unexpectedVariable",
            data: {
              hookName,
              variableName: reference.identifier.name,
            },
          })
        }

        for (const childScope of currentScope.childScopes) {
          visitHookScopesRecursively(childScope)
        }
      }
    }

    return {
      CallExpression: (node: TSESTree.CallExpression) => {
        if (node.callee.type !== "Identifier") {
          return
        }
        const hookName = node.callee.name
        switch (hookName) {
          case "useSignalEffect":
          case "useComputed":
            break
          default:
            return
        }

        const callback = node.arguments[0]
        if (!callback) {
          return
        }

        switch (callback.type) {
          case "FunctionExpression":
          case "ArrowFunctionExpression":
            visitHook(callback, hookName)
            return
          case "TSAsExpression":
            visitHook(callback.expression, hookName)
            return
        }
      },
    }
  },
})
