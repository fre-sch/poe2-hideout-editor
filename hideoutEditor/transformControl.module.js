import * as THREE from "three"
import { TransformControls } from "three/addons/controls/TransformControls.js"
import * as constants from "hideoutEditor/constants.module.js"
import * as util from "hideoutEditor/util.module.js"

export class TransformControl {
  constructor(viewport) {
    this.control = new TransformControls(viewport.camera, viewport.renderer.domElement)
    const transformControlGizmo = this.control.getHelper()
    transformControlGizmo.layers.set(constants.LAYER_GIZMOS)
    viewport.scene.add(transformControlGizmo)
    this.group = new THREE.Group()
    this.group.name = "TransformControl.Group"
    this.group.layers.set(constants.LAYER_HIDDEN)
    viewport.scene.add(this.group)
    // this.bboxHelper = new THREE.BoxHelper(this.group, 0x00FFFF)
    // this.bboxHelper.layers.set(constants.LAYER_GIZMOS)
    // viewport.scene.add(this.bboxHelper)

    this.control.addEventListener("objectChange", (event) => {
      // this.bboxHelper.update()
      viewport.render()
    })
    this.control.addEventListener("dragging-changed", (event) => {
      viewport.viewControl.enabled = !event.value
    })
  }

  setChildren (objects) {
    const bbox = new THREE.Box3()
    let objectWorldPos = new THREE.Vector3()
    for (let i = 0; i < objects.length; i++) {
      if (objects[i].parent.id == this.group.id) {
        continue
      }
      objects[i].originalParent = objects[i].parent
      objects[i].getWorldPosition(objectWorldPos)
      bbox.expandByPoint(objectWorldPos)
    }
    bbox.getCenter(this.group.position)
    this.group.layers.set(constants.LAYER_GIZMOS)
    // this.bboxHelper.layers.set(constants.LAYER_GIZMOS)
    for (let i = 0; i < objects.length; i++) {
      if (objects[i].parent.id == this.group.id) {
        continue
      }
      this.group.attach(objects[i])
      // this.group.worldToLocal(objects[i].position)
    }
    // this.bboxHelper.update()
    this.control.attach(this.group)
  }

  reset () {
    const groupChildren = [...this.group.children]
    for (let i = 0; i < groupChildren.length; i++) {
      groupChildren[i].originalParent.attach(groupChildren[i])
      delete groupChildren[i].originalParent
    }
    this.group.clear()
    this.group.layers.set(constants.LAYER_HIDDEN)
    // this.bboxHelper.layers.set(constants.LAYER_HIDDEN)
    this.control.detach()
  }

  setModeTranslate () {
    this.control.setMode("translate")
    this.control.showX = true
    this.control.showY = false
    this.control.showZ = true
  }

  setModeRotate () {
    this.control.setMode("rotate")
    this.control.showX = false
    this.control.showY = true
    this.control.showZ = false
  }
}
