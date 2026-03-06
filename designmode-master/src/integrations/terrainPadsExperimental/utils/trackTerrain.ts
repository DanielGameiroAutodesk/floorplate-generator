import type { FlatPolygonV1 } from "src/core/terrain/terrain-types"

import { EventName, FeatureCategory } from "@spacemakerai/webapp-analytics"
import { Analytics } from "src/core/analytics"

type TerrainUpdateDetails = Partial<
  Record<"coordinates" | "elevation" | "buffer" | "applyGrade", { from: any; to: any }>
>

export type TerrainChange =
  | { type: "added"; id: string }
  | { type: "removed"; id: string }
  | { type: "updated"; id: string; changes: TerrainUpdateDetails }

function diffTerrainOperations(
  newOps: FlatPolygonV1[],
  currentOps: FlatPolygonV1[],
): {
  added: FlatPolygonV1[]
  removed: FlatPolygonV1[]
  updated: { newOp: FlatPolygonV1; oldOp: FlatPolygonV1 }[]
} {
  const newOpMap = new Map(newOps.map((op) => [op.id, op]))
  const currentOpMap = new Map(currentOps.map((op) => [op.id, op]))

  const added = newOps.filter((op) => !currentOpMap.has(op.id))
  const removed = currentOps.filter((op) => !newOpMap.has(op.id))
  const updated: { newOp: FlatPolygonV1; oldOp: FlatPolygonV1 }[] = []

  for (const op of newOps) {
    const old = currentOpMap.get(op.id)
    if (old) {
      updated.push({ newOp: op, oldOp: old })
    }
  }

  return { added, removed, updated }
}

function getTerrainChanges(newOp: FlatPolygonV1, oldOp: FlatPolygonV1): TerrainUpdateDetails {
  const changes: TerrainUpdateDetails = {}

  if (newOp.elevation !== oldOp.elevation) {
    changes.elevation = { from: oldOp.elevation, to: newOp.elevation }
  }

  if (newOp.buffer !== oldOp.buffer) {
    changes.buffer = { from: oldOp.buffer, to: newOp.buffer }
  }

  if (newOp.applyGrade !== oldOp.applyGrade) {
    changes.applyGrade = { from: oldOp.applyGrade, to: newOp.applyGrade }
  }

  const coordsChanged =
    newOp.coordinates.length !== oldOp.coordinates.length ||
    newOp.coordinates.some((c, i) => {
      const prev = oldOp.coordinates[i]
      return !prev || c.x !== prev.x || c.y !== prev.y
    })

  if (coordsChanged) {
    changes.coordinates = { from: oldOp.coordinates, to: newOp.coordinates }
  }

  return changes
}

export const trackTerrain = (currentTerrainOperations: FlatPolygonV1[], newTerrainOperations: FlatPolygonV1[]) => {
  const { added, removed, updated } = diffTerrainOperations(newTerrainOperations, currentTerrainOperations)

  const baseProps = {
    feature_category: FeatureCategory.DesignTool,
    feature: "terrain",
    sub_feature: "terrain_pad",
  }

  for (const op of added) {
    Analytics.track(EventName.Add, baseProps, { terrain_pad_id: op.id })
  }

  for (const op of removed) {
    Analytics.track(EventName.Delete, baseProps, { terrain_pad_id: op.id })
  }

  for (const { newOp, oldOp } of updated) {
    const terrainChanges = getTerrainChanges(newOp, oldOp)
    if (Object.keys(terrainChanges).length === 0) continue

    Analytics.track(EventName.Edit, baseProps, {
      terrain_pad_id: newOp.id,
      ...(terrainChanges.elevation && { elevation_changed: true }),
      ...(terrainChanges.buffer && { buffer_changed: true }),
      ...(terrainChanges.coordinates && { coordinates_changed: true }),
      ...(terrainChanges.applyGrade && { apply_grade_changed: true }),
    })
  }
}
