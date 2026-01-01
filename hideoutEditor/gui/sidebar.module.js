import { render } from 'preact'
import { html } from 'htm/preact'

import File from "hideoutEditor/gui/file.module.js"
import ViewportMode from "hideoutEditor/gui/viewportMode.module.js"
import HideoutData from "hideoutEditor/gui/hideoutData.module.js"

export default (root) => {
  render(
    html`
      <h1>PoE2 Hideout Editor</h1>
      <hr/>
      <${File}/>
      <${ViewportMode}/>
      <${HideoutData}/>
      <details class="sidebar-item" open>
        <summary>Help</summary>
        <ul class="ms-0 ps-3">
        <li>Click and drag <span class="shortcut">left mouse button</span> to select.</li>
        <li><span class="shortcut">Middle mouse button</span> to move view.</li>
        <li><span class="shortcut">Right mouse button</span> to rotate view.</li>
        <li><span class="shortcut">Mouse wheel</span> to zoom view.</li>
        <li><span class="shortcut">Del</span> key deletes selected objects.</li>
        <li>Press key <span class="shortcut">1</span> select, <span class="shortcut">2</span> to move selected, <span class="shortcut">3</span> to rotate selected.</li>
        <li>Press key <span class="shortcut">f</span> to focus on selected.</li>
        </ul>
      </details>
    `,
    root
  )
}
