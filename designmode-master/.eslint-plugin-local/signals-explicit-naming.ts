import type { TSESTree } from "@typescript-eslint/utils"
import { ESLintUtils } from "@typescript-eslint/utils"
import { findSignalSubscribeNode, checkIsSignal, checkIfSubscribes } from "./signals-utils"

/**
 * This rule enforces a consistent signals naming with Signal suffix.
 *
 * See README for details.
 */
export default ESLintUtils.RuleCreator.withoutDocs({
  meta: {
    type: "problem",
    messages: {
      signalIdentifierMissingSuffix: "Identifier should be suffixed with Signal",
      signalIdentifierRedundantSuffix:
        "Identifier should not be suffixed with Signal as it does not represent a signal",
      reactiveMethodMissingSuffix:
        "Method '{{name}}' has a side-effect that it subscribes to a signal. To make this explicit, add 'Reactive' suffix to the method name. Generally it's better to refactor the code to avoid the side-effect of subscriptions in methods, such as passing in dependencies instead. Use peek() if you don't intend to subscribe to updates. If the method calls another Reactive method the invocation can be wrapped in untracked() to peek instead of subscribing",
      reactiveMethodRedundantSuffix:
        "Method '{{name}}' should not be suffixed Reactive as it does not subscribe to a signal",
      peekInstead: "Peek the value instead if you don't need to rerun on updates",
    },
    schema: [],
    hasSuggestions: true,
  },
  defaultOptions: [],
  create(context) {
    function checkBlock(node: TSESTree.Node, nameNode: TSESTree.Node, name: string) {
      const signalNode = findSignalSubscribeNode(context, node)
      if (signalNode && !name.endsWith("Reactive")) {
        context.report({
          node: signalNode.parent!,
          messageId: "reactiveMethodMissingSuffix",
          data: {
            name,
          },
          suggest: checkIfSubscribes(signalNode)
            ? [
                {
                  messageId: "peekInstead",
                  fix: (fixer) => fixer.replaceText(signalNode.parent.property, "peek()"),
                },
              ]
            : [],
        })
      } else if (!signalNode && name.endsWith("Reactive")) {
        context.report({
          node: nameNode,
          messageId: "reactiveMethodRedundantSuffix",
          data: {
            name,
          },
        })
      }
    }

    function checkSignalNaming(node: TSESTree.Node, isSignal: boolean, name: string) {
      if (isSignal && !isSignalNamedLenient(name)) {
        context.report({
          node: node,
          messageId: "signalIdentifierMissingSuffix",
          suggest: [],
        })
      } else if (!isSignal && isSignalNamed(name)) {
        context.report({
          node: node,
          messageId: "signalIdentifierRedundantSuffix",
          suggest: [],
        })
      }
    }

    return {
      VariableDeclarator: (node: TSESTree.VariableDeclarator) => {
        // const someSignal = ...
        if (node.id.type === "Identifier") {
          // eslint-disable-next-line local/signals-explicit-naming
          const isSignal = checkIsSignal(context, node)
          checkSignalNaming(node.id, isSignal, node.id.name)
        }
      },
      PropertyDefinition: (node: TSESTree.PropertyDefinition) => {
        // class Foo {
        //   someSignal = ...
        // }
        if (node.key.type === "Identifier") {
          checkSignalNaming(node.key, checkIsSignal(context, node), node.key.name)
        }
      },
      Property: (node: TSESTree.Property) => {
        // const foo = {
        //   someSignal: ...
        // }
        if (node.key.type === "Identifier") {
          checkSignalNaming(node.key, checkIsSignal(context, node), node.key.name)
        }
      },
      FunctionDeclaration: (node: TSESTree.FunctionDeclaration) => {
        // function someReactive() { ... }
        if (node.id) {
          if (isHookOrComponent(node.id.name)) return

          checkBlock(node.body, node.id, node.id.name)
        }
      },
      MethodDefinition: (node: TSESTree.MethodDefinition) => {
        // class Foo {
        //   methodReactive() { ... }
        // }
        if (node.key.type === "Identifier" && node.value.body) {
          checkBlock(node.value.body, node.key, node.key.name)
        }

        // class Foo {
        //   get someSignal() { ... }
        // }
        if (node.kind === "get" && node.key.type === "Identifier") {
          checkSignalNaming(node.key, checkIsSignal(context, node), node.key.name)
        }
      },
      ArrowFunctionExpression: (node: TSESTree.ArrowFunctionExpression) => {
        // const someReactive = (...) => ...
        if (node.parent.type === "VariableDeclarator" && node.parent.id.type === "Identifier") {
          if (isHookOrComponent(node.parent.id.name)) return

          checkBlock(node.body, node.parent.id, node.parent.id.name)
        }
      },
      FunctionExpression: (node: TSESTree.FunctionExpression) => {
        // const someReactive = function (...) { ... }
        if ("id" in node.parent && node.parent.id && node.parent.id.type === "Identifier") {
          if (isHookOrComponent(node.parent.id.name)) return
          checkBlock(node.body, node.parent.id, node.parent.id.name)
        }

        // {
        //   someReactive(): { ... }
        // }
        if ("key" in node.parent && node.parent.key && node.parent.key.type === "Identifier") {
          if (isHookOrComponent(node.parent.key.name)) return
          checkBlock(node.body, node.parent.key, node.parent.key.name)
        }
      },
    }
  },
})

function isHookOrComponent(name: string) {
  return /^[A-Z]|use[A-Z]/.test(name)
}

function isSignalNamed(name: string) {
  return name.endsWith("Signal")
}

function isSignalNamedLenient(name: string) {
  return name.endsWith("Signal") || name === "signal" || name === "item"
}
