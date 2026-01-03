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
    this.primary = new SelectionBox(viewport.camera, viewport.scene, layers)
    this.secondary = new SelectionBox(viewport.camera, viewport.scene, layers)
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
    return this.primary.collection
  }

  setEnabled (value) {
    this.isEnabled = value
    this.helper.enabled = value

    if (value) {
      this.bbox.makeEmpty()
      for (let i = 0; i < this.primary.collection.length; i++) {
        this.bbox.expandByObject(this.primary.collection[i])
      }
      this.showBBox(this.primary.collection.length)
    }
    else {
      this.showBBox(0)
    }
  }

  updateBBox () {
    this.bbox.makeEmpty()
    for (const item of this.primary.collection) {
      this.bbox.expandByObject(item)
    }
    this.showBBox(this.primary.collection.length)
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

  modifyPrimaryCollection (add, objects) {
    for (const item of objects) {
      const index = this.primary.collection.indexOf(item)
      if (add === true && index < 0) {
        item.setSelected(true)
        this.primary.collection.push(item)
      }
      else if (add === false && index >= 0) {
        item.setSelected(false)
        this.primary.collection.splice(index, 1)
      }
    }
  }

  onSelectStart = (event) => {
    const sourceEvent = event.detail
    if (sourceEvent.ctrlKey || sourceEvent.shiftKey) {
      this.setBoxPoint(this.secondary.startPoint, sourceEvent)
    }
    else {
      for (const item of this.primary.collection) {
        item.setSelected(false)
      }
      this.setBoxPoint(this.primary.startPoint, sourceEvent)
    }
    this.dispatchEvent(new CustomEvent("changed"))
  }

  onSelectMove = (event) => {
    const sourceEvent = event.detail
    if (!this.helper.isDown) return
    if (sourceEvent.ctrlKey || sourceEvent.shiftKey) {
      this.setBoxPoint(this.secondary.endPoint, sourceEvent)
    }
    else {
      for (const item of this.primary.collection) {
        item.setSelected(false)
      }
      this.setBoxPoint(this.primary.endPoint, sourceEvent)
      const allSelected = this.primary.select()
      for (const item of allSelected) {
        item.setSelected(true)
      }
    }
    this.updateBBox()
    this.dispatchEvent(new CustomEvent("changed"))
  }

  onSelectOver = (event) => {
    const sourceEvent = event.detail
    if (sourceEvent.ctrlKey) {
      this.setBoxPoint(this.secondary.endPoint, sourceEvent)
      this.modifyPrimaryCollection(false, this.secondary.select())
    }
    else if (sourceEvent.shiftKey) {
      this.setBoxPoint(this.secondary.endPoint, sourceEvent)
      this.modifyPrimaryCollection(true, this.secondary.select())
    }
    else {
      this.setBoxPoint(this.primary.endPoint, sourceEvent)
      const allSelected = this.primary.select()
      for (const item of allSelected) {
        item.setSelected(true)
      }
    }
    this.updateBBox()
    this.dispatchEvent(new CustomEvent("changed"))
  }
}
