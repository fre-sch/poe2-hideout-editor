import * as constants from "hideoutEditor/constants.module.js"
import { SelectionBox } from 'hideoutEditor/selectionBox.module.js'
import { SelectionHelper } from 'hideoutEditor/selectionHelper.module.js'
import * as THREE from "three"


export class Selection extends EventTarget {
  constructor(viewport, cssClassName, layers) {
    super()
    this.viewport = viewport
    this.isEnabled = true
    this.button = 0
    this.box = new SelectionBox(viewport.camera, viewport.scene, layers)
    this.helper = new SelectionHelper(viewport.renderer, cssClassName, this.button)

    this.bbox = new THREE.Box3()
    this.bbox.makeEmpty()
    this.bboxHelper = new THREE.Box3Helper(this.bbox, constants.GIZMO_COLOR)
    this.bboxHelper.layers.set(constants.LAYER_HIDDEN)
    viewport.scene.add(this.bboxHelper)

    this.helper.addEventListener("selectStart", this.onSelectStart)
    this.helper.addEventListener("selectMove", this.onSelectMove)
    this.helper.addEventListener("selectOver", this.onSelectOver)
  }

  getSelected () {
    return this.box.collection
  }

  setEnabled (value) {
    this.isEnabled = value
    this.helper.enabled = value

    if (value) {
      this.bbox.makeEmpty()
      for (let i = 0; i < this.box.collection.length; i++) {
        this.bbox.expandByObject(this.box.collection[i])
      }
      this.showBBox(this.box.collection.length)
    }
    else {
      this.showBBox(0)
    }
  }

  showBBox (selectedCount) {
    // this.bboxHelper.layers.set(
    //   (selectedCount > 0)
    //     ? constants.LAYER_GIZMOS
    //     : constants.LAYER_HIDDEN
    // )
  }

  setBoxPoint (point, rect) {
    const { offsetX: x, offsetY: y } = rect
    const innerWidth = this.viewport.viewportRect.width
    const innerHeight = this.viewport.viewportRect.height
    point.set(
      (x  / innerWidth) * 2 - 1,
      -(y / innerHeight) * 2 + 1,
      0.5
    )
  }

  onSelectStart = (event) => {
    for (const item of this.box.collection) {
      item.setSelected(false)
    }
    this.setBoxPoint(this.box.startPoint, event.detail)
    this.dispatchEvent(new CustomEvent("changed"))
  }

  onSelectMove = (event) => {
    if (!this.helper.isDown) return
    for (let i = 0; i < this.box.collection.length; i++) {
      this.box.collection[i].setSelected(false)
    }
    this.setBoxPoint(this.box.endPoint, event.detail)
    this.bbox.makeEmpty()
    const allSelected = this.box.select()
    for (let i = 0; i < allSelected.length; i++) {
      allSelected[i].setSelected(true)
      this.bbox.expandByObject(allSelected[i])
    }
    this.showBBox(allSelected.length)
    this.dispatchEvent(new CustomEvent("changed"))
  }

  onSelectOver = (event) => {
    this.setBoxPoint(this.box.endPoint, event.detail)
    this.bbox.makeEmpty()
    const allSelected = this.box.select()
    for (let i = 0; i < allSelected.length; i++) {
      allSelected[i].setSelected(true)
      this.bbox.expandByObject(allSelected[i])
    }
    this.showBBox(allSelected.length)
    this.dispatchEvent(new CustomEvent("changed"))
  }
}
