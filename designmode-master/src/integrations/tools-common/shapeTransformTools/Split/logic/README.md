# Split Polygon Algorithm

![Polygon Split Algorithm](src/tools/shapeTransformTools/Split/logic/split_algorithm.png)

The algorithm is based on the following realizations:

- All line segments of the original polygon will appear in the final set of polygon exactly once
- All line segments of the splitting line that are inside the original polygon will appear in the final set twice:
  once in each direction
- When split into chunks of line segments that span between intersection points,
  each resulting polygon can be composed by connecting alternating pieces of chunks from the "slicee (original polygon) chunks" and
  the "slicer (split line) chunks"
  - Special case: line segments of the splitting line can be chunked across intersection points if the resulting closed chunk is wound counterclockwise

## Pseudocode

```
  split both the original polygon (slicee) and the splitting line (slicer) into their line segments

  for each slicer segment:
      for each slicee segment:
          if the segments intersect
              put the intersection coords in a list of intersections
                  split the slicee segment into two slices at the point of intersection
                  remove the original segment from the list of slicee segments and put the slices back in

      split the slicer segment at all the intersections, put the slices that are inside the polygon in "visited" list

    for each slicee segment:
        create chunks by connecting the segments at the vertices that are not intersection vertices
        put the chunks in the "slicee" output list

    for each slicer segment in the "done" list:
        create chunks by connecting the segments at the vertices that are not intersection vertices
        put the chunks in the "slicer" output list
        put the reverse of the chunk in the "slicer" output list
        chunk any chunks in the "slicer" output list that would create a counter clockwise wound polygon when connected

    create a list of output polygons
    create a "working" list of chunks
    while there are unvisited slicee chunks:
       mark a random slicee chunk as visited, and add it to the working list
       while the working list does not start and end at the same point:
            if the previous added chunk was a slicee chunk:
                find the slicer chunk that starts where the current working list ends and add it to the working list
            else
                find the slicee chunk that starts where the current working list ends and add it to the working list
       add the working list to the list of polygons and clear the working set

```
