import type { TSESLint, TSESTree } from "@typescript-eslint/utils"
import { ESLintUtils } from "@typescript-eslint/utils"
import type * as ts from "typescript"

export function checkIsSignal(context: TSESLint.RuleContext<any, any>, node: TSESTree.Node) {
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

  const services = ESLintUtils.getParserServices(context)
  const type = services.getTypeAtLocation(node)
  return type.isUnionOrIntersection() ? type.types.some((it) => checkType(it)) : checkType(type)
}

export function checkIfSubscribes(node: TSESTree.Node): node is TSESTree.Node & {
  parent: TSESTree.MemberExpression
} {
  return (
    (node.parent &&
      node.parent.type === "MemberExpression" &&
      node.parent.property.type === "Identifier" &&
      node.parent.property.name === "value" &&
      // Assigning to a signal value is fine.
      node.parent.parent.type !== "AssignmentExpression") ??
    false
  )
}

export function findReactiveCall(
  node: TSESTree.Node & {
    parent: TSESTree.Node
  },
) {
  if (node.parent.type === "CallExpression") {
    if (node.type === "MemberExpression" && node.property.type === "Identifier") {
      // instance.someReactive()
      if (node.property.name.endsWith("Reactive")) {
        return node.property
      }
    }

    if (node.type === "Identifier") {
      // someReactive()
      if (node.name.endsWith("Reactive")) {
        return node
      }
    }
  }

  return undefined
}

export function findSignalSubscribeNode(context: TSESLint.RuleContext<any, any>, node: TSESTree.Node) {
  const scope = context.sourceCode.getScope(node)

  return visitScopesRecursively(scope)

  function visitScopesRecursively(currentScope: TSESLint.Scope.Scope): TSESTree.Node | undefined {
    for (const reference of currentScope.references) {
      if (!reference.resolved) {
        continue
      }

      let node: TSESTree.Node = reference.identifier
      while (true) {
        if (checkIsSignal(context, node) && checkIfSubscribes(node)) {
          return node
        }

        const reactiveCall = findReactiveCall(node)
        if (reactiveCall) {
          return reactiveCall
        }

        // Follow property chains to handle cases like foo.bar.mySignal.value
        // Parent walks to the right starting at foo.
        if (node.parent.type === "MemberExpression" || node.parent.type === "CallExpression") {
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

      // Don't go into deeper function declarations.
      // Any violations within them will propgate to those in
      // a different check.
      if (
        childScope.block.type === "FunctionDeclaration" ||
        childScope.block.type === "FunctionExpression" ||
        childScope.block.type === "ArrowFunctionExpression"
      ) {
        continue
      }

      const result = visitScopesRecursively(childScope)
      if (result) return result
    }

    return undefined
  }
}
