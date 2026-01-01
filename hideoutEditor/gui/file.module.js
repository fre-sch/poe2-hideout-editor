import { html } from 'htm/preact'
import { hideoutFile } from "hideoutEditor/gui/state.module.js"
import { parseHideout } from "hideoutEditor/file.module.js"

const loadFile = async (event) => {
  event.preventDefault()
  const [file] = event.target.files
  if (file) {
    hideoutFile.value = {
      name: file.name,
      data: parseHideout(await file.text()),
    }
  }
  event.target.blur()
}

const loadFileButtonClicked = (event) => {
  const input = document.createElement("input")
  input.setAttribute("type", "file")
  input.addEventListener("change", (event) => {
    loadFile(event)
    input.removeEventListener("change", loadFile)
  })
  input.click()
}

const saveFile = (event) => {
  event.preventDefault()
  window.dispatchEvent(new CustomEvent("saveHideoutFile"))
}

const saveButton = () => {
  const disabled = (hideoutFile.value === null) ? "disabled" : ""
  return html`<button
    type="button"
    class="btn btn-primary btn-sm ${disabled}"
    onClick=${saveFile}>
      Save hideout
    </button>`
}

export default () => {
  return html`
    <details class="sidebar-item" open>
      <summary>File</summary>
      <button
        id="loadFile"
        type="button"
        class="btn btn-primary btn-sm me-2"
        onClick=${loadFileButtonClicked}
      >Load</button>
      <${saveButton}/>
    </details>
  `
}
