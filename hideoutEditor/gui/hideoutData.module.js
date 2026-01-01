import { html } from 'htm/preact'
import { hideoutFile } from "hideoutEditor/gui/state.module.js"

export default () => {
  if (hideoutFile.value === null) {
    return
  }
  const hideout = hideoutFile.value.data
  return html`
    <details class="sidebar-item" open>
      <summary>Hideout Info</summary>
      <div class="grid-2">
        <div class="text-secondary">File name:</div><div>${hideoutFile.value.name}</div>
        <div class="text-secondary">Version:</div><div>${hideout.version}</div>
        <div class="text-secondary">Language:</div><div>${hideout.language}</div>
        <div class="text-secondary">Type:</div><div>${hideout.hideout_name}</div>
        <div class="text-secondary">Doodads:</div><div>${hideout.doodads.length}</div>
      </div>
    </details>
  `
}
