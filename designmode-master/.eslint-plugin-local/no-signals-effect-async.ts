import type { TSESTree } from "@typescript-eslint/utils"
import { ESLintUtils } from "@typescript-eslint/utils"
import { findSignalSubscribeNode } from "./signals-utils"

/**
 * This rule prevents us from subscribing to signals inside an async method,
 * as this is often a mistake. For a signal to actually subscribe it must
 * read .value in the same synchronous execution context as the effect
 * it should rerun (such as useSignalEffect).
 */
export default ESLintUtils.RuleCreator.withoutDocs({
  meta: {
    type: "problem",
    messages: {
      // eslint-disable-next-line local/signals-explicit-naming
      unexpectedSignal:
        "The method '{{ methodName }}' is async and should not subscribe to signals. Signals will only subscribe in the same synchronous execution context as the effect that should rerun. Use peek() if you don't intend to subscribe to updates",
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    function checkBlock(node: TSESTree.Node, name: string) {
      const signalNode = findSignalSubscribeNode(context, node)
      if (signalNode) {
        context.report({
          node: signalNode.parent!,
          messageId: "unexpectedSignal",
          data: {
            methodName: name,
          },
        })
      }
    }

    return {
      FunctionDeclaration: (node: TSESTree.FunctionDeclaration) => {
        if (node.id && node.async) {
          checkBlock(node.body, node.id.name)
        }
      },
      MethodDefinition: (node: TSESTree.MethodDefinition) => {
        if (node.key.type === "Identifier" && node.value.body && node.value.async) {
          checkBlock(node.value.body, node.key.name)
        }
      },
      ArrowFunctionExpression: (node: TSESTree.ArrowFunctionExpression) => {
        if (node.parent.type === "VariableDeclarator" && node.parent.id.type === "Identifier" && node.async) {
          checkBlock(node.body, node.parent.id.name)
        }
      },
      FunctionExpression: (node: TSESTree.FunctionExpression) => {
        // const someReactive = async function (...) { ... }
        if (node.async && "id" in node.parent && node.parent.id && node.parent.id.type === "Identifier") {
          checkBlock(node.body, node.parent.id.name)
        }

        // {
        //   async someReactive(): { ... }
        // }
        if (node.async && "key" in node.parent && node.parent.key && node.parent.key.type === "Identifier") {
          checkBlock(node.body, node.parent.key.name)
        }
      },
    }
  },
})
