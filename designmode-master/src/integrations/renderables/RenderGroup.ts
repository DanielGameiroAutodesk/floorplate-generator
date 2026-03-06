import { BufferAttribute, BufferGeometry, Group, LineSegments, Mesh, MeshBasicMaterial, Sphere, Vector3 } from "three"
import type { Renderable, RenderingMode, RenderingSpec } from "./renderable"
import { RenderingSpecs } from "./renderable"
import { isDefined } from "src/lib/array"
import { loadTexture } from "./loadTexture"
import { dispose } from "src/core/three/useObjectLifecycle"
import { objectKeys } from "src/lib/record"

export function mergeRenderables(geometry: BufferGeometry, renderables: Renderable[]) {
  const description = RenderingSpecs[renderables[0].spec]
  let nofVertices = 0
  for (let r of renderables) {
    nofVertices += r.geometry.attributes.position.array.length / 3
  }

  for (let bufferSpec of description.buffers) {
    if (!geometry.attributes[bufferSpec.name] || nofVertices > geometry.attributes[bufferSpec.name].count) {
      geometry.setAttribute(
        bufferSpec.name,
        new BufferAttribute(new bufferSpec.type(nofVertices * bufferSpec.size), bufferSpec.size, bufferSpec.normalized),
      )
    } else {
      geometry.attributes[bufferSpec.name].needsUpdate = true
    }
    let ptr = 0
    for (let { geometry: renderableGeometry } of renderables) {
      if (!renderableGeometry.attributes[bufferSpec.name]) {
        throw Error(`Failed to merge geometries, buffer missing from geometry: ${bufferSpec.name}`)
      }
      const array = renderableGeometry.attributes[bufferSpec.name].array
      ;(geometry.attributes[bufferSpec.name] as BufferAttribute) /* no support for interleaved */
        .set(array, ptr)
      ptr += array.length
    }
  }

  geometry.setDrawRange(0, nofVertices)
  geometry.boundingSphere = new Sphere(new Vector3(), Number.MAX_SAFE_INTEGER) // assume you will never cull a merged renderable

  //Workaround for GL-bug on amd + macos: https://monorail-prod.appspot.com/p/chromium/issues/detail?id=1245448

  let index: number[] = []
  for (let i = 0; i < nofVertices; i++) {
    index.push(i)
  }
  geometry.setIndex(index)
  geometry.name = `RenderGroup - ${renderables[0].spec}`
}

export function createMesh(key: RenderingSpec, name: string, mode: RenderingMode) {
  const spec = RenderingSpecs[key]
  const geometry = new BufferGeometry()
  for (let bufferSpec of spec.buffers) {
    geometry.setAttribute(bufferSpec.name, new BufferAttribute(new bufferSpec.type(), bufferSpec.size))
  }
  const result =
    spec.drawMode === "LineSegments"
      ? new LineSegments(geometry, spec.material[mode])
      : new Mesh(geometry, spec.material[mode])
  geometry.name = `${name}/${key} - geometry`
  result.name = `${name}/${key}`
  result.castShadow = Boolean(spec.castShadow)
  result.receiveShadow = Boolean(spec.receiveShadow)
  result.renderOrder = spec.renderOrder ?? 0
  return result
}

const createOneMeshPerImageElement = (
  imageElements: Renderable[],
  key: RenderingSpec,
  mode: RenderingMode,
  groupName: string,
) => {
  return imageElements.map((element) => {
    const name = `${groupName} - ${key} - ${element.id}`
    let mesh = createMesh(key, name, mode)

    if (element.imgUrl) {
      mesh.material = mesh.material.clone()
      if (mesh.material instanceof MeshBasicMaterial) {
        const texture = loadTexture(element.imgUrl)
        mesh.material.map = texture
      }
    }
    mesh.geometry.name = name
    mergeRenderables(mesh.geometry, [element])

    return mesh
  })
}

export default class RenderGroup extends Group {
  constructor(name: string, renderables?: Renderable[]) {
    super()
    this.name = name
    if (renderables) this.update(renderables)
  }

  dispose() {
    this.children.forEach((child) => this.remove(child))
    this.parent?.remove(this)
  }
  update(renderables: Renderable[]) {
    // Group by material
    const byMaterial: { [K in RenderingSpec]?: { [M in RenderingMode]: Renderable[] } } = {}
    for (const r of renderables) {
      let bucket = byMaterial[r.spec]
      if (!bucket)
        bucket = byMaterial[r.spec] = {
          normal: [],
          faint: [],
          placeMode: [],
          placeModeSelected: [],
        }
      bucket[r.mode ?? "normal"].push(r)
    }

    // Remove unused childmeshes
    this.children
      .filter((m) => !byMaterial[m.name as RenderingSpec])
      .forEach((m) => {
        dispose(m)
        this.remove(m)
      })

    // Update sub-meshes, create any new ones needed
    const keys = objectKeys(byMaterial)

    const keysExpanded: { key: RenderingSpec; mode: RenderingMode }[] = keys
      .flatMap((k): ({ key: RenderingSpec; mode: RenderingMode } | undefined)[] => [
        (byMaterial[k]?.normal?.length ?? 0 > 0) ? { key: k, mode: "normal" } : undefined,
        (byMaterial[k]?.faint?.length ?? 0 > 0) ? { key: k, mode: "faint" } : undefined,
        (byMaterial[k]?.placeModeSelected?.length ?? 0 > 0) ? { key: k, mode: "placeModeSelected" } : undefined,
        (byMaterial[k]?.placeMode?.length ?? 0 > 0) ? { key: k, mode: "placeMode" } : undefined,
      ])
      .filter(isDefined)

    const addMesh = (mesh: Mesh | LineSegments) => {
      this.add(mesh)
    }

    keysExpanded.forEach(({ key, mode }) => {
      if (key === "imageSpec") {
        const imageElements = byMaterial[key]![mode]
        createOneMeshPerImageElement(imageElements, key, mode, this.name).forEach(addMesh)
      } else {
        const name = `${this.name} - ${key} - ${mode}`
        let mesh = this.children.find((m) => m.name === key) as Mesh | LineSegments

        if (!mesh) {
          mesh = createMesh(key, name, mode)
          addMesh(mesh)
        }
        mesh.geometry.name = name
        mergeRenderables(mesh.geometry, byMaterial[key]![mode])
      }
    })
  }
}
