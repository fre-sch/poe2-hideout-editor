import * as THREE from "three"
import * as constants from "hideoutEditor/constants.module.js"

export const axisHelper = (length) => {
  const origin = new THREE.Vector3(0, 0.001, 0)
  const headLength = length * 0.2
  const headWidth = length * 0.1
  let group = new THREE.Group()
  group.layers.set(constants.LAYER_GIZMOS)
  group.add(new THREE.ArrowHelper(
    new THREE.Vector3(1, 0, 0), origin, length, "red", headLength, headWidth
  ))
  group.add(new THREE.ArrowHelper(
    new THREE.Vector3(0, 1, 0), origin, length, "green", headLength, headWidth
  ))
  group.add(new THREE.ArrowHelper(
    new THREE.Vector3(0, 0, 1), origin, length, "blue", headLength, headWidth
  ))
  return group
}


export const makeLabelCanvas = (size, text) => {
  const borderSize = size / 8
  const font = `${size}px bold sans-serif`
  const ctx = document.createElement("canvas").getContext("2d")
  ctx.font = font
  // measure how long the name will be
  const doubleBorderSize = borderSize * 2
  const width = ctx.measureText(text).width + doubleBorderSize
  const height = size + doubleBorderSize
  ctx.canvas.width = width
  ctx.canvas.height = height
  // need to set font again after resizing canvas
  ctx.font = font
  ctx.textBaseline = 'top'
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, width, height)
  ctx.fillStyle = "#BB4"
  ctx.fillText(text, borderSize, borderSize)
  return ctx.canvas
}

export const reparent = (object, newParent) => {
  object.getWorldPosition(object.position)
  object.removeFromParent()
  newParent.add(object)
  newParent.worldToLocal(object.position)
}
