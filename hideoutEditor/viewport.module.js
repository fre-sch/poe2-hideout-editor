import * as THREE from "three"
import { MapControls } from "three/addons/controls/MapControls.js"

import * as constants from "hideoutEditor/constants.module.js"
import * as util from "hideoutEditor/util.module.js"
import { TransformControl } from "hideoutEditor/transformControl.module.js"
import { Selection } from "hideoutEditor/selection.module.js"
import { viewportMode } from "hideoutEditor/gui/state.module.js"

const GRID_AXIS_PRIMARY_COLOR = 0x407090
const GRID_AXIS_SECONDARY_COLOR = 0x204070
const GRID_SIZE = 500
const GRID_DIVISION = GRID_SIZE / 10

export class Viewport extends EventTarget {
  constructor(containerElem, canvasElem, scene) {
    super()

    this.containerElem = containerElem
    this.canvasElem = canvasElem
    this.viewportRect = this.canvasElem.getBoundingClientRect()
    this.scene = scene

    this.initRenderer()
    this.initCameras()
    this.initGridHelper()
    this.initViewControls()
    this.initTransformControls()
    this.initSelection()

    window.addEventListener("resize", this.onWindowResize)
    window.addEventListener("keydown", this.onKeyDown)
  }

  onKeyDown = (event) => {
    switch (event.key) {
      case "Delete":
        this.deleteSelection()
        break
      case "Escape":
      case "1":
        viewportMode.value = "select"
        break
      case "2":
        viewportMode.value = "translate"
        break
      case "3":
        viewportMode.value = "rotate"
        break
      case "f":
        const target = new THREE.Vector3()
        this.selection.bbox.getCenter(target)
        this.setCameraTarget(target)
        break
    }
  }

  initRenderer () {
    this.viewportRect = this.containerElem.getBoundingClientRect()
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      canvas: this.canvasElem
    })
    this.renderer.setPixelRatio(window.devicePixelRatio)
    this.renderer.setSize(this.viewportRect.width, this.viewportRect.height)
  }

  initTransformControls () {
    this.transformControl = new TransformControl(this)
  }

  initViewControls () {
    this.viewControl = new MapControls(this.camera, this.renderer.domElement)
    this.viewControl.mouseButtons = {
      LEFT: null,
      MIDDLE: THREE.MOUSE.PAN,
      RIGHT: THREE.MOUSE.ROTATE,
    }
    this.viewControl.update()
    this.viewControl.addEventListener("change",() => this.render())
  }

  initCameras () {
    const aspect = window.innerWidth / window.innerHeight
    const frustumSize = 5
    this.cameraPersp = new THREE.PerspectiveCamera(50, aspect, 0.1, 1000)
    this.cameraPersp.layers.enable(constants.LAYER_DEFAULT)
    this.cameraPersp.layers.enable(constants.LAYER_GIZMOS)
    this.cameraPersp.layers.enable(constants.LAYER_PICKABLE)
    this.camera = this.cameraPersp
    this.camera.position.set(50, 50, 50)
  }

  initGridHelper () {
    this.gridHelper = new THREE.GridHelper(
      GRID_SIZE, GRID_DIVISION, GRID_AXIS_PRIMARY_COLOR, GRID_AXIS_SECONDARY_COLOR
    )
    this.gridHelper.layers.set(constants.LAYER_GIZMOS)
    this.scene.add(this.gridHelper)
    this.gridHelper.add(util.axisHelper(4))
  }

  initSelection () {
    this.selection = new Selection(
      this,
      "selectBox",
      [constants.LAYER_PICKABLE]
    )
    this.selection.addEventListener("changed", () => {
      this.render()
    })
  }

  setMode (value) {
    if (value === "select") {
      this.setModeSelect()
    }
    else if (value === "translate") {
      this.setModeTranslate()
    }
    else if (value === "rotate") {
      this.setModeRotate()
    }
  }

  setModeSelect () {
    this.transformControl.reset()
    this.selection.setEnabled(true)
    this.render()
  }

  setModeTranslate = () => {
    this.transformControl.reset()
    this.selection.setEnabled(false)
    this.transformControl.setModeTranslate()
    this.transformControl.setChildren(this.selection.getSelected())
    this.render()
  }

  setModeRotate = () => {
    this.transformControl.reset()
    this.selection.setEnabled(false)
    this.transformControl.setModeRotate()
    this.transformControl.setChildren(this.selection.getSelected())
    this.render()
  }

  setCameraTarget (position) {
    // camoffset = -target + camera
    // campos = position + camoffset
    const cameraPosition = new THREE.Vector3()

    cameraPosition.copy(this.viewControl.object.position)
    cameraPosition.sub(this.viewControl.target)
    cameraPosition.add(position)

    this.viewControl.target.copy(position)
    this.viewControl.object.position.copy(cameraPosition)
    this.viewControl.update()

    // this.gridHelper.position.copy(position)
  }

  deleteSelection () {
    const selected = this.selection.getSelected()
    for (let i = 0; i < selected.length; i++) {
      selected[i].removeFromParent()
      selected[i].clear()
      this.scene.remove(selected[i])
    }
    this.render()
  }

  render () {
    this.renderer.render(this.scene, this.camera)
  }

  onWindowResize = () => {
    const clientRect = this.containerElem.getBoundingClientRect()
    const aspect = clientRect.width / clientRect.height
    this.viewportRect = clientRect
    this.cameraPersp.aspect = aspect
    this.cameraPersp.updateProjectionMatrix()
    this.renderer.setSize(clientRect.width, clientRect.height)
    this.render()
  }

}
