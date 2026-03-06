export function addDefaultPropsToGraph(graph) {
  const _graph = JSON.parse(JSON.stringify(graph))
  Object.values(_graph.edges).forEach((e) => {
    e.floorStackProps = [{ floorProps: [] }]
  })
  Object.values(_graph.vertices).forEach((v) => {
    v.floorStackProps = [{ floorProps: [] }]
  })
  return _graph
}
