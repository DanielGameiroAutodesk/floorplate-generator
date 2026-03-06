const container = document.createElement("div")
container.id = "framewarner"
container.setAttribute(
  "style",
  `
    border-radius: 5px;
    background: black;
    position: absolute;
    z-index: 1000000;
    text-align: right;
    top: 0;
    right: 0;
    display: flex;
    flex-direction: column-reverse;
    /* Make sure we don't capture clicks */
    pointer-events: none;
`,
)
document.body.appendChild(container)

let ignoreNextFrame = false
document.addEventListener("visibilitychange", () => {
  // Make sure we don't report when the tab/window is hidden
  ignoreNextFrame = document.visibilityState === "hidden"
})

let prev = Date.now()
function monitor(t) {
  const frametime = t - prev
  if (!ignoreNextFrame && frametime > 100) {
    const warning = document.createElement("div")
    warning.textContent = Math.round(frametime) + "ms"
    warning.setAttribute("style", `padding: 5px 10px; color: ${frametime < 500 ? "orange" : "red"};`)
    container.appendChild(warning)
    setTimeout(() => container.removeChild(warning), 5000)
  }
  ignoreNextFrame = false
  prev = t
  requestAnimationFrame(monitor)
}
requestAnimationFrame(monitor)
