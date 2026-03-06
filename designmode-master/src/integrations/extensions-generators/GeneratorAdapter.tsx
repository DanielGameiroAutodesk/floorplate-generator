import { useCallback, useEffect, useMemo, useState } from "preact/hooks"
import { Matrix4 } from "three"
import { useOperationPending } from "src/integrations/PendingOperation/useOperationPending"
import {
  EDIT_GENERATORS_TOOL_CFG,
  generatorIdSignal,
  setGeneratorIdSignalValue,
} from "src/integrations/Toolbars/CoreToolbar/domain/generators/GeneratorsToolbar"
import { PROJECT_ID } from "src/core/project/project"
import type { Generator } from "./generator-service"
import { useGeneratorsAndExtension } from "./generator-service"
import { contextRootSignal, selectedNodesSignal } from "src/core/selection/selectionState"
import type { SetIsPendingFn } from "./WebComponent"
import { FormaGeneratorAdapterRightMenu } from "./WebComponent"
import type { GeneratedElement } from "./elements"
import { isGeneratedElement } from "./elements"
import type { PersistSpec } from "./persist"
import { usePersist } from "./persist"
import { usePreview } from "./preview"
import type { Extension } from "src/integrations/extensions/extension-service"
import { newChildKey } from "src/lib/element/urn"
import type { EditedElementEvent } from "src/integrations/tools-common/Selection/editElement"
import type { InternalPath } from "src/lib/element/path"
import { useRequestHandles } from "./handles"
import { useComputed } from "@preact/signals"
import { elementState } from "src/core/elements/ElementState"
import { exitCurrentTool, toolAPI } from "src/core/toolsState"

import { RightMenuPanel } from "src/lib/components/RightMenu/RightMenuPanel"
import { useReadonlySignal } from "src/lib/signal"

const matrix4Default = new Matrix4()

export type ElementAndPath = {
  path: InternalPath
  element: GeneratedElement
}

function FormaGeneratorAdapterRightMenuContainer({
  elementAndPath,
  generator,
  extension,
  setEditedElementPath,
  exitDrawing,
  isDrawing,
}: {
  elementAndPath?: ElementAndPath
  generator: Generator
  extension: Extension
  setEditedElementPath: (
    editedElementPath: string | undefined | ((prev: string | undefined) => string | undefined),
  ) => void
  exitDrawing: (newEditedElementPath?: InternalPath) => void
  isDrawing: boolean
}) {
  const elementAndPathSignal = useReadonlySignal(elementAndPath)
  const transform = useComputed(() => {
    if (elementAndPathSignal.value) {
      return elementState.currentSnapshot.value.getNodeOrThrow(elementAndPathSignal.value.path).globalMatrix
    }
    return matrix4Default
  }).value

  const contextRoot = contextRootSignal.value

  const persistSpec = useMemo<PersistSpec>(
    () => ({
      path: elementAndPath ? elementAndPath.path : [contextRoot, newChildKey()].join("/"),
      elementAndPath,
    }),
    [contextRoot, elementAndPath],
  )

  const preview = usePreview(elementAndPath, transform)
  const persist = usePersist(persistSpec, setEditedElementPath, extension.id)
  const { shapeTool, requestHandles } = useRequestHandles(transform)
  const { setPendingOperation } = useOperationPending()

  const setPendingOperationSpecialized = useCallback<SetIsPendingFn>(
    (params) => {
      setPendingOperation(
        params
          ? {
              elementId: "generator-adapter",
            }
          : undefined,
      )
    },
    [setPendingOperation],
  )

  return (
    <RightMenuPanel style="display: block" id="generator-adapter">
      <FormaGeneratorAdapterRightMenu
        projectId={PROJECT_ID}
        generator={generator}
        extension={extension}
        element={elementAndPath?.element}
        elementPath={persistSpec.path}
        preview={preview}
        persist={persist}
        isDrawing={isDrawing}
        exitDrawing={exitDrawing}
        requestHandles={requestHandles}
        setIsPending={setPendingOperationSpecialized}
      />
      {shapeTool}
    </RightMenuPanel>
  )
}

const emptyList: never[] = []

export function GeneratorAdapter() {
  const selectedNodes = selectedNodesSignal.value

  const [editedElementPath, setEditedElementPath] = useState<string>()
  const [pendingExit, setPendingExit] = useState<boolean>(false)

  const generatorsAndExtension = useGeneratorsAndExtension() ?? emptyList
  const { isOperationPending, markOperationBlocked } = useOperationPending()
  const initialGeneratorId = generatorIdSignal.value

  const singleSelectedNode = selectedNodes.length === 1 ? selectedNodes[0] : undefined
  const element = singleSelectedNode ? singleSelectedNode.element : undefined
  const validElement = element && isGeneratedElement(element) ? element : undefined

  const existingGeneratorId = validElement ? validElement.properties.generator.generatorId : undefined
  const generatorId = initialGeneratorId ?? existingGeneratorId

  const generatorAndExtension = useMemo(
    () => generatorsAndExtension.find((it) => it.generator.id === generatorId),
    [generatorsAndExtension, generatorId],
  )

  const elementAndPath: ElementAndPath | undefined = useMemo(
    () =>
      singleSelectedNode && validElement
        ? {
            path: singleSelectedNode.path,
            element: validElement,
          }
        : undefined,
    [singleSelectedNode, validElement],
  )

  const exitDrawing = useCallback(() => {
    setEditedElementPath(undefined)
    if (isOperationPending) {
      setPendingExit(true)
      markOperationBlocked()
    } else {
      setPendingExit(false)
      setGeneratorIdSignalValue(undefined)
      exitCurrentTool()
    }
  }, [isOperationPending, markOperationBlocked])

  useEffect(() => {
    if (pendingExit && !isOperationPending) {
      exitDrawing()
    }
  }, [pendingExit, exitDrawing, isOperationPending])

  useEffect(() => {
    if (elementAndPath == null || editedElementPath !== elementAndPath.path) {
      setEditedElementPath(undefined)
    }
  }, [editedElementPath, elementAndPath])

  useEffect(() => {
    function listener(event: Event) {
      const e = event as EditedElementEvent
      setEditedElementPath(e.detail.path)
      toolAPI.setTool(EDIT_GENERATORS_TOOL_CFG)
    }

    window.addEventListener("experimental/editedElement", listener)
    return () => {
      window.removeEventListener("experimental/editedElement", listener)
    }
  }, [])

  if (generatorAndExtension) {
    return (
      <FormaGeneratorAdapterRightMenuContainer
        elementAndPath={elementAndPath}
        generator={generatorAndExtension.generator}
        extension={generatorAndExtension.extension}
        setEditedElementPath={setEditedElementPath}
        exitDrawing={exitDrawing}
        isDrawing={elementAndPath ? elementAndPath.path === editedElementPath : true}
      />
    )
  }

  return <></>
}
