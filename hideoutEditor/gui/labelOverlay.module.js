import { render } from 'preact'
import { html } from 'htm/preact'

import { labels, showLabels } from "hideoutEditor/gui/state.module.js"

const Label = (object) => {
  const { x, y, label, key } = object
  const style = {
    top: Math.round(y),
    left: Math.round(x),
  }
  return html`<div key=${key} class="label" style=${style}>${label}</div>`
}

const Labels = () => {
  return showLabels.value ? labels.value.map(Label) : null
}

export default (root) => {
  render(
    html`<${Labels}/>`,
    root
  )
}
