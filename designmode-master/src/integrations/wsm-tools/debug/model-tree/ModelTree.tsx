import stylesheet from "./ModelTree.module.pcss"

import { useEffect, useRef, useState } from "preact/hooks"
import { FastDataUtils, SketchMaterials, type DefaultSketchMaterials } from "@spacemakerai/web-sketch-renderer"

const { dataRetriever, getInstTransf3d, getObjectTypes } = FastDataUtils

import {
  formitInitializedSignal,
  useInitializeFormitCoreCallback,
} from "src/integrations/wsm-tools/wsr/api/useInitialize"
import { getMessageHandler } from "src/integrations/wsm-tools/wsr/utils"
import { Panel, PanelContentForm } from "./ModelTreePanel"
import sceneManager from "src/core/three/sceneManager"
import { render } from "preact"
import { signal } from "@preact/signals"
import { wsmObjectTypeToString } from "@spacemakerai/web-sketch-renderer/lib/wsmUtils"
import { WSRContext } from "src/integrations/wsm-tools/wsr/wsrContext"
import { MeshLambertMaterial, Vector3 } from "three"
import { LineMaterial } from "three/examples/jsm/Addons.js"
import { DownloadModelButton } from "./DownloadModelButton"
import { cameraApi } from "src/integrations/camera/CameraAPI"
import { EasingFunctions } from "src/lib/easing"
import { pathStartsWith } from "src/integrations/wsm-tools/wsr/tools/toolUtils"

function formatNumber(x: number, fx: number = 1) {
  return x.toFixed(fx)
}

function formatInterval3d(interval: WSM.Interval3dInterface) {
  const f = formatNumber
  const l = interval.lower
  const u = interval.upper
  return `(${f(l.x)}, ${f(l.y)}, ${f(l.z)}) ⇀ (${f(u.x)}, ${f(u.y)}, ${f(u.z)})`
}

function formatPath(path: WSM.GroupInstancePathInterface) {
  const ids = path.ids.map((id) => {
    const t = FastDataUtils.getObjectTypes(dataRetriever(), id.History, [id.Object]).types[0]
    return `${wsmObjectTypeToString(t)} ${id.History}:${id.Object}`
  })
  return `Path: ${ids.join(", ")}`
}

function expandPath(path: WSM.GroupInstancePathInterface, id: WSM.ObjectHistoryID): WSM.GroupInstancePathInterface {
  return {
    ...path,
    ids: [...path.ids, id],
  }
}

interface ModelTreeOptions {
  showCollapsedInitially: boolean
  showDebugVisuals: boolean
  showSyncedPaths: boolean
  updateDynamically: boolean
  respondToSelection: boolean
  preselectOnHover: boolean
  expandHistoriesByDefault: boolean
  expandBodiesByDefault: boolean
  expandFacesByDefault: boolean
  expandVerticesByDefault: boolean
  expandEdgesByDefault: boolean
  expandShellByDefault: boolean
  expandLumpByDefault: boolean
  expandStringAttributeByDefault: boolean
  expandLevelByDefault: boolean
  expandMeshByDefault: boolean
  expandLineMeshByDefault: boolean
}

const defaultModelTreeOptions: ModelTreeOptions = {
  showCollapsedInitially: false,
  showDebugVisuals: true,
  showSyncedPaths: false,
  preselectOnHover: true,
  updateDynamically: true,
  respondToSelection: true,
  expandHistoriesByDefault: true,
  expandBodiesByDefault: false,
  expandFacesByDefault: false,
  expandVerticesByDefault: false,
  expandEdgesByDefault: false,
  expandShellByDefault: true,
  expandLumpByDefault: true,
  expandStringAttributeByDefault: false,
  expandLevelByDefault: false,
  expandMeshByDefault: false,
  expandLineMeshByDefault: false,
}

const modelTreeOptionsSignal = signal<ModelTreeOptions>({
  ...defaultModelTreeOptions,
})

function loadOptions() {
  const optionsStr = localStorage.getItem("wsm-model-tree-options")
  if (optionsStr) {
    const options = JSON.parse(optionsStr)
    modelTreeOptionsSignal.value = {
      ...defaultModelTreeOptions,
      ...options,
    }
  }
  return modelTreeOptionsSignal.peek()
}

function updateOptions(options: Partial<ModelTreeOptions>) {
  localStorage.setItem("wsm-model-tree-options", JSON.stringify(options))
  modelTreeOptionsSignal.value = {
    ...modelTreeOptionsSignal.peek(),
    ...options,
  }
}

loadOptions()

export function Checkbox(props: {
  id: string
  name: string
  label: string
  tooltip?: string
  disabled?: boolean
  isChecked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <div>
      <label title={props.tooltip} htmlFor={props.id}>
        <input
          type="checkbox"
          id={props.id}
          name={props.name}
          checked={props.isChecked}
          disabled={props.disabled}
          title={props.tooltip}
          onChange={(e) => {
            props.onChange((e.target as HTMLInputElement).checked)
          }}
        />
        {props.label}
      </label>
    </div>
  )
}

function CoedgeNode({
  history,
  object,
  options,
  path,
}: {
  history: number
  object: number
  options: ModelTreeOptions
  path: WSM.GroupInstancePathInterface
}) {
  const edges = FastDataUtils.getObjectsByType(dataRetriever(), history, object, WSM.nEdgeType).objects

  // TODO: fast call
  const forward = WSM.APIGetCoedgeDirectionReadOnly(history, object)

  return (
    <div className={stylesheet["mt-node"]}>
      <div className={stylesheet["mt-node-label"]}>
        Coedge, {forward ? "Forward" : "Reversed"} {object}
      </div>
      {edges.map((edge, index) => (
        <EdgeNode
          history={history}
          object={edge}
          key={index}
          options={options}
          path={expandPath(path, WSM.ObjectHistoryID(history, object))}
        />
      ))}
    </div>
  )
}

function LoopNode({
  history,
  object,
  options,
  path,
}: {
  history: number
  object: number
  options: ModelTreeOptions
  path: WSM.GroupInstancePathInterface
}) {
  const coedges = FastDataUtils.getObjectsByType(dataRetriever(), history, object, WSM.nCoedgeType).objects

  return (
    <div className={stylesheet["mt-node"]}>
      <div className={stylesheet["mt-node-label"]}>Loop {object}</div>

      {coedges.map((coedge, index) => (
        <CoedgeNode history={history} object={coedge} key={index} options={options} path={path} />
      ))}
    </div>
  )
}

function NoExpandButton() {
  return <div className={stylesheet["mt-no-expand"]}>•</div>
}

function ExpandButton({ expanded, setExpanded }: { expanded: boolean; setExpanded: (expanded: boolean) => void }) {
  return (
    <div className={stylesheet["mt-expand"]} onClick={() => setExpanded(!expanded)}>
      {expanded ? "⏷" : "⏵"}
    </div>
  )
}

function FaceNode({
  history,
  object,
  options,
  path,
}: {
  history: number
  object: number
  options: ModelTreeOptions
  path: WSM.GroupInstancePathInterface
}) {
  const [expanded, setExpanded] = useState(options.expandFacesByDefault)
  const loops = FastDataUtils.getObjectsByType(dataRetriever(), history, object, WSM.nLoopType).objects

  return (
    <div className={stylesheet["mt-node"]}>
      <div className={`${stylesheet["mt-node-label"]} ${stylesheet["mt-node-face"]}`}>
        <ExpandButton expanded={expanded} setExpanded={setExpanded} />
        <SelectableNode
          content={`nFaceType ${object}`}
          history={history}
          object={object}
          path={path}
          options={options}
        />
      </div>
      <div className={stylesheet["mt-node"]}>
        {expanded &&
          loops.map((loop, index) => (
            <LoopNode history={history} object={loop} key={index} options={options} path={path} />
          ))}
      </div>
    </div>
  )
}

function filterSelectable(path: WSM.GroupInstancePathInterface) {
  const supportedTypes = [
    WSM.nObjectType.nBodyType,
    WSM.nObjectType.nFaceType,
    WSM.nObjectType.nEdgeType,
    WSM.nObjectType.nVertexType,
    WSM.nObjectType.nMeshType,
    WSM.nObjectType.nLineMeshType,
    WSM.nObjectType.nInstanceType,
  ]

  const ids: WSM.ObjectHistoryID[] = []
  for (const id of path.ids) {
    const t = FastDataUtils.getObjectTypes(undefined, id.History, [id.Object]).types[0]
    if (supportedTypes.find((x) => x == t)) {
      ids.push(id)
    }
  }
  return WSM.GroupInstancePath(ids)
}

function SelectableNode({
  content,
  history,
  object,
  path,
  options,
  onCopyClicked,
}: {
  content: any
  history: number
  object: number
  path: WSM.GroupInstancePathInterface
  options: ModelTreeOptions
  onCopyClicked?: () => void
}) {
  const selected = dataRetriever()?.isIndirectlySelectedInAnyPath(history, object)

  return (
    <div className={`${stylesheet["mt-clickable"]} ${selected ? stylesheet["mt-selected"] : ""}`}>
      <div
        onMouseEnter={() => {
          if (!options.preselectOnHover) {
            return
          }

          const type = FastDataUtils.getObjectTypes(undefined, history, [object]).types[0]
          if (type == WSM.nFaceType || type == WSM.nEdgeType) {
            FormIt.Selection.SetPreSelections(WSM.GroupInstancePath(WSM.ObjectHistoryID(history, object)), [
              WSM.ObjectHistoryID(history, object),
            ])
          } else {
            const properPath = filterSelectable(path)
            console.log("Setting preselection: " + formatPath(properPath))
            FormIt.Selection.SetPreSelections(properPath, [WSM.ObjectHistoryID(history, object)])
          }

          getMessageHandler().broadcastJSMessage("FormIt.Message.kInferenceEventInferencedObjectChanged", path)
          sceneManager.render()
        }}
        onClick={() => {
          if (!selected) {
            const type = FastDataUtils.getObjectTypes(undefined, history, [object]).types[0]
            if (type != WSM.nInstanceType) {
              FormIt.Selection.SetSelections([WSM.ObjectHistoryID(history, object)])
            } else {
              const properPath = filterSelectable(path)
              console.log("Setting selection: " + formatPath(properPath))
              FormIt.Selection.SetSelections(properPath)
            }

            // const selectionPath = filterSelectable(path)
            // console.log("select..", JSON.stringify(selectionPath))
            // FormIt.Selection.AddSelections([selectionPath])
            // //FormIt.Selection.SetSelections(path.ids)
            sceneManager.render()
          } else {
            FormIt.Selection.SetSelections([])
            sceneManager.render()
          }
        }}
        className={stylesheet["mt-node-preselect"]}
      >
        {content}
      </div>
      {onCopyClicked ? <button onClick={onCopyClicked}>📋</button> : <></>}
      {history == 0 && (
        <button
          onClick={() => {
            // get all the instance path transforms
            const transf = WSM.GroupInstancePath.GetObjectTransform(path)

            const leaf = path.ids[path.ids.length - 1]
            const bb = WSM.APIGetBoxReadOnly(leaf.History, leaf.Object)

            const lowerTf = WSM.Transf3d.Multiply(transf, bb.lower)
            const upperTf = WSM.Transf3d.Multiply(transf, bb.upper)

            const center = WSM.Interval3d.GetMidPoint(WSM.Interval3d.Interval3d(lowerTf, upperTf))

            upperTf.x *= 0.3048
            upperTf.y *= 0.3048
            upperTf.z *= 0.3048

            center.x *= 0.3048
            center.y *= 0.3048
            center.z *= 0.3048

            const extend = Math.max(upperTf.x - center.x, upperTf.y - center.y, upperTf.z - center.z)
            const x = center.x + extend * 2.5
            const y = center.y + extend * 2.5
            const z = center.z + extend * 5

            cameraApi
              .moveCamera({ x, y, z }, center, 1.0, 1000, EasingFunctions.easeOutQuart)
              .then(() => console.log("camera moved"))
              .catch((e) => console.error("camera move failed", e))
          }}
        >
          🎯
        </button>
      )}
    </div>
  )
}

function VertexNode({
  history,
  object,
  options,
  path,
}: {
  history: number
  object: number
  options: ModelTreeOptions
  path: WSM.GroupInstancePathInterface
}) {
  const [expanded, setExpanded] = useState(options.expandVerticesByDefault)
  const point = WSM.APIGetVertexPoint3dReadOnly(history, object)
  //const { vertex: point } = getVertexPoint3d(undefined, history, object)

  return (
    <div className={stylesheet["mt-node"]}>
      <div className={`${stylesheet["mt-node-label"]} ${stylesheet["mt-node-vertex"]}`}>
        <ExpandButton expanded={expanded} setExpanded={setExpanded} />
        <SelectableNode
          content={`Vertex (${formatNumber(point.x)}, ${formatNumber(point.y)}, ${formatNumber(point.z)})`}
          history={history}
          object={object}
          path={path}
          options={options}
        />
      </div>
      <div className={stylesheet["mt-node"]}>{expanded && <pre>{JSON.stringify(point, undefined, 2)}</pre>}</div>
    </div>
  )
}

function EdgeNode({
  history,
  object,
  options,
  path,
}: {
  history: number
  object: number
  options: ModelTreeOptions
  path: WSM.GroupInstancePathInterface
}) {
  const [expanded, setExpanded] = useState(options.expandEdgesByDefault)
  const vertices = FastDataUtils.getObjectsByType(dataRetriever(), history, object, WSM.nVertexType).objects

  const points = vertices.map((v) => WSM.APIGetVertexPoint3dReadOnly(history, v))

  return (
    <div className={stylesheet["mt-node"]}>
      <div className={`${stylesheet["mt-node-label"]} ${stylesheet["mt-node-edge"]}`}>
        <ExpandButton expanded={expanded} setExpanded={setExpanded} />
        <SelectableNode
          content={`nEdgeType id: ${object} ${points
            .map((p) => {
              return `(${formatNumber(p.x)}, ${formatNumber(p.y)}, ${formatNumber(p.z)})`
            })
            .join(", ")}`}
          history={history}
          object={object}
          path={path}
          options={options}
        />
      </div>
      <div className={stylesheet["mt-node"]}>
        {expanded &&
          vertices.map((vertex, index) => (
            <VertexNode
              history={history}
              object={vertex}
              key={index}
              options={options}
              path={expandPath(path, WSM.ObjectHistoryID(history, vertex))}
            />
          ))}
      </div>
    </div>
  )
}

function ShellNode({
  history,
  object,
  options,
  path,
}: {
  history: number
  object: number
  options: ModelTreeOptions
  path: WSM.GroupInstancePathInterface
}) {
  const [expanded, setExpanded] = useState(options.expandShellByDefault)
  const faces = FastDataUtils.getObjectsByType(dataRetriever(), history, object, WSM.nFaceType).objects
  return (
    <div className={stylesheet["mt-node"]}>
      <div className={`${stylesheet["mt-node-label"]} ${stylesheet["mt-node-shell"]}`}>
        <ExpandButton expanded={expanded} setExpanded={setExpanded} />
        nShellType {object}&nbsp;(<span className={stylesheet["mt-node-label-item-count"]}>{faces.length}</span>)
      </div>
      {expanded &&
        faces.map((face, index) => (
          <FaceNode
            history={history}
            object={face}
            key={`${index}-${options.expandFacesByDefault}`}
            options={options}
            path={expandPath(path, WSM.ObjectHistoryID(history, face))}
          />
        ))}
    </div>
  )
}

function LumpNode({
  history,
  object,
  options,
  path,
}: {
  history: number
  object: number
  options: ModelTreeOptions
  path: WSM.GroupInstancePathInterface
}) {
  const [expanded, setExpanded] = useState(options.expandLumpByDefault)
  const shells = FastDataUtils.getObjectsByType(dataRetriever(), history, object, WSM.nShellType).objects
  return (
    <div className={stylesheet["mt-node"]}>
      <div className={`${stylesheet["mt-node-label"]} ${stylesheet["mt-node-lump"]}`}>
        <ExpandButton expanded={expanded} setExpanded={setExpanded} />
        nLumpType {object}
      </div>
      {expanded &&
        shells.map((shell, index) => (
          <ShellNode history={history} object={shell} key={index} options={options} path={path} />
        ))}
    </div>
  )
}

function BodyNode({
  history,
  object: body,
  options,
  path,
}: {
  history: number
  object: number
  options: ModelTreeOptions
  path: WSM.GroupInstancePathInterface
}) {
  const [expanded, setExpanded] = useState(options.expandBodiesByDefault)
  const lumps = FastDataUtils.getObjectsByType(dataRetriever(), history, body, WSM.nShellType).objects
  const transf3d = WSM.GroupInstancePath.GetObjectTransform(path)
  const bb = FastDataUtils.getBoundingBox(undefined, history, body, transf3d).boundingBox
  return (
    <div className={stylesheet["mt-node"]}>
      <div className={`${stylesheet["mt-node-label"]} ${stylesheet["mt-node-body"]}`}>
        <ExpandButton expanded={expanded} setExpanded={setExpanded} />
        <SelectableNode
          content={`nBodyType id: ${body} bounding box: ${formatInterval3d(bb)}`}
          history={history}
          object={body}
          path={path}
          options={options}
        />
      </div>
      {expanded && (
        <>
          {lumps.map((lump, index) => (
            <LumpNode
              path={path}
              history={history}
              object={lump}
              key={`${index}-${options.expandBodiesByDefault}`}
              options={options}
            />
          ))}
          <Attributes history={history} object={body} options={options} path={path} />
        </>
      )}
    </div>
  )
}

function MeshNode({
  history,
  object: meshId,
  options,
  path,
}: {
  history: number
  object: number
  options: ModelTreeOptions
  path: WSM.GroupInstancePathInterface
}) {
  const [expanded, setExpanded] = useState(options.expandMeshByDefault)
  const attributes = FastDataUtils.getObjectsByType(dataRetriever(), history, meshId, WSM.nStringAttributeType).objects
  const transf3d = WSM.GroupInstancePath.GetObjectTransform(path)
  const bb = FastDataUtils.getBoundingBox(undefined, history, meshId, transf3d).boundingBox
  return (
    <div className={stylesheet["mt-node"]}>
      <div className={`${stylesheet["mt-node-label"]} ${stylesheet["mt-node-mesh"]}`}>
        <ExpandButton expanded={expanded} setExpanded={setExpanded} />
        <SelectableNode
          content={`nMeshType id: ${meshId} bounding box: ${formatInterval3d(bb)}`}
          history={history}
          object={meshId}
          path={path}
          options={options}
        />
      </div>
      {expanded &&
        attributes.map((attr, index) => (
          <StringAttributeNode
            path={path}
            history={history}
            object={attr}
            key={`${index}-${options.expandBodiesByDefault}`}
            options={options}
          />
        ))}
    </div>
  )
}

function LineMeshNode({
  history,
  object: meshId,
  options,
  path,
}: {
  history: number
  object: number
  options: ModelTreeOptions
  path: WSM.GroupInstancePathInterface
}) {
  const [expanded, setExpanded] = useState(options.expandBodiesByDefault)
  const attributes = FastDataUtils.getObjectsByType(dataRetriever(), history, meshId, WSM.nStringAttributeType).objects
  const transf3d = WSM.GroupInstancePath.GetObjectTransform(path)
  const bb = FastDataUtils.getBoundingBox(undefined, history, meshId, transf3d).boundingBox
  return (
    <div className={stylesheet["mt-node"]}>
      <div className={`${stylesheet["mt-node-label"]} ${stylesheet["mt-node-mesh"]}`}>
        <ExpandButton expanded={expanded} setExpanded={setExpanded} />
        <SelectableNode
          content={`nLineMeshType id: ${meshId} bb: ${formatInterval3d(bb)}`}
          history={history}
          object={meshId}
          path={path}
          options={options}
        />
      </div>
      {expanded &&
        attributes.map((attr, index) => (
          <StringAttributeNode
            path={path}
            history={history}
            object={attr}
            key={`${index}-${options.expandBodiesByDefault}`}
            options={options}
          />
        ))}
    </div>
  )
}

function Transf3dContainer({ transf3d }: { transf3d: WSM.Transf3dInterface }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className={stylesheet["mt-node"]}>
      <div className={`${stylesheet["mt-node-label"]}`}>
        <ExpandButton expanded={expanded} setExpanded={setExpanded} />
        Transform Matrix
      </div>
      {expanded && (
        <div className={stylesheet["mt-node"]}>
          <Transf3d transf3d={transf3d} />
        </div>
      )}
    </div>
  )
}

function Transf3d({ transf3d }: { transf3d: WSM.Transf3dInterface }) {
  const m = transf3d.data as number[]
  const f = (n: number) => formatNumber(n, 6)
  return (
    <table className={stylesheet["mt-transform"]} style={{ userSelect: "text" }}>
      <tr>
        <td>{f(m[0])}</td>
        <td>{f(m[1])}</td>
        <td>{f(m[2])}</td>
        <td>{f(m[3])}</td>
      </tr>
      <tr>
        <td>{f(m[4])}</td>
        <td>{f(m[5])}</td>
        <td>{f(m[6])}</td>
        <td>{f(m[7])}</td>
      </tr>
      <tr>
        <td>{f(m[8])}</td>
        <td>{f(m[9])}</td>
        <td>{f(m[10])}</td>
        <td>{f(m[11])}</td>
      </tr>
      <tr>
        <td>{f(m[12])}</td>
        <td>{f(m[13])}</td>
        <td>{f(m[14])}</td>
        <td>{f(m[15])}</td>
      </tr>
    </table>
  )
}

function Attributes({
  history,
  object,
  path,
  options,
}: {
  history: number
  object: number
  options: ModelTreeOptions
  path: WSM.GroupInstancePathInterface
}) {
  const attrs = WSM.APIGetObjectAttributesReadOnly(history, object)
  const types = getObjectTypes(undefined, history, attrs).types

  const tags = []
  let i = 0
  for (const attr of attrs) {
    if (types[i] == WSM.nStringAttributeType) {
      tags.push(<StringAttributeNode key={i} history={history} object={attr} path={path} options={options} />)
    } else {
      tags.push(<GenericNode key={i} history={history} object={attr} path={path} options={options} />)
    }
    i++
  }
  return <>{tags}</>
}

function InstanceNode({
  history,
  object,
  path,
  options,
  refHistory,
}: {
  history: number
  object: number
  options: ModelTreeOptions
  path: WSM.GroupInstancePathInterface
  refHistory: number
}) {
  const [expanded, setExpanded] = useState(false)

  // const levelAttributes = getObjectsByType(undefined, history, object, WSM.nLevelAttributeType)
  // const layerAttributes = getObjectsByType(undefined, history, object, WSM.nLayerAttributeType)
  // const objectAttributes = getObjectsByType(undefined, history, object, WSM.nObjectPropertiesAttributeType)

  let inEditInContextPath = false

  const inContextPath = FormIt.GroupEdit.GetInContextEditingPath()
  const sanitizedPath = WSM.GroupInstancePath(filterSelectable(path))

  inEditInContextPath = pathStartsWith(inContextPath, sanitizedPath)
  const transf3d = getInstTransf3d(undefined, history, object)
  const pos = new Vector3(transf3d.data[3], transf3d.data[7], transf3d.data[11])
  return (
    <div className={stylesheet["mt-node"]}>
      <div
        className={`${stylesheet["mt-node-label"]} ${stylesheet["mt-node-instance"]} ${inEditInContextPath ? stylesheet["mt-context"] : ""}`}
      >
        <ExpandButton expanded={expanded} setExpanded={setExpanded} />
        <SelectableNode
          content={
            <span>{`nInstanceType id: ${object} translation: (${formatNumber(pos.x, 2)}, ${formatNumber(pos.y, 2)}, ${formatNumber(pos.z, 2)})`}</span>
          }
          history={history}
          object={object}
          path={path}
          options={options}
          onCopyClicked={() => {
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            navigator.clipboard.writeText(JSON.stringify(transf3d.data))
          }}
        />
      </div>
      <div className={stylesheet["mt-node"]}>
        {expanded && (
          <>
            <Transf3dContainer transf3d={transf3d} />
            <Attributes history={history} object={object} options={options} path={path} />
            <HistoryNode history={refHistory} options={options} path={path} />
          </>
        )}
      </div>
    </div>
  )
}

function GroupNode({
  history,
  object: group,
  options,
  path,
}: {
  history: number
  object: number
  options: ModelTreeOptions
  path: WSM.GroupInstancePathInterface
}) {
  const [expanded, setExpanded] = useState(true)
  const refHistory = FastDataUtils.getGroupReferencedHistory(dataRetriever(), history, group)
  const instances = FastDataUtils.getObjectsByType(dataRetriever(), history, group, WSM.nInstanceType).objects

  const transf3d = WSM.GroupInstancePath.GetObjectTransform(path)
  const bb = FastDataUtils.getBoundingBox(undefined, history, group, transf3d).boundingBox

  return (
    <div className={stylesheet["mt-node"]}>
      <div className={`${stylesheet["mt-node-label"]} ${stylesheet["mt-node-group"]}`}>
        <ExpandButton expanded={expanded} setExpanded={setExpanded} />
        <span>
          nGroupType id: {group}, bb: {formatInterval3d(bb)} &nbsp;{" "}
        </span>
        <span
          className={stylesheet["mt-clickable-span"]}
          onClick={() => {
            console.log("Clicked group", group)
            self.document.getElementById(`modeltree-history-${refHistory}`)?.scrollIntoView({ behavior: "smooth" })
          }}
        >
          ref&apos;d history {refHistory}{" "}
        </span>
      </div>
      {expanded &&
        instances.map((inst, index) => (
          <InstanceNode
            path={expandPath(path, WSM.ObjectHistoryID(history, inst))}
            history={history}
            object={inst}
            key={index}
            options={options}
            refHistory={refHistory}
          />
        ))}
    </div>
  )
}

function LevelNode({
  history,
  object,
  options,
  path,
}: {
  history: number
  object: number
  options: ModelTreeOptions
  path: WSM.GroupInstancePathInterface
}) {
  const [expanded, setExpanded] = useState(options?.expandLevelByDefault)
  const data = WSM.APIGetLevelDataReadOnly(history, object, true)
  const type = FastDataUtils.getObjectTypes(dataRetriever(), history, [object]).types[0]

  const attrs = WSM.APIGetObjectAttributesReadOnly(history, object)
  const attrTypes = FastDataUtils.getObjectTypes(dataRetriever(), history, attrs).types

  return (
    <div className={stylesheet["mt-node"]}>
      <div className={`${stylesheet["mt-node-label"]}`}>
        <ExpandButton expanded={expanded} setExpanded={setExpanded} />
        {wsmObjectTypeToString(type)} id: {object} Name: {data.sLevelName} Elevation: {formatNumber(data.dElevation, 6)}
      </div>
      <div className={stylesheet["mt-node"]}>
        {expanded &&
          attrs.map((x, i) =>
            attrTypes[i] == WSM.nObjectType.nStringAttributeType ? (
              <StringAttributeNode path={path} history={history} object={x} key={i} options={options} />
            ) : (
              <GenericNode path={path} history={history} object={x} key={i} options={options} />
            ),
          )}
      </div>
    </div>
  )
}

function LayerNode({
  history,
  object,
  options,
  path,
}: {
  history: number
  object: number
  options: ModelTreeOptions
  path: WSM.GroupInstancePathInterface
}) {
  const [expanded, setExpanded] = useState(false)
  const data = WSM.APIGetLayerDataReadOnly(history, object)
  const type = FastDataUtils.getObjectTypes(dataRetriever(), history, [object]).types[0]

  const attrs = WSM.APIGetObjectAttributesReadOnly(history, object)
  const attrTypes = FastDataUtils.getObjectTypes(dataRetriever(), history, attrs).types

  return (
    <div className={stylesheet["mt-node"]}>
      <div className={`${stylesheet["mt-node-label"]}`}>
        <ExpandButton expanded={expanded} setExpanded={setExpanded} />
        {wsmObjectTypeToString(type)} id: {object} Name: {data.name} Displayed: {data.displayed}
      </div>
      <div className={stylesheet["mt-node"]}>
        {expanded &&
          attrs.map((x, i) =>
            attrTypes[i] == WSM.nObjectType.nStringAttributeType ? (
              <StringAttributeNode path={path} history={history} object={x} key={i} options={options} />
            ) : (
              <GenericNode path={path} history={history} object={x} key={i} options={options} />
            ),
          )}
      </div>
    </div>
  )
}

/** Just a fallback if we have no other handler. */
function GenericNode({
  history,
  object,
}: {
  history: number
  object: number
  options: ModelTreeOptions
  path: WSM.GroupInstancePathInterface
}) {
  const type = FastDataUtils.getObjectTypes(dataRetriever(), history, [object]).types[0]
  // const attr = WSM.APIGetObjectAttributesReadOnly(history, object)
  // attributes: {attr.length}
  return (
    <div className={stylesheet["mt-node"]}>
      <div className={`${stylesheet["mt-node-label"]}`}>
        <NoExpandButton />
        {wsmObjectTypeToString(type)} id: {object}
      </div>
    </div>
  )
}

function StringAttributeNode({
  history,
  object,
  options,
}: {
  history: number
  object: number
  options: ModelTreeOptions
  path: WSM.GroupInstancePathInterface
}) {
  const [expanded, setExpanded] = useState(options?.expandStringAttributeByDefault)
  const keyValue = WSM.APIGetStringAttributeKeyValueReadOnly(history, object)

  return (
    <div className={stylesheet["mt-node"]}>
      <div className={`${stylesheet["mt-node-label"]}`}>
        <ExpandButton expanded={expanded} setExpanded={setExpanded} />
        nStringAttributeType id: {object} Key: {keyValue.sKey} Value: {keyValue.sValue}
      </div>
      <div className={stylesheet["mt-node"]}>{expanded && <pre>{JSON.stringify(keyValue, undefined, 2)}</pre>}</div>
    </div>
  )
}

function AnyNode({
  history,
  object,
  options,
  filterTypes,
  path,
}: {
  history: number
  object: number
  options: ModelTreeOptions
  filterTypes?: WSM.nObjectType[]
  path: WSM.GroupInstancePathInterface
}) {
  const t = FastDataUtils.getObjectTypes(dataRetriever(), history, [object]).types[0]

  if (filterTypes && filterTypes.indexOf(t) !== -1) {
    return <></>
  }

  const supportedTypes = [
    WSM.nObjectType.nBodyType,
    WSM.nObjectType.nFaceType,
    WSM.nObjectType.nEdgeType,
    WSM.nObjectType.nGroupType,
    WSM.nObjectType.nStringAttributeType,
    WSM.nObjectType.nMeshType,
    WSM.nObjectType.nLineMeshType,
    WSM.nObjectType.nLevelType,
    WSM.nObjectType.nLayerType,
  ]

  return (
    <>
      {t === WSM.nObjectType.nBodyType && <BodyNode path={path} history={history} object={object} options={options} />}
      {t === WSM.nObjectType.nFaceType && <FaceNode path={path} history={history} object={object} options={options} />}
      {t === WSM.nObjectType.nEdgeType && <EdgeNode path={path} history={history} object={object} options={options} />}
      {t === WSM.nObjectType.nMeshType && <MeshNode path={path} history={history} object={object} options={options} />}
      {t === WSM.nObjectType.nLineMeshType && (
        <LineMeshNode path={path} history={history} object={object} options={options} />
      )}
      {t === WSM.nObjectType.nGroupType && (
        <GroupNode path={path} history={history} object={object} options={options} />
      )}
      {t === WSM.nObjectType.nStringAttributeType && (
        <StringAttributeNode path={path} history={history} object={object} options={options} />
      )}
      {t === WSM.nObjectType.nLevelType && (
        <LevelNode path={path} history={history} object={object} options={options} />
      )}
      {t === WSM.nObjectType.nLayerType && (
        <LayerNode path={path} history={history} object={object} options={options} />
      )}
      {supportedTypes.indexOf(t) === -1 && (
        <GenericNode path={path} history={history} object={object} options={options} />
      )}
    </>
  )
}

function formatBytes(bytes: number, decimals = 2) {
  try {
    if (bytes === 0) return "0 Bytes"

    const k = 1024
    const dm = decimals < 0 ? 0 : decimals
    const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"]

    const i = Math.floor(Math.log(bytes) / Math.log(k))

    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i]
  } catch (e) {
    // just because the above seems a little fancy..
    console.warn("Error formatting bytes", e)
    return bytes.toString()
  }
}

function ModelStatsNode({ history }: { history: number }) {
  const modelStatsSummary = FormIt.Utils.ModelStatisticsSummary(history)
  if (!modelStatsSummary || FormIt.Tools.IsInContinuousAction()) {
    return <div></div>
  }
  return (
    <div className={`${stylesheet["mt-node"]} ${stylesheet["mt-stats"]}`}>
      <table className={stylesheet["mt-stats-table"]}>
        <tr>
          <td>Total History Size:</td>
          <td>{formatBytes(modelStatsSummary.totalHistorySize)}</td>
        </tr>
        <tr>
          <td>Total collapsed history size </td>
          <td>{formatBytes(modelStatsSummary.totalCollapsedHistorySize)}</td>
        </tr>
        <tr>
          <td>Total Bodies: </td>
          <td>{modelStatsSummary.totalBodies}</td>
        </tr>
        <tr>
          <td>Total Meshes: </td>
          <td>{modelStatsSummary.totalMeshes}</td>
        </tr>
        <tr>
          <td>Total Line Meshes: </td>
          <td>{modelStatsSummary.totalLineMeshes}</td>
        </tr>
        <tr>
          <td>Total Triangles: </td>
          <td>{modelStatsSummary.totalTriangles}</td>
        </tr>
        <tr>
          <td>Texture Bytes: </td>
          <td>{formatBytes(modelStatsSummary.textureBytes)}</td>
        </tr>
      </table>
    </div>
  )
}

function ModelStats({ history }: { history: number }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div id={`modeltree-stats`} className={stylesheet["mt-node"]}>
      <div className={`${stylesheet["mt-node-label"]} ${stylesheet["mt-node-history"]}`}>
        <ExpandButton expanded={expanded} setExpanded={setExpanded} />
        Statistics
      </div>
      {expanded && (
        <div className={stylesheet["mt-node"]}>
          <ModelStatsNode history={history} />
        </div>
      )}
    </div>
  )
}

function HistoryNode({
  history,
  options,
  path: givenPath,
}: {
  history: number
  options: ModelTreeOptions
  path?: WSM.GroupInstancePathInterface
}) {
  const [expanded, setExpanded] = useState(givenPath ? false : options.expandHistoriesByDefault)

  const nonOwned = FastDataUtils.getAllNonOwned(dataRetriever(), history)
  //const types = FastDataUtils.getObjectTypes(undefined, history, nonOwned).types

  return (
    <div id={`modeltree-history-${history}`} className={stylesheet["mt-node"]}>
      <div
        className={`${stylesheet["mt-node-label"]} ${stylesheet["mt-node-history"]} ${history == 0 ? stylesheet["mt-context"] : ""}`}
      >
        <ExpandButton expanded={expanded} setExpanded={setExpanded} />
        History {history}{" "}
        {!expanded && <span className={stylesheet["mt-node-label-item-count"]}>&nbsp;({nonOwned.length} items)</span>}
      </div>

      {expanded && <ModelStats history={history} />}
      {expanded &&
        nonOwned.map((object, index) => {
          let path = givenPath ?? WSM.GroupInstancePath(WSM.ObjectHistoryID(history, object))
          return (
            <AnyNode
              path={expandPath(path, WSM.ObjectHistoryID(history, object))}
              key={index}
              history={history}
              object={object}
              options={options}
            />
          )
        })}
    </div>
  )
}

export function DebugBackground() {
  const [formitInitialized, setFormitInitialized] = useState(false)
  const init = useInitializeFormitCoreCallback()

  init()
    .then(() => {
      setFormitInitialized(true)
    })
    .catch((e) => {
      console.error("Error initializing FormIt core", e)
    })

  return (
    <div className={stylesheet["mt-background"]}>
      {formitInitialized ? <ModelTree newWindow={true} /> : <div>Loading...</div>}
    </div>
  )
}

function WSMDebugVisualization({ highlightSynced }: { highlightSynced: boolean }) {
  const wsrContextRef = useRef<WSRContext>()

  const initialize = useInitializeFormitCoreCallback()

  const extraStyles: Partial<DefaultSketchMaterials> = highlightSynced
    ? {
        outOfContextFaceMaterial: new MeshLambertMaterial({
          ...SketchMaterials.defaultFaceMaterial,
          color: 0xaaffaa,
        }),
        outOfContextEdgeMaterial: new LineMaterial({
          ...SketchMaterials.defaultEdgeParams,
          color: 0x00aa00,
          linewidth: 1,
        }),
        // faceMaterial: new MeshLambertMaterial({
        //   ...SketchMaterials.defaultFaceMaterial,
        //   color: 0xaaffaa,
        //   transparent: true,
        //   opacity: 0.15,
        //   polygonOffset: true,
        //   polygonOffsetFactor: -1.0,
        //   polygonOffsetUnits: -1.0,
        // }),
        // edgeMaterial: new LineMaterial({
        //   ...SketchMaterials.defaultEdgeParams,
        //   color: 0x00ff00,
        //   linewidth: 1,
        // }),
        // unshadedFaceMaterial: new MeshLambertMaterial({
        //   ...SketchMaterials.defaultUnshadedFaceMaterial,
        //   color: 0xaaffaa,
        //   transparent: true,
        //   opacity: 0.15,
        // }),
        meshWireframeMaterial: new MeshLambertMaterial({
          ...SketchMaterials.defaultMeshWireframeMaterial,
          color: 0x00ff00,
        }),
      }
    : {}

  useEffect(() => {
    console.log("initializing debug vis")
    void initialize().then(() => {
      wsrContextRef.current = new WSRContext(
        sceneManager,
        FormIt.Model.GetHistoryID(),
        sceneManager.scene,
        {
          //alwaysInContext: true,
          allowHighlightsOutOfContext: true,
          disableOutOfContextStyling: false,
          allowEditingOnHistoryZero: true,
          onlyRenderOutOfContext: true,
          showInstanceIds: true,
          showAxisMarkers: true,
          defaultMaterialOverrides: extraStyles,
          inferenceHighlightMeshFaces: true,
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

export function ModelTree(props: { newWindow?: boolean }) {
  const [visible, setVisible] = useState(!modelTreeOptionsSignal.value.showCollapsedInitially)

  if (!formitInitializedSignal.value) {
    return <></>
  }

  const containerStyle = props.newWindow ? stylesheet["mt-full"] : stylesheet["mt-window"]

  const containerClass = visible ? containerStyle : stylesheet["mt-window-hidden"]

  return (
    <div className={containerClass}>
      <div className={stylesheet["mt-fixed-header"]}>
        {!props.newWindow && (
          <h2>
            WSM DEBUG{" "}
            <button
              className={stylesheet["mt-title-button"]}
              style={{ float: "right" }}
              onClick={() => {
                const w = window.open("", "_blank", "width=400,height=600") as any

                // Same origin, so we can share objects. Copy over the message handler and FormItModule
                ;(window as any).modelTreeWindow = w
                w.FormIt = window.FormIt
                w.WSM = window.WSM
                w.FormItModule = window.FormItModule
                w.messageHandler = (window as any).messageHandler
                const newDocument = w.document

                // Now we need to copy over all our stylesheets
                for (const ss of document.styleSheets) {
                  if (ss.href) {
                    const link = document.createElement("link")
                    link.rel = "stylesheet"
                    link.href = ss.href
                    newDocument.head.appendChild(link)
                  } else {
                    // Inline stylesheet
                    const style = document.createElement("style")
                    // Some older browsers may not support styleSheet.cssRules
                    const cssRules = ss.cssRules || ss.rules
                    if (cssRules) {
                      for (let i = 0; i < cssRules.length; i++) {
                        style.appendChild(document.createTextNode(cssRules[i].cssText))
                      }
                    } else {
                      style.textContent = (ss as any).textContent
                    }
                    newDocument.head.appendChild(style)
                  }
                }

                // Render into the body of our new window
                render(<ModelTree newWindow={true} />, w.document.body)
              }}
            >
              New Window
            </button>
            <button
              className={`${stylesheet["mt-minimize"]} ${stylesheet["mt-title-button"]}`}
              onClick={() => setVisible(!visible)}
            >
              {visible ? "Minimize" : "Expand"}
            </button>
          </h2>
        )}
      </div>
      {modelTreeOptionsSignal.value.showDebugVisuals && (
        <WSMDebugVisualization highlightSynced={modelTreeOptionsSignal.value.showSyncedPaths} />
      )}
      {visible && <ModelTreeInner newWindow={props.newWindow} />}
    </div>
  )
}

export function ModelTreeInner(props: { newWindow?: boolean }) {
  const [refreshCounter, setRefreshCounter] = useState(0)

  const contentRef = useRef<HTMLDivElement>(null)

  const histories = WSM.APIGetAllReachableHistoriesReadOnly(0, false)
  const modelTreeOptions = modelTreeOptionsSignal.value

  useEffect(() => {
    if (!modelTreeOptions.updateDynamically) {
      return
    }
    const modelChangedHandler = getMessageHandler().addMessageHandler(
      "FormIt.Message.kModelChanged",
      (/*_payload: FormIt.Message.kModelChangedPayload*/) => {
        setRefreshCounter(refreshCounter + 1)
        return true
      },
    )

    return () => {
      getMessageHandler().removeMessageHandler(modelChangedHandler)
    }
  }, [refreshCounter, modelTreeOptions])

  useEffect(() => {
    if (!modelTreeOptions.respondToSelection) {
      return
    }
    const selectionHandler = getMessageHandler().addMessageHandler(FormIt.Message.kSelectionsChanged, (/*payload*/) => {
      if (!modelTreeOptions.respondToSelection) {
        return true
      }
      setRefreshCounter(refreshCounter + 1)
      return true
    })

    return () => {
      getMessageHandler().removeMessageHandler(selectionHandler)
    }
  }, [refreshCounter, modelTreeOptions])

  useEffect(() => {
    if (!contentRef.current) {
      return
    }
    const cr = contentRef.current
    const handler = (event: Event) => {
      console.log("click", event.target)
    }

    cr.addEventListener("click", handler)

    return () => {
      cr.removeEventListener("click", handler)
    }
  })

  return (
    <>
      <Panel expandedByDefault={false} headerText="Model Tree Options">
        <PanelContentForm>
          <Checkbox
            id={"show-collapsed"}
            name={"show-collapsed"}
            label="Show Model Tree Collapsed Initially"
            isChecked={modelTreeOptions.showCollapsedInitially}
            onChange={(checked: boolean) => {
              updateOptions({
                showCollapsedInitially: checked,
              })
            }}
          />

          <div className={stylesheet["mt-option-separator"]} />
          <Checkbox
            id={"show-debug-visuals"}
            name={"show-debug-visuals"}
            label="Show Debug Visuals"
            isChecked={modelTreeOptions.showDebugVisuals}
            onChange={(checked: boolean) => {
              sceneManager.render()
              updateOptions({
                showDebugVisuals: checked,
              })
            }}
          />
          <div className={stylesheet["mt-option-indent"]}>
            <Checkbox
              id={"show-synced-paths"}
              name={"show-synced-paths"}
              label="Show Synced Paths In Green"
              isChecked={modelTreeOptions.showSyncedPaths}
              disabled={!modelTreeOptions.showDebugVisuals}
              onChange={(checked: boolean) => {
                sceneManager.render()
                updateOptions({
                  showSyncedPaths: checked,
                })
              }}
            />
            <Checkbox
              id={"preselect-on-hover"}
              name={"preselect-on-hover"}
              label="Preselect on Tree Item Hover"
              isChecked={modelTreeOptions.preselectOnHover}
              disabled={!modelTreeOptions.showDebugVisuals}
              onChange={(checked: boolean) => {
                updateOptions({
                  ...modelTreeOptions,
                  preselectOnHover: checked,
                })
              }}
            />
          </div>
          <div className={stylesheet["mt-option-separator"]} />

          <Checkbox
            id={"update-dynamically"}
            name={"update-dynamically"}
            label="Update Dynamically"
            isChecked={modelTreeOptions.updateDynamically}
            onChange={(checked: boolean) => {
              updateOptions({
                updateDynamically: checked,
              })
            }}
          />

          <div className={stylesheet["mt-option-indent"]}>
            <Checkbox
              id={"respond-to-selection"}
              name={"respond-to-selection"}
              label="Refresh on selection changed"
              isChecked={modelTreeOptions.respondToSelection}
              onChange={(checked: boolean) => {
                updateOptions({
                  ...modelTreeOptions,
                  respondToSelection: checked,
                })
              }}
            />
          </div>

          <div className={stylesheet["mt-option-separator"]} />

          <Checkbox
            id={"expand-histories"}
            name={"expand-histories"}
            label="Expand Histories Automatically"
            isChecked={modelTreeOptions.expandHistoriesByDefault}
            onChange={(checked: boolean) => {
              updateOptions({
                ...modelTreeOptions,
                expandHistoriesByDefault: checked,
              })
            }}
          />
          <Checkbox
            id={"expand-bodies"}
            name={"expand-bodies"}
            label="Expand Bodies Automatically"
            isChecked={modelTreeOptions.expandBodiesByDefault}
            onChange={(checked: boolean) => {
              updateOptions({
                ...modelTreeOptions,
                expandBodiesByDefault: checked,
              })
            }}
          />
          <Checkbox
            id={"expand-faces"}
            name={"expand-faces"}
            label="Expand Faces Automatically"
            isChecked={modelTreeOptions.expandFacesByDefault}
            onChange={(checked: boolean) => {
              console.log("set model tree options..")
              updateOptions({
                ...modelTreeOptions,
                expandFacesByDefault: checked,
              })
            }}
          />
          <Checkbox
            id={"expand-edges"}
            name={"expand-edges"}
            label="Expand Edges Automatically"
            isChecked={modelTreeOptions.expandEdgesByDefault}
            onChange={(checked: boolean) => {
              console.log("set model tree options..")
              updateOptions({
                ...modelTreeOptions,
                expandEdgesByDefault: checked,
              })
            }}
          />
          <Checkbox
            id={"expand-vertices"}
            name={"expand-vertices"}
            label="Expand Vertices Automatically"
            isChecked={modelTreeOptions.expandVerticesByDefault}
            onChange={(checked: boolean) => {
              console.log("set model tree options..")
              updateOptions({
                ...modelTreeOptions,
                expandVerticesByDefault: checked,
              })
            }}
          />
        </PanelContentForm>
      </Panel>

      <h2 className="mt-header">
        Model Tree
        <DownloadModelButton />
        <button style={{ float: "right" }} onClick={() => FormIt.Selection.SetSelections([])}>
          Clear Selections
        </button>
        <button style={{ float: "right" }} onClick={() => setRefreshCounter(refreshCounter + 1)}>
          Refresh
        </button>
      </h2>
      <div className={stylesheet["model-tree"]}>
        <div className={props.newWindow ? "" : stylesheet["mt-content"]}>
          <>
            {histories.map((history, index) => {
              return <HistoryNode key={index} history={history} options={modelTreeOptions} />
            })}
          </>
        </div>
      </div>
    </>
  )
}
