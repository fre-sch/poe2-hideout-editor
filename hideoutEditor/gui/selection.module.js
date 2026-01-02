import { html } from 'htm/preact'
import { selection } from "hideoutEditor/gui/state.module.js"

const selectionItem = (sceneObj) => {
  return html`
    <li>${sceneObj.name}</li>
  `
}

const selectionList = () => {
  return html`<ul>${selection.value.map(selectionItem)}</ul>`
}

export default () => {
  return html`
  <details class="sidebar-item" style="max-height: 10rem; overflow: auto" open>
    <summary>Selection</summary>
    <${selectionList}/>
  </details>
  `
}
