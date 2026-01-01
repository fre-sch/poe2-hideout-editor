import { html } from 'htm/preact'
import { viewportMode } from "hideoutEditor/gui/state.module.js"

const setMode = (mode) => {
  viewportMode.value = mode
}

export default () => {
  return html`
    <details class="sidebar-item" open>
      <summary>Edit mode</summary>
      <div class="btn-group">
        <button class="btn btn-primary ${viewportMode.value == "select" ? "active" : ""}"
          id="select"
          title="Select"
          onClick=${() => setMode("select")}>
          <i class="bi bi-cursor-fill"></i></button>
        <button class="btn btn-primary ${viewportMode.value == "translate" ? "active" : ""}"
          id="translate"
          title="Move"
          onClick=${() => setMode("translate")}>
          <i class="bi bi-arrows-move"></i></button>
        <button class="btn btn-primary ${viewportMode.value == "rotate" ? "active" : ""}"
          id="rotate"
          title="Rotate"
          onClick=${() => setMode("rotate")}>
          <i class="bi bi-arrow-repeat"></i></button>
      </div>
    </details>
  `
}
