declare module "line-of-closest-approach" {
  type Line = [[number, number, number], [number, number, number]]
  export default function lca(
    line1: Line,
    line2: Line,
    clamp: boolean,
  ): [[number, number, number], [number, number, number], number, number]
}
