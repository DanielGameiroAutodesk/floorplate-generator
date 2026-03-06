import { useEffect, useMemo, useState } from "preact/compat"
import type { Child, FormaElement } from "@spacemakerai/element-types"
import type { AmbientLight, BufferGeometry, DirectionalLight } from "three"
import { Color, Group, Mesh, MeshBasicMaterial } from "three"
import { useObjectLifecycle } from "src/core/three/useObjectLifecycle"
import { ROOT_KEY } from "src/lib/element/path"
import { logFixtureData } from "./createAndLoadFixture"
import sceneManager, { lightIntensities } from "src/core/three/sceneManager"
import { useCallback } from "preact/hooks"
import { ProposalClientV3 } from "src/core/proposal-element-system/ProposalClient"
import { proposalIdSignal } from "src/core/proposal"
import { parseUrn } from "src/lib/element/urn"
import { REVISION_URL_PARAM } from "src/lib/location"
import { intializeStats } from "./stats"
import { elementState } from "src/core/elements/ElementState"
import { PROJECT_ID } from "src/core/project/project"
import { selectedNodesSignal, setSelectionSignalValue } from "src/core/selection/selectionState"
import { effect, signal } from "@preact/signals"
import PopUpBox from "src/lib/components/PopUps/PopUpBox"
import { isDebugEnabled } from "src/lib/debug"
import { addPlus3 } from "@spacemakerai/add"
import { terrainSignal } from "src/core/terrain/new-terrain-state"

const colors = new Map<string, Color>()
const colorForId = (id: string) => {
  const ex = colors.get(id)
  if (ex) return ex
  const c = new Color(Math.random(), Math.random(), Math.random())
  colors.set(id, c)
  return c
}

function useDebugHitboxVisuals(show: boolean) {
  const proposal = elementState.currentProposalSignal.value
  const terrain = terrainSignal.value
  const hitboxVisuals = useMemo(() => {
    const group = new Group()
    for (const node of proposal.getToplevelNodes()) {
      if (node.elementContainer === proposal.terrain?.container) continue
      for (const selectable of node.selectables(terrain.terrainSamplerData).getOrCompute().selectables) {
        for (const raycastTarget of selectable.raycastTargets) {
          if (raycastTarget.object3d instanceof Mesh) {
            const m = new Mesh(
              (raycastTarget.object3d.geometry as BufferGeometry).clone(),
              new MeshBasicMaterial({
                color: colorForId(selectable.selectionPath),
                polygonOffset: true,
                polygonOffsetUnits: -3,
                polygonOffsetFactor: -3,
                transparent: true,
                opacity: 0.2,
              }),
            )
            group.add(m)
          }
        }
      }
    }
    return group
  }, [proposal, terrain])
  useObjectLifecycle(hitboxVisuals, show)
}

function SliderInput({ onSubmit, value, label }: { onSubmit: (val: number) => void; label: string; value: number }) {
  return (
    <div>
      {label} {value}
      <weave-slider
        value={`${value}`}
        min={`${0}`}
        max={`${Math.PI}`}
        step={`${0.01}`}
        onInput={(e) => {
          if (!e.detail) return
          return onSubmit(parseFloat(e.detail))
        }}
        onChange={(e) => {
          if (!e.detail) return
          return onSubmit(parseFloat(e.detail))
        }}
      ></weave-slider>
    </div>
  )
}

function LightingSliders() {
  const { scene } = sceneManager
  const [ambient, setAmbient] = useState(lightIntensities.ambient)
  const [headlamp, setHeadlamp] = useState(lightIntensities.headlamp)
  const [sun, setSun] = useState(lightIntensities.sun)
  return (
    <>
      <SliderInput
        label={"Ambient intensity"}
        onSubmit={(val) => {
          console.log("val", val)
          const light = scene.getObjectByName("light-ambient") as AmbientLight
          if (light) {
            light.intensity = val
          }
          lightIntensities.ambient = val
          setAmbient(val)
          sceneManager.render()
        }}
        value={ambient}
      />
      <SliderInput
        label={"Headlamp intensity"}
        onSubmit={(val) => {
          console.log("val", val)
          const light = scene.getObjectByName("light-headlamp") as AmbientLight
          if (light) {
            light.intensity = val
          }
          lightIntensities.headlamp = val
          setHeadlamp(val)
          sceneManager.render()
        }}
        value={headlamp}
      />
      <SliderInput
        label={"Sun intensity"}
        onSubmit={(val) => {
          console.log("val", val)
          const sun = scene.getObjectByName("Sun") as { refs: { light: DirectionalLight } } | undefined
          if (sun) {
            const light = sun.refs.light
            light.intensity = val
          }
          lightIntensities.sun = val
          setSun(val)
          sceneManager.render()
        }}
        value={sun}
      />
    </>
  )
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (val: boolean) => void }) {
  // TODO: Tried using weave-toggle, but it don't behave properly being controlled failing to accept updates.
  // return (
  //   <label
  //     style={{
  //       display: "flex",
  //       flexDirection: "row",
  //       alignItems: "center",
  //     }}
  //     // This is needed a weave components isn't form-ready to integrate with native label elements.
  //     onClick={(e) => {
  //       e.stopPropagation()
  //       onChange(!value)
  //     }}
  //   >
  //     <weave-toggle toggled={value} onChange={(ev) => onChange(ev.detail.checked)}></weave-toggle>
  //     {label}
  //   </label>
  // )

  return (
    <weave-checkbox
      checked={value}
      onChange={() => {
        onChange(!value)
      }}
      label={label}
      showlabel
    />
  )
}

const initialShow = isDebugEnabled || sessionStorage.getItem("designmode-debug-ui-visible") === "true"

const showDebugUiSignal = signal(initialShow)

effect(() => {
  if (showDebugUiSignal.value) {
    sessionStorage.setItem("designmode-debug-ui-visible", "true")
  } else if (sessionStorage.getItem("designmode-debug-ui-visible")) {
    sessionStorage.removeItem("designmode-debug-ui-visible")
  }
})

declare global {
  interface Window {
    openFormaDebugUi(): void
  }
}

window.openFormaDebugUi = () => {
  showDebugUiSignal.value = true
}

export function DebugUI() {
  const a = addPlus3(1, 2)
  console.log(a)
  if (showDebugUiSignal.value === false) {
    if (document.location.hostname.includes("local")) {
      console.warn("Debug UI is hidden. To show it, run `openFormaDebugUi()` in the console or add ?debug URL flag.")
    }
    return null
  }
  if (!elementState.isInitializedSignal.value) return null

  return <DebugUIInner />
}

declare global {
  interface Window {
    __TREE__?: any
  }
}

export function DebugUIInner() {
  const snapshot = elementState.currentSnapshot.value

  const [showHitBoxes, setShowHitBoxes] = useState(false)

  useDebugHitboxVisuals(showHitBoxes)

  useEffect(() => {
    function buildTree(parentPath: string | undefined, child: Child): any {
      const path = parentPath ? parentPath + "/" + child.key : child.key
      return {
        path,
        ...(child.name ? { name: child.name } : {}),
        ...(child.transform ? { transform: child.transform } : {}),
        element: snapshot.getFormaElementOrThrow(child.urn),
        children: snapshot.getFormaElementOrThrow(child.urn).children?.map((c) => buildTree(path, c)),
      }
    }

    window.__TREE__ = buildTree("", { key: ROOT_KEY, name: "Proposal", urn: snapshot.rootUrn })
  }, [snapshot])

  return (
    <PopUpBox.Container
      id="debug-ui"
      top={300}
      header={
        <>
          <PopUpBox.HeaderTitle>Debug</PopUpBox.HeaderTitle>
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              alignItems: "right",
              gap: "10px",
            }}
          >
            <weave-button
              onMouseDown={(e) => {
                e.stopPropagation()
              }}
              onClick={(e) => {
                e.preventDefault()
                intializeStats()
              }}
            >
              Show FPS
            </weave-button>
            <PopUpBox.HeaderCloseIcon
              onClose={() => {
                showDebugUiSignal.value = false
                console.warn("Debug UI hidden. Run openFormaDebugUi() to show it again")
              }}
            />
          </div>
        </>
      }
    >
      <div
        style={{
          padding: 15,
          width: "300px",
          maxHeight: "500px",
          overflow: "auto",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "10px",
          }}
        >
          <weave-button
            onClick={() => {
              console.log(elementState.currentProposalSignal.value)
            }}
          >
            Log current Proposal
          </weave-button>
          <SelectedElement />
          <Toggle label="Show hit boxes" value={showHitBoxes} onChange={(checked) => setShowHitBoxes(checked)} />
          <LightingSliders />
          <LogFixtureData />
          <ListRevisions />
          <SelectElement />
        </div>
      </div>
    </PopUpBox.Container>
  )
}

function SelectedElement() {
  const selectedNodes = selectedNodesSignal.value
  if (selectedNodes.length !== 1) return null
  const selectedNode = selectedNodes[0]
  const element = selectedNode.element

  return (
    <div
      style={{
        border: "1px solid #ccc",
        padding: "10px",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
      }}
    >
      <div>Selected: {selectedNode.path}</div>
      <weave-text-link href={`/elements-inspector/?urn=${encodeURIComponent(selectedNode.urn)}`} target="_blank">
        Elements inspector
      </weave-text-link>
      <weave-button onClick={() => void navigator.clipboard.writeText(element.urn)}>Copy URN</weave-button>
      <weave-button onClick={() => void navigator.clipboard.writeText(JSON.stringify(element, null, 2))}>
        Copy element data
      </weave-button>
      <weave-button
        onClick={() => {
          console.log(selectedNode.path, selectedNode)
        }}
      >
        Log ChildNodeContainer
      </weave-button>
      <pre style={{ overflow: "scroll", maxHeight: "200px" }}>{JSON.stringify(element, null, 2)}</pre>
    </div>
  )
}

function ListRevisions() {
  const [revisions, setRevisions] = useState<FormaElement[]>([])
  const proposalId = proposalIdSignal.value

  const loadRevisions = useCallback(() => {
    void ProposalClientV3.listRevisionsForProposal(proposalId, PROJECT_ID).then(setRevisions)
  }, [proposalId])

  return (
    <div>
      <weave-button onClick={loadRevisions}>Fetch revisions</weave-button>
      <ol
        style={{
          paddingLeft: "20px",
        }}
      >
        {revisions.map((rev) => (
          <li style={{ padding: "2px" }} key={rev.urn}>
            {new Date(rev.metadata!.createdAt!).toLocaleString()} – (
            <a
              href={`/designmode/${PROJECT_ID}/${proposalId}?${REVISION_URL_PARAM}=${parseUrn(rev.urn).revision}&debug`}
            >
              {parseUrn(rev.urn).revision}
            </a>
            )
          </li>
        ))}
      </ol>
    </div>
  )
}

export function LogFixtureData() {
  const [ignoreTerrain, setIgnoreTerrain] = useState(true)

  return (
    <div>
      <weave-button
        onClick={() => {
          logFixtureData(ignoreTerrain)
        }}
      >
        Log fixture data
      </weave-button>
      <Toggle label="Ignore terrain" value={ignoreTerrain} onChange={setIgnoreTerrain} />
    </div>
  )
}

function SelectElement() {
  return (
    <div>
      <div>select urn or path</div>
      <weave-input
        id="select-element-input"
        style={{
          width: "300px",
          marginTop: "4px",
          marginBottom: "4px",
        }}
      />
      <weave-button
        onClick={() => {
          const input = document.getElementById("select-element-input") as HTMLInputElement
          if (input?.value) {
            const isUrn = input.value.startsWith("urn:")
            if (isUrn) {
              const urnPaths: string[] = []
              for (const node of elementState.currentSnapshot.peek().nodes.values()) {
                if (node.urn === input.value) {
                  urnPaths.push(node.path)
                }
              }
              setSelectionSignalValue(urnPaths)
            } else {
              setSelectionSignalValue([input.value])
            }
          }
        }}
      >
        select
      </weave-button>
    </div>
  )
}
