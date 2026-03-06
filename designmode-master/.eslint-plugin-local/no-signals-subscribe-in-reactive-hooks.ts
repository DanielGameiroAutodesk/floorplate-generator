import type { TSESLint, TSESTree } from "@typescript-eslint/utils"
import { ESLintUtils } from "@typescript-eslint/utils"
import type * as ts from "typescript"
import { checkIfSubscribes, findReactiveCall } from "./signals-utils"

/**
 * This rule prevents us from attempting to subscribe to a signal
 * from inside a useEffect etc., which does not cause the effect to
 * rerun when the signal is updated.
 */
export default ESLintUtils.RuleCreator.withoutDocs({
  meta: {
    type: "problem",
    messages: {
      unexpectedSubscribeMemo:
        "Subscribing to a signal in this context is unexpected and will not work. Prefer converting to signal-native useComputed or assign to a variable outside {{ hookName }} instead. Use peek() if you don't intend to subscribe to updates",
      unexpectedSubscribeCallback:
        "Subscribing to a signal in this context might not work and depends on how the callback is used, and should be avoided. Assign to a variable outside {{ hookName }} instead or use a signal-native mechanism such as useComputed. Use peek() if you don't intend to subscribe to updates",
      unexpectedSubscribeEffect:
        "This effect will not rerun when the signal value changes. Prefer converting to useSignalEffect or assign to a variable outside {{ hookName }}. Use peek() if you don't intend to subscribe to updates",
      peekInstead: "Peek the value instead if you don't need to rerun on updates",
    },
    hasSuggestions: true,
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    const services = ESLintUtils.getParserServices(context)
    const scopeManager = context.sourceCode.scopeManager!

    function visitHook(node: TSESTree.Node, hookName: string) {
      const scope = scopeManager.acquire(node)!

      visitHookScopesRecursively(scope)

      function checkIsSignal(node: TSESTree.Node) {
        function checkType(type: ts.Type) {
          // type A = ... becomes aliasSymbol with name A
          // interface A { ... } becomes symbol with name A
          const name = type.aliasSymbol?.name ?? type.symbol?.name
          if (!name) return false

          if (name === "Signal") return true
          if (name === "ReadonlySignal") return true
          if (name === "ReadonlySignalHack") return true

          return false
        }

        const type = services.getTypeAtLocation(node)
        return type.isUnionOrIntersection() ? type.types.some((it) => checkType(it)) : checkType(type)
      }

      function getMessageId() {
        return hookName === "useMemo"
          ? "unexpectedSubscribeMemo"
          : hookName === "useCallback" || hookName === "useRecoilCallback"
            ? "unexpectedSubscribeCallback"
            : "unexpectedSubscribeEffect"
      }

      function visitHookScopesRecursively(currentScope: TSESLint.Scope.Scope) {
        for (const reference of currentScope.references) {
          if (!reference.resolved) {
            continue
          }

          let node: TSESTree.Node = reference.identifier
          while (true) {
            if (checkIsSignal(node) && checkIfSubscribes(node)) {
              const parent = node.parent
              context.report({
                node: parent.property,
                messageId: getMessageId(),
                data: {
                  hookName,
                },
                suggest: [
                  {
                    messageId: "peekInstead",
                    fix: (fixer) => fixer.replaceText(parent.property, "peek()"),
                  },
                ],
              })
            }

            const reactiveCall = findReactiveCall(node)
            if (reactiveCall) {
              const parent = node.parent
              context.report({
                node: parent,
                messageId: getMessageId(),
                data: {
                  hookName,
                },
              })
            }

            // Follow property chains to handle cases like foo.bar.mySignal.value
            // Parent walks to the right starting at foo.
            if (node.parent.type === "MemberExpression") {
              node = node.parent
            } else {
              break
            }
          }
        }

        for (const childScope of currentScope.childScopes) {
          // Wrapping a block in untracked() will disable
          // any subscription attempts inside.
          if (
            childScope.block.parent?.type === "CallExpression" &&
            childScope.block.parent.callee.type === "Identifier" &&
            ["untracked", "computed", "effect"].includes(childScope.block.parent.callee.name)
          ) {
            continue
          }

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
          case "useEffect":
          case "useLayoutEffect":
          case "useCallback":
          case "useMemo":
          case "useRecoilCallback":
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
          default:
            return
        }
      },
    }
  },
})
