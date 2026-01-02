import * as THREE from "three"
import * as constants from "hideoutEditor/constants.module.js"
import * as util from "hideoutEditor/util.module.js"
import * as bounds from "hideoutEditor/bounds.module.js"

const POE_TO_RADIAN = (2 * Math.PI) / 65536
const RADIAN_TO_POE = 65536 / (2 * Math.PI)
const RAD2DEG = 180 / Math.PI

export class Hideout {
  constructor() {
    this.sceneObj = new THREE.Group()
    this.sceneObj.name = "HideoutGroup"
    this.sceneObj.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI)
    this.geometry = null
    this.objectColors = {
      normal: 0x008080,
      selected: 0xC0C000,
    }
    this.lineColors = {
      normal: 0x00FFFF,
      selected: 0xFFFF00,
    }
    this.bbox = new THREE.Box3()
    this.numDoodads = 0
  }

  createBoundsVisual (hideoutData) {
    const obj = bounds.fromHideoutHash("" + hideoutData.hideout_hash)
    if (obj !== undefined) {
      this.sceneObj.add(obj)
    }
  }

  load (hideoutData) {
    this.sceneObj.userData = hideoutData
    this.bbox.makeEmpty()
    this.sceneObj.clear()
    this.createBoundsVisual(hideoutData)
    for (const doodadItem of hideoutData.doodads) {
      const [doodadName, doodadData] = doodadItem

      const doodadObj = new THREE.Group()
      doodadObj.userData = { ...doodadData, isDoodad: true }
      this.makeDoodadVisual(doodadObj, doodadName)
      doodadObj.setSelected = (selected) => {
        if (selected) {
          doodadObj?.children[0]?.material.color.setHex(this.objectColors.selected)
          doodadObj?.children[1]?.material.color.setHex(this.lineColors.selected)
        }
        else {
          doodadObj?.children[0]?.material.color.setHex(this.objectColors.normal)
          doodadObj?.children[1]?.material.color.setHex(this.lineColors.normal)
        }
      }
      doodadObj.name = doodadName
      doodadObj.position.set(doodadData.y, 0, doodadData.x)
      doodadObj.rotation.y = doodadData.r * POE_TO_RADIAN
      doodadObj.layers.set(constants.LAYER_PICKABLE)
      this.sceneObj.add(doodadObj)
    }
    this.bbox.setFromObject(this.sceneObj)
    const bboxCenter = new THREE.Vector3()
    this.bbox.getCenter(bboxCenter)
    return bboxCenter
  }

  makeLabel (doodadName) {
    const canvas = util.makeLabelCanvas(48, doodadName)
    const texture = new THREE.CanvasTexture(canvas)
    const label = new THREE.Sprite(new THREE.SpriteMaterial({
      map: texture,
      side: THREE.DoubleSide,
      transparent: false,
      depthTest: false
    }))
    label.renderOrder = 999
    const labelScale = 0.005
    label.scale.x = canvas.width * labelScale
    label.scale.y = canvas.height * labelScale
    label.position.y = -0.2
    label.layers.set(constants.LAYER_GIZMOS)
    return label
  }

  makeDoodadVisual (parent, name) {
    const label = this.makeLabel(name)
    const mesh = new THREE.Mesh(this.geometry,
      new THREE.MeshBasicMaterial({ color: this.objectColors.normal })
    )
    const edges = new THREE.EdgesGeometry(this.geometry)
    const lines = new THREE.LineSegments(edges,
      new THREE.LineBasicMaterial({ color: this.lineColors.normal })
    )
    mesh.renderOrder = 90
    lines.renderOrder = 99
    parent.add(mesh)
    parent.add(lines)
    parent.add(label)
  }

  attach (scene) {
    scene.add(this.sceneObj)
  }

  serializeHideoutData () {
    const hideoutData = JSON.parse(JSON.stringify(this.sceneObj.userData))
    hideoutData.doodads = []
    let euler = new THREE.Euler()
    let child
    for (let i = 0; i < this.sceneObj.children.length; i++) {
      child = this.sceneObj.children[i]
      if (!child.userData.isDoodad) continue
      euler.setFromQuaternion(child.quaternion, "YXZ")
      const { isDoodad, ...doodad } = child.userData
      doodad.x = Math.round(child.position.z)
      doodad.y = Math.round(child.position.x)
      doodad.r = (Math.round(euler.y * RADIAN_TO_POE) + 65536) % 65536
      hideoutData.doodads.push([child.name, doodad])
    }
    return hideoutData
  }
}
