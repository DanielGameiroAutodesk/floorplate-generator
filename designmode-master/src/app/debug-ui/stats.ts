import Stats from "three/addons/libs/stats.module.js"

const stats = new Stats()

function constantLoop() {
  stats.begin()
  stats.end()
  window.requestAnimationFrame(constantLoop)
}

export function intializeStats() {
  stats.showPanel(0) // 0: fps, 1: ms, 2: mb, 3+: custom
  document.body.appendChild(stats.dom)
  constantLoop()
}
