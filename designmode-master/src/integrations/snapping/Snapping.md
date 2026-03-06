# Functional description

## Edge snapping

- Normal edges
  - All visible edges are snapped to
- "Relevant edges"
  - Users can define up to 10 relevant edges by hovering on them
    - Adding more edges after the 10th, removes the oldest edge in a first-in-first-out fashion
  - For relevant edges, we snap to:
    - extension of edge in both directions
    - 90 degree angle on endpoints of edges
    - lines orthogonal with edge
    - lines parallel with edge
    - Same length as line (TODO)
- Line lock
  - By holding shift, users can lock the position to be on the locked line
  - When locking, we snap to intersections between the locked line and any other line in the XY-plane

## Point Snapping

- Endpoints and midpoints of visible edges are always snappable
- Intersections of lines (derived or real) are considered snapping points
  - For lines that only intersect in the XY-plane (when seen top down), we only snap if one of the lines have been locked using "line lock"
