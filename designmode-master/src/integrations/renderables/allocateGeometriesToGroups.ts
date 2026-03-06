/**
 * Geometries will get assigned to batches/groups of sizes that are whole multiples of this
 * constant. For reference, a group size of 10,000 vertices is equivalent to 29 kB of data for a
 * typical mesh (each vertex requiring 12 bytes (3 floats) for position, 12 bytes (3 floats) for
 * normal, 3 bytes for color and 2 bytes for index)
 */
const GROUP_UNIT_SIZE = 10_000

/**
 * Algorithm used to assign unique geometries to BatchedMeshes within RenderGroupV3.
 * @param allGeometries Identifiers of the geometries that should be grouped
 * @param getGeometrySize Callback to get the size of a geometry (in the same units as GROUP_UNIT_SIZE above)
 * @param oldGroups The old groups that were returned by the grouping algorithm in the previous iteration
 * @returns A list of lists, where each inner list is a group of geometry identifiers
 */
export function assignGeometriesToGroups<G>(
  allGeometries: G[],
  getGeometrySize: (geometry: G) => number,
  oldGroups: G[][],
): G[][] {
  /** All groups that have been finalized so far */
  const newGroups: G[][] = []
  /** Keep track of the total size of all remaining (ungrouped) geometries */
  let remainingSize = allGeometries.map(getGeometrySize).reduce((a, b) => a + b, 0)

  /** Current group in progress */
  let newGroup: G[] = []
  /** Current size of the group in progress */
  let newGroupSize = 0

  /**
   * The size threshold for each group changes throughout the grouping process (as we want large
   * groups for infrequently-changing geometries, but smaller groups for recently-changed ones)
   */
  let newGroupThreshold = getNextGroupSizeThreshold(remainingSize)

  /** Helper to finalize the group currently in progress (if any) */
  function finalizeGroup() {
    if (newGroup.length == 0) return
    newGroups.push(newGroup)
    remainingSize -= newGroupSize

    newGroup = []
    newGroupSize = 0

    // Recalculate the size threshold for the next group
    newGroupThreshold = getNextGroupSizeThreshold(remainingSize)
  }

  /**
   * Helper to iteratively assign a list of geometries into groups. The geometries are sorted by
   * size so that larger geometries will get assigned first. This helps ensure that the groups end
   * up at roughly the desired size (instead of almost filling up with small geometries first and
   * then blowing the budget by exceeding the threshold with a large geometry at the end)
   */
  function assignGeometriesToGroups(geometries: G[]) {
    const geometriesSortedByCostDecr = geometries
      .filter((geometry) => allGeometriesSet.has(geometry))
      .sort((a, b) => getGeometrySize(b) - getGeometrySize(a))
    geometriesSortedByCostDecr.forEach((geometry) => {
      newGroup.push(geometry)
      newGroupSize += getGeometrySize(geometry)
      if (newGroupSize >= newGroupThreshold) {
        finalizeGroup()
      }
    })
  }

  // The first phase of assigning geometries to groups is to iterate over all the previous groups
  // and assign their geometries to new groups. Smaller group IDs are groups that container "older"
  // geometry. For example, if group 0 from the previous invokation is passed in unchanged again to
  // this invokation, it will simply get repopulated with all the same geometries and remain as
  // group 0. If any of the previous geometries have disappeared from the input list, the other
  // geometries will still end up in group 0 -- possibly together with other, "newer" geometries
  // that now fit in group 0. Over time, unchanged geometries will move toward lower group IDs
  const allGeometriesSet = new Set(allGeometries)
  oldGroups.map(assignGeometriesToGroups)

  // The next phase of group assignment is to iterate over all the _new_ geometries that don't have
  // a previous group ID. These will necessarily end up in groups with higher group IDs
  oldGroups.forEach((geometriesInGroup) => geometriesInGroup.forEach((geometry) => allGeometriesSet.delete(geometry)))
  assignGeometriesToGroups([...allGeometriesSet.values()])

  finalizeGroup()
  return newGroups
}

/** Calculate the appropriate size for the next group */
function getNextGroupSizeThreshold(totalSize: number): number {
  // Calculate the full sequence of group sizes and return the size of group 0
  return calculateGroupSizes(totalSize)[0]
}

/**
 * Calculate the full sequence of group sizes appropriate for the given total sum of geometry sizes.
 * The concept behind the algorithm is to first split the geometries into chunks/units of the same
 * size (see GROUP_UNIT_SIZE above), and then iteratively merging equal-sized pairs together (into a
 * new group of size 2x) so that group sizes are always power-of-2 multiples of GROUP_UNIT_SIZE.
 *
 * We merge from the start of the group array, so that groups with lower IDs (which are the "older"
 * geometries, see explanation above) end up with the largest sizes, while higher-ID groups (more
 * recently-changed geometries) will have smaller group sizes.
 *
 * We only merge a certain size if there are at least THREE groups of that size, so that we always
 * leave behind ONE group at the smaller size level. This is to avoid large discontinuities in the
 * group composition when crossing power-of-2 thresholds. To illustrate, the sequence of group sizes
 * will look like the following (notice how we keep the number of splits/merges low in each step):
 *
 * Total size  1: 1
 * Total size  2: 1 1
 * Total size  3: 2 1
 * Total size  4: 2 1 1
 * Total size  5: 2 2 1
 * Total size  6: 2 2 1 1
 * Total size  7: 4 2 1
 * Total size  8: 4 2 1 1
 * Total size  9: 4 2 2 1
 * Total size 10: 4 2 2 1 1
 * Total size 11: 4 4 2 1
 */
function calculateGroupSizes(totalSize: number): number[] {
  // Convert size numbers into "units" (multiples of GROUP_UNIT_SIZE)
  const unitCount = Math.floor(totalSize / GROUP_UNIT_SIZE)
  if (unitCount < 1) return [GROUP_UNIT_SIZE]

  // Keep track of how many groups we currently have of each size, starting with N groups of size 1
  const groupSizeCounts = new Map([[1, unitCount]])

  // Iteratively merge groups pairwise for as long as there are groups sizes of which we have more
  // than 2 groups, following the merging logic outlined above
  let madeAnyMergers
  let unitSize = 1
  do {
    // Check whether we still want to merge any groups
    madeAnyMergers = false
    const entriesOfThisUnitSize = groupSizeCounts.get(unitSize) ?? 0
    const shouldMergeUnitsOfThisSize = entriesOfThisUnitSize > 2
    if (!shouldMergeUnitsOfThisSize) continue

    // Calculate how many to merge and what the new counts will be
    const newUnitSize = unitSize * 2
    const numberOfNewUnits = Math.floor((entriesOfThisUnitSize - 1) / 2)
    const unitsToReplace = 2 * numberOfNewUnits
    groupSizeCounts.set(unitSize, entriesOfThisUnitSize - unitsToReplace)
    groupSizeCounts.set(newUnitSize, numberOfNewUnits)

    // Keep iterating
    madeAnyMergers = true
    unitSize = newUnitSize
  } while (madeAnyMergers)

  // Convert the counts-of-groups-of-a-given-size map into an actual list of group sizes
  return [...groupSizeCounts.entries()]
    .sort((a, b) => b[0] - a[0])
    .flatMap(([unitSize, unitCount]) => [...Array(unitCount)].map(() => unitSize * GROUP_UNIT_SIZE))
}
