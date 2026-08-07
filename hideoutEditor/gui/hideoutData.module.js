import { html } from 'htm/preact'
import { hideoutFile, hideoutType } from "hideoutEditor/gui/state.module.js"
import { boundsDefinitions } from "hideoutEditor/bounds.module.js"
import { stringSortCmp } from "hideoutEditor/util.module.js"


const option = (entry) => {
  return html`<option value=${entry.hash} selected=${entry.hash === ""+hideoutType.value}>${entry.name}</option>`
}

const onHideoutTypeSelect = (event) => {
  event.preventDefault()
  event.target.blur()
  hideoutType.value = event.currentTarget.value
}

const hideoutTypeSelect = () => {
  const items = [...boundsDefinitions]
  items.sort((a, b) => stringSortCmp(a.name, b.name))
  return html`
    <select class="form-select form-select-sm" onChange=${onHideoutTypeSelect}>
      ${items.map(option)}
    </select>
  `
}

export default () => {
  if (hideoutFile.value === null) {
    return
  }
  const hideout = hideoutFile.value.data
  return html`
    <details class="sidebar-item" open>
      <summary>Hideout Info</summary>
      <div class="grid-2">
        <div class="text-secondary">File name:</div><div style="line-break:anywhere">${hideoutFile.value.name}</div>
        <div class="text-secondary">Version:</div><div>${hideout.version}</div>
        <div class="text-secondary">Language:</div><div>${hideout.language}</div>
        <div class="text-secondary">Type:</div><div><${hideoutTypeSelect}/></div>
        <div class="text-secondary">Doodads:</div><div>${hideout.doodads.length}</div>
      </div>
    </details>
  `
}
