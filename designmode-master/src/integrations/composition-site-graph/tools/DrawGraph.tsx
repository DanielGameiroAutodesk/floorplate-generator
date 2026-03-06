import type { Graph, PType } from "src/integrations/composition-site-graph/graph/types"
import { atom, atomFamily, useRecoilState, useRecoilValue, useResetRecoilState, useSetRecoilState } from "recoil"
import type { GraphToolState } from "./toolState"
import { DrawEdges } from "./DrawEdges"
import { useCallback, useMemo } from "preact/compat"
import graph from "src/integrations/composition-site-graph/graph/graph"
import { useHotkey, type HotkeyKeyRegistration } from "src/core/hotkeys"
import { snappingAPIStateful } from "src/integrations/snapping/SnappingAPI"

export type CompleteCallbackGraph = <EP extends PType, CoEP extends PType, PP extends PType, VP extends PType>(
  graph: Graph<EP, CoEP, PP, VP>,
) => void

export const drawGraphToolState = atom<GraphToolState>({ key: "draw-graph-tool-state", default: "edge" })
//dont use this outside this file, hack for now
export const drawGraphState = atomFamily<Graph, string>({
  key: "draw-graph-state",
  default: graph.empty,
})

export function useExitGraphTool(onComplete: CompleteCallbackGraph, onCancel: () => void, stateId: string) {
  const resetToolState = useResetRecoilState(drawGraphToolState)
  const state = useRecoilValue(drawGraphState(stateId))
  const setState = useSetRecoilState(drawGraphState(stateId))
  return useCallback(() => {
    resetToolState()
    snappingAPIStateful.clearSnapInfo()
    if (Object.values(state._edges).length >= 1) {
      onComplete(state)
    } else {
      onCancel()
    }
    setState(graph.empty())
  }, [resetToolState, state, setState, onComplete, onCancel])
}

export function DrawGraph({
  graphToolStateId,
  onComplete,
  onPreview,
  onCancel,
}: {
  graphToolStateId: string
  onComplete: CompleteCallbackGraph
  onPreview: CompleteCallbackGraph
  onCancel: () => void
}) {
  const [state, setState] = useRecoilState(drawGraphState(graphToolStateId))
  const exitDrawGraph = useExitGraphTool(onComplete, onCancel, graphToolStateId)
  const escapeHotkey = useMemo<HotkeyKeyRegistration>(() => {
    return {
      description: (t) => t(($) => $.hotkeys.exitGraphTool),
      keyCode: "Escape",
      editAccessRequired: true,
      callback: exitDrawGraph,
    }
  }, [exitDrawGraph])
  useHotkey(escapeHotkey)
  const enterHotkey = useMemo<HotkeyKeyRegistration>(() => {
    return {
      description: (t) => t(($) => $.hotkeys.exitGraphTool),
      keyCode: "Enter",
      editAccessRequired: true,
      callback: exitDrawGraph,
    }
  }, [exitDrawGraph])
  useHotkey(enterHotkey)

  const resetHotkey = useMemo<HotkeyKeyRegistration>(() => {
    return {
      description: (t) => t(($) => $.hotkeys.resetGraph),
      keyCode: "d",
      editAccessRequired: true,
      callback: () => {
        setState(graph.empty())
      },
    }
  }, [setState])

  useHotkey(resetHotkey)

  const onCommit = useCallback(
    (newGraph: Graph) => {
      if (newGraph === state) {
        exitDrawGraph()
      } else {
        onPreview(newGraph)
        setState(newGraph)
      }
    },
    [exitDrawGraph, onPreview, setState, state],
  )

  return <DrawEdges state={state} onPreview={onPreview} onCommit={onCommit} />
}
