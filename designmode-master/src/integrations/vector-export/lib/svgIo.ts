import type { Line3 } from "three"
import type { Raster, RasterLayers } from "./raster-rendering"
import type { RelevantLinesByBase } from "src/integrations/vector-export/types"

function writeSvgImage(raster: Raster) {
  return `
  <image x="0" y="0"
  width="${window.innerWidth}" height="${window.innerHeight}"
  xlink:href="${raster.dataUrl}" opacity="${raster.opacity}" id="${raster.name}">
  </image>`
}

function writeSvgGroups(groups: { content: string[]; name: string; hidden?: boolean }[]): string[] {
  // Create a group for each category and add all lines to it
  return groups
    .filter((group) => group.content.length > 0)
    .map((group) => {
      return `<g id="${group.name}" display="${group.hidden ? "none" : "inherit"}">
              ${group.content.join("")}
            </g>`
    })
}

function drawLineString(ndcLine: Line3, color = "black", dashed = false, width = 1, opacity = 1) {
  const start = ndcLine.start
  const end = ndcLine.end
  const x1 = ((start.x + 1) / 2) * window.innerWidth
  const y1 = window.innerHeight - ((start.y + 1) / 2) * window.innerHeight
  const x2 = ((end.x + 1) / 2) * window.innerWidth
  const y2 = window.innerHeight - ((end.y + 1) / 2) * window.innerHeight
  const dasharray = dashed ? "2,2" : "0"

  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${width}" stroke-dasharray="${dasharray}" opacity="${opacity}" />`
}

function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  let results: T[][] = []
  for (let i = 0; i < array.length; i += chunkSize) {
    results.push(array.slice(i, i + chunkSize))
  }
  return results
}

function getColorForLayer(layerName: string) {
  if (layerName === "terrain") return "#000000"
  if (layerName === "building") return "#848488"
  if (layerName === "vegetation") return "#419D2F"
  if (layerName === "zone") return "#3D6AC2"
  if (layerName === "site_limit") return "#D47686"
  if (layerName === "constraints") return "#8D477F"
  return "#848488"
}

function isVisibilityTypeHidden(visibilityType: string) {
  return visibilityType === "hidden" || visibilityType === "visibleBelowTerrain"
}

function isVisibilityTypeDashed(visibilityType: string) {
  return visibilityType === "visibleBelowTerrain"
}

function getLineWidthForLineType(lineType: string) {
  return lineType === "sectionCutLines" ? 3 : 1
}

function getOpacityForVisibilityType(visibilityType: string) {
  return visibilityType === "hidden" ? 0.4 : 1
}

export function convertRelevantLinesToSvg(relevantLinesByCategory: RelevantLinesByBase) {
  return writeSvgGroups(
    Object.entries(relevantLinesByCategory).map(([base, relevantLinesByCategory]) => {
      return {
        name: base,
        content: writeSvgGroups(
          Object.entries(relevantLinesByCategory).map(([layerName, visibilityGroups]) => ({
            name: layerName,
            content: writeSvgGroups(
              Object.entries(visibilityGroups).map(([visibilityType, lineTypes]) => ({
                name: visibilityType,
                hidden: isVisibilityTypeHidden(visibilityType),
                content: writeSvgGroups(
                  Object.entries(lineTypes).map(([lineType, lines]) => ({
                    name: lineType,
                    content: lines.map((line) =>
                      drawLineString(
                        line,
                        getColorForLayer(layerName),
                        isVisibilityTypeDashed(visibilityType),
                        getLineWidthForLineType(lineType),
                        getOpacityForVisibilityType(visibilityType),
                      ),
                    ),
                  })),
                ),
              })),
            ),
          })),
        ),
      }
    }),
  )
}

export function writeSvg(svgComponents: string[], rasterLayers: RasterLayers) {
  const chunkSize = 10000

  // Process lines in chunks and concatenate results
  const chunks = chunkArray(svgComponents, chunkSize)
  let svgContent =
    '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="' +
    window.innerWidth +
    '" height="' +
    window.innerHeight +
    '">'

  rasterLayers?.back.forEach((raster) => {
    svgContent += writeSvgImage(raster)
  })

  chunks.forEach((chunk) => {
    svgContent += chunk.join("")
  })

  rasterLayers?.front.forEach((raster) => {
    svgContent += writeSvgImage(raster)
  })

  svgContent += "</svg>"
  return svgContent
}

export const saveSvg = (svgContent: string, fileName: string) => {
  const svgBlob = new Blob([svgContent], { type: "image/svg+xml;charset=utf-8" })
  const svgUrl = URL.createObjectURL(svgBlob)
  const downloadLink = document.createElement("a")
  downloadLink.href = svgUrl
  downloadLink.download = fileName.endsWith(".svg") ? fileName : fileName + ".svg"
  document.body.appendChild(downloadLink)
  downloadLink.click()
  document.body.removeChild(downloadLink)
}

export const getFileName = (projectName?: string, proposalName?: string, maxTitleLength = 20) => {
  const formatTitle = (title?: string) => {
    if (!title) return ""
    return title.length > maxTitleLength ? title.slice(0, maxTitleLength - 3) + "..." : title
  }

  // replace spaces with underscores
  const truncatedProjectName = formatTitle(projectName)
  const truncatedProposalName = formatTitle(proposalName)
  const date = new Date().toISOString().split("T")[0]
  // use military time HH-MM-SS
  const time = new Date().toISOString().split("T")[1].split(".")[0].replace(/:/g, "-")
  return `${truncatedProjectName}_${truncatedProposalName}_${date}_${time}`
}
