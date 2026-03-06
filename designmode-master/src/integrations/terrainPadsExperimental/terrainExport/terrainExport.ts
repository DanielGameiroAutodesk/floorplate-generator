import { elementState } from "src/core/elements/ElementState"
import { Mesh } from "three"
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js"
import { OBJExporter } from "three/examples/jsm/exporters/OBJExporter.js"
import JSZip from "jszip"
import type { Licensing } from "forma-elements"
import { parseUrn } from "src/lib/element/urn"

async function createZipFile(blobs: { name: string; blob: Blob }[], zipFileName: string) {
  const zip = new JSZip()
  blobs.forEach(({ name, blob }) => {
    zip.file(name, blob)
  })
  const zipBlob = await zip.generateAsync({ type: "blob" })
  const url = URL.createObjectURL(zipBlob)
  const a = document.createElement("a")
  a.href = url
  a.download = zipFileName
  a.style.display = "none"
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function createLicenseText(licensing: Licensing, fileNameTerrain: string) {
  let result = ""
  const attributions = (licensing.attributions ?? [])
    .filter((it) => it.action === "transfer")
    .map((it) => ({
      attributionLabel: it.content,
      attributionUrl: it.url,
      licenseUrl: licensing.licenseUrl,
    }))

  result += `The exported file "${fileNameTerrain}" contains data requiring attribution.`

  for (const attribution of attributions) {
    result += `\n\n${attribution.attributionLabel}`
    if (attribution.attributionUrl) {
      result += `\n${attribution.attributionUrl}`
    }
    if (attribution.licenseUrl) {
      result += `\nLicense: ${attribution.licenseUrl}`
    }
  }
  result += "\n"
  return new Blob([result], { type: "text/plain" })
}

export async function exportTerrain(fileFormat: "GLB" | "OBJ") {
  const terrainElement = elementState.currentTerrainSignal.peek()
  if (!terrainElement) {
    throw new Error("No terrain element in proposal")
  }
  if (isTerrainExportable() === false) {
    throw new Error("Terrain is not exportable")
  }
  if (terrainElement.element?.metadata?.licensing === undefined) {
    throw new Error("Terrain is not exportable")
  }
  const licenseFileName = "NOTICE.txt"
  const terrainMesh = terrainElement.mesh
  const terrainFilePrefix = `terrain-${parseUrn(terrainElement.element.urn).revision}`
  const terrainZipFileName = "terrain.zip"
  const exportMesh = new Mesh(terrainMesh.geometry.clone())
  exportMesh.geometry.rotateX(-Math.PI / 2)
  if (fileFormat === "GLB") {
    const glb: ArrayBuffer = await new Promise((resolve, reject) => {
      new GLTFExporter().parse(exportMesh, (res: any) => resolve(res as ArrayBuffer), reject, { binary: true })
    })
    const terrainFileName = `${terrainFilePrefix}.glb`
    const licensingBlob = createLicenseText(terrainElement.element.metadata.licensing, terrainFileName)
    const licensingFile = { name: licenseFileName, blob: licensingBlob }
    const glbFile = { name: terrainFileName, blob: new Blob([glb], { type: "model/gltf-binary" }) }
    await createZipFile([glbFile, licensingFile], terrainZipFileName)
  }
  if (fileFormat === "OBJ") {
    const objExporter = new OBJExporter()
    const objString = objExporter.parse(exportMesh)
    const blob = new Blob([objString], { type: "text/plain" })
    const terrainFileName = `${terrainFilePrefix}.obj`
    const licensingBlob = createLicenseText(terrainElement.element.metadata.licensing, terrainFileName)
    const licensingFile = { name: licenseFileName, blob: licensingBlob }
    await createZipFile([{ blob, name: terrainFileName }, licensingFile], terrainZipFileName)
  }
}

export const isTerrainExportable = () => {
  return elementState.currentTerrainSignal.peek()?.element.metadata?.licensing?.exportable
}
