import { useEffect, useRef, useState } from "preact/hooks"
import useLazyLoadScript from "src/lib/useLazyLoadScript"
import { WSRContext } from "src/integrations/wsm-tools/wsr/wsrContext"
import sceneManager from "src/core/three/sceneManager"
import { MeshLambertMaterial } from "three"
import { SketchMaterials } from "@spacemakerai/web-sketch-renderer"
import { useInitializeFormitCoreCallback } from "src/integrations/wsm-tools/wsr/api/useInitialize"
import { LineMaterial } from "three/addons/lines/LineMaterial.js"
import { getMessageHandler } from "src/integrations/wsm-tools/wsr/utils"
import { ModelTree } from "src/integrations/wsm-tools/debug/model-tree/ModelTree"

declare module "preact" {
  namespace JSX {
    interface IntrinsicElements {
      "wsm-model-tree": JSX.HTMLAttributes<HTMLElement> & {
        toggleDebugVisuals: (on: boolean) => void
      }
    }
  }
}

/**
 * @deprecated Don't use this anymore! ModelTree has a good one.
 * @returns
 */
function WSMDebugVisualization() {
  const wsrContextRef = useRef<WSRContext>()
  const initialize = useInitializeFormitCoreCallback()

  useEffect(() => {
    console.log("initializing debug vis")
    void initialize().then(() => {
      wsrContextRef.current = new WSRContext(
        sceneManager,
        FormIt.Model.GetHistoryID(),
        sceneManager.scene,
        {
          showAxisMarkers: true,
          inferenceHighlightMeshFaces: true,
          defaultMaterialOverrides: {
            faceMaterial: new MeshLambertMaterial({
              ...SketchMaterials.defaultFaceMaterial,
              color: 0x00aaff,
              transparent: true,
              opacity: 0.5,
              polygonOffset: true,
              polygonOffsetFactor: -1.0,
              polygonOffsetUnits: -1.0,
            }),
            edgeMaterial: new LineMaterial({
              ...SketchMaterials.defaultEdgeParams,
              color: 0x00ff00,
              linewidth: 2,
            }),
            unshadedFaceMaterial: new MeshLambertMaterial({
              ...SketchMaterials.defaultUnshadedFaceMaterial,
              color: 0x00aaff,
              transparent: true,
              opacity: 0.5,
            }),
            meshWireframeMaterial: new MeshLambertMaterial({
              ...SketchMaterials.defaultMeshWireframeMaterial,
              color: 0x00ff00,
            }),
          },
        },
        getMessageHandler(),
        undefined,
        true,
      )

      wsrContextRef.current?.sketchScene.syncChanges(FormIt.Model.GetHistoryID())
      wsrContextRef.current.animate(0)
    })

    return () => {
      wsrContextRef.current?.onShutdown()
    }
  })
  return null
}

// TODO: remove when new one is stable. And then archive the old repository.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function OldWSMModelTreeWrapper() {
  const [debugVis, setDebugVis] = useState(false)
  useLazyLoadScript("/web-components/wsm-model-tree/wsm-model-tree.mjs", "conceptual")
  return (
    <>
      {debugVis && <WSMDebugVisualization />}
      {
        <wsm-model-tree
          toggleDebugVisuals={(on: boolean) => {
            console.log(`debug visuals ${on}`)
            setDebugVis(on)
          }}
          style={`position: absolute;
            bottom: 0;
            z-index: 9999;
            right: 0;`}
        />
      }
    </>
  )
}

function WSMModelTreeWrapper() {
  return <ModelTree />
}

export default WSMModelTreeWrapper
