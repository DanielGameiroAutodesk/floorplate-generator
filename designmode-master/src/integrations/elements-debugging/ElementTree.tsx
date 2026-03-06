import type { ElementState } from "src/core/elements/ElementState"
import type { Urn } from "@spacemakerai/element-types"
import { parseUrn } from "src/lib/element/urn"
import { useMemo } from "preact/hooks"
import type { InternalPath } from "src/lib/element/path"
import { mergePath, ROOT_KEY } from "src/lib/element/path"
import { isDefined } from "src/lib/array"
import type { ElementSnapshot } from "src/core/elements/ElementSnapshot"

export default function ElementTree({ state }: { state: ElementState }) {
  return (
    <div>
      <ElementInfoViewer snapshot={state.currentSnapshot.value} path={ROOT_KEY} />
    </div>
  )
}

function ElementInfoViewer({ snapshot, path }: { snapshot: ElementSnapshot; path: InternalPath }) {
  const node = useMemo(() => snapshot.getNode(path), [snapshot, path])

  const childNodes = useMemo(() => {
    if (!node) return []
    const childPaths = node.elementContainer.element.children?.map((child) => mergePath(node.path, child.key)) ?? []
    return childPaths.map((path) => snapshot.getNode(path)).filter(isDefined)
  }, [node, snapshot])

  if (!node) {
    return null
  }

  return (
    <div>
      <PrettyUrn
        selected={false}
        onClick={() => {}}
        prefix={"-".repeat(node.path.split("/").length - 1)}
        postfix={node.elementContainer.representations.volumeMesh ? "###" : undefined}
        persisted={node.elementContainer.isServerState}
        urn={node.elementContainer?.element.urn}
      />
      {childNodes.map((child) => (
        <ElementInfoViewer key={child.path} snapshot={snapshot} path={child.path} />
      ))}
    </div>
  )
}

function PrettyUrn({
  prefix,
  postfix,
  selected,
  urn,
  onClick,
  persisted,
}: {
  onClick: () => void
  selected: boolean
  prefix: string
  postfix: string | undefined
  urn: Urn
  persisted: boolean
}) {
  const parsed = parseUrn(urn)

  return (
    <p onClick={onClick} style={{ cursor: "pointer", ...(selected ? { color: "blue" } : {}) }}>
      {`${prefix} ${parsed.system}:${parsed.id.slice(0, 5)}:${parsed.revision.slice(-5)}`}
      <strong>{postfix}</strong>
      <strong>{persisted ? "saved" : "(saving)"}</strong>
    </p>
  )
}
